'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
    trigger: boolean
    onComplete?: () => void
}

export function Confetti({ trigger, onComplete }: ConfettiProps) {
    const [show, setShow] = useState(false)
    const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; duration: number }>>([])

    useEffect(() => {
        if (trigger) {
            setShow(true)
            // Generate particles
            const newParticles = Array.from({ length: 30 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                delay: Math.random() * 200,
                duration: 800 + Math.random() * 400,
            }))
            setParticles(newParticles)

            // Clean up after animation
            const timer = setTimeout(() => {
                setShow(false)
                onComplete?.()
            }, 1500)

            return () => clearTimeout(timer)
        }
    }, [trigger, onComplete])

    if (!show) return null

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute top-0 w-2 h-2"
                    style={{
                        left: `${particle.x}%`,
                        animationDelay: `${particle.delay}ms`,
                        animationDuration: `${particle.duration}ms`,
                    }}
                >
                    <div 
                        className="w-full h-full rounded-full animate-confetti"
                        style={{
                            background: `hsl(${Math.random() * 60 + 130}, 80%, 60%)`, // Green to cyan range
                        }}
                    />
                </div>
            ))}
        </div>
    )
}

