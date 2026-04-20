'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { checkPlanLimits } from '@/lib/plan-limits'
import { ingestCsv } from '@/lib/magic-dataset'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function uploadDataset(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new Error('Not authenticated')

    const limitCheck = await checkPlanLimits(session.user.id, 'CONNECTION_ADD')
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: 'Database connection limit reached. Please upgrade your plan.',
      }
    }

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file uploaded.' }
    if (file.size === 0) return { success: false, error: 'Uploaded file is empty.' }
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File exceeds the 10 MB size limit.' }
    }
    if (file.name.length > 255) {
      return { success: false, error: 'File name is too long.' }
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return {
        success: false,
        error: 'Only CSV files are currently supported for Magic Upload.',
      }
    }

    const csvText = await file.text()
    const ingest = await ingestCsv({
      userId: session.user.id,
      csvText,
      filename: file.name,
    })

    // For magic connections the `user` column carries the owning user id so
    // the driver can derive the per-user schema; `database` holds the table
    // name created by the ingest.
    await prisma.databaseConnection.create({
      data: {
        name: `CSV: ${file.name}`,
        host: 'magic',
        port: 0,
        database: ingest.tableName,
        user: session.user.id,
        password: encrypt('magic'),
        dbType: 'magic',
        ssl: false,
        userId: session.user.id,
      },
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload dataset.'
    console.error('Upload Dataset Error:', err)
    return { success: false, error: message }
  }
}
