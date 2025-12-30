"use client"

import { useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Zap, Activity, Filter, BarChart3, TrendingUp } from "lucide-react"

export function Hero3D() {
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const mouseXSpring = useSpring(x)
    const mouseYSpring = useSpring(y)

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"])
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"])

    // Parallax layers
    const translateX1 = useTransform(mouseXSpring, [-0.5, 0.5], ["-20px", "20px"])
    const translateY1 = useTransform(mouseYSpring, [-0.5, 0.5], ["-20px", "20px"])
    const translateX2 = useTransform(mouseXSpring, [-0.5, 0.5], ["-40px", "40px"])
    const translateY2 = useTransform(mouseYSpring, [-0.5, 0.5], ["-40px", "40px"])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const width = rect.width
        const height = rect.height
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const xPct = mouseX / width - 0.5
        const yPct = mouseY / height - 0.5
        x.set(xPct)
        y.set(yPct)
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.div
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full max-w-5xl aspect-[16/9] md:aspect-[2.2/1] relative perspective-1000 group mx-auto mt-20"
        >
            {/* Base Layer: Glass Dashboard */}
            <div className="absolute inset-0 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-none">
                {/* Header Mockup */}
                <div className="h-10 border-b border-white/5 bg-white/5 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 text-red-500 border border-red-500/30" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/30" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 text-green-500 border border-green-500/30" />
                    </div>
                </div>

                <div className="p-6 grid grid-cols-12 gap-4 h-full">
                    {/* Sidebar */}
                    <div className="col-span-2 hidden md:block border-r border-white/5 pr-4 space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-8 rounded bg-white/5 w-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                        ))}
                    </div>

                    {/* Chart Area */}
                    <div className="col-span-12 md:col-span-10 flex items-end justify-between gap-1 h-full pb-10">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} className="flex-1 bg-zinc-800/30 rounded-t-sm" style={{ height: `${Math.random() * 60 + 10}%` }} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Parallax Layer 1: Data Points (Near) */}
            <motion.div
                style={{ translateX: translateX1, translateY: translateY1, translateZ: "50px" }}
                className="absolute inset-x-10 inset-y-20 flex items-center justify-center pointer-events-none"
            >
                {/* Floating Elements simulated at different positions */}
                <div className="absolute top-10 left-20 p-3 rounded-lg bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono shadow-lg backdrop-blur-md">
                    +1250 BTC Vol
                </div>
                <div className="absolute bottom-20 right-40 p-3 rounded-lg bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono shadow-lg backdrop-blur-md">
                    Whale Alert: 500 ETH
                </div>
            </motion.div>

            {/* Parallax Layer 2: The Main Alert (Nearest) */}
            <motion.div
                style={{ translateX: translateX2, translateY: translateY2, translateZ: "100px" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
                <div className="p-6 rounded-2xl bg-black/80 backdrop-blur-xl border border-brand-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col gap-4 min-w-[300px]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/50">
                            <Zap className="w-6 h-6 text-white text-shadow" />
                        </div>
                        <div>
                            <div className="text-brand-400 font-bold tracking-widest text-xs uppercase mb-0.5">Spike Detected</div>
                            <div className="text-white text-2xl font-bold font-mono">BTC/USDT</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div>
                            <div className="text-zinc-500 text-xs text-right">Vol Ratio</div>
                            <div className="text-emerald-400 font-mono font-bold text-lg text-right">+12.4x</div>
                        </div>
                        <div>
                            <div className="text-zinc-500 text-xs">Price</div>
                            <div className="text-emerald-400 font-mono font-bold text-lg">+1.2%</div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
