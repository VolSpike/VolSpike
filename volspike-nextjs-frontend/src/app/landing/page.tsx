"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate, AnimatePresence } from "framer-motion"
import { ArrowRight, Zap, Shield, BarChart3, Play, MousePointer2, TrendingUp, Check, X, Filter, Activity, Terminal } from "lucide-react"
import Link from "next/link"

// --- TYPES ---
type SimulationState = 'noise' | 'filtering' | 'detected'

// --- UTILS ---
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

// --- COMPONENTS ---

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: "circOut" }}
            className={cn(
                "fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-500",
                scrolled ? "bg-black/60 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
            )}
        >
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <Zap className="w-5 h-5 text-white fill-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">VolSpike</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
                {['Product', 'How it Works', 'Pricing'].map((item) => (
                     <Link key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`} className="hover:text-brand-400 transition-colors relative group">
                        {item}
                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-500 transition-all group-hover:w-full" />
                     </Link>
                ))}
            </div>

            <div className="flex items-center gap-4">
                <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Log in</Link>
                <Link href="/signup" className="group relative px-6 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-brand-50 transition-all flex items-center gap-2 overflow-hidden hover:scale-105 active:scale-95 duration-200">
                   Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer" />
                </Link>
            </div>
        </motion.nav>
    )
}

// Custom 3D-ish Particle System using Canvas for Performance
const ParticleHeroBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let width = window.innerWidth
        let height = window.innerHeight
        canvas.width = width
        canvas.height = height

        const particles: { x: number, y: number, vx: number, vy: number, size: number, color: string }[] = []
        const particleCount = width < 768 ? 30 : 60 // Less particles on mobile
        
        const colors = ['rgba(16, 185, 129, 0.5)', 'rgba(59, 130, 246, 0.3)', 'rgba(255, 255, 255, 0.1)']

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)]
            })
        }

        let animationFrameId: number

        const render = () => {
             ctx.clearRect(0, 0, width, height)
             
             // Update and draw particles
             particles.forEach((p, i) => {
                 p.x += p.vx
                 p.y += p.vy

                 if (p.x < 0 || p.x > width) p.vx *= -1
                 if (p.y < 0 || p.y > height) p.vy *= -1

                 ctx.beginPath()
                 ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                 ctx.fillStyle = p.color
                 ctx.fill()
                 
                 // Connections
                 for (let j = i + 1; j < particles.length; j++) {
                     const p2 = particles[j]
                     const dx = p.x - p2.x
                     const dy = p.y - p2.y
                     const dist = Math.sqrt(dx * dx + dy * dy)
                     
                     if (dist < 150) {
                         ctx.beginPath()
                         ctx.strokeStyle = `rgba(16, 185, 129, ${0.1 * (1 - dist / 150)})`
                         ctx.lineWidth = 0.5
                         ctx.moveTo(p.x, p.y)
                         ctx.lineTo(p2.x, p2.y)
                         ctx.stroke()
                     }
                 }
             })
             
             animationFrameId = requestAnimationFrame(render)
        }
        
        render()

        const handleResize = () => {
            width = window.innerWidth
            height = window.innerHeight
            canvas.width = width
            canvas.height = height
        }
        
        window.addEventListener('resize', handleResize)
        return () => {
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener('resize', handleResize)
        }

    }, [])

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-60" />
}

const Hero = () => {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden bg-[#020408]">
            {/* Dynamic Background */}
            <ParticleHeroBackground />
            
            {/* Gradient Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen" />

            <div className="container relative z-10 px-4 md:px-6 mx-auto flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8 p-1 px-2 rounded-full border border-brand-500/20 bg-brand-500/5 backdrop-blur-md flex items-center gap-2"
                >
                     <span className="flex h-2 w-2 relative ml-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                     </span>
                     <span className="text-xs font-mono text-brand-300 pr-2">System Status: Operational</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-[1.1] max-w-5xl"
                >
                    Capture the <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-emerald-200 to-white">Volume,</span> <br />
                    Before the Move.
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12 leading-relaxed"
                >
                    Detect institutional accumulation on Binance Perpetual Futures in milliseconds.
                    The most advanced volume analysis tool for serious traders.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center gap-5"
                >
                    <Link href="/signup" className="h-14 px-8 rounded-xl bg-white text-black font-bold text-lg hover:bg-brand-50 transition-all flex items-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] hover:-translate-y-1">
                        Start Tracking Free <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link href="#how-it-works" className="h-14 px-8 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center gap-2 backdrop-blur-md">
                        <Play className="w-5 h-5 fill-current" /> Watch Breakdown
                    </Link>
                </motion.div>
                
                {/* Hero Dashboard Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 100, rotateX: 20 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                    className="mt-20 w-full max-w-5xl relative"
                >
                     <div className="absolute inset-x-0 -top-20 h-[300px] bg-brand-500/10 blur-[100px] -z-10" />
                     <div className="rounded-t-2xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-xl shadow-2xl overflow-hidden aspect-[16/9] md:aspect-[2/1] relative group">
                        {/* Mock UI Header */}
                        <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-white/5">
                             <div className="flex gap-1.5">
                                 <div className="w-3 h-3 rounded-full bg-red-500/20 text-red-500 border border-red-500/30" />
                                 <div className="w-3 h-3 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/30" />
                                 <div className="w-3 h-3 rounded-full bg-green-500/20 text-green-500 border border-green-500/30" />
                             </div>
                             <div className="ml-4 h-4 w-40 rounded-full bg-white/5" />
                        </div>
                        
                        {/* Interactive Hero Content */}
                        <div className="p-6 grid grid-cols-12 gap-4 h-full">
                            {/* Feed Column */}
                            <div className="col-span-12 md:col-span-3 space-y-3 hidden md:block">
                                {[1,2,3].map(i => (
                                    <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i===1 ? 'bg-brand-500/20 text-brand-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                            <Zap size={14} />
                                        </div>
                                        <div>
                                            <div className="h-2 w-12 bg-white/20 rounded mb-1" />
                                            <div className="h-2 w-8 bg-white/10 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Main Chart Area */}
                            <div className="col-span-12 md:col-span-9 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden flex items-end p-4 gap-1">
                                {Array.from({length: 40}).map((_, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ height: "10%" }}
                                        animate={{ height: `${Math.random() * 80 + 10}%` }}
                                        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: i * 0.05 }}
                                        className={`flex-1 rounded-sm ${i > 30 ? 'bg-brand-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-800/50'}`}
                                    />
                                ))}
                                
                                {/* Overlay Alert */}
                                <motion.div 
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 1.5, duration: 0.5 }}
                                >
                                     <div className="p-4 rounded-xl bg-black/80 backdrop-blur border border-brand-500/50 shadow-2xl flex items-center gap-4">
                                         <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center">
                                             <Zap className="w-6 h-6 text-white" />
                                         </div>
                                         <div>
                                             <div className="text-brand-400 font-bold tracking-wider text-xs">SPIKE DETECTED</div>
                                             <div className="text-white text-xl font-bold font-mono">BTC/USDT</div>
                                         </div>
                                         <div className="pl-4 border-l border-white/10 text-right">
                                             <div className="text-emerald-400 font-mono font-bold">+5.2x</div>
                                             <div className="text-zinc-500 text-xs">Vol Ratio</div>
                                         </div>
                                     </div>
                                </motion.div>
                            </div>
                        </div>

                     </div>
                </motion.div>
            </div>
            
            <div className="w-full absolute bottom-0 bg-gradient-to-t from-[#020408] to-transparent h-40 z-20" />
        </section>
    )
}

const ScrollingTicker = () => {
    return (
        <div className="w-full bg-[#020408] border-y border-white/5 py-3 overflow-hidden flex relative z-20">
            <motion.div 
                animate={{ x: "-50%" }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="flex gap-12 whitespace-nowrap min-w-max px-6"
            >
                {Array.from({length: 20}).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 text-zinc-500 font-mono text-sm">
                        <span className="text-zinc-300 font-bold">{['BTC', 'ETH', 'SOL', 'AVAX', 'BNB'][i%5]}</span>
                        <span className={i % 2 === 0 ? "text-emerald-400" : "text-red-400"}>
                            {i % 2 === 0 ? "+" : "-"}{(Math.random() * 5).toFixed(2)}%
                        </span>
                        <span className="text-zinc-700">|</span>
                        <span>OI: ${(Math.random() * 100).toFixed(0)}M</span>
                    </div>
                ))}
            </motion.div>
        </div>
    )
}

const StickyProductWalkthrough = () => {
    return (
        <section id="how-it-works" className="relative py-32 bg-[#020408]">
            <div className="container mx-auto px-6">
                <div className="text-center mb-24">
                     <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">How VolSpike Works</h2>
                     <p className="text-zinc-400 max-w-2xl mx-auto">A seamless flow from noise to actionable signals.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative">
                     {/* Sticky Visual Side */}
                     <div className="hidden md:block sticky top-32 h-[500px]">
                         <InteractiveSimulation />
                     </div>

                     {/* Scrollable Text Side */}
                     <div className="space-y-40 py-20">
                         <WalkthroughStep 
                            number="01" 
                            title="Ingest Real-time Data" 
                            desc="We monitor every single trade tick on Binance Perpetual Futures, processing millions of data points per second." 
                         />
                         <WalkthroughStep 
                            number="02" 
                            title="Filter the Noise" 
                            desc="Our proprietary algorithm filters out wash trading and bot noise, isolating organic institutional volume." 
                         />
                         <WalkthroughStep 
                            number="03" 
                            title="Generate Signals" 
                            desc="When significant volume aggregation is detected, we push an instant alert to your dashboard and Telegram." 
                         />
                     </div>
                </div>
            </div>
        </section>
    )
}

const WalkthroughStep = ({ number, title, desc }: { number: string, title: string, desc: string }) => (
    <motion.div 
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ margin: "-20% 0px -20% 0px" }}
        className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm"
    >
        <div className="text-brand-500 font-mono text-xl mb-4 opacity-50">{number}</div>
        <h3 className="text-3xl font-bold text-white mb-4">{title}</h3>
        <p className="text-zinc-400 text-lg leading-relaxed">{desc}</p>
    </motion.div>
)

const InteractiveSimulation = () => {
    const [state, setState] = useState<SimulationState>('noise')
    
    // Auto-cycle state for visual effect
    useEffect(() => {
        const interval = setInterval(() => {
            setState(p => p === 'noise' ? 'filtering' : p === 'filtering' ? 'detected' : 'noise')
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="w-full h-full rounded-3xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative shadow-2xl">
            {/* Background Data Stream */}
            <div className="absolute inset-0 opacity-20 flex flex-wrap gap-1 p-4 content-start overflow-hidden font-mono text-[10px] text-brand-500/50 break-all select-none">
                 {Array.from({length: 400}).map((_,i) => (
                    <span key={i}>{Math.random() > 0.5 ? '1' : '0'}</span>
                 ))}
            </div>
            
            <div className="absolute inset-0 z-10 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {state === 'noise' && (
                        <motion.div 
                            key="noise"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl flex items-center gap-4"
                        >
                            <Activity className="animate-pulse text-zinc-500" />
                            <div className="text-zinc-400">Processing Market Noise...</div>
                        </motion.div>
                    )}
                    {state === 'filtering' && (
                        <motion.div 
                             key="filter"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-brand-900/40 border border-brand-500/30 p-6 rounded-xl flex items-center gap-4"
                        >
                            <Filter className="space-y-2 text-brand-400 animate-spin" />
                            <div className="text-brand-300">Filtering Anomalies...</div>
                        </motion.div>
                    )}
                    {state === 'detected' && (
                        <motion.div 
                             key="detected"
                             initial={{ scale: 0.5, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             className="relative"
                        >
                             <div className="absolute -inset-4 bg-brand-500/20 blur-xl rounded-full" />
                             {/* Twitter Card Clone */}
                             <div className="relative w-[380px] bg-[#0f172a] rounded-xl border border-brand-500/40 p-5 shadow-2xl overflow-hidden">
                                 <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-[#0f172a]" />
                                 <div className="relative z-10 flex justify-between items-start mb-4">
                                     <div className="flex items-center gap-3">
                                         <TrendingUp className="text-brand-500 h-6 w-6" />
                                         <span className="text-2xl font-bold text-white tracking-tight">SOL</span>
                                     </div>
                                     <div className="text-right">
                                         <div className="text-zinc-400 text-sm">10:42 AM</div>
                                     </div>
                                 </div>
                                 <div className="relative z-10 flex items-center gap-3 mb-4">
                                     <span className="px-3 py-1 rounded-md bg-brand-500/15 border border-brand-500/40 text-brand-400 font-bold font-mono">+12.5x</span>
                                     <span className="px-3 py-1 rounded-md bg-amber-500/85 text-white text-sm font-medium shadow-sm">Hourly Update</span>
                                 </div>
                                 <div className="relative z-10 text-zinc-400 text-sm space-y-1 mb-4 border-t border-white/5 pt-3">
                                     <div className="flex justify-between"><span>This hour:</span> <span className="text-white">$42.5M</span></div>
                                     <div className="flex justify-between"><span>Last hour:</span> <span className="text-zinc-500">$3.4M</span></div>
                                 </div>
                                 <div className="relative z-10 flex items-center justify-between text-xs font-medium text-zinc-500 pt-3 border-t border-white/10">
                                      <span className="text-emerald-400">Price: +4.2%</span>
                                      <span>volspike.com</span>
                                 </div>
                             </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                 {['noise', 'filtering', 'detected'].map((s) => (
                     <div key={s} className={`w-2 h-2 rounded-full transition-colors ${state === s ? 'bg-brand-500' : 'bg-white/20'}`} />
                 ))}
            </div>
        </div>
    )
}

const MobileResponsiveReview = () => {
    return (
        <section className="py-20 border-t border-white/5 bg-[#020408] text-center">
            <div className="container px-4">
                <div className="max-w-2xl mx-auto space-y-8">
                     <div className="w-16 h-16 rounded-2xl bg-zinc-800 mx-auto flex items-center justify-center">
                         <Terminal className="text-zinc-400" />
                     </div>
                     <h3 className="text-2xl font-bold text-white">Works anywhere.</h3>
                     <p className="text-zinc-400">
                         Our dashboard is fully optimized for mobile. Track whales from your phone, tablet, or desktop with 
                         the same speed and precision.
                     </p>
                     
                     <div className="flex justify-center gap-4 pt-4">
                         <div className="w-12 h-20 border-2 border-zinc-700 rounded-lg bg-zinc-900 shadow-xl" />
                         <div className="w-32 h-20 border-2 border-zinc-700 rounded-lg bg-zinc-900 shadow-xl" />
                     </div>
                </div>
            </div>
        </section>
    )
}

const CTA = () => {
    return (
        <section className="py-32 relative overflow-hidden bg-[#050505]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-900/20 via-black to-black" />
            
            <div className="container relative z-10 px-4 md:px-6 mx-auto text-center">
                <h2 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-8 max-w-4xl mx-auto">
                    Stop Trading Blend. <br />
                    Start Trading Spikes.
                </h2>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
                     <Link href="/signup" className="w-full sm:w-auto px-12 py-5 rounded-full bg-brand-500 text-white font-bold text-xl hover:bg-brand-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25">
                        Get Started Now
                    </Link>
                </div>
            </div>
        </section>
    )
}

const Footer = () => {
    return (
        <footer className="bg-black py-12 border-t border-white/5">
            <div className="container px-4 md:px-6 mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="text-zinc-500 text-sm">© 2024 VolSpike Inc. All rights reserved.</div>
                 <div className="flex gap-6 text-sm text-zinc-500 font-medium">
                     <Link href="#" className="hover:text-brand-400 transition-colors">Privacy Policy</Link>
                     <Link href="#" className="hover:text-brand-400 transition-colors">Terms of Service</Link>
                 </div>
            </div>
        </footer>
    )
}

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-[#020408] text-white selection:bg-brand-500/30 font-sans">
            <Navbar />
            <Hero />
            <ScrollingTicker />
            <StickyProductWalkthrough />
            <MobileResponsiveReview />
            <CTA />
            <Footer />
        </main>
    )
}
