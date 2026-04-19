import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.log('Usage: npx tsx scripts/check-user.ts <email>')
    return
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, role: true },
  })

  if (!user) {
    console.error('User not found')
    process.exit(1)
  }
  console.log(JSON.stringify(user, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
