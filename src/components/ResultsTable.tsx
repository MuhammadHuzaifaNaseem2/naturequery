'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { clsx } from 'clsx'
import { QueryResultRow } from '@/actions/db'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250]

interface ResultsTableProps {
  rows: QueryResultRow[]
  fields: string[]
  rowCount: number
  executionTime: number
}

export default function ResultsTable({
  rows,
  fields,
  rowCount,
  executionTime,
}: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedRows = useMemo(() => {
    if (!sortField) return rows
    return [...rows].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }, [rows, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, safeCurrentPage, pageSize])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  if (fields.length === 0) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="p-8 text-center text-sm text-muted-foreground">
          No data to display
        </div>
      </div>
    )
  }

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Stats Header */}
      <div className="bg-secondary px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Rows: <span className="font-medium text-foreground">{rowCount}</span>
          </span>
          <span>-</span>
          <span>
            Columns: <span className="font-medium text-foreground">{fields.length}</span>
          </span>
          <span>-</span>
          <span>
            Execution time:{' '}
            <span className="font-medium text-foreground">{executionTime}ms</span>
          </span>
          {sortField && (
            <>
              <span>-</span>
              <span>
                Sorted by:{' '}
                <span className="font-medium text-foreground">
                  {sortField} {sortDir === 'asc' ? '\u2191' : '\u2193'}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/70 sticky top-0 z-10">
            <tr>
              {fields.map((field) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="px-4 py-3 text-left font-bold text-foreground border-b border-border whitespace-nowrap cursor-pointer hover:bg-secondary select-none transition-colors"
                >
                  <span className="flex items-center gap-1">
                    {field}
                    {sortField === field && (
                      <span className="text-primary">
                        {sortDir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex % 2 === 0 ? 'bg-card' : 'bg-secondary/30'
                }
              >
                {fields.map((field) => (
                  <td
                    key={field}
                    className="px-4 py-2.5 border-b border-border/50 whitespace-nowrap"
                  >
                    <span
                      className={
                        row[field] === null || row[field] === undefined
                          ? 'text-muted-foreground/50 italic'
                          : ''
                      }
                    >
                      {formatCellValue(row[field])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {rows.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Query returned no results
        </div>
      )}

      {/* Pagination Footer */}
      {rows.length > 0 && (
        <div className="bg-secondary/50 px-4 py-3 border-t border-border flex items-center justify-between">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page:</span>
            <div className="flex gap-1">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    pageSize === size
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary text-muted-foreground'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-2">
              {(safeCurrentPage - 1) * pageSize + 1}-
              {Math.min(safeCurrentPage * pageSize, sortedRows.length)} of {sortedRows.length}
            </span>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-2">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
