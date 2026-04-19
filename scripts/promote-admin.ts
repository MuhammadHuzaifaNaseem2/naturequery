import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Please provide an email address')
    process.exit(1)
  }

  console.log(`Promoting user ${email} to ADMIN...`)

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.error(`User with email ${email} not found`)
      process.exit(1)
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    })

    console.log(`Successfully promoted ${updatedUser.email} to ${updatedUser.role}`)
  } catch (error) {
    console.error('Error promoting user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
