// Quick script to check if history entries match the expected userId
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  })
  console.log('=== USERS ===')
  users.forEach(u => console.log(`  ${u.id} | ${u.email} | ${u.name}`))

  // Get history entries grouped by userId
  const history = await prisma.queryHistory.groupBy({
    by: ['userId'],
    _count: { id: true },
  })
  console.log('\n=== HISTORY BY USER ===')
  for (const h of history) {
    const user = users.find(u => u.id === h.userId)
    console.log(`  userId: ${h.userId} | count: ${h._count.id} | user: ${user?.email ?? 'UNKNOWN'}`)
  }

  // Check if any history entries have a userId that doesn't match any user
  const allHistory = await prisma.queryHistory.findMany({
    select: { id: true, userId: true, question: true },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })
  console.log('\n=== LATEST 5 HISTORY ENTRIES ===')
  allHistory.forEach(h => {
    const user = users.find(u => u.id === h.userId)
    console.log(`  id: ${h.id} | userId: ${h.userId} | user: ${user?.email ?? 'ORPHAN!'} | q: ${h.question.slice(0, 40)}`)
  })

  // Check accounts table to see linked accounts
  const accounts = await prisma.account.findMany({
    select: { userId: true, provider: true, providerAccountId: true },
  })
  console.log('\n=== LINKED ACCOUNTS ===')
  accounts.forEach(a => {
    const user = users.find(u => u.id === a.userId)
    console.log(`  userId: ${a.userId} | provider: ${a.provider} | user: ${user?.email ?? 'UNKNOWN'}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
