'use client'
import { useEffect } from 'react'

export default function DebugFetchLogger() {
    useEffect(() => {
        const orig = window.fetch
        window.fetch = async (...args) => {
            try {
                console.log('[FETCH DEBUG]', args[0])
            } catch { }
            // @ts-ignore
            return orig(...args)
        }
        return () => { window.fetch = orig }
    }, [])
    return null
}
