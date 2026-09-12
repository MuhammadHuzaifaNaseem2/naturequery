import type { CellValue, Worksheet } from 'exceljs'
import type { ReconciliationRow } from '@/lib/reconciliation'

function cellValue(value: CellValue): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  if ('result' in value) return cellValue(value.result as CellValue)
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('')
  }
  if ('hyperlink' in value && typeof value.hyperlink === 'string') {
    return typeof value.text === 'string' ? value.text : value.hyperlink
  }
  return String(value)
}

function uniqueHeaders(worksheet: Worksheet) {
  const seen = new Map<string, number>()
  const columnCount = worksheet.actualColumnCount || worksheet.columnCount
  return Array.from({ length: columnCount }, (_, index) => {
    const raw = cellValue(worksheet.getRow(1).getCell(index + 1).value)
    const base = String(raw ?? '').trim() || `Column ${index + 1}`
    const count = seen.get(base) || 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base} (${count + 1})`
  })
}

export function worksheetToRows(worksheet: Worksheet): {
  fields: string[]
  rows: ReconciliationRow[]
} {
  const fields = uniqueHeaders(worksheet)
  const rows: ReconciliationRow[] = []

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const worksheetRow = worksheet.getRow(rowNumber)
    const row: ReconciliationRow = {}
    let hasValue = false
    fields.forEach((field, index) => {
      const value = cellValue(worksheetRow.getCell(index + 1).value)
      row[field] = value
      if (value !== null && value !== '') hasValue = true
    })
    if (hasValue) rows.push(row)
  }

  return { fields, rows }
}

export async function parseXlsxBuffer(buffer: ArrayBuffer) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('The workbook has no worksheets')
  return { ...worksheetToRows(worksheet), sheetName: worksheet.name }
}
