'use server'

import ExcelJS from 'exceljs'
import { QueryResultRow } from './db'
import { ExportToExcelSchema, ExportToCSVSchema, validateInput } from '@/lib/validation'

export interface ExportRequest {
  rows: QueryResultRow[]
  fields: string[]
  filename?: string
  title?: string
}

export interface ExportResult {
  success: boolean
  data?: string // base64 encoded file
  filename?: string
  mimeType?: string
  error?: string
}

/**
 * Export query results to CSV format
 */
export async function exportToCSV(request: ExportRequest): Promise<ExportResult> {
  try {
    // Validate input
    const validation = validateInput(ExportToCSVSchema, request)
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      }
    }

    const { rows, fields, filename = 'report.csv' } = validation.data

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) {
        return ''
      }
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build CSV content
    const headerRow = fields.map(escapeCSV).join(',')
    const dataRows = rows.map((row) => fields.map((field) => escapeCSV(row[field])).join(','))

    const csvContent = [headerRow, ...dataRows].join('\n')

    // Convert to base64
    const base64 = Buffer.from(csvContent, 'utf-8').toString('base64')

    return {
      success: true,
      data: base64,
      filename,
      mimeType: 'text/csv',
    }
  } catch (error) {
    console.error('CSV export failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export to CSV',
    }
  }
}

/**
 * Export query results to a professionally formatted Excel file
 * Theme: Blue headers, gray zebra-stripes, currency formatting, auto-filter
 */
export async function exportToExcel(request: ExportRequest): Promise<ExportResult> {
  try {
    // Validate input
    const validation = validateInput(ExportToExcelSchema, request)
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      }
    }

    const { rows, fields, filename = 'report.xlsx', title = 'Query Results' } = validation.data

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'NatureQuery'
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet('Report', {
      views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row
    })

    // Define columns with headers
    worksheet.columns = fields.map((field) => ({
      header: field,
      key: field,
      width: Math.max(field.length + 2, 12),
    }))

    // Style the header row (Row 1)
    const headerRow = worksheet.getRow(1)
    headerRow.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11,
    }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue-600
    }
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    }
    headerRow.height = 24

    // Add data rows with zebra striping
    rows.forEach((row, index) => {
      const dataRow = worksheet.addRow(row)
      const rowNumber = index + 2 // +2 because row 1 is header

      // Zebra striping: alternate between white and light gray
      if (index % 2 === 1) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }, // Gray-100
        }
      }

      // Format each cell
      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const value = cell.value

        // Apply currency formatting for number columns that look like money
        if (typeof value === 'number') {
          const fieldName = fields[colNumber - 1]?.toLowerCase() || ''
          if (
            fieldName.includes('price') ||
            fieldName.includes('amount') ||
            fieldName.includes('total') ||
            fieldName.includes('cost') ||
            fieldName.includes('revenue') ||
            fieldName.includes('salary') ||
            fieldName.includes('fee')
          ) {
            cell.numFmt = '"$"#,##0.00'
          } else if (fieldName.includes('percent') || fieldName.includes('rate')) {
            cell.numFmt = '0.00%'
          } else {
            cell.numFmt = '#,##0.##'
          }
        }

        // Format dates
        if (value instanceof Date) {
          cell.numFmt = 'yyyy-mm-dd'
        }

        // Add subtle borders
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }

        cell.alignment = { vertical: 'middle' }
      })
    })

    // Auto-fit column widths based on content
    worksheet.columns.forEach((column) => {
      let maxLength = column.header?.toString().length || 10

      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value?.toString() || ''
        maxLength = Math.max(maxLength, cellValue.length)
      })

      column.width = Math.min(maxLength + 4, 50)
    })

    // Add auto-filter to header row
    if (fields.length > 0 && rows.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rows.length + 1, column: fields.length },
      }
    }

    // Add header borders (stronger)
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1E40AF' } },
        left: { style: 'thin', color: { argb: 'FF1E40AF' } },
        bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
        right: { style: 'thin', color: { argb: 'FF1E40AF' } },
      }
    })

    // Generate buffer and convert to base64
    const buffer = await workbook.xlsx.writeBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    return {
      success: true,
      data: base64,
      filename,
    }
  } catch (error) {
    console.error('Excel export failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export to Excel',
    }
  }
}
