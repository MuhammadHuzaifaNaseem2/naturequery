/**
 * One-time migration: find DatabaseConnection rows whose `name` field contains
 * a connection-string URI (meaning a password may have been leaked into it)
 * and replace the name with a safe fallback derived from host + database.
 *
 * Run with:
 *   DATABASE_URL="..." npx tsx scripts/fix-leaked-connection-names.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONNECTION_STRING_RE = /^(postgresql|postgres|mysql|mongodb(\+srv)?|redis|sqlite):\/\//i

async function main() {
  const all = await prisma.databaseConnection.findMany({
    select: { id: true, name: true, host: true, database: true },
  })

  const leaked = all.filter((c) => CONNECTION_STRING_RE.test(c.name))

  if (leaked.length === 0) {
    console.log('No leaked connection names found.')
    return
  }

  console.log(`Found ${leaked.length} connection(s) with leaked names. Sanitizing…`)

  for (const conn of leaked) {
    const safeName = `${conn.database}@${conn.host}`.slice(0, 50)
    await prisma.databaseConnection.update({
      where: { id: conn.id },
      data: { name: safeName },
    })
    console.log(`  Fixed: ${conn.id} → "${safeName}"`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
