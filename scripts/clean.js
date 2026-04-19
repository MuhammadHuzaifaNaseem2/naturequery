require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  await prisma.databaseConnection.deleteMany();
  console.log('Deleted all database connections to fix encryption mismatch');
}
clean().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
