require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    // Update all ANALYST users to ADMIN for the owner
    const result = await prisma.user.updateMany({
        where: { email: { contains: 'huzaifakhan' } },
        data: { role: 'ADMIN' },
    })
    console.log('✅ Updated', result.count, 'user(s) to ADMIN')

    // Verify
    const users = await prisma.user.findMany({
        where: { email: { contains: 'huzaifakhan' } },
        select: { email: true, role: true },
    })
    users.forEach(u => console.log(`  ${u.email} → ${u.role}`))
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
