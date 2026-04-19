// Verify that the locale column was added successfully
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyLocaleColumn() {
    try {
        console.log('🔍 Verifying locale column...\n')

        // Try to query a user with the locale field
        const user = await prisma.user.findFirst({
            select: {
                id: true,
                email: true,
                locale: true,
            }
        })

        if (user) {
            console.log('✅ SUCCESS! Locale column exists and is working!')
            console.log(`   User: ${user.email}`)
            console.log(`   Locale: ${user.locale}`)
            console.log('\n🎉 Your database is now ready for i18n!\n')
        } else {
            console.log('✅ Locale column exists (no users found to test with)')
        }

    } catch (error) {
        console.error('❌ Error:', error.message)
        console.log('\nThe locale column might not have been added correctly.')
        console.log('Please try running the SQL command again in pgAdmin.\n')
    } finally {
        await prisma.$disconnect()
    }
}

verifyLocaleColumn()
