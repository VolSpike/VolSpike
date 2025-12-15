// App Router NextAuth route handler
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers

// Ensure Node runtime (not edge) for NextAuth
export const runtime = 'nodejs'

// NextAuth reads/writes cookies and must never be statically cached.
export const dynamic = 'force-dynamic'
export const revalidate = 0
