'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { QueryResultRow } from '@/actions/db'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250]

interface ColumnFilter {
  type: 'text' | 'number'
  textValue?: string
  min?: string
  max?: string
}

interface ResultsTableProps {
  rows: QueryResultRow[]
  fields: string[]
  rowCount: number
  executionTime: number
}

export default function ResultsTable({ rows, fields, rowCount, executionTime }: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [globalSearch, setGlobalSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenFilterCol(null)
    }
    if (openFilterCol) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openFilterCol])

  // Detect column types from data
  const columnTypes = useMemo(() => {
    const types: Record<string, 'number' | 'text'> = {}
    for (const field of fields) {
      const firstNonNull = rows.find((r) => r[field] !== null && r[field] !== undefined)
      types[field] = firstNonNull && typeof firstNonNull[field] === 'number' ? 'number' : 'text'
    }
    return types
  }, [rows, fields])

  // Apply global search + column filters
  const filteredRows = useMemo(() => {
    let result = rows

    // Global search
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase()
      result = result.filter((row) =>
        fields.some((f) => {
          const val = row[f]
          if (val === null || val === undefined) return false
          return String(val).toLowerCase().includes(q)
        })
      )
    }

    // Column filters
    for (const [field, filter] of Object.entries(columnFilters)) {
      if (filter.type === 'text' && filter.textValue?.trim()) {
        const q = filter.textValue.toLowerCase()
        result = result.filter((row) => {
          const val = row[field]
          if (val === null || val === undefined) return false
          return String(val).toLowerCase().includes(q)
        })
      } else if (filter.type === 'number') {
        const hasMin = filter.min !== undefined && filter.min !== ''
        const hasMax = filter.max !== undefined && filter.max !== ''
        if (hasMin || hasMax) {
          const minVal = hasMin ? Number(filter.min) : -Infinity
          const maxVal = hasMax ? Number(filter.max) : Infinity
          result = result.filter((row) => {
            const val = row[field]
            if (val === null || val === undefined) return false
            const num = Number(val)
            if (isNaN(num)) return false
            return num >= minVal && num <= maxVal
          })
        }
      }
    }

    return result
  }, [rows, fields, globalSearch, columnFilters])

  const sortedRows = useMemo(() => {
    if (!sortField) return filteredRows
    return [...filteredRows].sort((a, b) => {
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
  }, [filteredRows, sortField, sortDir])

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

  const updateColumnFilter = useCallback(
    (field: string, update: Partial<ColumnFilter>) => {
      setColumnFilters((prev) => ({
        ...prev,
        [field]: { ...prev[field], type: columnTypes[field] ?? 'text', ...update },
      }))
      setCurrentPage(1)
    },
    [columnTypes]
  )

  const clearColumnFilter = useCallback((field: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setCurrentPage(1)
  }, [])

  const clearAllFilters = useCallback(() => {
    setGlobalSearch('')
    setColumnFilters({})
    setCurrentPage(1)
  }, [])

  const activeFilterCount =
    Object.entries(columnFilters).filter(([, f]) => {
      if (f.type === 'text') return f.textValue?.trim()
      if (f.type === 'number')
        return (f.min !== undefined && f.min !== '') || (f.max !== undefined && f.max !== '')
      return false
    }).length + (globalSearch.trim() ? 1 : 0)

  const hasColumnFilter = (field: string) => {
    const f = columnFilters[field]
    if (!f) return false
    if (f.type === 'text') return !!f.textValue?.trim()
    if (f.type === 'number')
      return (f.min !== undefined && f.min !== '') || (f.max !== undefined && f.max !== '')
    return false
  }

  if (fields.length === 0) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="p-8 text-center text-sm text-muted-foreground">No data to display</div>
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
      {/* Stats Header + Global Search */}
      <div className="bg-secondary px-3 sm:px-4 py-3 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Rows:{' '}
              <span className="font-medium text-foreground">
                {filteredRows.length !== rows.length
                  ? `${filteredRows.length} / ${rowCount}`
                  : rowCount}
              </span>
            </span>
            <span>-</span>
            <span>
              Columns: <span className="font-medium text-foreground">{fields.length}</span>
            </span>
            <span>-</span>
            <span>
              Execution time: <span className="font-medium text-foreground">{executionTime}ms</span>
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
            {activeFilterCount > 0 && (
              <>
                <span>-</span>
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>

          {/* Global Search */}
          <div className="relative w-full sm:w-52 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search all columns..."
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8 pr-8 py-1.5 text-xs rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-full transition-colors"
            />
            {globalSearch && (
              <button
                onClick={() => {
                  setGlobalSearch('')
                  setCurrentPage(1)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex flex-col overflow-hidden max-h-[500px]">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-secondary sticky top-0 z-10 shadow-sm">
              <tr>
                {fields.map((field) => (
                  <th
                    key={field}
                    className="px-4 py-2 text-left font-bold text-foreground border-b border-border whitespace-nowrap select-none relative align-top"
                  >
                    <div className="flex items-center gap-1">
                      <span
                        onClick={() => handleSort(field)}
                        className="flex items-center gap-1 py-3 cursor-pointer hover:text-primary transition-colors flex-1"
                      >
                        {field}
                        {sortField === field && (
                          <span className="text-primary">
                            {sortDir === 'asc' ? '\u2191' : '\u2193'}
                          </span>
                        )}
                      </span>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenFilterCol(openFilterCol === field ? null : field)
                        }}
                        className={clsx(
                          'p-1 rounded transition-colors',
                          hasColumnFilter(field)
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary'
                        )}
                        title={`Filter ${field}`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Filter Dropdown */}
                    {openFilterCol === field && (
                      <div
                        ref={filterRef}
                        className="mt-2 mb-2 bg-card border border-border rounded-lg shadow-sm p-3 min-w-[220px] font-normal"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">
                            Filter: {field}
                          </span>
                          {hasColumnFilter(field) && (
                            <button
                              onClick={() => clearColumnFilter(field)}
                              className="text-xs text-primary hover:text-primary/80"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {columnTypes[field] === 'number' ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground w-8">Min</label>
                              <input
                                type="number"
                                placeholder="Min"
                                value={columnFilters[field]?.min ?? ''}
                                onChange={(e) =>
                                  updateColumnFilter(field, { type: 'number', min: e.target.value })
                                }
                                className="flex-1 px-2 py-1.5 text-xs rounded border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground w-8">Max</label>
                              <input
                                type="number"
                                placeholder="Max"
                                value={columnFilters[field]?.max ?? ''}
                                onChange={(e) =>
                                  updateColumnFilter(field, { type: 'number', max: e.target.value })
                                }
                                className="flex-1 px-2 py-1.5 text-xs rounded border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder={`Search ${field}...`}
                              value={columnFilters[field]?.textValue ?? ''}
                              onChange={(e) =>
                                updateColumnFilter(field, {
                                  type: 'text',
                                  textValue: e.target.value,
                                })
                              }
                              autoFocus
                              className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-card' : 'bg-secondary/30'}>
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
              {paginatedRows.length === 0 && sortedRows.length === 0 && rows.length > 0 && (
                <tr>
                  <td
                    colSpan={fields.length}
                    className="p-12 text-center text-sm text-muted-foreground w-full"
                  >
                    No rows match your filters.{' '}
                    <button onClick={clearAllFilters} className="text-primary hover:underline">
                      Clear all filters
                    </button>
                  </td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={fields.length}
                    className="p-12 text-center text-sm text-muted-foreground w-full"
                  >
                    Query returned no results
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {sortedRows.length > 0 && (
          <div className="bg-secondary/50 px-3 sm:px-4 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Page size selector */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Rows per page:</span>
              <span className="sm:hidden">Per page:</span>
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap">
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
    </div>
  )
}
