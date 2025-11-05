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

interface SoundConfig {
  spike: Howl | null
  half_update: Howl | null
  full_update: Howl | null
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
  const soundsRef = useRef<SoundConfig>({
    spike: null,
    half_update: null,
    full_update: null,
  })
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize Howler sounds on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // Initialize each sound with Howler
      // Note: Files will be created at public/sounds/*.mp3
      // For now, we provide paths and gracefully fall back if they don't exist
      soundsRef.current = {
        spike: new Howl({
          src: ['/sounds/spike-alert.mp3', '/sounds/spike-alert.webm'],
          volume: volume,
          preload: true,
          html5: true, // Use HTML5 Audio for better mobile support
          onload: () => {
            console.log('✅ Spike alert sound loaded')
            setLoading(false)
          },
          onloaderror: (_id, err) => {
            console.log('ℹ️ Spike alert MP3 not found, will use Web Audio API fallback')
            setLoading(false)
          },
        }),
        half_update: new Howl({
          src: ['/sounds/half-update.mp3', '/sounds/half-update.webm'],
          volume: volume,
          preload: true,
          html5: true,
          onloaderror: (_id, err) => {
            console.log('ℹ️ Half update MP3 not found, will use Web Audio API fallback')
          },
        }),
        full_update: new Howl({
          src: ['/sounds/full-update.mp3', '/sounds/full-update.webm'],
          volume: volume,
          preload: true,
          html5: true,
          onloaderror: (_id, err) => {
            console.log('ℹ️ Full update MP3 not found, will use Web Audio API fallback')
          },
        }),
      }
    } catch (err) {
      console.warn('Howler.js initialization failed, using Web Audio API:', err)
      setLoading(false)
    }

    // Cleanup on unmount
    return () => {
      Object.values(soundsRef.current).forEach(sound => {
        if (sound) {
          sound.unload()
        }
      })
    }
  }, [])

  // Update volume when it changes
  useEffect(() => {
    Object.values(soundsRef.current).forEach(sound => {
      if (sound) {
        sound.volume(volume)
      }
    })
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
   */
  const playSound = useCallback((type: AlertType) => {
    if (!enabled) return

    const sound = soundsRef.current[type]

    // Try Howler first
    if (sound && sound.state() === 'loaded') {
      sound.play()
      return
    }

    // Fallback to Web Audio API
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
