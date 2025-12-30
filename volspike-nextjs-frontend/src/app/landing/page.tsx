"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useScroll, useTransform, useSpring, useVelocity, useAnimationFrame } from "framer-motion"
import { ArrowRight, Zap, Shield, BarChart3, Play, Activity, Terminal, Check } from "lucide-react"
import Link from "next/link"

import { Hero3D } from "./components/Hero3D"
import { SpotlightCard } from "./components/SpotlightCard"
import { MagneticButton } from "./components/MagneticButton"
import { LiveOrderbook } from "./components/LiveOrderbook"

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
                scrolled ? "bg-[#020408]/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
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
                <MagneticButton>
                    <Link href="/signup" className="group relative px-6 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-brand-50 transition-all flex items-center gap-2 overflow-hidden">
                        Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    </Link>
                </MagneticButton>
            </div>
        </motion.nav>
    )
}

const Hero = () => {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden bg-[#020408]">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] mix-blend-screen" />
                <LiveOrderbook />
            </div>

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
                    className="flex flex-col sm:flex-row items-center gap-5 z-20"
                >
                    <MagneticButton>
                        <Link href="/signup" className="h-14 px-8 rounded-xl bg-white text-black font-bold text-lg hover:bg-brand-50 transition-all flex items-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)]">
                            Start Tracking Free <ArrowRight className="w-5 h-5" />
                        </Link>
                    </MagneticButton>
                    <MagneticButton>
                        <Link href="#how-it-works" className="h-14 px-8 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center gap-2 backdrop-blur-md">
                            <Play className="w-5 h-5 fill-current" /> Watch Breakdown
                        </Link>
                    </MagneticButton>
                </motion.div>

                {/* 3D Dashboard Preview */}
                <Hero3D />
            </div>

            <div className="w-full absolute bottom-0 bg-gradient-to-t from-[#020408] to-transparent h-40 z-20 pointer-events-none" />
        </section>
    )
}

const ScrollingTicker = () => {
    const { scrollY } = useScroll()
    const scrollVelocity = useVelocity(scrollY)
    const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 })
    const skewX = useTransform(smoothVelocity, [-1000, 1000], [-30, 30]) // Max skew when scrolling fast

    return (
        <div className="w-full bg-[#020408] border-y border-white/5 py-4 overflow-hidden flex relative z-20">
            <motion.div
                style={{ skewX }}
                animate={{ x: "-50%" }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="flex gap-16 whitespace-nowrap min-w-max px-6"
            >
                {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 text-zinc-500 font-mono text-sm">
                        <span className="text-white font-bold text-lg">{['BTC', 'ETH', 'SOL', 'AVAX', 'BNB'][i % 5]}</span>
                        <span className={i % 2 === 0 ? "text-brand-400 font-bold" : "text-red-400 font-bold"}>
                            {i % 2 === 0 ? "LONG" : "SHORT"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs">
                            Vol: {(Math.random() * 5 + 1).toFixed(1)}x
                        </span>
                        <span className="text-zinc-600">|</span>
                        <span>$ {(Math.random() * 100).toFixed(0)}M Interest</span>
                    </div>
                ))}
            </motion.div>
        </div>
    )
}

const Features = () => {
    return (
        <section id="features" className="py-32 bg-[#020408]">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center mb-24">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Built for Edge.</h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Every feature is designed to give you milliseconds of advantage.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SpotlightCard className="p-8 rounded-3xl h-full">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 text-purple-400">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">Instant Execution</h3>
                        <p className="text-zinc-400 leading-relaxed">
                            Websocket integration ensures you see volume spikes before the candle even prints on your chart.
                        </p>
                    </SpotlightCard>
                    <SpotlightCard className="p-8 rounded-3xl h-full">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 text-blue-400">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">Visual Intelligence</h3>
                        <p className="text-zinc-400 leading-relaxed">
                            Don't read numbers. See the flow. Our heatmaps and custom charts make institutional movement obvious.
                        </p>
                    </SpotlightCard>
                    <SpotlightCard className="p-8 rounded-3xl h-full">
                        <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center mb-6 text-brand-400">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">Wash Trade Filtering</h3>
                        <p className="text-zinc-400 leading-relaxed">
                            Our algorithm automatically ignores low-quality volume and wash trading, so you only trade real moves.
                        </p>
                    </SpotlightCard>
                </div>
            </div>
        </section>
    )
}


export default function LandingPage() {
    return (
        <main className="min-h-screen bg-[#020408] text-white selection:bg-brand-500/30 font-sans overflow-x-hidden">
            <Navbar />
            <Hero />
            <ScrollingTicker />
            <Features />
        </main>
    )
}
