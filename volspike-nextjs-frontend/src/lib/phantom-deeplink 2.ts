"use client"

import nacl from 'tweetnacl'
import { base58 } from '@scure/base'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/backend'

// sessionStorage keys
const SK_EPHEM = 'phantom_ephem_secret'
const SK_EPHEM_PUB = 'phantom_ephem_public'
const SK_SESSION = 'phantom_session'
const SK_PHANTOM_PUB = 'phantom_pubkey'
const SK_INTENT = 'phantom_intent' // 'connect' | 'sign'
const SK_MESSAGE = 'phantom_message'
const SK_ADDRESS = 'solana_address'

// Cookie helpers (as last-resort cross-tab persistence on iOS)
function setCookie(key: string, value: string, maxAgeSec = 300) {
  try {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
  } catch {}
}
function getCookie(key: string): string | null {
  try {
    const name = encodeURIComponent(key) + '='
    const parts = (document.cookie || '').split(';')
    for (const raw of parts) {
      const c = raw.trim()
      if (c.startsWith(name)) return decodeURIComponent(c.substring(name.length))
    }
  } catch {}
  return null
}

// Robust storage helpers to survive iOS returning in a new tab
function setKV(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch {}
  try { sessionStorage.setItem(key, value) } catch {}
  setCookie(key, value)
}
function getKV(key: string): string | null {
  try {
    const v = localStorage.getItem(key)
    if (v != null) return v
  } catch {}
  try {
    return sessionStorage.getItem(key)
  } catch {}
  const fromCookie = getCookie(key)
  return fromCookie
}
function removeKV(key: string) {
  try { localStorage.removeItem(key) } catch {}
  try { sessionStorage.removeItem(key) } catch {}
  setCookie(key, '', -1)
}

export type PhantomIntent = 'connect' | 'sign'

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const platform = (navigator as any).platform
  const touch = (navigator as any).maxTouchPoints
  return /iP(hone|od|ad)/i.test(ua) || (platform === 'MacIntel' && touch > 1)
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const hasSafari = /Safari\//i.test(ua)
  const isChromeiOS = /CriOS/i.test(ua)
  const isFirefoxiOS = /FxiOS/i.test(ua)
  const isBraveiOS = /Brave/i.test(ua)
  const isEdgiOS = /EdgiOS/i.test(ua)
  return hasSafari && !isChromeiOS && !isFirefoxiOS && !isBraveiOS && !isEdgiOS
}

export const isThirdPartyIOSBrowser = () => isIOS() && !isSafari()

export const toDeepLink = (universalUrl: string) => universalUrl.replace('https://phantom.app/ul/', 'phantom://ul/')

export const pickBestPhantomUrl = (universalUrl: string) => (isThirdPartyIOSBrowser() ? toDeepLink(universalUrl) : universalUrl)

export function getPublicOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_PUBLIC_URL || 'https://volspike.com'
}

export function generateEphemeralKeys(): { publicKey58: string; secretKey58: string } {
  const { publicKey, secretKey } = nacl.box.keyPair()
  const publicKey58 = base58.encode(publicKey)
  const secretKey58 = base58.encode(secretKey)
  setKV(SK_EPHEM, secretKey58)
  setKV(SK_EPHEM_PUB, publicKey58)
  return { publicKey58, secretKey58 }
}

export function getEphemeralSecret(): Uint8Array | null {
  const secretKey58 = getKV(SK_EPHEM)
  if (!secretKey58) return null
  return base58.decode(secretKey58)
}

export function storeSession(session: string, phantomPubKey58: string) {
  setKV(SK_SESSION, session)
  setKV(SK_PHANTOM_PUB, phantomPubKey58)
}

export function getSession(): { session: string | null; phantomPubKey: Uint8Array | null } {
  const s = getKV(SK_SESSION)
  const pk58 = getKV(SK_PHANTOM_PUB)
  return { session: s, phantomPubKey: pk58 ? base58.decode(pk58) : null }
}

export function setIntent(i: PhantomIntent) {
  setKV(SK_INTENT, i)
}

export function getIntent(): PhantomIntent | null {
  const i = getKV(SK_INTENT)
  return (i === 'connect' || i === 'sign') ? i : null
}

export function clearIntent() {
  removeKV(SK_INTENT)
}

export function saveMessageToSign(message: string) {
  setKV(SK_MESSAGE, message)
}

export function getMessageToSign(): string | null {
  return getKV(SK_MESSAGE)
}

function computeSharedSecret(phantomPubKey: Uint8Array, dappSecretKey: Uint8Array): Uint8Array {
  return nacl.box.before(phantomPubKey, dappSecretKey)
}

export function encryptPayload(sharedSecret: Uint8Array, obj: unknown): { payload58: string; nonce58: string } {
  const nonce = nacl.randomBytes(24)
  const data = new TextEncoder().encode(JSON.stringify(obj))
  const box = nacl.box.after(data, nonce, sharedSecret)
  return { payload58: base58.encode(box), nonce58: base58.encode(nonce) }
}

export function decryptPayload(sharedSecret: Uint8Array, payload58: string, nonce58: string): any | null {
  try {
    const payload = base58.decode(payload58)
    const nonce = base58.decode(nonce58)
    const opened = nacl.box.open.after(payload, nonce, sharedSecret)
    if (!opened) return null
    const text = new TextDecoder().decode(opened)
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Build deep links
export function buildConnectUrl({ appUrl, dappPubKey58, redirect }: { appUrl: string; dappPubKey58: string; redirect: string }): string {
  const params = new URLSearchParams({
    app_url: appUrl,
    dapp_encryption_public_key: dappPubKey58,
    redirect_link: redirect,
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet-beta'
  })
  return `https://phantom.app/ul/v1/connect?${params.toString()}`
}

export function buildSignUrl({ appUrl, dappPubKey58, redirect, phantomPubKey, session, message }: { appUrl: string; dappPubKey58: string; redirect: string; phantomPubKey: Uint8Array; session: string; message: string }): { url: string } {
  const dappSecret = getEphemeralSecret()
  if (!dappSecret) throw new Error('Missing ephemeral secret')
  const shared = computeSharedSecret(phantomPubKey, dappSecret)
  const messageBytes58 = base58.encode(new TextEncoder().encode(message))
  const { payload58, nonce58 } = encryptPayload(shared, { session, message: messageBytes58 })
  const params = new URLSearchParams({
    app_url: appUrl,
    dapp_encryption_public_key: dappPubKey58,
    redirect_link: redirect,
    nonce: nonce58,
    payload: payload58,
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet-beta'
  })
  return { url: `https://phantom.app/ul/v1/signMessage?${params.toString()}` }
}

export async function startIOSConnectDeepLink(): Promise<void> {
  const origin = getPublicOrigin()
  setIntent('connect')
  // Ask backend to generate ephemeral keys and a connect URL so return can land in any browser
  const res = await fetch(`${API_URL}/api/auth/phantom/dl/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appUrl: origin, redirect: `${origin}/auth/phantom-callback` })
  })
  const { state, connectUrl, error } = await res.json()
  if (error || !state || !connectUrl) throw new Error(error || 'Failed to init Phantom connect')
  setKV('phantom_state', state)
  window.location.href = connectUrl
}

export async function continueIOSSignDeepLink(message: string): Promise<{ url: string }> {
  const origin = getPublicOrigin()
  const state = getKV('phantom_state')
  if (!state) throw new Error('Missing Phantom state')
  setIntent('sign')
  saveMessageToSign(message)
  const res = await fetch(`${API_URL}/api/auth/phantom/dl/sign-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, message, appUrl: origin, redirect: `${origin}/auth/phantom-callback` })
  })
  const { url, error } = await res.json()
  if (error || !url) throw new Error(error || 'Failed to build sign link')
  return { url }
}

export async function tryHandleCallbackOnServer(params: URLSearchParams): Promise<{ stage: 'connect' | 'sign'; result?: any } | null> {
  const phantomPubKey58 = params.get('phantom_encryption_public_key') || ''
  const payload58 = params.get('payload') || params.get('data') || ''
  const nonce58 = params.get('nonce') || ''
  // Try multiple sources for state: URL param, localStorage, sessionStorage, cookies
  const stateFromUrl = params.get('state')
  const stateFromStorage = getKV('phantom_state')
  const state = stateFromUrl || stateFromStorage || ''
  
  console.log('[tryHandleCallbackOnServer] Checking params:', {
    hasPhantomPubKey: !!phantomPubKey58,
    hasPayload: !!payload58,
    hasNonce: !!nonce58,
    stateFromUrl,
    stateFromStorage,
    finalState: state,
    allParams: Object.fromEntries(params)
  })
  
  // For sign stage, Phantom may not include phantom_encryption_public_key in the redirect URL
  // The backend will use the stored one from the connect stage
  if (!payload58 || !nonce58 || !state) {
    console.warn('[tryHandleCallbackOnServer] Missing required params:', {
      phantomPubKey58: !!phantomPubKey58,
      payload58: !!payload58,
      nonce58: !!nonce58,
      state: !!state
    })
    return null
  }
  // Persist state in the current browser so the subsequent sign step can find it
  setKV('phantom_state', state)

  // Phantom may send 'data' or 'payload' parameter - send both to backend for flexibility
  const res = await fetch(`${API_URL}/api/auth/phantom/dl/decrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      state, 
      phantom_encryption_public_key: phantomPubKey58 || undefined, // Optional for sign stage
      payload: payload58 || undefined,
      data: payload58 || undefined, // Some Phantom redirects use 'data' instead of 'payload'
      nonce: nonce58 
    })
  })
  const json = await res.json()
  if (!json?.ok || !json?.data) throw new Error(json?.error || 'Failed to decrypt')
  const data = json.data

  // Infer stage from data rather than relying on intent (which may be missing if a different browser handled the return)
  if (data.session && data.public_key) {
    storeSession(data.session, phantomPubKey58)
    setKV(SK_ADDRESS, data.public_key)
    return { stage: 'connect', result: { address: data.public_key } }
  }
  if (data.signature) {
    return { stage: 'sign', result: { signature58: data.signature } }
  }
  return null
}
