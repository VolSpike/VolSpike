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
                password: { label: 'Password', type: 'password' },
                deviceId: { label: 'Device ID', type: 'text' } // Client-generated device ID for session tracking
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                try {
                    console.log('[NextAuth] Calling backend:', `${BACKEND_API_URL}/api/auth/signin`)
                    console.log('[NextAuth] Credentials:', { email: credentials.email, hasPassword: !!credentials.password, hasDeviceId: !!credentials.deviceId })

                    const response = await fetch(`${BACKEND_API_URL}/api/auth/signin`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                            deviceId: credentials.deviceId || undefined, // Pass deviceId to backend for session tracking
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

                    const { user, token, sessionId } = await response.json()

                    if (!user?.id || !token) {
                        console.error('[NextAuth] Backend response missing user or token')
                        return null
                    }

                    console.log('[NextAuth] Sign-in successful', { sessionId: sessionId ? 'present' : 'missing' })

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
                        authMethod: 'password',
                        sessionId, // Store sessionId for session validation
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
                            authMethod: 'evm',
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
        // CRITICAL: Handle redirects after OAuth sign-in
        // This ensures admin users are redirected to /admin, not back to /auth
        async redirect({ url, baseUrl }: any) {
            console.log('[NextAuth] Redirect callback triggered:', {
                url,
                baseUrl,
                isRelative: url?.startsWith('/'),
                isSameOrigin: url?.startsWith(baseUrl),
                fullUrl: url,
            })

            // If url is relative, it's safe to redirect
            if (url?.startsWith('/')) {
                console.log('[NextAuth] ✅ Redirecting to relative URL:', url)
                return url
            }

            // If url is same origin, redirect to it
            if (url?.startsWith(baseUrl)) {
                console.log('[NextAuth] ✅ Redirecting to same-origin URL:', url)
                return url
            }

            // Default: redirect to base URL (home page)
            console.log('[NextAuth] ✅ Redirecting to base URL:', baseUrl)
            return baseUrl
        },
        async jwt({ token, user, account, trigger }: any) {
            // Handle non-Google sign-in (email/password, SIWE, etc.)
            if (user && account?.provider !== 'google') {
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
                // Store sessionId for session validation
                if ((user as any).sessionId) {
                    token.sessionId = (user as any).sessionId
                }
                if ((user as any).authMethod) {
                    token.authMethod = (user as any).authMethod
                }
                // Store profile image if available (from OAuth or other providers)
                if (user.image) {
                    token.image = user.image
                }
                token.iat = Math.floor(Date.now() / 1000) // Issued at time
                console.log(`[Auth] JWT callback - User logged in: ${user.email}, role: ${token.role}, tier: ${token.tier}, authMethod: ${token.authMethod}, sessionId: ${token.sessionId ? 'present' : 'missing'}`, {
                    userId: user.id,
                    role: token.role,
                    tier: token.tier,
                    authMethod: token.authMethod,
                    hasAccessToken: !!token.accessToken,
                    hasSessionId: !!token.sessionId,
                })
            }

            // For initial Google OAuth sign-in, we deliberately avoid treating
            // Google's subject (`profile.sub`) as our database user ID.
            // We only stash basic identity here; the real user ID is obtained
            // from the backend in the OAuth linking block below.
            if (user && account?.provider === 'google') {
                // Normalize email immediately so subsequent callbacks see the same casing
                token.email = user.email ? String(user.email).toLowerCase().trim() : user.email
                token.tier = user.tier || token.tier || 'free'
                token.emailVerified = user.emailVerified ?? token.emailVerified
                token.role = user.role || token.role || 'USER'
                token.status = user.status ?? token.status
                token.twoFactorEnabled = user.twoFactorEnabled ?? token.twoFactorEnabled
                if ((user as any).authMethod) {
                    token.authMethod = (user as any).authMethod
                } else if (!token.authMethod) {
                    token.authMethod = 'google'
                }
                // Store Google profile image while we have it
                if (user.image) {
                    token.image = user.image
                }
                token.iat = Math.floor(Date.now() / 1000)
                console.log(`[Auth] JWT callback - Google OAuth user initiated login: ${user.email}, image: ${user.image ? 'present' : 'missing'}`)
            }

            // Always fetch fresh tier data from database when update() is called or periodically
            // This ensures tier changes are reflected immediately
            // Also fetch immediately after OAuth sign-in (when user object is present but token might be stale)
            // IMPORTANT: Use longer refresh interval (5 minutes) to prevent unnecessary backend calls
            // and reduce the chance of session invalidation due to transient network issues
            const shouldRefresh = trigger === 'update' ||
                !token.tierLastChecked ||
                Date.now() - (token.tierLastChecked as number) > 300000 || // 5 minutes instead of 30 seconds
                (user && account?.provider === 'google') // Force refresh after Google OAuth

            if (token.id && shouldRefresh) {
                try {
                    const meUrl = `${BACKEND_API_URL}/api/auth/me`
                    // Add timeout to prevent hanging requests
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

                    const response = await fetch(meUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token.accessToken || token.id}`,
                            'X-Auth-Source': 'nextauth-jwt',
                        },
                        signal: controller.signal,
                    })

                    clearTimeout(timeoutId)

                    console.log(`[Auth] JWT callback - fetching user data, status: ${response.status}`)
                    
                    if (response.ok) {
                        const { user: dbUser } = await response.json()

                        if (dbUser) {
                            // Check if password was changed after this token was issued
                            // IMPORTANT: Only check for password-based auth, not OAuth
                            const dbPasswordChangedAt = dbUser.passwordChangedAt ? new Date(dbUser.passwordChangedAt).getTime() : 0
                            const tokenIssuedAt = (token.iat as number) * 1000 || 0
                            const isPasswordAuth = token.authMethod === 'password' || (!token.authMethod && !token.oauthProvider)

                            // Only invalidate if:
                            // 1. This is password-based auth
                            // 2. Password was changed AFTER token was issued
                            // 3. Password change is significant (>10 seconds after token issued to avoid race conditions)
                            const timeDiff = dbPasswordChangedAt - tokenIssuedAt
                            if (isPasswordAuth && dbPasswordChangedAt > 0 && timeDiff > 10000) {
                                // Password was changed after token was issued - invalidate session
                                console.log(`[Auth] ⚠️ Password changed ${Math.round(timeDiff/1000)}s after token issued - invalidating session`, {
                                    dbPasswordChangedAt: new Date(dbPasswordChangedAt).toISOString(),
                                    tokenIssuedAt: new Date(tokenIssuedAt).toISOString(),
                                    authMethod: token.authMethod,
                                    email: dbUser.email,
                                })
                                return null // Return null to invalidate the session
                            } else if (dbPasswordChangedAt > tokenIssuedAt) {
                                // Log but don't invalidate (race condition or OAuth user)
                                console.log(`[Auth] Password check: not invalidating (timeDiff: ${Math.round(timeDiff/1000)}s, isPasswordAuth: ${isPasswordAuth})`)
                            }

                            // CRITICAL: Check if user status is BANNED or user was deleted
                            if (dbUser.status === 'BANNED') {
                                console.log(`[Auth] ⚠️ User account is banned - invalidating session`)
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
                        } else {
                            // User not found in database - account was deleted
                            console.error(`[Auth] ⚠️ User not found in database response - account was deleted - invalidating session`)
                            return null // Return null to invalidate the session
                        }
                    } else if (response.status === 404 || response.status === 401) {
                        // User not found or token invalid – attempt Google self-heal first if possible
                        const errorData = await response.json().catch(() => ({ error: 'User not found' }))
                        const isNotFound = response.status === 404 || errorData.error?.toLowerCase().includes('not found')

                        if (isNotFound && token.oauthProvider === 'google' && token.oauthProviderAccountId && token.email) {
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

                        if (isNotFound) {
                            console.error(`[Auth] ⚠️ User not found (${response.status}) - account was deleted - invalidating session`)
                            return null // Return null to invalidate the session
                        }

                        // If it's a 401 but not clearly "not found", might be auth error - don't invalidate yet
                        console.warn(`[Auth] Non-404/401 error or unclear error message, status: ${response.status}`)
                    }
                } catch (error) {
                    // IMPORTANT: Silently fail and use cached token data if fetch fails
                    // This prevents session invalidation due to network issues or backend downtime
                    // Only log error for debugging - don't invalidate the session
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout')
                    console.error(`[Auth] Error refreshing user data${isTimeout ? ' (timeout)' : ''} - using cached token:`, errorMessage)
                    // Update tierLastChecked to prevent immediate retry on next page navigation
                    token.tierLastChecked = Date.now()
                }
            }

            // Handle Google OAuth account linking for sign-in.
            // This runs on the OAuth callback and ensures we always have a real
            // database user ID + backend access token associated with the session.
            if (account?.provider === 'google' && user?.email) {
                try {
                    token.authMethod = 'google'
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

                    // Generate a deviceId for OAuth users (server-side, so use crypto.randomUUID)
                    // This ensures OAuth users get session tracking just like credentials users
                    const oauthDeviceId = crypto.randomUUID()

                    const requestBody: any = {
                        // Send normalized email to backend for consistent linking
                        email: String(user.email).toLowerCase().trim(),
                        name: user.name,
                        image: user.image, // Ensure image is sent to backend
                        provider: 'google',
                        // Use Google's stable subject identifier returned by NextAuth
                        // to avoid creating duplicate account rows per sign-in
                        providerId: account.providerAccountId,
                        deviceId: oauthDeviceId, // Pass deviceId for single-session enforcement
                    }

                    const headers: HeadersInit = {
                        'Content-Type': 'application/json',
                    }

                    // Always use the unauthenticated OAuth endpoint here. It handles both
                    // first-time sign-ins and repeat sign-ins for the same Google account.
                    const endpoint = `${BACKEND_API_URL}/api/auth/oauth-link`
                    console.log('[NextAuth] Creating or linking account with Google OAuth via /oauth-link', {
                        endpoint,
                        email: requestBody.email,
                        provider: requestBody.provider,
                    })

                    console.log('[NextAuth] Calling OAuth endpoint:', {
                        endpoint,
                        email: requestBody.email,
                        provider: requestBody.provider,
                    })

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(requestBody),
                    })

                    console.log('[NextAuth] OAuth endpoint response:', {
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok,
                        endpoint,
                    })

                    if (response.ok) {
                        const { user: dbUser, token: dbToken, sessionId: dbSessionId } = await response.json()
                        console.log('[NextAuth] OAuth endpoint success:', {
                            hasUser: !!dbUser,
                            hasToken: !!dbToken,
                            hasSessionId: !!dbSessionId,
                            userId: dbUser?.id,
                            email: dbUser?.email,
                            role: dbUser?.role,
                        })

                        if (!dbUser || !dbUser.id) {
                            throw new Error('OAuth linking failed: backend did not return a user')
                        }

                        token.id = dbUser.id
                        {
                            // Preserve email, but normalize casing for consistency
                            const candidate = token.email || dbUser.email || user.email
                            token.email = candidate ? String(candidate).toLowerCase().trim() : candidate
                        }
                        token.tier = dbUser.tier || 'free' // Default to 'free' if undefined
                        token.emailVerified = dbUser.emailVerified
                        token.role = dbUser.role || 'USER' // Default to 'USER' if undefined - CRITICAL for admin access
                        token.status = dbUser.status
                        token.twoFactorEnabled = dbUser.twoFactorEnabled
                        token.accessToken = dbToken
                        // Store sessionId for single-session enforcement
                        if (dbSessionId) {
                            token.sessionId = dbSessionId
                        }
                        token.tierLastChecked = Date.now() // Mark as checked so refresh happens

                        console.log(`[NextAuth] ✅ OAuth account created/linked: ${dbUser.email}, role: ${token.role}, tier: ${token.tier}, sessionId: ${dbSessionId ? 'present' : 'missing'}`)
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
                    } else {
                        const errorData = await response.json().catch(() => ({}))
                        const errorMessage = errorData?.error || `OAuth linking failed: ${response.status} ${response.statusText}`
                        console.error('[NextAuth] OAuth linking failed:', {
                            status: response.status,
                            statusText: response.statusText,
                            errorData,
                            email: user?.email,
                            provider: account?.provider,
                        })
                        // CRITICAL: Throw error so NextAuth knows sign-in failed
                        // If we don't throw, NextAuth continues with incomplete token and user isn't signed in
                        throw new Error(errorMessage)
                    }
                } catch (error) {
                    console.error('[NextAuth] OAuth linking failed:', error)
                    // CRITICAL: Re-throw error so NextAuth knows sign-in failed
                    throw error
                }
            }

            // CRITICAL: Ensure token has required fields before returning
            // If OAuth linking didn't set token.id, the session will be invalid
            if (account?.provider === 'google' && !token.id) {
                console.error('[NextAuth] CRITICAL: OAuth token missing user ID after linking attempt', {
                    hasToken: !!token,
                    tokenKeys: token ? Object.keys(token) : [],
                    email: user?.email,
                    provider: account?.provider,
                })
                throw new Error('OAuth authentication failed: Unable to create user session')
            }

            return token
        },
        async session({ session, token }: any) {
            // If token is null (invalidated due to password change), return null to force logout
            if (!token) {
                console.warn('[Auth] Session callback: token is null, returning null session')
                return null as any
            }

            // CRITICAL: If token doesn't have user ID, session is invalid
            if (!token.id) {
                console.error('[Auth] Session callback: token missing user ID, returning null session', {
                    hasToken: !!token,
                    tokenKeys: token ? Object.keys(token) : [],
                    email: token.email,
                })
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
                    ; (session as any).authMethod = token.authMethod || null
                // Always include profile image if available in token
                if (token.image) {
                    session.user.image = token.image
                }
                session.accessToken = token.accessToken
                // Include sessionId for session validation
                session.sessionId = token.sessionId

                console.log(`[Auth] Session callback - User: ${token.email}, role: ${token.role}, tier: ${session.user.tier}, hasAccessToken: ${!!token.accessToken}, hasSessionId: ${!!token.sessionId}`, {
                    userId: token.id,
                    email: token.email,
                    role: token.role,
                    tier: token.tier,
                    status: token.status,
                    hasAccessToken: !!token.accessToken,
                    hasSessionId: !!token.sessionId,
                    authMethod: token.authMethod,
                })
            } else {
                console.error('[Auth] Session callback: token or session.user missing', {
                    hasToken: !!token,
                    hasSession: !!session,
                    hasSessionUser: !!session?.user,
                    tokenKeys: token ? Object.keys(token) : [],
                    sessionKeys: session ? Object.keys(session) : [],
                })
            }
            return session
        },
    },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
