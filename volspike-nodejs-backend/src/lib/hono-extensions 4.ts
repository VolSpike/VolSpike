import { Context } from 'hono'
import { User } from '../types'

// Extended context with proper typing
export interface AuthenticatedContext extends Context {
    get: (key: 'user') => User | undefined
    set: (key: 'user', value: User) => void
}

// Helper function to get user from context
export function getUser(c: Context): User | undefined {
    return c.get('user') as User | undefined
}

// Helper function to require user (throws if not authenticated)
export function requireUser(c: Context): User {
    const user = c.get('user') as User | undefined
    if (!user) {
        throw new Error('User not authenticated')
    }
    return user
}
