"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"

export function LiveOrderbook() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let width = canvas.width = canvas.offsetWidth
        let height = canvas.height = canvas.offsetHeight

        // Orders: [price, size, type(0=bid, 1=ask), age]
        const orders: number[][] = []
        const maxOrders = 50

        const render = () => {
            ctx.clearRect(0, 0, width, height)

            // Generate random order
            if (Math.random() > 0.8) {
                orders.push([
                    Math.random(), // x pos (price)
                    Math.random(), // size
                    Math.random() > 0.5 ? 1 : 0, // type
                    0 // age
                ])
                if (orders.length > maxOrders) orders.shift()
            }

            // Draw orders
            orders.forEach(order => {
                order[3] += 0.02 // age
                const x = order[0] * width
                const size = order[1] * 30 + 5
                const type = order[2] // 1 = sell (red), 0 = buy (green)
                const alpha = Math.max(0, 1 - order[3])

                ctx.beginPath()
                ctx.fillStyle = type === 1
                    ? `rgba(239, 68, 68, ${alpha})`
                    : `rgba(16, 185, 129, ${alpha})`

                // Falling effect
                const y = order[3] * height * 0.5 + (type === 1 ? 0 : height / 2)

                ctx.arc(x, y, 2, 0, Math.PI * 2)
                ctx.fill()

                // Flash line on spawn
                if (order[3] < 0.1) {
                    ctx.fillStyle = `rgba(255,255,255,${0.5 - order[3] * 5})`
                    ctx.fillRect(x - size / 2, y, size, 1)
                }
            })

            requestAnimationFrame(render)
        }
        const anim = requestAnimationFrame(render)
        return () => cancelAnimationFrame(anim)
    }, [])

    return (
        <canvas ref={canvasRef} className="w-full h-full opacity-50" />
    )
}
