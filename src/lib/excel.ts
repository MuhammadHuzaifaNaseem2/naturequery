import ExcelJS from 'exceljs'
import { QueryResult } from './types'

export interface ExportOptions {
  filename?: string
  sheetName?: string
  includeMetadata?: boolean
}

/**
 * Export query results to Excel buffer
 */
export async function exportToExcel(
  queryResult: QueryResult,
  options: ExportOptions = {}
): Promise<Buffer> {
  const {
    filename = 'query_results.xlsx',
    sheetName = 'Query Results',
    includeMetadata = true,
  } = options

  const workbook = new ExcelJS.Workbook()
  
  // Set workbook properties
  workbook.creator = 'ReportFlow'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Create main worksheet
  const worksheet = workbook.addWorksheet(sheetName)

  // Add metadata if requested
  if (includeMetadata && queryResult.rowCount > 0) {
    worksheet.addRow(['Query Metadata'])
    worksheet.addRow(['Total Rows:', queryResult.rowCount])
    worksheet.addRow(['Execution Time:', `${queryResult.executionTime}ms`])
    worksheet.addRow(['Generated:', new Date().toISOString()])
    worksheet.addRow([]) // Empty row for spacing
    
    // Style metadata section
    worksheet.getCell('A1').font = { bold: true, size: 14 }
    worksheet.getCell('A2').font = { bold: true }
    worksheet.getCell('A3').font = { bold: true }
    worksheet.getCell('A4').font = { bold: true }
  }

  // Add column headers
  if (queryResult.fields.length > 0) {
    const headers = queryResult.fields.map(field => field.name)
    const headerRow = worksheet.addRow(headers)
    
    // Style headers
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
  }

  // Add data rows
  for (const row of queryResult.rows) {
    const values = queryResult.fields.map(field => {
      const value = row[field.name]
      
      // Handle special data types
      if (value instanceof Date) {
        return value
      }
      if (value === null || value === undefined) {
        return ''
      }
      if (typeof value === 'object') {
        return JSON.stringify(value)
      }
      
      return value
    })
    
    worksheet.addRow(values)
  }

  // Auto-fit columns
  worksheet.columns.forEach((column, index) => {
    let maxLength = 10 // Minimum width
    
    if (queryResult.fields[index]) {
      maxLength = Math.max(maxLength, queryResult.fields[index].name.length)
    }
    
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value?.toString() || ''
      maxLength = Math.max(maxLength, cellValue.length)
    })
    
    column.width = Math.min(maxLength + 2, 50) // Max width of 50
  })

  // Add borders to data range
  if (queryResult.rows.length > 0) {
    const dataStartRow = includeMetadata ? 6 : 1
    const lastRow = dataStartRow + queryResult.rows.length
    const lastCol = queryResult.fields.length
    
    for (let row = dataStartRow; row <= lastRow; row++) {
      for (let col = 1; col <= lastCol; col++) {
        const cell = worksheet.getCell(row, col)
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        }
      }
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Create downloadable Excel file from query results
 */
export function createExcelDownload(buffer: Buffer, filename: string): Blob {
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
