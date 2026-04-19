'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { checkPlanLimits } from '@/lib/plan-limits'
import Papa from 'papaparse'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

export async function uploadDataset(formData: FormData): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user?.id) throw new Error('Not authenticated')

        // Limits check
        const limitCheck = await checkPlanLimits(session.user.id, 'CONNECTION_ADD')
        if (!limitCheck.allowed) {
            return { success: false, error: 'Database connection limit reached. Please upgrade your plan.' }
        }

        const file = formData.get('file') as File | null
        if (!file) throw new Error('No file uploaded.')

        // ── Security validation ───────────────────────────────────────────────
        const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB hard limit
        if (file.size > MAX_FILE_SIZE) {
            return { success: false, error: 'File exceeds the 10 MB size limit.' }
        }

        if (file.size === 0) {
            return { success: false, error: 'Uploaded file is empty.' }
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
            return { success: false, error: 'Only CSV files are currently supported for Magic Upload.' }
        }

        // Validate filename length to prevent filesystem issues
        if (file.name.length > 255) {
            return { success: false, error: 'File name is too long.' }
        }

        // Read and parse the CSV
        const textData = await file.text()
        const parsed = Papa.parse(textData, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, // Automatically parse numbers and booleans
        })

        if (parsed.errors.length > 0) {
            console.warn("CSV parser encountered some errors:", parsed.errors)
        }

        const rows = parsed.data as Record<string, any>[]
        if (rows.length === 0) {
            throw new Error('CSV file is empty.')
        }

        // Hard cap: reject files with more than 100,000 rows to protect server memory
        if (rows.length > 100_000) {
            return { success: false, error: 'CSV file exceeds the 100,000 row limit.' }
        }

        // CSV formula injection protection: prefix dangerous leading characters with apostrophe
        const sanitizeCellValue = (val: unknown): unknown => {
            if (typeof val === 'string' && val.length > 0) {
                // Chars that trigger formula execution in spreadsheet apps
                if (/^[=+\-@\t\r|%]/.test(val)) {
                    return `'${val}`
                }
            }
            return val
        }

        const fields = parsed.meta.fields || Object.keys(rows[0])

        // Sanitize table name to be SQL safe
        let tableName = file.name.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
        if (!/^[a-zA-Z]/.test(tableName)) {
            tableName = 't_' + tableName // Ensure it starts with a letter
        }

        // Create a safe database file path
        const dataDir = path.join(process.cwd(), 'data')
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
        }

        const dbFileName = `dataset_${session.user.id}_${crypto.randomBytes(6).toString('hex')}.db`
        const dbFilePath = path.join(dataDir, dbFileName)

        // Setup SQLite Database
        const db = new Database(dbFilePath)

        // Build Schema dynamically based on fields
        const columns = fields.map((field: string) => {
            // Type inference based on the first row's data
            const sampleVal = rows[0][field]
            let type = 'TEXT'
            if (typeof sampleVal === 'number') type = Number.isInteger(sampleVal) ? 'INTEGER' : 'REAL'
            if (typeof sampleVal === 'boolean') type = 'INTEGER' // SQLite bool is tinyint

            const safeColName = field.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
            // Fix column name if starts with a number
            const finalColName = /^[a-zA-Z]/.test(safeColName) ? safeColName : `col_${safeColName}`
            return `"${finalColName}" ${type}`
        })

        const createTableSql = `CREATE TABLE "${tableName}" (${columns.join(', ')});`
        db.prepare(createTableSql).run()

        // Insert data
        const safeFieldNames = fields.map((f: string) => {
            const safe = f.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
            return /^[a-zA-Z]/.test(safe) ? safe : `col_${safe}`
        })

        const insertSql = `INSERT INTO "${tableName}" (${safeFieldNames.map((f: string) => `"${f}"`).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`
        const insertStmt = db.prepare(insertSql)

        // Use transaction for massive performance boost
        db.transaction(() => {
            for (const row of rows) {
                const values = fields.map((f: string) =>
                    row[f] == null ? null : sanitizeCellValue(row[f])
                )
                insertStmt.run(...values)
            }
        })()

        db.close()

        // Now save this physical SQLite file as a standard Connection in the DB
        await prisma.databaseConnection.create({
            data: {
                name: `CSV: ${file.name}`,
                host: 'localhost', // not used for sqlite
                port: 0,
                database: dbFilePath,
                user: 'admin',      // not used for sqlite
                password: encrypt('sqlite_magic'), // dummy encrypted pass
                dbType: 'sqlite',
                ssl: false,
                userId: session.user.id,
            },
        })

        return { success: true }
    } catch (err: any) {
        console.error('Upload Dataset Error:', err)
        return { success: false, error: err.message || 'Failed to upload dataset.' }
    }
}
