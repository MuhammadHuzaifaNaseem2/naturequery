require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const email = 'fashionmaxofficial2@gmail.com'
    
    // Find the user first
    const user = await prisma.user.findUnique({
        where: { email }
    })

    if (!user) {
        console.error(`❌ User with email ${email} not found`)
        return
    }

    // Upsert subscription to PRO
    const subscription = await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { 
            plan: 'PRO',
            status: 'ACTIVE'
        },
        create: {
            userId: user.id,
            plan: 'PRO',
            status: 'ACTIVE'
        }
    })

    console.log(`✅ Updated subscription for ${email} to PRO`)
    console.log(`Subscription ID: ${subscription.id}`)
    console.log(`Plan: ${subscription.plan}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
