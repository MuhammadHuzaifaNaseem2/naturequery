require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const email = 'fashionmaxofficial2@gmail.com'
    
    const user = await prisma.user.update({
        where: { email },
        data: { password: null }
    })

    console.log(`✅ Cleared password for ${email}. Now try signing in with Google again.`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
