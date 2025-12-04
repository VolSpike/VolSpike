import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nonceManager } from '../../services/nonce-manager'

// Mock the logger
vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('Nonce Manager', () => {
  beforeEach(() => {
    // Clear all nonces before each test
    nonceManager.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Nonce Generation', () => {
    it('should generate a valid nonce for EVM address', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      expect(nonce).toBeDefined()
      expect(typeof nonce).toBe('string')
      expect(nonce.length).toBeGreaterThan(0)
      expect(nonceManager.getSize()).toBe(1)
    })

    it('should generate a valid nonce for Solana address', () => {
      const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
      const nonce = nonceManager.generate(address, 'solana')

      expect(nonce).toBeDefined()
      expect(typeof nonce).toBe('string')
      expect(nonce.length).toBeGreaterThan(0)
      expect(nonceManager.getSize()).toBe(1)
    })

    it('should generate unique nonces for multiple requests', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce1 = nonceManager.generate(address, 'evm')
      const nonce2 = nonceManager.generate(address, 'evm')

      expect(nonce1).not.toBe(nonce2)
      expect(nonceManager.getSize()).toBe(2)
    })

    it('should store nonce with lowercase address', () => {
      const address = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
      const nonce = nonceManager.generate(address, 'evm')

      const data = nonceManager.validate(nonce)
      expect(data).not.toBeNull()
      expect(data?.address).toBe(address.toLowerCase())
    })

    it('should store correct provider type', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      const data = nonceManager.validate(nonce)
      expect(data).not.toBeNull()
      expect(data?.provider).toBe('evm')
    })
  })

  describe('Nonce Validation', () => {
    it('should validate a freshly generated nonce', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      const data = nonceManager.validate(nonce)

      expect(data).not.toBeNull()
      expect(data?.nonce).toBe(nonce)
      expect(data?.address).toBe(address.toLowerCase())
      expect(data?.provider).toBe('evm')
      expect(data?.timestamp).toBeDefined()
    })

    it('should return null for non-existent nonce', () => {
      const data = nonceManager.validate('nonexistent-nonce')

      expect(data).toBeNull()
    })

    it('should return null for expired nonce', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      // Mock the timestamp to make the nonce expired (> 5 minutes)
      const nonceData = nonceManager.validate(nonce)
      expect(nonceData).not.toBeNull()

      // Clear and re-add with old timestamp
      nonceManager.clear()
      const expiredTimestamp = Date.now() - 6 * 60 * 1000 // 6 minutes ago

      // Access private store via reflection for testing
      const store = (nonceManager as any).store
      store.set(nonce, {
        timestamp: expiredTimestamp,
        address: address.toLowerCase(),
        provider: 'evm',
        nonce,
      })

      const result = nonceManager.validate(nonce)
      expect(result).toBeNull()
      expect(nonceManager.getSize()).toBe(0) // Should be deleted
    })

    it('should not delete valid nonce during validation', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      const data1 = nonceManager.validate(nonce)
      const data2 = nonceManager.validate(nonce)

      expect(data1).not.toBeNull()
      expect(data2).not.toBeNull()
      expect(nonceManager.getSize()).toBe(1)
    })
  })

  describe('Nonce Consumption (One-Time Use)', () => {
    it('should consume a valid nonce successfully', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      const consumed = nonceManager.consume(nonce)

      expect(consumed).toBe(true)
      expect(nonceManager.getSize()).toBe(0)
    })

    it('should return false when consuming non-existent nonce', () => {
      const consumed = nonceManager.consume('nonexistent-nonce')

      expect(consumed).toBe(false)
    })

    it('should prevent nonce reuse after consumption', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      // First consumption
      const consumed1 = nonceManager.consume(nonce)
      expect(consumed1).toBe(true)

      // Second consumption attempt (should fail)
      const consumed2 = nonceManager.consume(nonce)
      expect(consumed2).toBe(false)

      // Validation should also fail
      const data = nonceManager.validate(nonce)
      expect(data).toBeNull()
    })

    it('should remove nonce from validation after consumption', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      nonceManager.consume(nonce)

      const data = nonceManager.validate(nonce)
      expect(data).toBeNull()
    })
  })

  describe('Store Management', () => {
    it('should track store size correctly', () => {
      expect(nonceManager.getSize()).toBe(0)

      const address = '0x1234567890abcdef1234567890abcdef12345678'
      nonceManager.generate(address, 'evm')
      expect(nonceManager.getSize()).toBe(1)

      nonceManager.generate(address, 'evm')
      expect(nonceManager.getSize()).toBe(2)

      nonceManager.clear()
      expect(nonceManager.getSize()).toBe(0)
    })

    it('should clear all nonces when clear() is called', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce1 = nonceManager.generate(address, 'evm')
      const nonce2 = nonceManager.generate(address, 'evm')
      const nonce3 = nonceManager.generate(address, 'solana')

      expect(nonceManager.getSize()).toBe(3)

      nonceManager.clear()

      expect(nonceManager.getSize()).toBe(0)
      expect(nonceManager.validate(nonce1)).toBeNull()
      expect(nonceManager.validate(nonce2)).toBeNull()
      expect(nonceManager.validate(nonce3)).toBeNull()
    })
  })

  describe('Nonce Expiration', () => {
    it('should expire nonce after 5 minutes', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      // Manually set timestamp to 5 minutes + 1 second ago
      const store = (nonceManager as any).store
      const nonceData = store.get(nonce)
      nonceData.timestamp = Date.now() - (5 * 60 * 1000 + 1000)
      store.set(nonce, nonceData)

      const result = nonceManager.validate(nonce)
      expect(result).toBeNull()
    })

    it('should not expire nonce before 5 minutes', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      // Set timestamp to 4 minutes ago (still valid)
      const store = (nonceManager as any).store
      const nonceData = store.get(nonce)
      nonceData.timestamp = Date.now() - (4 * 60 * 1000)
      store.set(nonce, nonceData)

      const result = nonceManager.validate(nonce)
      expect(result).not.toBeNull()
      expect(result?.nonce).toBe(nonce)
    })
  })

  describe('Cleanup Mechanism', () => {
    it('should have cleanup interval running', () => {
      const cleanupInterval = (nonceManager as any).cleanupInterval
      expect(cleanupInterval).not.toBeNull()
    })

    it('should cleanup expired nonces', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'

      // Generate some nonces
      const nonce1 = nonceManager.generate(address, 'evm')
      const nonce2 = nonceManager.generate(address, 'evm')
      const nonce3 = nonceManager.generate(address, 'evm')

      expect(nonceManager.getSize()).toBe(3)

      // Make first two nonces expired
      const store = (nonceManager as any).store
      const expiredTimestamp = Date.now() - 6 * 60 * 1000

      const data1 = store.get(nonce1)
      data1.timestamp = expiredTimestamp
      store.set(nonce1, data1)

      const data2 = store.get(nonce2)
      data2.timestamp = expiredTimestamp
      store.set(nonce2, data2)

      // Call cleanup manually
      ;(nonceManager as any).cleanup()

      // Only nonce3 should remain
      expect(nonceManager.getSize()).toBe(1)
      expect(nonceManager.validate(nonce3)).not.toBeNull()
      expect(nonceManager.validate(nonce1)).toBeNull()
      expect(nonceManager.validate(nonce2)).toBeNull()
    })
  })

  describe('Security - Nonce Reuse Prevention', () => {
    it('should prevent using the same nonce twice', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      // Validate and consume nonce
      const data1 = nonceManager.validate(nonce)
      expect(data1).not.toBeNull()

      const consumed = nonceManager.consume(nonce)
      expect(consumed).toBe(true)

      // Try to validate again (should fail)
      const data2 = nonceManager.validate(nonce)
      expect(data2).toBeNull()

      // Try to consume again (should fail)
      const consumed2 = nonceManager.consume(nonce)
      expect(consumed2).toBe(false)
    })

    it('should handle multiple wallets with different nonces', () => {
      const address1 = '0x1111111111111111111111111111111111111111'
      const address2 = '0x2222222222222222222222222222222222222222'

      const nonce1 = nonceManager.generate(address1, 'evm')
      const nonce2 = nonceManager.generate(address2, 'evm')

      expect(nonce1).not.toBe(nonce2)

      const data1 = nonceManager.validate(nonce1)
      const data2 = nonceManager.validate(nonce2)

      expect(data1?.address).toBe(address1.toLowerCase())
      expect(data2?.address).toBe(address2.toLowerCase())
    })
  })

  describe('EIP-4361 Compliance', () => {
    it('should generate alphanumeric nonces compatible with EIP-4361', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      const nonce = nonceManager.generate(address, 'evm')

      // EIP-4361 requires at least 8 alphanumeric characters
      expect(nonce.length).toBeGreaterThanOrEqual(8)

      // Should only contain alphanumeric characters
      expect(/^[a-zA-Z0-9]+$/.test(nonce)).toBe(true)
    })
  })
})
