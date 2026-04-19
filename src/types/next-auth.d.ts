import 'next-auth'
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
      plan: 'FREE' | 'PRO' | 'ENTERPRISE'
      onboardingCompleted: boolean
    }
    onboardingCompleted: boolean // Kept for backwards compatibility
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: UserRole
    plan: 'FREE' | 'PRO' | 'ENTERPRISE'
    onboardingCompleted: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    onboardingCompleted: boolean
    plan: 'FREE' | 'PRO' | 'ENTERPRISE'
    passwordChangedAt: number | null
    lastDbCheckAt: number
  }
}
