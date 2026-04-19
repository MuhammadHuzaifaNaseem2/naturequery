require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const email = 'fashionmaxofficial2@gmail.com'

    console.log(`\n=== SEARCHING FOR EMAIL: ${email} ===`)

    // 1. Find ALL users (case-insensitive check)
    const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, name: true, password: true }
    })
    
    const matchedUsers = allUsers.filter(u => u.email?.toLowerCase() === email.toLowerCase())

    console.log(`Found ${matchedUsers.length} user(s) matching email (case-insensitive):`)
    matchedUsers.forEach(u => {
        console.log(`  ID: ${u.id}`)
        console.log(`  Email: ${u.email}`)
        console.log(`  Has Password: ${!!u.password}`)
        console.log()
    })

    // 2. Find ALL linked accounts for these users
    for (const user of matchedUsers) {
        const accounts = await prisma.account.findMany({
            where: { userId: user.id }
        })
        console.log(`Accounts for User ID ${user.id} (${user.email}):`)
        if (accounts.length === 0) {
            console.log('  None')
        } else {
            accounts.forEach(a => {
                console.log(`  - Provider: ${a.provider}, ID: ${a.providerAccountId}`)
            })
        }
        console.log()
    }

    // 3. Find ALL Google accounts and see if ANY match the email being returned
    console.log('=== ALL GOOGLE ACCOUNTS IN DB ===')
    const googleAccounts = await prisma.account.findMany({
        where: { provider: 'google' },
        include: { user: true }
    })
    
    if (googleAccounts.length === 0) {
        console.log('No Google accounts found in the database.')
    } else {
        googleAccounts.forEach(a => {
            console.log(`  - Google ID: ${a.providerAccountId}`)
            console.log(`    Linked to User ID: ${a.userId}`)
            console.log(`    User Email: ${a.user.email}`)
            console.log()
        })
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
