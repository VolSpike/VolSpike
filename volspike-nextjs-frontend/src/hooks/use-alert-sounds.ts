'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Custom hook for managing alert notification sounds
 * Provides different sounds for different alert types with user controls
 */

export type AlertType = 'spike' | 'half_update' | 'full_update'

interface UseAlertSoundsOptions {
  enabled?: boolean
  volume?: number // 0-1
}

export function useAlertSounds(options: UseAlertSoundsOptions = {}) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('alertSoundsEnabled')
    return stored !== null ? stored === 'true' : (options.enabled ?? true)
  })

  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.5
    const stored = localStorage.getItem('alertSoundsVolume')
    return stored !== null ? parseFloat(stored) : (options.volume ?? 0.5)
  })

  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize AudioContext on first interaction (browser requirement)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }

    // Initialize on first user interaction
    const events = ['click', 'touchstart', 'keydown']
    events.forEach(event => document.addEventListener(event, initAudio, { once: true }))

    return () => {
      events.forEach(event => document.removeEventListener(event, initAudio))
    }
  }, [])

  // Persist settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alertSoundsEnabled', enabled.toString())
      localStorage.setItem('alertSoundsVolume', volume.toString())
    }
  }, [enabled, volume])

  /**
   * Generate different sounds using Web Audio API
   */
  const playSound = (type: AlertType) => {
    if (!enabled || !audioContextRef.current) return

    const ctx = audioContextRef.current
    const now = ctx.currentTime

    // Create gain node for volume control
    const gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)
    gainNode.gain.value = volume

    switch (type) {
      case 'spike': {
        // New Volume Spike: Exciting two-tone chime (higher pitch, attention-grabbing)
        // First tone: 800Hz
        const osc1 = ctx.createOscillator()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(800, now)
        osc1.connect(gainNode)
        osc1.start(now)
        osc1.stop(now + 0.1)

        // Second tone: 1000Hz (slightly delayed for chime effect)
        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1000, now + 0.08)
        osc2.connect(gainNode)
        osc2.start(now + 0.08)
        osc2.stop(now + 0.25)
        break
      }

      case 'half_update': {
        // 30m Update: Softer pop sound (medium pitch, informative)
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, now)
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15)
        
        const envelope = ctx.createGain()
        envelope.connect(gainNode)
        envelope.gain.setValueAtTime(volume * 0.7, now) // Softer than spike
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
        
        osc.connect(envelope)
        osc.start(now)
        osc.stop(now + 0.15)
        break
      }

      case 'full_update': {
        // Hourly Update: Gentle beep (low pitch, subtle reminder)
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(500, now)
        
        const envelope = ctx.createGain()
        envelope.connect(gainNode)
        envelope.gain.setValueAtTime(volume * 0.5, now) // Even softer
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
        
        osc.connect(envelope)
        osc.start(now)
        osc.stop(now + 0.12)
        break
      }
    }
  }

  return {
    playSound,
    enabled,
    setEnabled,
    volume,
    setVolume,
  }
}

