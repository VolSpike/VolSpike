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
            authorization: {
                params: {
                    prompt: 'select_account', // Force account selection on every sign-in
                    access_type: 'offline',
                    response_type: 'code',
                },
            },
            profile(profile) {
                console.log('[NextAuth] Google profile received:', {
                    sub: profile.sub,
                    email: profile.email,
                    name: profile.name,
                    picture: profile.picture,
                })
                return {
                    id: profile.sub,
                    email: profile.email,
                    name: profile.name,
                    image: profile.picture, // Google's profile picture URL
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
                // Normalize email to ensure consistency across auth methods
                token.email = user.email ? String(user.email).toLowerCase().trim() : user.email
                token.tier = user.tier || 'free' // Default to 'free' if undefined
                token.emailVerified = user.emailVerified
                token.role = user.role || 'USER' // Default to 'USER' if undefined
                token.status = user.status
                token.twoFactorEnabled = user.twoFactorEnabled
                token.accessToken = user.accessToken
                token.walletAddress = user.walletAddress
                token.walletProvider = user.walletProvider
                token.passwordChangedAt = user.passwordChangedAt || null // Track password change time
                // Store profile image if available (from Google OAuth or other providers)
                if (user.image) {
                    token.image = user.image
                }
                token.iat = Math.floor(Date.now() / 1000) // Issued at time
                console.log(`[Auth] JWT callback - User logged in: ${user.email}, tier: ${token.tier}, image: ${user.image ? 'present' : 'missing'}`)
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
                            // Check if password was changed after this token was issued
                            const dbPasswordChangedAt = dbUser.passwordChangedAt ? new Date(dbUser.passwordChangedAt).getTime() : 0
                            const tokenIssuedAt = (token.iat as number) * 1000 || 0
                            
                            if (dbPasswordChangedAt > tokenIssuedAt) {
                                // Password was changed after token was issued - invalidate session
                                console.log(`[Auth] ⚠️ Password changed after token issued - invalidating session`)
                                return null // Return null to invalidate the session
                            }
                            
                            const oldTier = token.tier
                            token.tier = dbUser.tier || 'free'
                            token.emailVerified = dbUser.emailVerified
                            token.role = dbUser.role || 'USER'
                            token.status = dbUser.status
                            token.twoFactorEnabled = dbUser.twoFactorEnabled
                            token.passwordChangedAt = dbUser.passwordChangedAt || null
                            // Preserve image from token if backend doesn't provide it
                            // (Backend may not store images, so we keep the OAuth image in the token)
                            if (dbUser.image) {
                                token.image = dbUser.image
                            } else if (!token.image && user?.image) {
                                // Fallback: preserve image from initial user object if not in token yet
                                token.image = user.image
                            }
                            token.tierLastChecked = Date.now() // Cache timestamp
                            
                            if (oldTier !== token.tier) {
                                console.log(`[Auth] ✅ Tier updated: ${oldTier} → ${token.tier} for ${dbUser.email}`)
                            }
                        }
                    } else if ((response.status === 401 || response.status === 404) && token.oauthProvider === 'google' && token.oauthProviderAccountId && token.email) {
                        // Self-heal: if /me says user not found but we have Google identity,
                        // create/link the account now using the saved providerAccountId.
                        try {
                            console.warn('[Auth] /me returned not found. Attempting self-heal via /oauth-link')
                            const linkRes = await fetch(`${BACKEND_API_URL}/api/auth/oauth-link`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: String(token.email).toLowerCase().trim(),
                                    name: token.email?.split('@')[0],
                                    image: token.image,
                                    provider: 'google',
                                    providerId: token.oauthProviderAccountId,
                                }),
                            })
                            if (linkRes.ok) {
                                const { user: dbUser, token: dbToken } = await linkRes.json()
                                token.id = dbUser.id
                                token.tier = dbUser.tier || token.tier || 'free'
                                token.emailVerified = dbUser.emailVerified
                                token.role = dbUser.role || token.role || 'USER'
                                token.status = dbUser.status || token.status
                                token.twoFactorEnabled = dbUser.twoFactorEnabled ?? token.twoFactorEnabled
                                if (dbToken) token.accessToken = dbToken
                                token.tierLastChecked = Date.now()
                                console.log('[Auth] ✅ Self-heal succeeded. Token now bound to DB user', dbUser.id)
                            } else {
                                const detail = await linkRes.json().catch(() => ({}))
                                console.warn('[Auth] Self-heal /oauth-link failed', linkRes.status, detail)
                            }
                        } catch (e) {
                            console.warn('[Auth] Self-heal attempt errored', e)
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
                    // Persist provider identity for future self-healing if linking fails
                    token.oauthProvider = 'google'
                    token.oauthProviderAccountId = account.providerAccountId
                    // Store Google profile image in token immediately - this is critical!
                    if (user.image) {
                        token.image = user.image
                        console.log('[NextAuth] ✅ Stored Google profile image in token:', user.image)
                    } else {
                        console.warn('[NextAuth] ⚠️ Google OAuth user object missing image field:', user)
                    }
                    
                    // Check if user is already logged in (for account linking)
                    const existingSession = token.id ? { userId: token.id } : null
                    
                    const requestBody: any = {
                        // Send normalized email to backend for consistent linking
                        email: String(user.email).toLowerCase().trim(),
                        name: user.name,
                        image: user.image, // Ensure image is sent to backend
                        provider: 'google',
                        // Use Google's stable subject identifier returned by NextAuth
                        // to avoid creating duplicate account rows per sign-in
                        providerId: account.providerAccountId,
                    }

                    // If user is already logged in, include Authorization header for linking
                    const headers: HeadersInit = {
                        'Content-Type': 'application/json',
                    }
                    
                    let endpoint = `${BACKEND_API_URL}/api/auth/oauth-link`
                    if (existingSession?.userId) {
                        headers['Authorization'] = `Bearer ${existingSession.userId}`
                        endpoint = `${BACKEND_API_URL}/api/auth/oauth/link`
                        console.log('[NextAuth] Linking Google OAuth to existing account:', existingSession.userId)
                    } else {
                        console.log('[NextAuth] Creating new account with Google OAuth')
                    }

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(requestBody),
                    })

                    if (response.ok) {
                        const responseData = await response.json()
                        
                        // If linking to existing account, use existing token data
                        if (existingSession?.userId && responseData.success) {
                            console.log('[NextAuth] Google OAuth linked successfully to existing account')
                            // Keep existing token data, just mark OAuth as linked
                            token.googleLinked = true
                        } else {
                            // New account creation
                            const { user: dbUser, token: dbToken } = responseData
                            token.id = dbUser.id
                            {
                                // Preserve email, but normalize casing for consistency
                                const candidate = token.email || dbUser.email || user.email
                                token.email = candidate ? String(candidate).toLowerCase().trim() : candidate
                            }
                            token.tier = dbUser.tier || 'free' // Default to 'free' if undefined
                            token.emailVerified = dbUser.emailVerified
                            token.role = dbUser.role || 'USER' // Default to 'USER' if undefined
                            token.status = dbUser.status
                            token.twoFactorEnabled = dbUser.twoFactorEnabled
                            token.accessToken = dbToken
                            // CRITICAL: Preserve Google profile image - backend doesn't return it
                            // Always use user.image if available (it's the fresh Google profile photo)
                            if (user.image) {
                                token.image = user.image
                                console.log('[NextAuth] ✅ Preserved Google profile image after account creation:', user.image)
                            } else if (token.image) {
                                console.log('[NextAuth] Keeping existing image from token:', token.image)
                            } else {
                                console.warn('[NextAuth] ⚠️ No profile image available after account creation')
                            }
                        }
                    } else {
                        const errorData = await response.json().catch(() => ({}))
                        console.error('[NextAuth] OAuth linking failed:', errorData)
                        // Don't throw error - let NextAuth handle it
                    }
                } catch (error) {
                    console.error('[NextAuth] OAuth linking failed:', error)
                    // Don't throw error - let NextAuth handle it
                }
            }

            return token
        },
        async session({ session, token }: any) {
            // If token is null (invalidated due to password change), return null to force logout
            if (!token) {
                return null as any
            }
            
            if (token && session.user) {
                session.user.id = token.id
                // Ensure email is normalized in the session
                session.user.email = token.email ? String(token.email).toLowerCase().trim() : token.email
                session.user.name = session.user.name || token.email?.split('@')[0] || 'VolSpike User'
                session.user.tier = token.tier || 'free' // Default to 'free' if undefined
                session.user.emailVerified = token.emailVerified
                session.user.role = token.role || 'USER' // Default to 'USER' if undefined
                session.user.status = token.status
                session.user.twoFactorEnabled = token.twoFactorEnabled
                session.user.walletAddress = token.walletAddress
                session.user.walletProvider = token.walletProvider
                // Always include profile image if available in token
                if (token.image) {
                    session.user.image = token.image
                }
                session.accessToken = token.accessToken
                console.log(`[Auth] Session callback - User: ${token.email}, tier: ${session.user.tier}, image: ${token.image ? 'present' : 'missing'}`)
            }
            return session
        },
    },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
