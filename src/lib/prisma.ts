import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isDev = process.env.NODE_ENV === 'development'

export const prisma =
  globalForPrisma.prisma ??
  (function () {
    const client = new PrismaClient({
      log: isDev ? [{ emit: 'event', level: 'query' }, 'error', 'warn'] : ['error'],
    })

    return client
  })()


if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
