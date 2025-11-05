'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Howl } from 'howler'

/**
 * Custom hook for managing alert notification sounds
 * Uses Howler.js for professional audio playback with Web Audio API fallback
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

  const [loading, setLoading] = useState(true)
  const soundRef = useRef<Howl | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize single Howler sound on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // Initialize single alert sound
      // Uses one MP3 file for all alert types (cleaner approach)
      soundRef.current = new Howl({
        src: ['/sounds/alert.mp3', '/sounds/alert.webm'],
        volume: volume,
        preload: true,
        html5: true, // Use HTML5 Audio for better mobile support
        onload: () => {
          console.log('✅ Alert sound loaded successfully')
          setLoading(false)
        },
        onloaderror: (_id, err) => {
          console.log('ℹ️ Alert MP3 not found, will use Web Audio API fallback')
          setLoading(false)
        },
      })
    } catch (err) {
      console.warn('Howler.js initialization failed, using Web Audio API:', err)
      setLoading(false)
    }

    // Cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unload()
      }
    }
  }, [])

  // Update volume when it changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.volume(volume)
    }
  }, [volume])

  // Initialize Web Audio API context (fallback)
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
   * Fallback to Web Audio API if MP3 files don't exist
   * This is a temporary solution until professional MP3s are added
   */
  const playFallbackSound = useCallback((type: AlertType) => {
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current
    const now = ctx.currentTime

    // Create gain node for volume control
    const gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)
    gainNode.gain.value = volume

    switch (type) {
      case 'spike': {
        // New Volume Spike: Two-tone chime
        const osc1 = ctx.createOscillator()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(800, now)
        osc1.connect(gainNode)
        osc1.start(now)
        osc1.stop(now + 0.1)

        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1000, now + 0.08)
        osc2.connect(gainNode)
        osc2.start(now + 0.08)
        osc2.stop(now + 0.25)
        break
      }

      case 'half_update': {
        // 30m Update: Softer pop
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, now)
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15)
        
        const envelope = ctx.createGain()
        envelope.connect(gainNode)
        envelope.gain.setValueAtTime(volume * 0.7, now)
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
        
        osc.connect(envelope)
        osc.start(now)
        osc.stop(now + 0.15)
        break
      }

      case 'full_update': {
        // Hourly Update: Gentle beep
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(500, now)
        
        const envelope = ctx.createGain()
        envelope.connect(gainNode)
        envelope.gain.setValueAtTime(volume * 0.5, now)
        envelope.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
        
        osc.connect(envelope)
        osc.start(now)
        osc.stop(now + 0.12)
        break
      }
    }
  }, [volume])

  /**
   * Play alert sound - tries Howler first, falls back to Web Audio API
   * Note: Uses single sound file for all alert types (simpler, cleaner)
   */
  const playSound = useCallback((type: AlertType) => {
    if (!enabled) return

    // Try Howler first (single sound for all types)
    if (soundRef.current && soundRef.current.state() === 'loaded') {
      soundRef.current.play()
      return
    }

    // Fallback to Web Audio API (still type-specific for variety)
    playFallbackSound(type)
  }, [enabled, playFallbackSound])

  return {
    playSound,
    enabled,
    setEnabled,
    volume,
    setVolume,
    loading,
  }
}
