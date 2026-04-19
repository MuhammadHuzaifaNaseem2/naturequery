const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Attempting to add locale column to User table...\n');

try {
    // Method 1: Try using Prisma CLI directly
    console.log('Method 1: Using Prisma db push...');
    const output = execSync('npx prisma db push --accept-data-loss --skip-generate', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
        stdio: 'pipe'
    });
    console.log(output);
    console.log('✅ Success! Locale column added via Prisma db push\n');
} catch (error) {
    console.log('❌ Prisma db push failed\n');

    // Method 2: Try direct SQL execution
    console.log('Method 2: Trying direct SQL execution...');
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        (async () => {
            try {
                await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
        `);
                console.log('✅ Success! Locale column added via direct SQL\n');
                await prisma.$disconnect();
            } catch (err) {
                console.error('❌ Direct SQL failed:', err.message);
                console.log('\n📋 MANUAL STEPS REQUIRED:');
                console.log('1. Open pgAdmin or your PostgreSQL client');
                console.log('2. Connect to the "reportflow" database');
                console.log('3. Run this SQL command:');
                console.log('   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT \'en\';');
                console.log('\n4. Restart your dev server\n');
                await prisma.$disconnect();
                process.exit(1);
            }
        })();
    } catch (err) {
        console.error('❌ Could not load Prisma Client:', err.message);
        console.log('\n📋 MANUAL STEPS REQUIRED:');
        console.log('1. Open pgAdmin or your PostgreSQL client');
        console.log('2. Connect to the "reportflow" database');
        console.log('3. Run this SQL command:');
        console.log('   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT \'en\';');
        console.log('\n4. Restart your dev server\n');
        process.exit(1);
    }
}
