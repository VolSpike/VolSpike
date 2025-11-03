import { useState, useEffect, useRef, useCallback } from 'react';

const parseFundingRate = (raw: any): number => {
    if (!raw) return 0;

    const candidates = [
        raw.r,
        raw.R,
        raw.lastFundingRate,
        raw.fr,
        raw.fundingRate,
        raw.estimatedSettlePriceRate,
    ];

    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;

        const numeric =
            typeof candidate === 'number'
                ? candidate
                : Number(candidate);

        if (!Number.isNaN(numeric)) {
            return numeric;
        }
    }

    return 0;
};

interface MarketData {
    symbol: string;
    price: number;
    volume24h: number;
    change24h?: number;
    volumeChange?: number;
    fundingRate: number;
    openInterest: number;
    timestamp: number;
}

interface UseClientOnlyMarketDataProps {
    tier: 'elite' | 'pro' | 'free';
    onDataUpdate?: (data: MarketData[]) => void;
}

export function useClientOnlyMarketData({ tier, onDataUpdate }: UseClientOnlyMarketDataProps) {
    const [data, setData] = useState<MarketData[]>([]);
    const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting');
    const [lastUpdate, setLastUpdate] = useState<number>(0);
    const [nextUpdate, setNextUpdate] = useState<number>(0);

    const wsRef = useRef<WebSocket | null>(null);
    const onDataUpdateRef = useRef<typeof onDataUpdate>(onDataUpdate);
    const tickersRef = useRef<Map<string, any>>(new Map());
    const fundingRef = useRef<Map<string, any>>(new Map());
    const allowedSymbolsRef = useRef<Set<string> | null>(null);
    const lastRenderRef = useRef<number>(0);
    const firstPaintDoneRef = useRef<boolean>(false);
    const connectedAtRef = useRef<number>(0);
    const bootstrapWindowMs = 2500; // gather symbols before first paint
    const minBootstrapSymbols = 50; // wait for at least this many if possible
    const reconnectAttemptsRef = useRef<number>(0);
    const renderPendingRef = useRef<boolean>(false);

    // Tier-based update intervals
    const CADENCE = tier === 'elite' ? 0 : (tier === 'pro' ? 300_000 : 900_000); // 0ms, 5min, 15min

    // Calculate next wall-clock update time
    const getNextWallClockUpdate = useCallback(() => {
        if (tier === 'elite') return 0; // Elite is real-time
        
        const now = new Date();
        const currentMinute = now.getMinutes();
        
        if (tier === 'pro') {
            // Pro: next :00, :05, :10, etc.
            const nextMinute = Math.ceil((currentMinute + 1) / 5) * 5;
            const next = new Date(now);
            next.setMinutes(nextMinute, 0, 0);
            return next.getTime();
        } else {
            // Free: next :00, :15, :30, :45
            const nextMinute = Math.ceil((currentMinute + 1) / 15) * 15;
            const next = new Date(now);
            next.setMinutes(nextMinute, 0, 0);
            return next.getTime();
        }
    }, [tier]);

    // Keep callback stable via ref to avoid effect/deps churn
    useEffect(() => {
        onDataUpdateRef.current = onDataUpdate;
    }, [onDataUpdate]);

    const buildSnapshot = useCallback((): MarketData[] => {
        const out: MarketData[] = [];

        for (const [sym, t] of Array.from(tickersRef.current.entries())) {
            // Filter for USDT perpetual pairs only
            if (!sym.endsWith('USDT')) continue;
            // If we have an allowlist from exchangeInfo, require membership
            if (allowedSymbolsRef.current && !allowedSymbolsRef.current.has(sym)) continue;

            const volume24h = Number(t.q || t.quoteVolume || t.v || 0);

            // Filter for >$100M in 24h volume
            if (volume24h < 100_000_000) continue;

            const f = fundingRef.current.get(sym);
            const fundingRate = parseFundingRate(f);
            out.push({
                symbol: sym,
                price: Number(t.c || t.lastPrice || 0),
                volume24h: volume24h,
                change24h: Number(t.P || t.priceChangePercent || 0),
                fundingRate,
                openInterest: 0, // Not available in ticker stream
                timestamp: Date.now(),
            });
        }

        // Sort by volume (highest to lowest) - no limit, show all qualifying pairs
        out.sort((a, b) => b.volume24h - a.volume24h);
        return out;
    }, []);

    const render = useCallback((snapshot: MarketData[]) => {
        setData(snapshot);
        setLastUpdate(Date.now());

        // Save to localStorage for fallback
        try {
            localStorage.setItem('volspike:lastSnapshot', JSON.stringify({
                t: Date.now(),
                rows: snapshot
            }));
        } catch { }

        // Call latest callback if provided (stable via ref)
        if (onDataUpdateRef.current) {
            try {
                onDataUpdateRef.current(snapshot);
            } catch {
                // swallow callback errors to not break render pipeline
            }
        }
    }, []);

    const primeFundingSnapshot = useCallback(async () => {
        try {
            const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
            if (!response.ok) return;

            const payload = await response.json();
            if (!Array.isArray(payload)) return;

            let seeded = false;

            for (const entry of payload) {
                if (typeof entry?.symbol !== 'string' || !entry.symbol.endsWith('USDT')) continue;

                fundingRef.current.set(entry.symbol, {
                    s: entry.symbol,
                    r: entry.lastFundingRate ?? entry.r,
                    lastFundingRate: entry.lastFundingRate,
                });

                seeded = true;
            }

            if (seeded && tickersRef.current.size > 0) {
                const snapshot = buildSnapshot();
                if (snapshot.length > 0) {
                    render(snapshot);
                    lastRenderRef.current = Date.now();
                    if (tier !== 'elite') {
                        setNextUpdate(getNextWallClockUpdate());
                    }
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to seed funding rates from REST:', error);
            }
        }
    }, [buildSnapshot, render, tier, CADENCE]);

    // Fetch active perpetual USDT symbols to exclude delisted/expired contracts
    const primeActiveSymbols = useCallback(async () => {
        try {
            // Cache to localStorage for 1 hour to reduce requests
            const cacheKey = 'volspike:exchangeInfo:perpUsdt';
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.t && Date.now() - parsed.t < 60 * 60 * 1000 && Array.isArray(parsed.list)) {
                    allowedSymbolsRef.current = new Set(parsed.list);
                }
            }

            const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
            if (!response.ok) return;
            const info = await response.json();
            const list: string[] = [];
            for (const s of info?.symbols || []) {
                if (
                    s?.contractType === 'PERPETUAL' &&
                    s?.quoteAsset === 'USDT' &&
                    s?.status === 'TRADING' &&
                    typeof s?.symbol === 'string'
                ) {
                    list.push(s.symbol);
                }
            }
            if (list.length) {
                allowedSymbolsRef.current = new Set(list);
                try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), list })); } catch {}
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to fetch exchangeInfo (allowlist):', error);
            }
        }
    }, []);

    // Optionally seed tickers map with a one-shot 24h ticker REST call to avoid
    // missing symbols right after connect (some browsers may not process the
    // first !ticker@arr payload fast enough and tier throttling would freeze it).
    const primeTickersSnapshot = useCallback(async () => {
        try {
            const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
            if (!response.ok) return;
            const payload = await response.json();
            if (!Array.isArray(payload)) return;

            let seeded = 0;
            for (const entry of payload) {
                const sym = entry?.symbol;
                if (typeof sym !== 'string' || !sym.endsWith('USDT')) continue;
                tickersRef.current.set(sym, entry);
                seeded++;
            }

            if (seeded > 0) {
                const snapshot = buildSnapshot();
                // Only render if we are still within the bootstrap window and before first paint
                const now = Date.now();
                if (!firstPaintDoneRef.current && (now - connectedAtRef.current <= bootstrapWindowMs)) {
                    render(snapshot);
                    // Do NOT mark first paint done here; allow WebSocket to refine within window
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to seed tickers from REST:', error);
            }
        }
    }, [buildSnapshot, render]);

    const geofenceFallback = useCallback(() => {
        console.log('Region may be blocked, trying localStorage fallback');

        try {
            const raw = localStorage.getItem('volspike:lastSnapshot');
            if (raw) {
                const { rows } = JSON.parse(raw);
                if (rows?.length) {
                    render(rows);
                    setStatus('error');
                    return;
                }
            }
        } catch { }

        setStatus('error');
    }, [render]);

    const connect = useCallback(() => {
        // Use environment variable for WebSocket URL, fallback to Binance direct
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr';

        try {
            console.log('🔌 Connecting to WebSocket:', WS_URL);
            wsRef.current = new WebSocket(WS_URL);
            let opened = false;

            wsRef.current.onopen = () => {
                opened = true;
                reconnectAttemptsRef.current = 0;
                setStatus('live');
                console.log('✅ Binance WebSocket connected');
                connectedAtRef.current = Date.now();
                firstPaintDoneRef.current = false; // reset on each connect

                // Initialize countdown for non-elite tiers
                if (tier !== 'elite') {
                    setNextUpdate(getNextWallClockUpdate());
                }

                void primeFundingSnapshot();
                void primeActiveSymbols();
                // Warm start: try to seed from REST in parallel (best-effort)
                void primeTickersSnapshot();
            };

            wsRef.current.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    const payload = msg?.data ?? msg;
                    const arr = Array.isArray(payload) ? payload : [payload];

                    // Process ticker data
                    for (const it of arr) {
                        if (it?.e === '24hrTicker' || it?.c || it?.v) {
                            tickersRef.current.set(it.s, it);
                        }
                        if (
                            it?.r !== undefined ||
                            it?.R !== undefined ||
                            it?.fr !== undefined ||
                            it?.lastFundingRate !== undefined
                        ) {
                            fundingRef.current.set(it.s, it);

                            // Debug logging for funding rate data
                            if (msg.stream === '!markPrice@arr') {
                                console.log('📊 MarkPrice data:', {
                                    symbol: it.s,
                                    r: it.r,
                                    R: it.R,
                                    fr: it.fr,
                                    lastFundingRate: it.lastFundingRate,
                                    parsed: parseFundingRate(it)
                                });
                            }
                        }
                    }

                    const snapshot = buildSnapshot();
                    const now = Date.now();

                    // Bootstrap: before first paint, gather a fuller set to avoid missing symbols
                    if (!firstPaintDoneRef.current) {
                        const elapsed = now - connectedAtRef.current;
                        // If enough symbols collected OR bootstrap window elapsed, paint
                        if (snapshot.length >= minBootstrapSymbols || elapsed >= bootstrapWindowMs) {
                            render(snapshot);
                            firstPaintDoneRef.current = true;
                            lastRenderRef.current = now;
                            // For non-elite tiers, set countdown to next wall-clock time
                            if (tier !== 'elite') {
                                setNextUpdate(getNextWallClockUpdate());
                            }
                            return;
                        }
                        // Otherwise keep accumulating without rendering
                    }

                    // Elite tier - render with debouncing
                    if (tier === 'elite') {
                        if (!renderPendingRef.current) {
                            renderPendingRef.current = true;
                            setTimeout(() => {
                                render(snapshot);
                                renderPendingRef.current = false;
                            }, 200); // 200ms debounce
                        }
                    }
                    // Pro/Free tiers - render based on cadence
                    else if (now - lastRenderRef.current >= CADENCE) {
                        render(snapshot);
                        lastRenderRef.current = now;
                    }

                    // Update next update countdown to next wall-clock time
                    if (tier !== 'elite') {
                        setNextUpdate(getNextWallClockUpdate());
                    }

                } catch (error) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn('Error processing WebSocket message (non-fatal):', error);
                    }
                }
            };

            wsRef.current.onerror = (evt) => {
                // Chrome often gives an empty object. Add context. Noise in dev.
                if (process.env.NODE_ENV === 'development') {
                    console.warn('WebSocket warning (likely handshake or transient issue)', {
                        url: WS_URL,
                        readyState: wsRef.current?.readyState,
                        event: evt
                    });
                }
                setStatus('error');
            };

            wsRef.current.onclose = (evt) => {
                setStatus('reconnecting');
                console.warn('WebSocket closed', {
                    code: evt.code,
                    reason: evt.reason,
                    url: WS_URL
                });

                // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s
                const delay = Math.min(30_000, (2 ** reconnectAttemptsRef.current) * 1000);
                reconnectAttemptsRef.current++;

                setTimeout(() => {
                    if (wsRef.current?.readyState === WebSocket.CLOSED) {
                        connect();
                    }
                }, delay);
            };

            // If it never opens (geofence), show fallback after 5s
            setTimeout(() => {
                if (!opened && wsRef.current?.readyState !== WebSocket.OPEN) {
                    geofenceFallback();
                }
            }, 5000);

        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to connect to WebSocket (will retry):', error);
            }
            setStatus('error');
        }
    }, [tier, CADENCE, geofenceFallback, primeFundingSnapshot, primeActiveSymbols, primeTickersSnapshot, render, getNextWallClockUpdate]);

    useEffect(() => {
        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [tier, connect]);

    // Update countdown timer
    useEffect(() => {
        if (tier === 'elite' || nextUpdate === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            if (now >= nextUpdate) {
                setNextUpdate(0);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [nextUpdate, tier]);

    return {
        data,
        status,
        lastUpdate,
        nextUpdate,
        isLive: status === 'live',
        isConnecting: status === 'connecting',
        isReconnecting: status === 'reconnecting',
        hasError: status === 'error',
    };
}
