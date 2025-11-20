import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'

// Mock Prisma - must be defined before vi.mock
vi.mock('../../index', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Import after mocking
import { authMiddleware } from '../../middleware/auth'
import { prisma } from '../../index'

const mockPrisma = prisma as any

// Helper to create a valid JWT token
async function createJWT(userId: string, secret: string = 'test-jwt-secret'): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret)
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretBytes)
}

// Mock Hono context
function createMockContext(authHeader?: string) {
  const headers = new Map<string, string>()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }

  return {
    req: {
      header: (name: string) => {
        return headers.get(name.toLowerCase())
      },
    },
    json: vi.fn((data, status) => {
      return { data, status }
    }),
    set: vi.fn(),
  } as any
}

describe('Authentication Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Missing or Invalid Authorization Header', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const mockContext = createMockContext()
      const mockNext = vi.fn()

      const result = await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing or invalid authorization header' },
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      const mockContext = createMockContext('Basic sometoken')
      const mockNext = vi.fn()

      const result = await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing or invalid authorization header' },
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Simple User ID Token (NextAuth session)', () => {
    it('should accept simple user ID token and authenticate user', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        tier: 'PRO',
        refreshInterval: 5,
        theme: 'dark',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const mockContext = createMockContext('Bearer 123')
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
        select: {
          id: true,
          email: true,
          tier: true,
          refreshInterval: true,
          theme: true,
        },
      })
      expect(mockContext.set).toHaveBeenCalledWith('user', mockUser)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 when user not found with simple token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const mockContext = createMockContext('Bearer 999')
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'User not found' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Mock Token (Development/Test)', () => {
    it('should accept valid mock token and extract user ID', async () => {
      const mockUser = {
        id: 'test-user-123',
        email: 'test@example.com',
        tier: 'ELITE',
        refreshInterval: 0,
        theme: 'light',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const mockContext = createMockContext('Bearer mock-token-test-user-123-1234567890')
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-user-123' },
        select: {
          id: true,
          email: true,
          tier: true,
          refreshInterval: true,
          theme: true,
        },
      })
      expect(mockContext.set).toHaveBeenCalledWith('user', mockUser)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 for invalid mock token format', async () => {
      const mockContext = createMockContext('Bearer mock-token-invalid')
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Invalid mock token format' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('JWT Token Verification', () => {
    it('should verify valid JWT token and authenticate user', async () => {
      const userId = 'jwt-user-456'
      const token = await createJWT(userId)

      const mockUser = {
        id: userId,
        email: 'jwt@example.com',
        tier: 'FREE',
        refreshInterval: 15,
        theme: 'dark',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const mockContext = createMockContext(`Bearer ${token}`)
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          tier: true,
          refreshInterval: true,
          theme: true,
        },
      })
      expect(mockContext.set).toHaveBeenCalledWith('user', mockUser)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should return 401 for invalid JWT token', async () => {
      const mockContext = createMockContext('Bearer invalid.jwt.token')
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 401 for expired JWT token', async () => {
      const userId = 'expired-user'
      const secretBytes = new TextEncoder().encode('test-jwt-secret')

      // Create an expired token (1 second expiration, then wait)
      const expiredToken = await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('-1h') // Already expired
        .sign(secretBytes)

      const mockContext = createMockContext(`Bearer ${expiredToken}`)
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Invalid token' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 401 when JWT has no sub claim', async () => {
      const secretBytes = new TextEncoder().encode('test-jwt-secret')

      // Create token without sub claim
      const tokenWithoutSub = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secretBytes)

      const mockContext = createMockContext(`Bearer ${tokenWithoutSub}`)
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Invalid token payload' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 401 when user not found in database', async () => {
      const userId = 'nonexistent-user'
      const token = await createJWT(userId)

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const mockContext = createMockContext(`Bearer ${token}`)
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'User not found' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const token = await createJWT('user-123')

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'))

      const mockContext = createMockContext(`Bearer ${token}`)
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Authentication error' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle unexpected errors gracefully', async () => {
      const mockContext = createMockContext('Bearer 123')
      const mockNext = vi.fn()

      mockPrisma.user.findUnique.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Authentication error' }, 401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('User Context Setting', () => {
    it('should set user context with all required fields', async () => {
      const mockUser = {
        id: 'user-789',
        email: 'context@example.com',
        tier: 'PRO',
        refreshInterval: 5,
        theme: 'light',
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const mockContext = createMockContext('Bearer user-789')
      const mockNext = vi.fn()

      await authMiddleware(mockContext, mockNext)

      expect(mockContext.set).toHaveBeenCalledWith('user', {
        id: 'user-789',
        email: 'context@example.com',
        tier: 'PRO',
        refreshInterval: 5,
        theme: 'light',
      })
    })
  })
})
