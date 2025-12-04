import { Context, Next, MiddlewareHandler } from 'hono'
import { jwtVerify } from 'jose'
import { prisma } from '../index'
import { createLogger } from '../lib/logger'
import { Role, UserStatus } from '@prisma/client'

const logger = createLogger()

type Variables = {
  adminUser: {
    id: string
    email: string
    role: Role
    tier: string
    status: UserStatus
    twoFactorEnabled: boolean
    lastLoginAt: Date | null
    ipAddress: string | null
    userAgent: string | null
  }
}

export const requireAdmin: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Admin access attempt without token')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.substring(7)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)

    if (!payload.sub) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        email: true,
        role: true,
        tier: true,
        status: true,
        twoFactorEnabled: true,
        lockedUntil: true,
        lastLoginAt: true,
        ipAddress: true,
        userAgent: true,
      },
    })

    if (!user) {
      logger.warn(`Admin access attempt with invalid user ID: ${payload.sub}`)
      return c.json({ error: 'User not found' }, 401)
    }

    if (user.role !== 'ADMIN') {
      logger.warn(`Non-admin access attempt by ${user.email}`)
      return c.json({ error: 'Admin access required' }, 403)
    }

    if (user.status !== 'ACTIVE') {
      logger.warn(`Inactive admin account ${user.email} attempted access`)
      return c.json({ error: 'Account is not active' }, 403)
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logger.warn(`Locked admin account ${user.email} attempted access`)
      return c.json({ error: 'Account locked' }, 403)
    }

    c.set('adminUser', user as any)
    logger.info(`Admin ${user.email} accessed ${c.req.path}`)

    await next()
  } catch (error) {
    logger.error('Admin auth middleware error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}

export const require2FA: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const user = c.get('adminUser')
  if (user?.twoFactorEnabled) {
    const twoFactorCode = c.req.header('X-2FA-Code')
    if (!twoFactorCode) {
      return c.json({ error: '2FA required', require2FA: true }, 403)
    }
    // Implement actual 2FA verification later
  }
  await next()
}

export const requirePermission = (permission: string): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    await next()
  }
}

export const requireResourceAccess = (resource: string, action: string): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    const user = c.get('adminUser')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    await next()
  }
}