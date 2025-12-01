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
    precision?: number; // number of decimals to use for stable formatting
}

interface UseClientOnlyMarketDataProps {
    tier: 'elite' | 'pro' | 'free';
    onDataUpdate?: (data: MarketData[]) => void;
    watchlistSymbols?: string[]; // Symbols to always include, bypassing tier limits
}

export function useClientOnlyMarketData({ tier, onDataUpdate, watchlistSymbols = [] }: UseClientOnlyMarketDataProps) {
    const [data, setData] = useState<MarketData[]>([]);
    const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting');
    const [lastUpdate, setLastUpdate] = useState<number>(0);
    const [nextUpdate, setNextUpdate] = useState<number>(0);

    const wsRef = useRef<WebSocket | null>(null);
    const onDataUpdateRef = useRef<typeof onDataUpdate>(onDataUpdate);
    const tickersRef = useRef<Map<string, any>>(new Map());
    const fundingRef = useRef<Map<string, any>>(new Map());
    const openInterestRef = useRef<Map<string, number>>(new Map()); // Symbol -> OI in USD
    const openInterestAsOfRef = useRef<number>(0); // Last OI timestamp (asOf) from backend
    const openInterestFetchedAtRef = useRef<number>(0); // Last successful fetch time (client)
    const allowedSymbolsRef = useRef<Set<string> | null>(null);
    const symbolPrecisionRef = useRef<Map<string, number>>(new Map()); // Symbol -> decimals
    const lastRenderRef = useRef<number>(0);
    const firstPaintDoneRef = useRef<boolean>(false);
    const connectedAtRef = useRef<number>(0);
    const bootstrapWindowMs = 900; // faster first paint to reduce perceived latency
    const minBootstrapSymbols = 30; // still aim for a reasonable set
    const reconnectAttemptsRef = useRef<number>(0);
    const renderPendingRef = useRef<boolean>(false);
    // Use ref for watchlistSymbols to prevent WebSocket reconnection when it changes
    const watchlistSymbolsRef = useRef<string[]>(watchlistSymbols);

    // Update watchlistSymbols ref when it changes (without triggering reconnection)
    // Also trigger immediate render if watchlist symbols are provided
    useEffect(() => {
        watchlistSymbolsRef.current = watchlistSymbols;
    }, [watchlistSymbols]);

    // Normalize symbol: remove dashes/underscores and convert to uppercase
    const normalizeSym = useCallback((s: string): string => {
        return s.replace(/[-_]/g, '').toUpperCase();
    }, []);

    // All tiers now get real-time WebSocket data (Open Interest still fetches every 5min separately)

    // Keep callback stable via ref to avoid effect/deps churn
    useEffect(() => {
        onDataUpdateRef.current = onDataUpdate;
    }, [onDataUpdate]);

    const buildSnapshot = useCallback((): MarketData[] => {
        const out: MarketData[] = [];
        const oiLookupDebug: Array<{symbol: string, normalized: string, found: boolean, value: number}> = [];

        for (const [sym, t] of Array.from(tickersRef.current.entries())) {
            // Filter for USDT perpetual pairs only
            if (!sym.endsWith('USDT')) continue;
            // If we have an allowlist from exchangeInfo, require membership
            if (allowedSymbolsRef.current && !allowedSymbolsRef.current.has(sym)) continue;

            const volume24h = Number(t.q || t.quoteVolume || t.v || 0);

            const f = fundingRef.current.get(sym);
            const fundingRate = parseFundingRate(f);
            
            // Get Open Interest from ref (fetched from backend)
            // Normalize symbol consistently for matching
            const normalizedSym = normalizeSym(sym);
            const openInterest = openInterestRef.current.get(normalizedSym) || 0;
            
            // Debug first 10 lookups
            if (oiLookupDebug.length < 10) {
                oiLookupDebug.push({
                    symbol: sym,
                    normalized: normalizedSym,
                    found: openInterestRef.current.has(normalizedSym),
                    value: openInterest
                });
            }
            
            const prec = symbolPrecisionRef.current.get(sym) ?? 2;
            out.push({
                symbol: sym,
                price: Number(t.c || t.lastPrice || 0),
                volume24h: volume24h,
                change24h: Number(t.P || t.priceChangePercent || 0),
                fundingRate,
                openInterest, // From backend (via Digital Ocean script)
                timestamp: Date.now(),
                precision: prec,
            });
        }

        // OI lookup debug info (removed console.log per user request)

        // Sort by volume (highest to lowest)
        out.sort((a, b) => b.volume24h - a.volume24h);
        
        // Normalize watchlist symbols for matching (always include these, bypassing tier limits)
        // Use ref to avoid recreating buildSnapshot when watchlistSymbols changes
        const normalizedWatchlistSymbols = watchlistSymbolsRef.current.map(s => normalizeSym(s));
        
        // Create a Set of normalized watchlist symbols for fast lookup
        const normalizedWatchlistSet = new Set(normalizedWatchlistSymbols);
        
        if (normalizedWatchlistSymbols.length > 0) {
            console.log(`[buildSnapshot] Watchlist symbols requested:`, normalizedWatchlistSymbols);
            console.log(`[buildSnapshot] Total symbols in WebSocket:`, out.length);
            console.log(`[buildSnapshot] Normalized watchlist set size:`, normalizedWatchlistSet.size);
        }
        
        // Separate watchlist symbols from others
        const watchlistItems: MarketData[] = [];
        const otherItems: MarketData[] = [];
        
        // Check which watchlist symbols are actually in the WebSocket data
        const foundWatchlistSymbols: string[] = [];
        const missingWatchlistSymbols: string[] = [];
        
        for (const item of out) {
            const normalizedSym = normalizeSym(item.symbol);
            if (normalizedWatchlistSet.has(normalizedSym)) {
                watchlistItems.push(item);
                foundWatchlistSymbols.push(item.symbol);
            } else {
                otherItems.push(item);
            }
        }
        
        // Debug: Verify separation worked correctly
        if (normalizedWatchlistSymbols.length > 0 && process.env.NODE_ENV === 'development') {
            const watchlistSymbolSet = new Set(watchlistItems.map(item => normalizeSym(item.symbol)));
            const duplicatesInOther = otherItems.filter(item => 
                watchlistSymbolSet.has(normalizeSym(item.symbol))
            );
            if (duplicatesInOther.length > 0) {
                console.error(`[buildSnapshot] ❌ SEPARATION BUG: Found ${duplicatesInOther.length} watchlist symbols in otherItems:`, 
                    duplicatesInOther.map(item => item.symbol));
            } else {
                console.log(`[buildSnapshot] ✅ Separation correct: ${watchlistItems.length} watchlist items, ${otherItems.length} other items, 0 duplicates`);
            }
        }
        
        // Check for missing watchlist symbols
        for (const requestedSym of normalizedWatchlistSymbols) {
            if (!foundWatchlistSymbols.some(found => normalizeSym(found) === requestedSym)) {
                missingWatchlistSymbols.push(requestedSym);
            }
        }
        
        if (missingWatchlistSymbols.length > 0) {
            console.warn(`[buildSnapshot] ⚠️ Watchlist symbols NOT in WebSocket data:`, missingWatchlistSymbols);
            console.warn(`[buildSnapshot] These symbols may not be trading or may be delisted`);
        }
        
        if (watchlistItems.length > 0) {
            console.log(`[buildSnapshot] ✅ Found ${watchlistItems.length} watchlist symbols in WebSocket:`, foundWatchlistSymbols);
        }
        
        // Debug: Verify separation worked correctly (ALWAYS log, not just in development)
        if (normalizedWatchlistSymbols.length > 0) {
            const watchlistSymbolSet = new Set(watchlistItems.map(item => normalizeSym(item.symbol)));
            const duplicatesInOther = otherItems.filter(item => 
                watchlistSymbolSet.has(normalizeSym(item.symbol))
            );
            if (duplicatesInOther.length > 0) {
                console.error(`[buildSnapshot] ❌ SEPARATION BUG: Found ${duplicatesInOther.length} watchlist symbols in otherItems:`, 
                    duplicatesInOther.map(item => item.symbol));
            } else {
                console.log(`[buildSnapshot] ✅ Separation correct: ${watchlistItems.length} watchlist items, ${otherItems.length} other items, 0 duplicates in otherItems`);
            }
        }
        
        // Apply tier-based limits to non-watchlist items only
        const tierLimits = {
            free: 50,
            pro: 100,
            elite: otherItems.length // Elite gets all symbols
        };
        const limit = tierLimits[tier as keyof typeof tierLimits] || 50;
        const limitedOtherItems = otherItems.slice(0, limit);
        
        // Debug: Check if any watchlist symbols are in limitedOtherItems (they shouldn't be)
        if (normalizedWatchlistSymbols.length > 0) {
            const watchlistSymbolSet = new Set(watchlistItems.map(item => normalizeSym(item.symbol)));
            const duplicatesInLimited = limitedOtherItems.filter(item => 
                watchlistSymbolSet.has(normalizeSym(item.symbol))
            );
            if (duplicatesInLimited.length > 0) {
                console.error(`[buildSnapshot] ❌ Found ${duplicatesInLimited.length} watchlist symbols in limitedOtherItems (top ${limit}):`, 
                    duplicatesInLimited.map(item => item.symbol));
            } else {
                console.log(`[buildSnapshot] ✅ No duplicates in limitedOtherItems (top ${limit}): ${limitedOtherItems.length} items`);
            }
        }
        
        // Combine: watchlist items first (always included), then limited other items
        // Remove duplicates (watchlist symbols should already be excluded from otherItems, but double-check)
        const combined = [...watchlistItems];
        const watchlistSymbolSet = new Set(watchlistItems.map(item => normalizeSym(item.symbol)));
        
        // Debug: Log watchlist symbols for comparison
        if (normalizedWatchlistSymbols.length > 0) {
            console.log(`[buildSnapshot] Watchlist symbols in Set:`, Array.from(watchlistSymbolSet));
            
            // Check ALL symbols in limitedOtherItems for duplicates
            const duplicatesFound = limitedOtherItems.filter(item => 
                watchlistSymbolSet.has(normalizeSym(item.symbol))
            );
            
            if (duplicatesFound.length > 0) {
                console.error(`[buildSnapshot] ❌ FOUND ${duplicatesFound.length} WATCHLIST SYMBOLS IN limitedOtherItems:`, 
                    duplicatesFound.map(item => item.symbol));
            } else {
                console.log(`[buildSnapshot] ✅ Verified: No watchlist symbols found in limitedOtherItems (checked all ${limitedOtherItems.length} items)`);
            }
            
            // Show first 10 for reference
            console.log(`[buildSnapshot] First 10 symbols in limitedOtherItems:`, limitedOtherItems.slice(0, 10).map(item => ({
                original: item.symbol,
                normalized: normalizeSym(item.symbol),
                inSet: watchlistSymbolSet.has(normalizeSym(item.symbol))
            })));
        }
        
        let addedOtherItems = 0;
        let skippedDuplicates = 0;
        for (const item of limitedOtherItems) {
            const normalizedItemSym = normalizeSym(item.symbol);
            if (watchlistSymbolSet.has(normalizedItemSym)) {
                // This shouldn't happen if separation worked correctly - log as error
                skippedDuplicates++;
                console.error(`[buildSnapshot] ❌ DUPLICATE FOUND: ${item.symbol} (normalized: ${normalizedItemSym}) is in both watchlistItems and limitedOtherItems`);
            } else {
                combined.push(item);
                addedOtherItems++;
            }
        }
        
        if (normalizedWatchlistSymbols.length > 0) {
            console.log(`[buildSnapshot] Final combined result: ${combined.length} unique items (${watchlistItems.length} watchlist + ${addedOtherItems} other, ${skippedDuplicates} duplicates skipped)`);
            if (skippedDuplicates > 0) {
                console.error(`[buildSnapshot] ❌ SEPARATION FAILED: Found ${skippedDuplicates} duplicates - watchlist symbols are in both lists!`);
            }
        }
        
        return combined;
    }, [tier, normalizeSym]); // Removed watchlistSymbols from deps - using ref instead
    
    // Expose buildSnapshot for immediate calls when watchlist changes
    const buildSnapshotRef = useRef(buildSnapshot);
    buildSnapshotRef.current = buildSnapshot;

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
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to seed funding rates from REST:', error);
            }
        }
    }, [buildSnapshot, render, tier]);

    // Fetch Open Interest from VolSpike backend (sourced from Digital Ocean script)
    const fetchOpenInterest = useCallback(async () => {
        try {
            // Resolve backend base URL robustly
            let apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
            const socketUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || ''
            let socketOrigin = ''
            try { socketOrigin = socketUrl ? new URL(socketUrl).origin : '' } catch {}

            // If API URL is missing or points to localhost in prod, fall back to Socket.IO origin
            const isLocalhost = (u: string) => u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1')
            if ((!apiUrl || isLocalhost(apiUrl)) && socketOrigin) {
                apiUrl = socketOrigin
            }
            // Final fallback (dev): localhost
            if (!apiUrl) {
                apiUrl = 'http://localhost:3001'
            }

            const fetchUrl = `${apiUrl}/api/market/open-interest`;

            const response = await fetch(fetchUrl);
            
            if (!response.ok) {
                // Silently handle fetch errors - will retry on next interval
                return;
            }

            const payload = await response.json();
            
            const data = payload?.data ?? {};
            const keys = Object.keys(data);
            
            // Only update ref if we actually have keys (never overwrite with empty {})
            if (keys.length > 0) {
                // Normalize all keys and store in map
                const newMap = new Map<string, number>();
                let matchedCount = 0;
                const unmatchedSamples: string[] = [];
                const matchedSamples: string[] = [];
                
                for (const [symbol, oiUsd] of Object.entries(data)) {
                    if (typeof oiUsd === 'number' && oiUsd > 0) {
                        const normalizedKey = normalizeSym(symbol);
                        newMap.set(normalizedKey, oiUsd);
                        
                        // Check if we have this symbol in tickers
                        // Tickers are stored with raw symbols from Binance, so check both normalized and raw
                        // Also check all ticker keys to see if any match (in case of case/format differences)
                        let foundInTickers = false;
                        const normalizedTickerKeys = Array.from(tickersRef.current.keys()).map(k => normalizeSym(k));
                        
                        if (tickersRef.current.has(normalizedKey) || 
                            tickersRef.current.has(symbol) ||
                            normalizedTickerKeys.includes(normalizedKey)) {
                            foundInTickers = true;
                            matchedCount++;
                            if (matchedSamples.length < 5) {
                                matchedSamples.push(`${symbol} -> ${normalizedKey} (OI: $${oiUsd.toLocaleString()})`);
                            }
                        } else {
                            if (unmatchedSamples.length < 5) {
                                unmatchedSamples.push(`${symbol} -> ${normalizedKey}`);
                            }
                        }
                    }
                }
                
                // Processing OI data (debug logs removed)
                
                // Update ref with new data
                openInterestRef.current = newMap;
                openInterestAsOfRef.current = payload?.asOf ?? Date.now();
                openInterestFetchedAtRef.current = Date.now();
                
                // Persist to localStorage for next reload
                try {
                    localStorage.setItem('vs:openInterest', JSON.stringify({
                        data: Object.fromEntries(newMap),
                        asOf: payload?.asOf ?? Date.now()
                    }));
                } catch (e) {
                    // localStorage might be full or disabled, ignore
                }
                
                // OI cache updated (debug logs removed)

                // Always re-render with updated OI data (even if tickers aren't loaded yet, they'll be matched later)
                const snapshot = buildSnapshot();
                if (snapshot.length > 0) {
                    render(snapshot);
                }
            } else {
                // No clobbering! Keep existing ref so UI doesn't flip to 0s
                // Received empty data, keeping existing cache
            }
        } catch (error) {
            // Silently handle fetch errors - will retry on next interval
        }
    }, [buildSnapshot, render, normalizeSym]);

    // Fetch active perpetual USDT symbols to exclude delisted/expired contracts
    const primeActiveSymbols = useCallback(async () => {
        try {
            // Cache to localStorage for 1 hour to reduce requests
            const cacheKey = 'volspike:exchangeInfo:perpUsdt';
            const precCacheKey = 'volspike:exchangeInfo:precision';
            const cached = localStorage.getItem(cacheKey);
            const cachedPrec = localStorage.getItem(precCacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.t && Date.now() - parsed.t < 60 * 60 * 1000 && Array.isArray(parsed.list)) {
                    allowedSymbolsRef.current = new Set(parsed.list);
                }
            }
            if (cachedPrec) {
                try {
                    const parsed = JSON.parse(cachedPrec);
                    if (parsed?.t && Date.now() - parsed.t < 60 * 60 * 1000 && parsed.map) {
                        const m = new Map<string, number>(parsed.map);
                        symbolPrecisionRef.current = m;
                    }
                } catch {}
            }

            const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
            if (!response.ok) return;
            const info = await response.json();
            const list: string[] = [];
            const pmap = new Map<string, number>();
            for (const s of info?.symbols || []) {
                if (
                    s?.contractType === 'PERPETUAL' &&
                    s?.quoteAsset === 'USDT' &&
                    s?.status === 'TRADING' &&
                    typeof s?.symbol === 'string'
                ) {
                    list.push(s.symbol);
                    // Derive precision from PRICE_FILTER.tickSize if available
                    try {
                        const pf = (s.filters || []).find((f: any) => f.filterType === 'PRICE_FILTER');
                        const tick = pf ? parseFloat(pf.tickSize) : NaN;
                        if (!Number.isNaN(tick) && tick > 0) {
                            const calcDec = Math.max(0, -Math.floor(Math.log10(tick)));
                            const dec = Math.max(2, calcDec);
                            pmap.set(s.symbol, dec);
                        }
                    } catch {}
                }
            }
            if (list.length) {
                allowedSymbolsRef.current = new Set(list);
                try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), list })); } catch {}
            }
            if (pmap.size) {
                symbolPrecisionRef.current = pmap;
                try { localStorage.setItem(precCacheKey, JSON.stringify({ t: Date.now(), map: Array.from(pmap.entries()) })); } catch {}
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
                // Fetch OI after tickers are loaded so we can match symbols
                void fetchOpenInterest();
                
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
                console.log('✅ Binance WebSocket connected - Real-time for all tiers');
                connectedAtRef.current = Date.now();
                firstPaintDoneRef.current = false; // reset on each connect

                void primeFundingSnapshot();
                void primeActiveSymbols();
                // Warm start: seed tickers first, then fetch OI after tickers are loaded
                void primeTickersSnapshot().then(() => {
                    // Fetch OI after tickers are seeded so we can match symbols
                    void fetchOpenInterest();
                });
                // Also fetch OI immediately in case tickers are already loaded from localStorage
                void fetchOpenInterest();
            };

            wsRef.current.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    const payload = msg?.data ?? msg;
                    const arr = Array.isArray(payload) ? payload : [payload];

                    // Process ticker data
                    let tickersUpdated = false;
                    for (const it of arr) {
                        if (it?.e === '24hrTicker' || it?.c || it?.v) {
                            // Always keep watchlist symbols in tickersRef, even if they don't meet volume/tier limits
                            // This ensures instant display when switching to watchlist view
                            const symbol = it.s;
                            const isWatchlistSymbol = watchlistSymbolsRef.current.some(ws => 
                                normalizeSym(ws) === normalizeSym(symbol)
                            );
                            
                            // Always store ticker data (WebSocket receives all symbols)
                            tickersRef.current.set(symbol, it);
                            tickersUpdated = true;
                            
                            // If this is a watchlist symbol that just arrived, force immediate render
                            if (isWatchlistSymbol && watchlistSymbolsRef.current.length > 0) {
                                // Trigger immediate snapshot rebuild to include this watchlist symbol
                                const snapshot = buildSnapshotRef.current();
                                if (snapshot.length > 0) {
                                    render(snapshot);
                                }
                            }
                        }
                        if (
                            it?.r !== undefined ||
                            it?.R !== undefined ||
                            it?.fr !== undefined ||
                            it?.lastFundingRate !== undefined
                        ) {
                            fundingRef.current.set(it.s, it);

                            // Debug logging for funding rate data
                            if (process.env.NODE_ENV === 'development' && msg.stream === '!markPrice@arr') {
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

                    // If tickers were updated and we have OI data, trigger a fetch to match symbols
                    // Tickers updated via WebSocket, re-rendering with OI data

                    const snapshot = buildSnapshot();
                    const now = Date.now();
                    
                    // If watchlist symbols are requested, ensure we render immediately when they arrive
                    // This fixes delay when switching to watchlist view - missing symbols appear instantly
                    if (watchlistSymbolsRef.current.length > 0 && tickersUpdated) {
                        const normalizedWatchlistSymbols = watchlistSymbolsRef.current.map(s => normalizeSym(s));
                        const snapshotSymbols = snapshot.map(item => normalizeSym(item.symbol));
                        const missingInSnapshot = normalizedWatchlistSymbols.filter(req => 
                            !snapshotSymbols.includes(req)
                        );
                        
                        // If all watchlist symbols are now present, force immediate render
                        if (missingInSnapshot.length === 0 && snapshot.length > 0) {
                            render(snapshot);
                            return; // Skip debouncing for watchlist completeness
                        }
                    }

                    // Bootstrap: before first paint, gather a fuller set to avoid missing symbols
                    if (!firstPaintDoneRef.current) {
                        const elapsed = now - connectedAtRef.current;
                        // If enough symbols collected OR bootstrap window elapsed, paint
                        if (snapshot.length >= minBootstrapSymbols || elapsed >= bootstrapWindowMs) {
                            render(snapshot);
                            firstPaintDoneRef.current = true;
                            lastRenderRef.current = now;
                            return;
                        }
                        // Otherwise keep accumulating without rendering
                    }

                    // Real-time rendering for ALL tiers with debouncing
                    if (!renderPendingRef.current) {
                        renderPendingRef.current = true;
                        setTimeout(() => {
                            render(snapshot);
                            renderPendingRef.current = false;
                        }, 200); // 200ms debounce for smooth updates
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

            // If it never opens (geofence), show fallback after 3s
            setTimeout(() => {
                if (!opened && wsRef.current?.readyState !== WebSocket.OPEN) {
                    geofenceFallback();
                }
            }, 3000);

        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Failed to connect to WebSocket (will retry):', error);
            }
            setStatus('error');
        }
    }, [tier, geofenceFallback, primeFundingSnapshot, primeActiveSymbols, primeTickersSnapshot, render]);

    // Connect on mount and when tier changes, but NOT when watchlistSymbols change
    // watchlistSymbols changes shouldn't trigger reconnection - they're just used in buildSnapshot
    useEffect(() => {
        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [tier]); // Removed 'connect' from deps - it's stable enough, and watchlistSymbols changes shouldn't reconnect

    // Hydrate Open Interest from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem('vs:openInterest');
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached?.data && typeof cached.asOf === 'number') {
                    // Restore the map from cached data
                    const restoredMap = new Map<string, number>();
                    for (const [key, value] of Object.entries(cached.data)) {
                        if (typeof value === 'number') {
                            restoredMap.set(normalizeSym(key), value);
                        }
                    }
                    openInterestRef.current = restoredMap;
                    if (typeof cached.asOf === 'number') {
                        openInterestAsOfRef.current = cached.asOf;
                    }
                    openInterestFetchedAtRef.current = Date.now();
                    
                    // Open Interest hydrated from localStorage (debug logs removed)
                }
            }
        } catch (e) {
            // localStorage might be disabled or corrupted, ignore
        }
    }, [normalizeSym]);

    // Calculate delay until next 5-minute boundary (with 15s slack)
    const nextBoundaryDelay = useCallback(() => {
        const now = Date.now();
        const period = 5 * 60 * 1000; // 5 minutes
        const next = Math.ceil(now / period) * period + 15000; // +15s slack to catch DO post
        return Math.max(0, next - now);
    }, []);

    // Fetch Open Interest aligned to 5-minute boundaries (independent of tier)
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        
        // Fetch immediately on mount (after localStorage hydration)
        void fetchOpenInterest();
        
        // Calculate initial delay to align with next boundary
        const initialDelay = nextBoundaryDelay();
        
        // Set up polling aligned to 5-minute boundaries
        const timeoutId = setTimeout(() => {
            void fetchOpenInterest();
            
            // Then poll every 5 minutes
            intervalId = setInterval(() => {
                void fetchOpenInterest();
            }, 5 * 60 * 1000);
        }, initialDelay);

        return () => {
            clearTimeout(timeoutId);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [fetchOpenInterest, nextBoundaryDelay]);

    // Watchdog: if OI asOf drifts beyond 6 minutes, try lightweight refetch every 30s
    useEffect(() => {
        const watchdog = setInterval(() => {
            const asOf = openInterestAsOfRef.current || 0
            if (!asOf) return
            const ageMs = Date.now() - asOf
            if (ageMs > 6 * 60 * 1000) {
                void fetchOpenInterest()
            }
        }, 30 * 1000)
        return () => clearInterval(watchdog)
    }, [fetchOpenInterest])

    return {
        data,
        status,
        lastUpdate,
        nextUpdate: 0, // Real-time for all tiers now (no countdown needed)
        isLive: status === 'live',
        isConnecting: status === 'connecting',
        isReconnecting: status === 'reconnecting',
        hasError: status === 'error',
        openInterestAsOf: openInterestAsOfRef.current,
    };
}
