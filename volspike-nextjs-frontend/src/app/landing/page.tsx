"use client"

import { useState, useEffect } from "react"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { ArrowRight, Zap, Shield, BarChart3, Globe, CheckCircle2, Play, MousePointer2 } from "lucide-react"
import Link from "next/link"

// --- Components ---

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
            className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 ${
                scrolled ? "bg-black/50 backdrop-blur-md border-b border-white/5" : "bg-transparent"
            }`}
        >
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white fill-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">VolSpike</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
                <Link href="#features" className="hover:text-white transition-colors">Features</Link>
                <Link href="#how-it-works" className="hover:text-white transition-colors">How it Works</Link>
                <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
            </div>
            <div className="flex items-center gap-4">
                <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Log in</Link>
                <Link href="/signup" className="group relative px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 overflow-hidden">
                   Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </motion.nav>
    )
}

const Hero = () => {
    const { scrollY } = useScroll()
    const y1 = useTransform(scrollY, [0, 500], [0, 200])
    const y2 = useTransform(scrollY, [0, 500], [0, -150])

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 z-0 bg-[#0A0A0A]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] opacity-30 animate-pulse" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] opacity-20" />
            </div>

            <div className="container relative z-10 px-4 md:px-6 mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300 mb-8"
                >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    Real-time Volume Intelligence
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.2, 0.65, 0.3, 0.9] }}
                    className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-6 leading-[1.1]"
                >
                    Don't guess. <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-white">
                        Just follow the volume.
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed"
                >
                    The fastest way to detect institutional movement on Binance Perpetual Futures.
                    Institutional-grade alerts, visualized in real-time.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Link href="/signup" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-black font-semibold text-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                        Start Tracking Free <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link href="#demo" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2 backdrop-blur-sm">
                        <Play className="w-5 h-5 fill-current" /> Watch Demo
                    </Link>
                </motion.div>

                {/* Floating Elements Animation */}
                <motion.div style={{ y: y1 }} className="absolute top-20 left-[10%] hidden lg:block opacity-60">
                    <div className="p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400"><BarChart3 size={16}/></div>
                             <div className="text-sm text-white font-mono">BTCUSDT</div>
                        </div>
                        <div className="text-2xl font-bold text-green-400">+4.2% Vol</div>
                    </div>
                </motion.div>

                <motion.div style={{ y: y2 }} className="absolute bottom-40 right-[10%] hidden lg:block opacity-60">
                    <div className="p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400"><Zap size={16}/></div>
                             <div className="text-sm text-white font-mono">ETHUSDT</div>
                        </div>
                        <div className="text-2xl font-bold text-red-400">Spike Detected</div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="group p-8 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-indigo-500/30 transition-all duration-300 hover:bg-zinc-900/80"
        >
            <div className="mb-6 inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-zinc-400 leading-relaxed">
                {description}
            </p>
        </motion.div>
    )
}

const Features = () => {
    return (
        <section id="features" className="py-24 bg-[#0A0A0A] relative">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6"
                    >
                        Built for <span className="text-indigo-400">Speed</span> & Precision
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-zinc-400 max-w-2xl mx-auto"
                    >
                        Every second counts in crypto. Our architecture is designed to give you the advantage you need.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={Zap}
                        title="Instant Alerts"
                        description="Receive notifications the millisecond a volume spike occurs. Available on Telegram, Discord, and Web."
                        delay={0.1}
                    />
                    <FeatureCard
                        icon={BarChart3}
                        title="Visual Intelligence"
                        description="Don't just see numbers. Visualize flow with our advanced charting and heatmap overlays."
                        delay={0.2}
                    />
                    <FeatureCard
                        icon={Shield}
                        title="False Positive Filtering"
                        description="Our proprietary algorithm filters out wash trading and noise, so you only see real movement."
                        delay={0.3}
                    />
                </div>
            </div>
        </section>
    )
}

const InteractiveDemo = () => {
    return (
        <section className="py-24 bg-black relative overflow-hidden">
             <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
             
             <div className="container px-4 md:px-6 mx-auto">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <motion.h2 
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="text-3xl md:text-5xl font-bold text-white"
                        >
                            See the market <br/>
                            <span className="text-zinc-500">before it moves.</span>
                        </motion.h2>
                        <ul className="space-y-4">
                            {[
                                "Real-time order book analysis",
                                "Whale tracking & wallet labeling",
                                "Historical spike correlation data",
                                "Customizable alert thresholds"
                            ].map((item, i) => (
                                <motion.li 
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center gap-3 text-zinc-300"
                                >
                                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                         <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 }}
                        >
                             <Link href="/signup" className="inline-flex text-indigo-400 hover:text-indigo-300 items-center gap-2 font-medium transition-colors">
                                Explore all features <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>
                    </div>

                    <div className="flex-1 w-full relative">
                        {/* Abstract UI representation */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, rotateX: 20 }}
                            whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="relative aspect-video bg-zinc-900 rounded-xl border border-white/10 overflow-hidden shadow-2xl group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
                            
                            {/* Mock UI Header */}
                            <div className="absolute top-0 inset-x-0 h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-black/20">
                                <div className="w-3 h-3 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-[8px]">●</div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-[8px]">●</div>
                                <div className="w-3 h-3 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[8px]">●</div>
                            </div>

                            {/* Mock Charts/Bars */}
                            <div className="absolute inset-0 mt-10 p-6 flex items-end justify-between gap-1">
                                {[30, 45, 25, 60, 35, 80, 55, 40, 70, 90, 45, 65].map((h, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ height: "10%" }}
                                        whileInView={{ height: `${h}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 1, delay: i * 0.05, ease: "backOut" }}
                                        className={`w-full rounded-t-sm ${h > 75 ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 opacity-100' : 'bg-zinc-800 opacity-50'}`}
                                    />
                                ))}
                            </div>
                            
                            {/* Overlay Card */}
                             <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 1 }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex items-center gap-4 min-w-[240px]"
                            >
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-400">Signal Detected</div>
                                    <div className="text-white font-bold">Strong Buy &middot; BTC</div>
                                </div>
                                <div className="ml-auto text-green-400 font-mono">+12.4%</div>
                            </motion.div>

                            {/* Mouse Cursor Simulation */}
                             <motion.div
                                animate={{ 
                                    x: [0, 100, 100, 200, 0], 
                                    y: [0, -50, -20, 50, 0],
                                    opacity: [0, 1, 1, 0]
                                }}
                                transition={{ duration: 5, repeat: Infinity, repeatDelay: 2 }}
                                className="absolute bottom-10 left-10 text-white drop-shadow-md pointer-events-none"
                            >
                                <MousePointer2 className="w-5 h-5 fill-black" />
                            </motion.div>

                        </motion.div>
                    </div>
                </div>
             </div>
        </section>
    )
}

const CTA = () => {
    return (
        <section className="py-32 relative overflow-hidden bg-[#050505]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black" />
            
            <div className="container relative z-10 px-4 md:px-6 mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-8 max-w-4xl mx-auto">
                        Ready to trade with <br className="hidden md:block"/> unmatched clarity?
                    </h2>
                    <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
                        Join 5,000+ traders who have switched to VolSpike.
                        Start your free trial today.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/signup" className="w-full sm:w-auto px-10 py-5 rounded-full bg-white text-black font-bold text-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2">
                            Get Started Now
                        </Link>
                    </div>
                </motion.div>
            </div>
            
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </section>
    )
}

const Footer = () => {
    return (
        <footer className="bg-black py-12 border-t border-white/5">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Zap className="w-3 h-3 text-zinc-400" />
                        </div>
                        <span className="text-zinc-400 font-semibold">VolSpike</span>
                    </div>
                    <div className="flex gap-8 text-sm text-zinc-500">
                        <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="#" className="hover:text-white transition-colors">Terms</Link>
                        <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
                    </div>
                    <div className="text-xs text-zinc-600">
                        © 2024 VolSpike Inc.
                    </div>
                </div>
            </div>
        </footer>
    )
}

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
            <Navbar />
            <Hero />
            <Features />
            <InteractiveDemo />
            <CTA />
            <Footer />
        </main>
    )
}
