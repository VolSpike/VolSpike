import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string
    image?: string
    tier?: 'free' | 'pro' | 'elite'
    role?: 'USER' | 'ADMIN'
    status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED'
    twoFactorEnabled?: boolean
    accessToken?: string
    walletAddress?: string
    walletProvider?: 'evm' | 'solana' | null
    sessionId?: string // Session ID for single-session enforcement
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      tier?: 'free' | 'pro' | 'elite'
      role?: 'USER' | 'ADMIN'
      status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED'
      twoFactorEnabled?: boolean
      walletAddress?: string
      walletProvider?: 'evm' | 'solana' | null
    }
    accessToken?: string
    sessionId?: string // Session ID for single-session enforcement
    authMethod?: 'password' | 'google' | 'evm' | 'solana' | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    tier?: 'free' | 'pro' | 'elite'
    role?: 'USER' | 'ADMIN'
    status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED'
    twoFactorEnabled?: boolean
    accessToken?: string
    walletAddress?: string
    walletProvider?: 'evm' | 'solana' | null
    authMethod?: 'password' | 'google' | 'evm' | 'solana' | null
    sessionId?: string // Session ID for single-session enforcement
  }
}
