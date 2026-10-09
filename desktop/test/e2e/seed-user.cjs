// Creates (or resets) the E2E test user in the throwaway test database.
const path = require('node:path')
const { createRequire } = require('node:module')
// @prisma/client and bcrypt come from the website's node_modules.
const requireWeb = createRequire(path.resolve(__dirname, '../../../package.json'))
const { PrismaClient } = requireWeb('@prisma/client')
const bcrypt = requireWeb('bcrypt')

if (!/127\.0\.0\.1:55442\/naturequery_test/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL is not the throwaway test database.')
  process.exit(1)
}

const prisma = new PrismaClient()
const email = 'desktop.e2e@example.com'

async function main() {
  const password = await bcrypt.hash('E2e-Test-Password-2026!', 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { password, emailVerified: new Date(), loginAttempts: 0, lockedUntil: null, onboardingCompleted: true },
    create: { email, name: 'E2E Tester', password, emailVerified: new Date(), onboardingCompleted: true },
  })
  await prisma.desktopSession.deleteMany({ where: { userId: user.id } })
  await prisma.usageRecord.deleteMany({ where: { userId: user.id } })
  console.log(user.id)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
