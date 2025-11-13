import { Hono } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { getUser, requireUser } from '../lib/hono-extensions'
import EmailService from '../services/email'
import { authMiddleware } from '../middleware/auth'
import * as bcrypt from 'bcryptjs'
import { SiweMessage, generateNonce } from 'siwe'
import { verifyMessage } from 'viem'
import { nonceManager } from '../services/nonce-manager'
import { isAllowedChain } from '../config/chains'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const logger = createLogger()
const emailService = EmailService.getInstance()

const auth = new Hono()

// Helper function to extract userId from Authorization header (optional - returns null if not authenticated)
async function getUserIdFromHeader(authHeader: string | undefined): Promise<string | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    let userId: string | null = null

    // Check if it's a simple user ID (from NextAuth session)
    if (!token.includes('.') && !token.startsWith('mock-token-')) {
        userId = token
    }
    // Handle mock tokens
    else if (token.startsWith('mock-token-')) {
        const match = token.match(/^mock-token-(.+?)-\d+$/)
        if (match) {
            userId = match[1]
        }
    }
    // Verify JWT tokens
    else {
        try {
            const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
            const secretBytes = new TextEncoder().encode(secret)
            const { payload } = await jwtVerify(token, secretBytes)

            if (payload.sub) {
                userId = payload.sub as string
            }
        } catch (jwtError) {
            // Invalid token - return null (user not authenticated)
            return null
        }
    }

    return userId
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Validation schemas
const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
})

// Shared password validation schema
const passwordSchema = z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character')

const signUpSchema = z.object({
    email: z.string().email(),
    password: passwordSchema,
    tier: z.enum(['free', 'pro', 'elite']).default('free'),
})

const siweSchema = z.object({
    message: z.string(),
    signature: z.string(),
    address: z.string(),
})

const oauthLinkSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    image: z.string().optional(),
    provider: z.string(),
    providerId: z.string(),
})

const requestVerificationSchema = z.object({
    email: z.string().email(),
})

const verifyEmailSchema = z.object({
    token: z.string(),
    email: z.string().email(),
})

// Password reset schemas
const requestPasswordResetSchema = z.object({
    email: z.string().email(),
})
const resetPasswordSchema = z.object({
    token: z.string().min(10),
    email: z.string().email(),
    newPassword: passwordSchema,
})
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
})

// Rate limiting middleware
function rateLimit(identifier: string, maxRequests: number = 5, windowMs: number = 60 * 60 * 1000) {
    const now = Date.now()
    const key = identifier
    const record = rateLimitStore.get(key)

    if (!record || now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
        return true
    }

    if (record.count >= maxRequests) {
        return false
    }

    record.count++
    return true
}

// Generate JWT token. Optional payload lets callers include extra SIWE fields
// such as wallet address/provider without affecting email/password tokens.
async function generateToken(userId: string, extraPayload?: Record<string, unknown>): Promise<string> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

    const base: Record<string, unknown> = { sub: userId }
    const claims = extraPayload ? { ...base, ...extraPayload } : base

    return await new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret)
}

// Hash password
async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12)
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
}

// Sign in with email/password
auth.post('/signin', async (c) => {
    try {
        const body = await c.req.json()
        logger.info(`[AUTH] /signin request received for: ${body.email}`)
        
        const { email, password } = signInSchema.parse(body)
        logger.info(`[AUTH] Schema validation passed for: ${email}`)

        // Case-insensitive email lookup
        const user = await prisma.user.findFirst({
            where: { 
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            },
        })

        if (!user) {
            logger.warn(`[AUTH] User not found: ${email}`)
            return c.json({ error: 'Invalid credentials' }, 401)
        }

        logger.info(`[AUTH] User found: ${user.email}, hasPassword: ${!!user.passwordHash}, emailVerified: ${!!user.emailVerified}, walletAddress: ${!!user.walletAddress}`)

        // Check if email is verified (allow wallet users to bypass)
        if (!user.emailVerified && !user.walletAddress) {
            logger.info(`Sign-in blocked for ${email}: email not verified`)
            return c.json({
                error: 'Please verify your email address before signing in. Check your inbox for the verification email.',
                requiresVerification: true,
                email: user.email // Include email so frontend can show resend option
            }, 403)
        }

        // Verify password
        if (!user.passwordHash) {
            logger.error(`User ${email} has no password hash - may be OAuth-only user`)
            return c.json({
                error: 'Please use OAuth login (Google) for this account',
                oauthOnly: true
            }, 401)
        }

        logger.info(`[AUTH] Verifying password for: ${email}`)
        const isValidPassword = await verifyPassword(password, user.passwordHash)
        logger.info(`[AUTH] Password verification result: ${isValidPassword ? 'VALID' : 'INVALID'}`)
        
        if (!isValidPassword) {
            logger.warn(`Invalid password attempt for ${email}`)
            return c.json({ error: 'Invalid email or password' }, 401)
        }
        
        logger.info(`[AUTH] Password valid, generating token for: ${email}`)

        const token = await generateToken(user.id)

        logger.info(`User ${user.email} signed in`)

        return c.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
                refreshInterval: user.refreshInterval,
                theme: user.theme,
                role: user.role,
                status: user.status,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        })
    } catch (error) {
        logger.error('Sign in error:', error)
        return c.json({ error: 'Invalid request' }, 400)
    }
})

// Sign up with email/password
auth.post('/signup', async (c) => {
    try {
        const body = await c.req.json()
        const { email, password, tier } = signUpSchema.parse(body)

        // Normalize email to lowercase
        const normalizedEmail = email.toLowerCase().trim()

        // Check if user already exists (case-insensitive)
        const existingUser = await prisma.user.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive'
                }
            },
        })

        if (existingUser) {
            return c.json({ error: 'User already exists' }, 409)
        }

        // Hash password
        const passwordHash = await hashPassword(password)

        // Create new user with hashed password and normalized email
        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                tier,
                passwordHash,
                emailVerified: null, // Will be set after email verification
            },
        })

        // Generate verification token
        const verificationToken = emailService.generateVerificationToken()
        const verificationUrl = `${process.env.EMAIL_VERIFICATION_URL_BASE}/auth/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`

        // Store verification token
        await prisma.verificationToken.create({
            data: {
                identifier: email,
                token: verificationToken,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                userId: user.id,
            },
        })

        // Send verification email
        const emailSent = await emailService.sendVerificationEmail({
            email,
            name: email.split('@')[0],
            verificationUrl,
        })

        if (!emailSent) {
            logger.error(`Failed to send verification email to ${email}`)
        }

        logger.info(`New user registered: ${user.email}`)

        return c.json({
            message: 'Account created successfully. Please check your email to verify your account.',
            requiresVerification: true,
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                emailVerified: user.emailVerified,
            },
        })
    } catch (error) {
        logger.error('Sign up error:', error)
        return c.json({ error: 'Invalid request' }, 400)
    }
})

// OAuth account linking (for Google OAuth)
auth.post('/oauth-link', async (c) => {
    try {
        const body = await c.req.json()
        const { email, name, image, provider, providerId } = oauthLinkSchema.parse(body)
        // Normalize email to ensure consistent user linking regardless of casing
        const normalizedEmail = email.toLowerCase().trim()

        // Find existing user by normalized email
        let user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        })

        if (!user) {
            // Create new user for OAuth
            user = await prisma.user.create({
                data: {
                    email: normalizedEmail,
                    tier: 'free',
                    emailVerified: new Date(), // OAuth users are considered verified
                },
            })
        }

        // Create or update account record
        await prisma.account.upsert({
            where: {
                provider_providerAccountId: {
                    provider,
                    providerAccountId: providerId,
                },
            },
            update: {
                userId: user.id,
                access_token: '', // OAuth tokens would be stored here
            },
            create: {
                userId: user.id,
                type: 'oauth',
                provider,
                providerAccountId: providerId,
                access_token: '', // OAuth tokens would be stored here
            },
        })

        const token = await generateToken(user.id)

        logger.info(`OAuth user linked: ${user.email}`)

        return c.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
                refreshInterval: user.refreshInterval,
                theme: user.theme,
                role: user.role,
                status: user.status,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        })
    } catch (error) {
        logger.error('OAuth link error:', error)
        return c.json({ error: 'Invalid request' }, 400)
    }
})

// Request email verification
auth.post('/request-verification', async (c) => {
    try {
        const body = await c.req.json()
        const { email } = requestVerificationSchema.parse(body)

        // Rate limiting
        if (!rateLimit(`verification:${email}`, 5, 60 * 60 * 1000)) {
            return c.json({ error: 'Too many verification requests. Please try again later.' }, 429)
        }

        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            // Don't reveal if user exists
            return c.json({ message: 'If an account exists with this email, a verification email has been sent.' })
        }

        if (user.emailVerified) {
            return c.json({ message: 'Email is already verified.' })
        }

        // Generate new verification token
        const verificationToken = emailService.generateVerificationToken()
        const verificationUrl = `${process.env.EMAIL_VERIFICATION_URL_BASE}/auth/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`

        // Delete old tokens
        await prisma.verificationToken.deleteMany({
            where: { identifier: email },
        })

        // Store new verification token
        await prisma.verificationToken.create({
            data: {
                identifier: email,
                token: verificationToken,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                userId: user.id,
            },
        })

        // Update last verification sent time
        await prisma.user.update({
            where: { id: user.id },
            data: { lastVerificationSent: new Date() },
        })

        // Send verification email
        const emailSent = await emailService.sendVerificationEmail({
            email,
            name: email.split('@')[0],
            verificationUrl,
        })

        if (!emailSent) {
            logger.error(`Failed to send verification email to ${email}`)
            return c.json({ error: 'Failed to send verification email' }, 500)
        }

        logger.info(`Verification email sent to ${email}`)

        return c.json({ message: 'Verification email sent successfully.' })
    } catch (error) {
        logger.error('Request verification error:', error)
        return c.json({ error: 'Invalid request' }, 400)
    }
})

// ======= Password: Forgot =======
auth.post('/password/forgot', async (c) => {
    try {
        const body = await c.req.json()
        const { email } = requestPasswordResetSchema.parse(body)

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
        })

        // Always return success (prevent user enumeration)
        if (!user) {
            return c.json({ success: true })
        }

        const token = emailService.generateVerificationToken()
        const identifier = `${user.email}|pwreset`

        await prisma.verificationToken.deleteMany({ where: { identifier } })
        await prisma.verificationToken.create({
            data: {
                identifier,
                token,
                expires: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
                userId: user.id,
            },
        })

        const base = process.env.FRONTEND_URL || 'http://localhost:3000'
        const resetUrl = `${base}/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`
        await emailService.sendPasswordResetEmail({ email: user.email, resetUrl })

        // Return helpful info for OAuth-only users (still return success to prevent enumeration)
        const isOAuthOnly = !user.passwordHash
        return c.json({ 
            success: true,
            isOAuthOnly: isOAuthOnly || undefined // Only include if true
        })
    } catch (error) {
        logger.error('Forgot password error:', error)
        return c.json({ success: true })
    }
})

// ======= Password: Reset with token =======
auth.post('/password/reset', async (c) => {
    try {
        const body = await c.req.json()
        const { token, email, newPassword } = resetPasswordSchema.parse(body)
        const identifier = `${email}|pwreset`

        const tokenRow = await prisma.verificationToken.findFirst({ where: { identifier, token } })
        if (!tokenRow || tokenRow.expires < new Date()) {
            return c.json({ error: 'Invalid or expired token' }, 400)
        }

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
        })
        if (!user) {
            return c.json({ error: 'Invalid request' }, 400)
        }

        // Prevent reusing the current password
        if (user.passwordHash) {
            const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)
            if (isSamePassword) {
                return c.json({ error: 'New password must be different from your current password' }, 400)
            }
        }

        const hash = await bcrypt.hash(newPassword, 12)
        await prisma.user.update({ 
            where: { id: user.id }, 
            data: { 
                passwordHash: hash,
                passwordChangedAt: new Date() // Track password change for session invalidation
            } 
        })
        await prisma.verificationToken.deleteMany({ where: { identifier } })

        return c.json({ success: true })
    } catch (error) {
        logger.error('Reset password error:', error)
        return c.json({ error: 'Failed to reset password' }, 500)
    }
})

// ======= Password: Change (authenticated) =======
auth.post('/password/change', async (c) => {
    try {
        // Reuse /me authentication logic: accept Authorization Bearer header
        const authHeader = c.req.header('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Not authenticated' }, 401)
        }
        const token = authHeader.substring(7)
        let userId: string | null = null
        if (!token.includes('.') && !token.startsWith('mock-token-')) {
            userId = token
        } else if (token.startsWith('mock-token-')) {
            const match = token.match(/^mock-token-(.+?)-\d+$/)
            if (match) userId = match[1]
        } else {
            try {
                const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
                const secretBytes = new TextEncoder().encode(secret)
                const { payload } = await jwtVerify(token, secretBytes)
                userId = (payload.sub as string) || null
            } catch {
                return c.json({ error: 'Invalid token' }, 401)
            }
        }
        if (!userId) return c.json({ error: 'Invalid token' }, 401)

        const body = await c.req.json()
        const { currentPassword, newPassword } = changePasswordSchema.parse(body)
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user?.passwordHash) {
            return c.json({ error: 'No password set for this account' }, 400)
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!valid) {
            return c.json({ error: 'Current password is incorrect' }, 400)
        }
        
        // Prevent reusing the current password
        const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)
        if (isSamePassword) {
            return c.json({ error: 'New password must be different from your current password' }, 400)
        }
        
        const hash = await bcrypt.hash(newPassword, 12)
        await prisma.user.update({ 
            where: { id: user.id }, 
            data: { 
                passwordHash: hash,
                passwordChangedAt: new Date() // Track password change for session invalidation
            } 
        })
        return c.json({ success: true })
    } catch (error) {
        logger.error('Change password error:', error)
        return c.json({ error: 'Failed to change password' }, 500)
    }
})

// Verify email
auth.post('/verify-email', async (c) => {
    try {
        const body = await c.req.json()
        const { token, email } = verifyEmailSchema.parse(body)

        const verificationToken = await prisma.verificationToken.findFirst({
            where: {
                token,
                identifier: email,
                expires: { gt: new Date() },
            },
            include: { user: true },
        })

        if (!verificationToken) {
            return c.json({ error: 'Invalid or expired verification token' }, 400)
        }

        // Mark email as verified
        await prisma.user.update({
            where: { id: verificationToken.user!.id },
            data: { emailVerified: new Date() },
        })

        // Delete verification token
        await prisma.verificationToken.delete({
            where: { id: verificationToken.id },
        })

        // Send welcome email
        await emailService.sendWelcomeEmail({
            email: verificationToken.user!.email,
            name: verificationToken.user!.email.split('@')[0],
            tier: verificationToken.user!.tier,
        })

        logger.info(`Email verified for ${email}`)

        return c.json({ message: 'Email verified successfully!' })
    } catch (error) {
        logger.error('Verify email error:', error)
        return c.json({ error: 'Invalid request' }, 400)
    }
})

// Nonce issuance for SIWE authentication - use generateNonce() for EIP-4361 compliance
auth.get('/siwe/nonce', async (c) => {
    try {
        const address = c.req.header('X-Wallet-Address') || 'unknown'
        logger.info(`Nonce request received for address: ${address}`)
        
        // ✅ Use nonceManager which uses generateNonce() internally for spec-compliant nonce
        const nonce = nonceManager.generate(address, 'evm')
        
        logger.info(`Nonce issued successfully for EVM address: ${address}`)
        
        return c.json({ nonce })
    } catch (error) {
        logger.error('Nonce issuance error:', error)
        logger.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return c.json({ error: 'Failed to issue nonce' }, 500)
    }
})

// Server-prepared SIWE message (best practice - eliminates client-side constructor issues)
auth.get('/siwe/prepare', async (c) => {
    try {
        const address = c.req.query('address')
        const chainId = c.req.query('chainId')
        const providedNonce = c.req.query('nonce')
        
        if (!address || !chainId) {
            return c.json({ error: 'address and chainId required' }, 400)
        }
        
        // Reuse the previously issued nonce - do not generate a new one here
        const nonce = typeof providedNonce === 'string' ? providedNonce : ''
        const nonceData = nonceManager.validate(nonce)
        if (!nonceData) {
            return c.json({ error: 'No valid nonce. Call /siwe/nonce first.' }, 400)
        }
        
        const expectedDomain = new URL(process.env.FRONTEND_URL || 'http://localhost:3000').hostname
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
        
        const msg = new SiweMessage({
            domain: expectedDomain,
            address,
            statement: 'Sign in with Ethereum to VolSpike.',
            uri: frontendUrl,
            version: '1',
            chainId: Number(chainId),
            nonce,
        })
        
        // v3 prepareMessage()
        const message = msg.prepareMessage()
        
        logger.info(`SIWE message prepared for ${address} on chain ${chainId}`)
        
        return c.json({ message })
    } catch (error) {
        logger.error('SIWE prepare error:', error)
        return c.json({ error: 'Failed to prepare SIWE message' }, 500)
    }
})

// Sign in with Ethereum (SIWE) - Signature verification (siwe v3)
auth.post('/siwe/verify', async (c) => {
    try {
        const { message, signature } = await c.req.json()

        console.log('[SIWE Verify] Received message:', message.substring(0, 100) + '...')
        console.log('[SIWE Verify] Received signature:', signature)

        // Parse SIWE message using siwe v3
        const siweMessage = new SiweMessage(message)
        
        // Extract nonce from the SIWE message and validate against server store
        const expectedNonce = siweMessage.nonce
        const nonceData = nonceManager.validate(expectedNonce || '')
        if (!nonceData) {
            logger.warn('SIWE verification failed: invalid or missing nonce')
            return c.json({ error: 'Invalid nonce' }, 401)
        }
        
        // v3 verify API - ✅ exact domain, no port
        const result = await siweMessage.verify({
            signature,
            domain: new URL(process.env.FRONTEND_URL || 'http://localhost:3000').hostname,
            nonce: expectedNonce,
            time: new Date().toISOString(),
        })

        if (!result.success) {
            logger.warn(`SIWE verification failed: ${result.error?.type || 'unknown error'}`)
            return c.json({ error: result.error?.type || 'SIWE verification failed' }, 401)
        }

        const { address, chainId } = siweMessage
        
        console.log('[SIWE Verify] Successfully verified:', { address, chainId })

        // Validate chain
        const caipChainId = `eip155:${chainId}`
        if (!isAllowedChain(caipChainId, 'evm')) {
            logger.warn(`Disallowed chain: ${caipChainId}`)
            return c.json({ error: `Chain not allowed. Supported chains: Ethereum (1), Base (8453), Polygon (137), Optimism (10), Arbitrum (42161)` }, 401)
        }

        // Consume nonce (one-time use)
        nonceManager.consume(expectedNonce || '')

        const caip10 = `eip155:${chainId}:${address}`
        console.log('[SIWE Verify] Looking up wallet account:', caip10)

        // Check if user is already logged in (has Authorization header)
        const authHeader = c.req.header('Authorization')
        const loggedInUserId = await getUserIdFromHeader(authHeader)
        
        // Find existing wallet account
        let walletAccount = await prisma.walletAccount.findUnique({
            where: {
                provider_caip10: {
                    provider: 'evm',
                    caip10: caip10,
                },
            },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                        role: true,
                        walletAddress: true,
                        emailVerified: true,
                        refreshInterval: true,
                        theme: true,
                        status: true,
                        twoFactorEnabled: true,
                    },
                },
            },
        })

        let user

        if (walletAccount) {
            // Existing wallet account - sign in to associated user
            user = walletAccount.user
            
            // If user is logged in with email/OAuth and wallet belongs to different user, don't auto-link
            if (loggedInUserId && loggedInUserId !== user.id) {
                logger.warn(`[SIWE Verify] Wallet ${caip10} belongs to different user. User ${loggedInUserId} attempted to sign in.`)
                return c.json({ 
                    error: 'This wallet is already linked to another account. Please unlink it first or use a different wallet.',
                    walletLinkedToDifferentAccount: true 
                }, 403)
            }
            
            await prisma.walletAccount.update({
                where: { id: walletAccount.id },
                data: { lastLoginAt: new Date() },
            })
            logger.info(`Existing wallet signed in: ${caip10}`)
        } else {
            // New wallet - check if user is logged in
            if (loggedInUserId) {
                // User is logged in - link wallet to existing account
                console.log('[SIWE Verify] User logged in, linking wallet to existing account:', loggedInUserId)
                try {
                    user = await prisma.user.findUnique({
                        where: { id: loggedInUserId },
                        select: {
                            id: true,
                            email: true,
                            tier: true,
                            role: true,
                            walletAddress: true,
                            emailVerified: true,
                            refreshInterval: true,
                            theme: true,
                            status: true,
                            twoFactorEnabled: true,
                        },
                    })
                    
                    if (!user) {
                        throw new Error('Logged-in user not found')
                    }
                    
                    // Create wallet account linked to existing user
                    await prisma.walletAccount.create({
                        data: {
                            userId: user.id,
                            provider: 'evm',
                            caip10: caip10,
                            address: address,
                            chainId: String(chainId),
                            lastLoginAt: new Date(),
                        },
                    })
                    
                    logger.info(`Wallet ${caip10} linked to existing user account: ${user.email}`)
                } catch (linkError: any) {
                    logger.error('[SIWE Verify] Error linking wallet to existing account:', linkError)
                    throw new Error(`Failed to link wallet: ${linkError.message}`)
                }
            } else {
                // User is NOT logged in - create separate wallet-only account
                const walletEmail = `${address}@volspike.wallet`
                console.log('[SIWE Verify] User not logged in, creating wallet-only account:', walletEmail)
                try {
                    user = await prisma.user.findUnique({
                        where: { email: walletEmail },
                        select: {
                            id: true,
                            email: true,
                            tier: true,
                            role: true,
                            walletAddress: true,
                            emailVerified: true,
                            refreshInterval: true,
                            theme: true,
                            status: true,
                            twoFactorEnabled: true,
                        },
                    })
                    
                    if (!user) {
                        user = await prisma.user.create({
                            data: {
                                email: walletEmail,
                                tier: 'free',
                                emailVerified: new Date(),
                            },
                            select: {
                                id: true,
                                email: true,
                                tier: true,
                                role: true,
                                walletAddress: true,
                                emailVerified: true,
                                refreshInterval: true,
                                theme: true,
                                status: true,
                                twoFactorEnabled: true,
                            },
                        })
                        console.log('[SIWE Verify] New wallet-only user created:', user.id)
                    }

                    await prisma.walletAccount.create({
                        data: {
                            userId: user.id,
                            provider: 'evm',
                            caip10: caip10,
                            address: address,
                            chainId: String(chainId),
                            lastLoginAt: new Date(),
                        },
                    })
                    
                    logger.info(`New wallet-only account created: ${caip10}`)
                } catch (createError: any) {
                    logger.error('[SIWE Verify] Error creating wallet-only account:', createError)
                    throw new Error(`Failed to create wallet account: ${createError.message}`)
                }
            }
        }

        // Generate token with SIWE context so NextAuth can surface wallet data
        const token = await generateToken(user.id, {
            address,
            provider: 'evm',
            chainId,
            tier: user.tier,
            role: user.role,
        })

        return c.json({
            ok: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
                refreshInterval: user.refreshInterval,
                theme: user.theme,
                walletAddress: address,
                walletProvider: 'evm',
                role: user.role,
                status: user.status,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        })
    } catch (error: any) {
        logger.error('SIWE verification error:', error)
        console.error('[SIWE Verify] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return c.json({ error: error.message || 'Verification failed' }, 401)
    }
})

// =============================
// Solana (Phantom) Authentication
// =============================

// Issue nonce for Solana
auth.post('/solana/nonce', async (c) => {
    try {
        const { address } = await c.req.json()
        if (!address) return c.json({ error: 'address required' }, 400)
        const nonce = nonceManager.generate(address, 'solana')
        return c.json({ nonce })
    } catch (e) {
        return c.json({ error: 'Failed to issue nonce' }, 500)
    }
})

// Prepare message for Solana signing
auth.get('/solana/prepare', async (c) => {
    const address = c.req.query('address')
    const chainId = c.req.query('chainId') || '101' // mainnet-beta
    const providedNonce = c.req.query('nonce')
    if (!address || !providedNonce) return c.json({ error: 'address and nonce required' }, 400)

    const nonce = typeof providedNonce === 'string' ? providedNonce : ''
    const nonceData = nonceManager.validate(nonce)
    if (!nonceData) return c.json({ error: 'No valid nonce. Call /solana/nonce first.' }, 400)

    const expectedDomain = new URL(process.env.FRONTEND_URL || 'http://localhost:3000').hostname
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

    // Simple SIWS message
    const issuedAt = new Date().toISOString()
    const message = `Sign in with Solana to VolSpike\n\nDomain: ${expectedDomain}\nAddress: ${address}\nURI: ${frontendUrl}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`

    return c.json({ message })
})

// Verify Solana signature and create session
auth.post('/solana/verify', async (c) => {
    try {
        const { message, signature, address, chainId } = await c.req.json()
        if (!message || !signature || !address) return c.json({ error: 'Invalid payload' }, 400)

        const expectedNonceMatch = message.match(/Nonce: (.*)/)
        const expectedNonce = expectedNonceMatch ? expectedNonceMatch[1]?.trim() : ''
        const nonceData = nonceManager.validate(expectedNonce || '')
        if (!nonceData) return c.json({ error: 'Invalid nonce' }, 401)

        // Verify signature
        const pubkey = bs58.decode(address)
        const sig = bs58.decode(signature)
        const msgBytes = new TextEncoder().encode(message)
        const ok = nacl.sign.detached.verify(msgBytes, sig, pubkey)
        if (!ok) return c.json({ error: 'Invalid signature' }, 401)

        // Consume nonce
        nonceManager.consume(expectedNonce || '')

        // Allowlist chain
        const caipChainId = `solana:${chainId || '101'}`
        if (!isAllowedChain(caipChainId, 'solana')) {
            return c.json({ error: 'Chain not allowed' }, 401)
        }

        const caip10 = `${caipChainId}:${address}`

        // Find/create wallet account and user
        let walletAccount = await prisma.walletAccount.findUnique({
            where: { provider_caip10: { provider: 'solana', caip10 } },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        tier: true,
                        role: true,
                        walletAddress: true,
                        emailVerified: true,
                        refreshInterval: true,
                        theme: true,
                        status: true,
                        twoFactorEnabled: true,
                    },
                },
            },
        })

        let user
        if (walletAccount) {
            user = walletAccount.user
            await prisma.walletAccount.update({ where: { id: walletAccount.id }, data: { lastLoginAt: new Date() } })
        } else {
            user = await prisma.user.create({
                data: {
                    email: `${address}@volspike.wallet`,
                    tier: 'free',
                    emailVerified: new Date(),
                },
                select: {
                    id: true,
                    email: true,
                    tier: true,
                    role: true,
                    walletAddress: true,
                    emailVerified: true,
                    refreshInterval: true,
                    theme: true,
                    status: true,
                    twoFactorEnabled: true,
                },
            })
            await prisma.walletAccount.create({
                data: {
                    userId: user.id,
                    provider: 'solana',
                    caip10,
                    address,
                    chainId: String(chainId || '101'),
                    lastLoginAt: new Date(),
                },
            })
        }

        const token = await generateToken(user.id, {
            address,
            provider: 'solana',
            chainId: chainId || '101',
            tier: user.tier,
            role: user.role,
        })

        return c.json({
            ok: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
                refreshInterval: user.refreshInterval,
                theme: user.theme,
                walletAddress: address,
                walletProvider: 'solana',
                role: user.role,
                status: user.status,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        })
    } catch (e: any) {
        return c.json({ error: e?.message || 'Verification failed' }, 401)
    }
})

// Link wallet to logged-in user account (requires authentication)
auth.post('/wallet/link', authMiddleware, async (c) => {
    try {
        const { message, signature, address, chainId, provider } = await c.req.json()
        
        if (!message || !signature || !address || !chainId || !provider) {
            return c.json({ error: 'Missing required fields' }, 400)
        }

        // Get logged-in user from middleware (guaranteed to exist by authMiddleware)
        const user = c.get('user')!
        
        // Verify signature based on provider
        let verified = false
        let caip10 = ''

        if (provider === 'evm') {
            const siweMessage = new SiweMessage(message)
            const result = await siweMessage.verify({
                signature,
                domain: new URL(process.env.FRONTEND_URL || 'http://localhost:3000').hostname,
                nonce: siweMessage.nonce,
                time: new Date().toISOString(),
            })
            
            if (!result.success) {
                return c.json({ error: 'Signature verification failed' }, 401)
            }
            
            verified = true
            caip10 = `eip155:${chainId}:${address}`
        } else if (provider === 'solana') {
            // Solana signature verification
            const expectedNonceMatch = message.match(/Nonce: (.*)/)
            const expectedNonce = expectedNonceMatch ? expectedNonceMatch[1]?.trim() : ''
            const nonceData = nonceManager.validate(expectedNonce || '')
            
            if (!nonceData) {
                return c.json({ error: 'Invalid nonce' }, 401)
            }
            
            const pubkey = bs58.decode(address)
            const sig = bs58.decode(signature)
            const msgBytes = new TextEncoder().encode(message)
            verified = nacl.sign.detached.verify(msgBytes, sig, pubkey)
            
            if (!verified) {
                return c.json({ error: 'Signature verification failed' }, 401)
            }
            
            nonceManager.consume(expectedNonce || '')
            caip10 = `solana:${chainId || '101'}:${address}`
        } else {
            return c.json({ error: 'Unsupported provider' }, 400)
        }

        if (!verified) {
            return c.json({ error: 'Signature verification failed' }, 401)
        }

        // Check if wallet is already linked to another account
        const existingWallet = await prisma.walletAccount.findUnique({
            where: {
                provider_caip10: {
                    provider: provider as 'evm' | 'solana',
                    caip10: caip10,
                },
            },
        })

        if (existingWallet) {
            if (existingWallet.userId === user.id) {
                return c.json({ error: 'Wallet is already linked to your account' }, 400)
            } else {
                return c.json({ error: 'This wallet is already linked to another account' }, 403)
            }
        }

        // Link wallet to user account
        await prisma.walletAccount.create({
            data: {
                userId: user.id,
                provider: provider as 'evm' | 'solana',
                caip10: caip10,
                address: address,
                chainId: String(chainId),
                lastLoginAt: new Date(),
            },
        })

        logger.info(`Wallet ${caip10} linked to user ${user.email}`)

        return c.json({ 
            success: true,
            message: 'Wallet linked successfully'
        })
    } catch (error: any) {
        logger.error('Wallet link error:', error)
        return c.json({ error: error.message || 'Failed to link wallet' }, 500)
    }
})

// Unlink wallet from logged-in user account (requires authentication)
auth.post('/wallet/unlink', authMiddleware, async (c) => {
    try {
        const { address, chainId, provider } = await c.req.json()
        
        if (!address || !chainId || !provider) {
            return c.json({ error: 'Missing required fields' }, 400)
        }

        // Get logged-in user from middleware (guaranteed to exist by authMiddleware)
        const user = c.get('user')!

        const caip10 = provider === 'evm' 
            ? `eip155:${chainId}:${address}`
            : `solana:${chainId || '101'}:${address}`

        // Find wallet account
        const walletAccount = await prisma.walletAccount.findUnique({
            where: {
                provider_caip10: {
                    provider: provider as 'evm' | 'solana',
                    caip10: caip10,
                },
            },
        })

        if (!walletAccount) {
            return c.json({ error: 'Wallet not found' }, 404)
        }

        // Verify wallet belongs to user
        if (walletAccount.userId !== user.id) {
            return c.json({ error: 'Wallet does not belong to your account' }, 403)
        }

        // Unlink wallet
        await prisma.walletAccount.delete({
            where: { id: walletAccount.id },
        })

        logger.info(`Wallet ${caip10} unlinked from user ${user.email}`)

        return c.json({ 
            success: true,
            message: 'Wallet unlinked successfully'
        })
    } catch (error: any) {
        logger.error('Wallet unlink error:', error)
        return c.json({ error: error.message || 'Failed to unlink wallet' }, 500)
    }
})

// Get linked wallets for logged-in user (requires authentication)
auth.get('/wallet/list', authMiddleware, async (c) => {
    try {
        // Get logged-in user from middleware (guaranteed to exist by authMiddleware)
        const user = c.get('user')!

        const wallets = await prisma.walletAccount.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                provider: true,
                address: true,
                chainId: true,
                caip10: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        })

        return c.json({ wallets })
    } catch (error: any) {
        logger.error('Get wallets error:', error)
        return c.json({ error: 'Failed to get wallets' }, 500)
    }
})

// Get current user (requires authentication via Authorization header)
auth.get('/me', async (c) => {
    try {
        const authHeader = c.req.header('Authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('[Auth] /me endpoint called without Authorization header')
            return c.json({ error: 'Not authenticated' }, 401)
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix
        let userId: string | null = null

        // Check if it's a simple user ID (from NextAuth session)
        if (!token.includes('.') && !token.startsWith('mock-token-')) {
            userId = token
            logger.info(`[Auth] /me using simple user ID token: ${userId}`)
        }
        // Handle mock tokens
        else if (token.startsWith('mock-token-')) {
            const match = token.match(/^mock-token-(.+?)-\d+$/)
            if (match) {
                userId = match[1]
            } else {
                return c.json({ error: 'Invalid token format' }, 401)
            }
        }
        // Verify JWT tokens
        else {
            try {
                const { jwtVerify } = await import('jose')
                const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
                const secretBytes = new TextEncoder().encode(secret)
                const { payload } = await jwtVerify(token, secretBytes)

                if (!payload.sub) {
                    return c.json({ error: 'Invalid token payload' }, 401)
                }

                userId = payload.sub as string
                logger.info(`[Auth] /me JWT verified for user ID: ${userId}`)
            } catch (jwtError) {
                logger.error('[Auth] /me JWT verification failed:', jwtError)
                return c.json({ error: 'Invalid token' }, 401)
            }
        }

        if (!userId) {
            return c.json({ error: 'Invalid token' }, 401)
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                tier: true,
                emailVerified: true,
                role: true,
                status: true,
                twoFactorEnabled: true,
                refreshInterval: true,
                theme: true,
                passwordChangedAt: true, // Include for session invalidation check
            },
        })

        if (!user) {
            logger.warn(`[Auth] /me user not found for ID: ${userId}`)
            return c.json({ error: 'User not found' }, 401)
        }

        // Return user data with passwordChangedAt for session validation
        const userResponse = {
            ...user,
            passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
        }

        logger.info('[Auth] /me endpoint called successfully', {
            userId: user.id,
            email: user.email,
            tier: user.tier,
        })

        return c.json({ user: userResponse })
    } catch (error) {
        logger.error('Get user error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export { auth as authRoutes }
// =============================
// Phantom Deep Link (iOS) Support
// =============================

type PhantomStateRecord = { secretKey: Uint8Array; publicKey: Uint8Array; createdAt: number; session?: string; phantomPubKey?: Uint8Array }
const phantomStateStore = new Map<string, PhantomStateRecord>()
const PHANTOM_STATE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function cleanupPhantomStateStore() {
    const now = Date.now()
    for (const [k, v] of phantomStateStore.entries()) {
        if (now - v.createdAt > PHANTOM_STATE_TTL_MS) phantomStateStore.delete(k)
    }
}

function generateEphemeralKeypair() {
    const pair = nacl.box.keyPair()
    return { publicKey: pair.publicKey, secretKey: pair.secretKey }
}

function computeSharedSecret(phantomPubKey: Uint8Array, dappSecretKey: Uint8Array): Uint8Array {
    return nacl.box.before(phantomPubKey, dappSecretKey)
}

function encryptPayload(shared: Uint8Array, obj: unknown) {
    const nonce = nacl.randomBytes(24)
    const data = new TextEncoder().encode(JSON.stringify(obj))
    const payload = nacl.box.after(data, nonce, shared)
    return { payload58: bs58.encode(payload), nonce58: bs58.encode(nonce) }
}

function decryptPayload(shared: Uint8Array, payload58: string, nonce58: string) {
    const payload = tryDecode(payload58)
    const nonce = tryDecode(nonce58)
    const opened = nacl.box.open.after(payload, nonce, shared)
    if (!opened) return null
    const text = new TextDecoder().decode(opened)
    return JSON.parse(text)
}

// Accept base58, base64, base64url encodings
function tryDecode(input: string): Uint8Array {
    try { return bs58.decode(input) } catch { /* fall through */ }
    try { return Uint8Array.from(Buffer.from(input, 'base64')) } catch { /* fall through */ }
    // base64url -> base64
    try {
        const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
        return Uint8Array.from(Buffer.from(b64, 'base64'))
    } catch {
        throw new Error('Unsupported encoding')
    }
}

// Start: returns server-managed ephemeral pubkey and ready-to-use connect URL
auth.post('/phantom/dl/start', async (c) => {
    try {
        cleanupPhantomStateStore()
        const body = await c.req.json().catch(() => ({})) as { appUrl?: string; redirect?: string }
        const origin = body.appUrl || (process.env.FRONTEND_URL || 'http://localhost:3000')
        const redirectBase = body.redirect || `${origin}/auth/phantom-callback`
        const { publicKey, secretKey } = generateEphemeralKeypair()
        const state = crypto.randomUUID()
        phantomStateStore.set(state, { publicKey, secretKey, createdAt: Date.now() })
        const dappPub58 = bs58.encode(publicKey)
        const cluster = (process.env.NODE_ENV === 'development' && c.req.query('cluster') === 'devnet') || process.env.SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet-beta'
        const redirectLink = `${redirectBase}?state=${encodeURIComponent(state)}`
        const params = new URLSearchParams({
            app_url: origin,
            dapp_encryption_public_key: dappPub58,
            redirect_link: redirectLink,
            cluster,
        })
        const connectUrl = `https://phantom.app/ul/v1/connect?${params.toString()}`
        const connectDeepLink = connectUrl.replace('https://phantom.app/ul/', 'phantom://ul/')
        return c.json({ ok: true, state, dappPublicKey58: dappPub58, connectUrl, connectDeepLink })
    } catch (e) {
        return c.json({ error: 'Failed to start deep link' }, 500)
    }
})

// Build signMessage URL on the server (uses stored ephemeral secret)
auth.post('/phantom/dl/sign-url', async (c) => {
    try {
        // Don't cleanup before checking - we need the state to exist
        // cleanupPhantomStateStore()
        const { state, message, appUrl, redirect } = await c.req.json()
        if (!state || !message) {
            logger.warn(`[PhantomDL] sign-url: missing state or message`)
            return c.json({ error: 'Invalid payload' }, 400)
        }
        const rec = phantomStateStore.get(state)
        if (!rec) {
            logger.warn(`[PhantomDL] sign-url: invalid or expired state=${state}`)
            return c.json({ error: 'Invalid or expired state' }, 400)
        }
        if (!rec.session || !rec.phantomPubKey) {
            logger.warn(`[PhantomDL] sign-url: missing session or phantomPubKey for state=${state}`)
            return c.json({ error: 'Missing Phantom session' }, 400)
        }
        const origin = appUrl || (process.env.FRONTEND_URL || 'http://localhost:3000')
        const redirectBase = redirect || `${origin}/auth/phantom-callback`
        const redirectLink = `${redirectBase}?state=${encodeURIComponent(state)}`
        const shared = computeSharedSecret(rec.phantomPubKey, rec.secretKey)
        const messageBytes58 = bs58.encode(new TextEncoder().encode(message))
        const { payload58, nonce58 } = encryptPayload(shared, { session: rec.session, message: messageBytes58 })
        const params = new URLSearchParams({
            app_url: origin,
            dapp_encryption_public_key: bs58.encode(rec.publicKey),
            redirect_link: redirectLink,
            nonce: nonce58,
            payload: payload58,
            cluster: process.env.SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet-beta'
        })
        const url = `https://phantom.app/ul/v1/signMessage?${params.toString()}`
        logger.info(`[PhantomDL] sign-url built successfully for state=${state}, redirectLink=${redirectLink}`)
        return c.json({ url })
    } catch (e: any) {
        logger.error(`[PhantomDL] sign-url error:`, e)
        return c.json({ error: 'Failed to build sign url' }, 500)
    }
})

// Decrypt payload on the server (works even if different browser handles the redirect)
auth.post('/phantom/dl/decrypt', async (c) => {
    try {
        // Only cleanup expired entries, don't remove active states
        const now = Date.now()
        for (const [k, v] of phantomStateStore.entries()) {
            if (now - v.createdAt > PHANTOM_STATE_TTL_MS) phantomStateStore.delete(k)
        }
        const body = await c.req.json()
        const { state, phantom_encryption_public_key, payload, data, nonce } = body
        // Phantom may send 'data' or 'payload' - accept both
        const payloadValue = payload || data
        if (!state || !payloadValue || !nonce) {
            logger.warn(`[PhantomDL] decrypt: missing required params`, { 
                hasState: !!state, 
                hasPubKey: !!phantom_encryption_public_key, 
                hasPayload: !!payload,
                hasData: !!data,
                hasPayloadValue: !!payloadValue,
                hasNonce: !!nonce 
            })
            return c.json({ error: 'Invalid payload' }, 400)
        }
        const rec = phantomStateStore.get(state)
        if (!rec) {
            logger.warn(`[PhantomDL] decrypt: state not found or expired`, { 
                state, 
                storeSize: phantomStateStore.size,
                storeKeys: Array.from(phantomStateStore.keys()).slice(0, 5)
            })
            return c.json({ error: 'Invalid or expired state' }, 400)
        }
        // For sign stage, Phantom may not include phantom_encryption_public_key in redirect
        // Use the stored one from the connect stage if available
        const phantomPubKeyToUse = phantom_encryption_public_key 
            ? bs58.decode(phantom_encryption_public_key)
            : (rec.phantomPubKey || null)
        if (!phantomPubKeyToUse) {
            logger.warn(`[PhantomDL] decrypt: missing phantom_encryption_public_key and not stored in state`)
            return c.json({ error: 'Missing phantom encryption public key' }, 400)
        }
        const shared = computeSharedSecret(phantomPubKeyToUse, rec.secretKey)
        const decryptedData = decryptPayload(shared, payloadValue, nonce)
        if (!decryptedData) {
            logger.warn(`[PhantomDL] decrypt failed for state=${state}`)
            return c.json({ error: 'Decryption failed' }, 400)
        }
        const stage = decryptedData.signature ? 'sign' : (decryptedData.session && decryptedData.public_key ? 'connect' : 'unknown')
        // Persist session + phantom pubkey on connect stage
        if (stage === 'connect') {
            const rec = phantomStateStore.get(state)
            if (rec) {
                rec.session = decryptedData.session
                try { rec.phantomPubKey = bs58.decode(phantom_encryption_public_key || '') } catch {}
                phantomStateStore.set(state, rec)
            }
        }
        logger.info(`[PhantomDL] decrypt ok state=${state} stage=${stage}`, { 
            hasSignature: !!decryptedData.signature, 
            hasSession: !!decryptedData.session, 
            hasPublicKey: !!decryptedData.public_key 
        })
        return c.json({ ok: true, data: decryptedData })
    } catch (e: any) {
        logger.error(`[PhantomDL] decrypt error:`, e)
        return c.json({ error: 'Failed to decrypt' }, 500)
    }
})
