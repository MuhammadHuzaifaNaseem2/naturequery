import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('Verifying all existing users...\n')

  // Find all users with null emailVerified
  const unverifiedUsers = await prisma.user.findMany({
    where: { emailVerified: null },
    select: { id: true, email: true, name: true, role: true },
  })

  if (unverifiedUsers.length === 0) {
    console.log('✓ All users are already verified!')
    return
  }

  console.log(`Found ${unverifiedUsers.length} unverified user(s):\n`)
  unverifiedUsers.forEach((user) => {
    console.log(`  - ${user.email} (${user.role})`)
  })

  console.log('\nVerifying all users...')

  // Update all users to set emailVerified to current date
  const result = await prisma.user.updateMany({
    where: { emailVerified: null },
    data: { emailVerified: new Date() },
  })

  console.log(`\n✓ Successfully verified ${result.count} user(s)!`)
  console.log('\nAll existing users can now login.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
