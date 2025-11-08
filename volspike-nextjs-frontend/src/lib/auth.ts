import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthConfig } from 'next-auth'

const BACKEND_API_URL = process.env.BACKEND_API_URL 
    || process.env.NEXT_PUBLIC_API_URL 
    || (typeof window === 'undefined' && process.env.NODE_ENV === 'production' 
        ? 'https://volspike-production.up.railway.app' 
        : 'http://localhost:3001')

export const authConfig: NextAuthConfig = {
    debug: process.env.NODE_ENV === 'development',
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            profile(profile) {
                return {
                    id: profile.sub,
                    email: profile.email,
                    name: profile.name,
                    image: profile.picture,
                }
            }
        }),
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                try {
                    console.log('[NextAuth] Calling backend:', `${BACKEND_API_URL}/api/auth/signin`)
                    console.log('[NextAuth] Credentials:', { email: credentials.email, hasPassword: !!credentials.password })
                    
                    const response = await fetch(`${BACKEND_API_URL}/api/auth/signin`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                        }),
                    })
                    
                    console.log('[NextAuth] Response status:', response.status, response.statusText)

                    if (!response.ok) {
                        console.error('[NextAuth] Backend signin failed', response.status)
                        const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }))
                        console.error('[NextAuth] Backend error:', errorData)

                        // For 403 (email not verified), throw a specific error that NextAuth will pass through
                        if (response.status === 403 && errorData?.requiresVerification) {
                            throw new Error(errorData.error || 'Please verify your email address before signing in')
                        }

                        // For 401 (invalid credentials), prefer backend message
                        if (response.status === 401) {
                            if (errorData?.oauthOnly) {
                                throw new Error('Please use OAuth login (Google) for this account')
                            }
                            throw new Error(errorData?.error || 'Invalid credentials')
                        }

                        // For other errors, throw generic error
                        throw new Error(errorData?.error || 'Authentication failed')
                    }

                    const { user, token } = await response.json()

                    if (!user?.id || !token) {
                        console.error('[NextAuth] Backend response missing user or token')
                        return null
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.email,
                        tier: user.tier || 'free', // Default to 'free' if undefined
                        emailVerified: user.emailVerified,
                        role: user.role || 'USER', // Default to 'USER' if undefined
                        status: user.status,
                        twoFactorEnabled: user.twoFactorEnabled,
                        accessToken: token,
                    }
                } catch (error) {
                    console.error('[NextAuth] Authorization error:', error)
                    // Return null for any errors - NextAuth will handle this properly
                    return null
                }
            }
        }),
        CredentialsProvider({
            id: 'siwe',
            name: 'SIWE',
            credentials: {
                token: { label: 'Token', type: 'text' },
                walletAddress: { label: 'Wallet Address', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.token) {
                    console.error('[NextAuth] SIWE authorize: missing token')
                    return null
                }

                // Verify the backend-issued token locally. The backend signs SIWE tokens
                // with HS256 using JWT_SECRET (or NEXTAUTH_SECRET). Try a few candidates.
                const candidateSecrets = [
                    process.env.SIWE_JWT_SECRET,
                    process.env.JWT_SECRET,
                    process.env.NEXTAUTH_SECRET,
                ].filter(Boolean) as string[]

                for (const secret of candidateSecrets) {
                    try {
                        // jsonwebtoken typings export named verify; use it to satisfy TS
                        const { verify } = await import('jsonwebtoken')
                        const payload: any = verify(credentials.token as string, secret as string)

                        return {
                            id: payload.sub || payload.userId || payload.address,
                            name: payload.address || payload.sub || 'Wallet User',
                            email: undefined,
                            walletAddress: payload.address,
                            walletProvider: 'evm',
                            role: payload.role || 'USER',
                            tier: payload.tier || 'free',
                            accessToken: credentials.token,
                        } as any
                    } catch (_) {
                        // try next secret
                    }
                }

                console.error('[NextAuth] SIWE authorize: JWT local verification failed with all candidate secrets')
                return null
            },
        })
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/auth',
        error: '/auth',
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, user, account, trigger }: any) {
            if (user) {
                token.id = user.id
                token.email = user.email
                token.tier = user.tier || 'free' // Default to 'free' if undefined
                token.emailVerified = user.emailVerified
                token.role = user.role || 'USER' // Default to 'USER' if undefined
                token.status = user.status
                token.twoFactorEnabled = user.twoFactorEnabled
                token.accessToken = user.accessToken
                token.walletAddress = user.walletAddress
                token.walletProvider = user.walletProvider
                console.log(`[Auth] JWT callback - User logged in: ${user.email}, tier: ${token.tier}`)
            }

            // Always fetch fresh tier data from database when update() is called or periodically
            // This ensures tier changes are reflected immediately
            if (token.id && (trigger === 'update' || !token.tierLastChecked || Date.now() - (token.tierLastChecked as number) > 30000)) {
                try {
                    const meUrl = `${BACKEND_API_URL}/api/auth/me`
                    const response = await fetch(meUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token.accessToken || token.id}`,
                        },
                    })

                    if (response.ok) {
                        const { user: dbUser } = await response.json()
                        
                        if (dbUser) {
                            const oldTier = token.tier
                            token.tier = dbUser.tier || 'free'
                            token.emailVerified = dbUser.emailVerified
                            token.role = dbUser.role || 'USER'
                            token.status = dbUser.status
                            token.twoFactorEnabled = dbUser.twoFactorEnabled
                            token.tierLastChecked = Date.now() // Cache timestamp
                            
                            if (oldTier !== token.tier) {
                                console.log(`[Auth] ✅ Tier updated: ${oldTier} → ${token.tier} for ${dbUser.email}`)
                            }
                        }
                    }
                } catch (error) {
                    // Silently fail - use cached tier if fetch fails
                    console.error('[Auth] Error refreshing user data:', error)
                }
            }

            // Handle Google OAuth account linking
            if (account?.provider === 'google' && user?.email) {
                try {
                    // Check if user exists in our database
                    console.log('[NextAuth] OAuth linking to:', `${BACKEND_API_URL}/api/auth/oauth-link`)
                    const response = await fetch(`${BACKEND_API_URL}/api/auth/oauth-link`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            email: user.email,
                            name: user.name,
                            image: user.image,
                            provider: 'google',
                            // Use Google's stable subject identifier returned by NextAuth
                            // to avoid creating duplicate account rows per sign-in
                            providerId: account.providerAccountId,
                        }),
                    })

                    if (response.ok) {
                        const { user: dbUser, token: dbToken } = await response.json()
                        token.id = dbUser.id
                        token.tier = dbUser.tier || 'free' // Default to 'free' if undefined
                        token.emailVerified = dbUser.emailVerified
                        token.role = dbUser.role || 'USER' // Default to 'USER' if undefined
                        token.status = dbUser.status
                        token.twoFactorEnabled = dbUser.twoFactorEnabled
                        token.accessToken = dbToken
                    }
                } catch (error) {
                    console.error('[NextAuth] OAuth linking failed:', error)
                }
            }

            return token
        },
        async session({ session, token }: any) {
            if (token && session.user) {
                session.user.id = token.id
                session.user.email = token.email
                session.user.name = session.user.name || token.email?.split('@')[0] || 'VolSpike User'
                session.user.tier = token.tier || 'free' // Default to 'free' if undefined
                session.user.emailVerified = token.emailVerified
                session.user.role = token.role || 'USER' // Default to 'USER' if undefined
                session.user.status = token.status
                session.user.twoFactorEnabled = token.twoFactorEnabled
                session.user.walletAddress = token.walletAddress
                session.user.walletProvider = token.walletProvider
                session.accessToken = token.accessToken
                console.log(`[Auth] Session callback - User: ${token.email}, tier: ${session.user.tier}, AccessToken set to JWT`)
            }
            return session
        },
    },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
