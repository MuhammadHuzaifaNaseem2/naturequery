import fs from 'node:fs'
import { once } from 'node:events'
import type { ExportFormat } from '@shared/types'

/** Text for one exported cell. Objects become JSON; nothing becomes empty. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Spreadsheet apps treat text starting with = + - @ (and tab or carriage
 * return) as a formula. Prefix such text with an apostrophe so exported data
 * can never execute when opened. Real numbers are left alone.
 */
export function neutralizeFormula(text: string, original: unknown): string {
  if (typeof original === 'number' || typeof original === 'bigint') return text
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

export function csvCell(value: unknown): string {
  const text = neutralizeFormula(cellText(value), value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function writeCsv(file: string, columns: string[], rows: unknown[][]): Promise<void> {
  const stream = fs.createWriteStream(file, { encoding: 'utf8' })
  const write = async (chunk: string) => {
    if (!stream.write(chunk)) await once(stream, 'drain')
  }
  // The byte order mark makes Excel open UTF-8 text correctly.
  await write('﻿' + columns.map(csvCell).join(',') + '\r\n')
  for (const row of rows) await write(row.map(csvCell).join(',') + '\r\n')
  stream.end()
  await once(stream, 'finish')
}

export async function writeJson(file: string, columns: string[], rows: unknown[][]): Promise<void> {
  const objects = rows.map((row) => {
    const record: Record<string, unknown> = {}
    columns.forEach((column, index) => {
      const value = row[index]
      record[uniqueKey(record, column)] = typeof value === 'bigint' ? value.toString() : value
    })
    return record
  })
  await fs.promises.writeFile(file, JSON.stringify(objects, null, 2), 'utf8')
}

/**
 * exceljs is a CommonJS package. In the built app, import() hands back its exports under
 * `default` (so `ExcelJS.stream` was undefined and every Excel export failed), while
 * test runners flatten them. Take whichever shape arrives.
 */
export function commonJsModule<T extends object>(imported: T): T {
  const wrapped = (imported as { default?: T }).default
  return wrapped && typeof wrapped === 'object' ? wrapped : imported
}

export async function writeXlsx(file: string, columns: string[], rows: unknown[][]): Promise<void> {
  const ExcelJS = commonJsModule(await import('exceljs'))
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: file, useStyles: true })
  workbook.creator = 'NatureQuery Desktop'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Results', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map((name, index) => ({
    header: name,
    key: `c${index}`,
    width: estimateWidth(name, rows, index),
  }))
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).commit()
  for (const row of rows) {
    sheet
      .addRow(
        row.map((value) => {
          if (value === null || value === undefined) return null
          if (typeof value === 'number' || typeof value === 'boolean') return value
          if (value instanceof Date) return value
          return neutralizeFormula(cellText(value), value)
        })
      )
      .commit()
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  await sheet.commit()
  await workbook.commit()
}

function estimateWidth(header: string, rows: unknown[][], index: number): number {
  let longest = header.length
  for (let i = 0; i < Math.min(rows.length, 200); i++) {
    longest = Math.max(longest, cellText(rows[i][index]).length)
  }
  return Math.min(Math.max(longest + 2, 8), 60)
}

function uniqueKey(record: Record<string, unknown>, name: string): string {
  if (!(name in record)) return name
  let suffix = 2
  while (`${name}_${suffix}` in record) suffix++
  return `${name}_${suffix}`
}

export async function writeExport(
  format: ExportFormat,
  file: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  if (format === 'csv') return writeCsv(file, columns, rows)
  if (format === 'json') return writeJson(file, columns, rows)
  return writeXlsx(file, columns, rows)
}

export const EXPORT_FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  csv: { name: 'CSV file', extensions: ['csv'] },
  xlsx: { name: 'Excel workbook', extensions: ['xlsx'] },
  json: { name: 'JSON file', extensions: ['json'] },
}
