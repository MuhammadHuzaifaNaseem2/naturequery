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
  const columnCount = worksheet.columnCount
  const bases = Array.from({ length: columnCount }, (_, index) => {
    const raw = cellValue(worksheet.getRow(1).getCell(index + 1).value)
    return String(raw ?? '').trim() || `Column ${index + 1}`
  })
  const reserved = new Set(bases)
  const used = new Set<string>()
  return bases.map((base) => {
    let name = base
    let suffix = 2
    while (used.has(name)) {
      do {
        name = `${base} (${suffix++})`
      } while (reserved.has(name) || used.has(name))
    }
    used.add(name)
    return name
  })
}

export function worksheetToRows(worksheet: Worksheet): {
  fields: string[]
  rows: ReconciliationRow[]
} {
  const fields = uniqueHeaders(worksheet)
  const rows: ReconciliationRow[] = []

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
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
