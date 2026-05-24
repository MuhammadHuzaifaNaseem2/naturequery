import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { normalizeRegionalDates } from '@/lib/normalize-dates'
import { DashboardWidget } from '@/components/DashboardWidgets'
import { ScheduledQuery } from '@/components/QueryScheduler'
import { executeSQLByConnection } from '@/actions/connections'
import { updateChecklistItem } from '@/actions/onboarding-checklist'
import { SavedConnection } from '@/app/dashboard/types'
import { getUserConnections } from '@/actions/connections'

export function useDashboardWidgets(
  activeConnectionId: string | null,
  activeConnection: SavedConnection | undefined,
  setConnections: React.Dispatch<React.SetStateAction<SavedConnection[]>>,
  setActiveConnectionId: React.Dispatch<React.SetStateAction<string | null>>,
  setShowPlanLimit: React.Dispatch<React.SetStateAction<boolean>>,
  setPlanLimitReason: React.Dispatch<React.SetStateAction<'query' | 'connection'>>,
  setShowScheduler: React.Dispatch<React.SetStateAction<boolean>>
) {
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
  const [scheduledQueries, setScheduledQueries] = useState<ScheduledQuery[]>([])
  const [isRefreshingWidget, setIsRefreshingWidget] = useState<string | null>(null)
  const [schedulerContext, setSchedulerContext] = useState<{
    question: string
    sql: string
  } | null>(null)

  const handlePinToDashboard = useCallback(
    async (
      question: string,
      sql: string,
      data: import('@/actions/db').QueryResultRow[],
      fields: string[]
    ) => {
      const title = question.slice(0, 50) || 'Query Result'
      const connectionId = activeConnectionId || undefined
      const connectionName = activeConnection?.name || undefined
      try {
        const res = await fetch('/api/dashboard/widgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, question, sql, connectionId, connectionName }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        const w = json.data
        setDashboardWidgets((prev) => [
          ...prev,
          {
            id: w.id,
            name: w.title,
            question: w.question,
            sql: w.sql,
            chartType: 'bar',
            data,
            fields,
            createdAt: new Date(w.createdAt),
            lastRefreshed: new Date(),
            position: w.position,
          },
        ])
        window.dispatchEvent(new Event('switchToDashboard'))
        toast.success('Pinned to dashboard')
        updateChecklistItem('pinnedChart', true).catch(() => {})
        window.dispatchEvent(
          new CustomEvent('onboarding:complete', { detail: { item: 'pinnedChart' } })
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to pin query')
      }
    },
    [activeConnectionId, activeConnection]
  )

  const handleRemoveWidget = useCallback(async (id: string) => {
    try {
      await fetch(`/api/dashboard/widgets/${id}`, { method: 'DELETE' })
      setDashboardWidgets((prev) => prev.filter((w) => w.id !== id))
    } catch {
      toast.error('Failed to remove widget')
    }
  }, [])

  const handleRefreshWidget = useCallback(
    async (id: string) => {
      const widget = dashboardWidgets.find((w) => w.id === id)
      if (!widget || !activeConnection) return
      setIsRefreshingWidget(id)
      try {
        if (activeConnection.isDemo) return
        const result = await executeSQLByConnection(activeConnection.id, widget.sql)
        if (result.success && result.data) {
          setDashboardWidgets((prev) =>
            prev.map((w) =>
              w.id === id ? { ...w, data: result.data!.rows, lastRefreshed: new Date() } : w
            )
          )
        }
      } finally {
        setIsRefreshingWidget(null)
      }
    },
    [dashboardWidgets, activeConnection]
  )

  const handleReorderWidgets = useCallback((widgets: DashboardWidget[]) => {
    setDashboardWidgets(widgets)
  }, [])

  const handleOpenScheduler = useCallback(
    (question: string, sql: string) => {
      setSchedulerContext({ question, sql })
      setShowScheduler(true)
    },
    [setShowScheduler]
  )

  const handleUploadCSV = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase()
      const isCsv = lower.endsWith('.csv')
      const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls')

      if (!isCsv && !isExcel) {
        toast.error('Invalid file type', {
          description: 'Only .csv, .xlsx, and .xls files are supported.',
        })
        return
      }

      const loadingToast = toast.loading(isExcel ? 'Reading Excel…' : 'Reading CSV…')

      try {
        let rows: Record<string, unknown>[] = []
        let headers: string[] = []

        if (isExcel) {
          // Dynamic import keeps ExcelJS out of the initial bundle
          const ExcelJS = (await import('exceljs')).default
          const wb = new ExcelJS.Workbook()
          const buf = await file.arrayBuffer()
          await wb.xlsx.load(buf)
          const ws = wb.worksheets[0]
          if (!ws) {
            toast.error('Empty workbook', {
              description: 'No sheets found in the file.',
              id: loadingToast,
            })
            return
          }
          const headerRow = ws.getRow(1)
          headers = (headerRow.values as unknown[])
            .slice(1) // ExcelJS uses 1-based indexing; index 0 is null
            .map((v) => (v == null ? '' : String(v).trim()))
            .filter((h) => h !== '')

          for (let r = 2; r <= ws.rowCount; r++) {
            const row = ws.getRow(r)
            const vals = (row.values as unknown[]).slice(1)
            const obj: Record<string, unknown> = {}
            let hasValue = false
            headers.forEach((h, i) => {
              const v = vals[i]
              if (v != null && String(v).trim() !== '') hasValue = true
              // ExcelJS returns Date objects for date cells — convert to ISO strings
              obj[h] = v instanceof Date ? v.toISOString() : (v ?? null)
            })
            if (hasValue) rows.push(obj)
          }
        } else {
          // Parse CSV entirely in the browser.
          // Try UTF-8 first; fall back to Windows-1252 for Excel-exported CSVs that
          // contain accented characters or smart quotes (very common pitfall).
          const buf = await file.arrayBuffer()
          let text: string
          try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
          } catch {
            text = new TextDecoder('windows-1252').decode(buf)
          }
          // Strip UTF-8 BOM if present
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
          const parsed = Papa.parse<Record<string, unknown>>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().replace(/^﻿/, ''),
          })
          rows = parsed.data
          headers = parsed.meta.fields ?? []
        }

        if (rows.length === 0) {
          toast.error('Empty file', { description: 'The file has no data rows.', id: loadingToast })
          return
        }
        if (headers.length === 0) {
          toast.error('No headers found', {
            description: 'The first row must contain column names.',
            id: loadingToast,
          })
          return
        }
        if (rows.length > 100_000) {
          toast.error('Too many rows', {
            description: 'Maximum 100,000 rows supported.',
            id: loadingToast,
          })
          return
        }

        // Convert regional dates (DD/MM/YYYY, MM/DD/YYYY) to ISO so the server
        // can infer DATE/TIMESTAMP column types correctly.
        normalizeRegionalDates(rows, headers)

        // Send in batches of 5000 rows (~1-2 MB JSON each, well under Vercel's 4.5 MB cap)
        const BATCH = 5000
        const batches: Record<string, unknown>[][] = []
        for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH))

        toast.loading(`Uploading ${rows.length.toLocaleString()} rows…`, { id: loadingToast })

        let tableName: string | undefined

        for (let i = 0; i < batches.length; i++) {
          const isFirst = i === 0
          const isLast = i === batches.length - 1

          if (batches.length > 1) {
            toast.loading(`Uploading… ${Math.round(((i + 1) / batches.length) * 100)}%`, {
              id: loadingToast,
            })
          }

          const res = await fetch('/api/upload-csv-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              ...(isFirst ? { headers } : { headers }),
              rows: batches[i],
              tableName,
              isFirst,
              isLast,
            }),
          })

          const result = (await res.json()) as {
            success: boolean
            error?: string
            tableName?: string
            limitReached?: boolean
          }

          if (!result.success) {
            if (result.limitReached) {
              toast.dismiss(loadingToast)
              setPlanLimitReason('connection')
              setShowPlanLimit(true)
            } else {
              toast.error('Upload Failed', { description: result.error, id: loadingToast })
            }
            return
          }

          if (isFirst) tableName = result.tableName
        }

        toast.success(`Magic Dataset ready! (${rows.length.toLocaleString()} rows)`, {
          id: loadingToast,
        })

        const serverConns = await getUserConnections()
        setConnections((prev) => {
          const prevById = new Map(prev.map((c) => [c.id, c]))
          return serverConns.map((c) => {
            const existing = prevById.get(c.id)
            return {
              id: c.id,
              name: c.name,
              host: c.host,
              port: c.port,
              database: c.database,
              user: c.user,
              dbType: c.dbType,
              isActive: c.isActive,
              status: 'active' as const,
              schema: existing?.schema,
            }
          })
        })
        const newConn = serverConns.find((c) => c.name === `CSV: ${file.name}`)
        if (newConn) setActiveConnectionId(newConn.id)
      } catch {
        toast.error('Upload Failed', {
          description: 'Something went wrong. Please try again.',
          id: loadingToast,
        })
      }
    },
    [setConnections, setActiveConnectionId, setShowPlanLimit, setPlanLimitReason]
  )

  const handleCloseScheduler = useCallback(() => {
    setShowScheduler(false)
    setSchedulerContext(null)
  }, [setShowScheduler])

  const handleCreateSchedule = useCallback(
    async (schedule: Omit<ScheduledQuery, 'id' | 'lastRun' | 'nextRun' | 'createdAt'>) => {
      const frequencyMap: Record<string, string> = {
        hourly: 'HOURLY',
        daily: 'DAILY',
        weekly: 'WEEKLY',
        monthly: 'MONTHLY',
      }
      const frequency = frequencyMap[schedule.schedule.type] || 'DAILY'
      try {
        const res = await fetch('/api/scheduled-queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: schedule.name,
            question: schedule.question,
            sql: schedule.sql,
            connectionId: schedule.connectionId,
            frequency,
            notifyEmails: schedule.notifyEmails ?? [],
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Failed to create schedule')
        const s = json.data
        setScheduledQueries((prev) => [
          ...prev,
          {
            id: s.id,
            name: s.name,
            question: s.question,
            sql: s.sql,
            connectionId: s.connectionId ?? '',
            connectionName: s.connectionName ?? '',
            schedule: {
              type: (s.frequency as string).toLowerCase() as
                | 'hourly'
                | 'daily'
                | 'weekly'
                | 'monthly',
              time: '09:00',
            },
            notifications: {},
            notifyEmails: s.notifyEmails ?? [],
            isActive: s.enabled,
            lastStatus: s.lastStatus ?? null,
            lastError: s.lastError ?? null,
            createdAt: new Date(s.createdAt),
            nextRun: s.nextRunAt ? new Date(s.nextRunAt) : undefined,
          },
        ])
        setShowScheduler(false)
        toast.success('Query scheduled')
        updateChecklistItem('setupSchedule', true).catch(() => {})
        window.dispatchEvent(
          new CustomEvent('onboarding:complete', { detail: { item: 'setupSchedule' } })
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create schedule'
        toast.error(message)
      }
    },
    [setShowScheduler]
  )

  const handleDeleteSchedule = useCallback(async (id: string) => {
    try {
      await fetch(`/api/scheduled-queries/${id}`, { method: 'DELETE' })
      setScheduledQueries((prev) => prev.filter((s) => s.id !== id))
    } catch {
      toast.error('Failed to delete schedule')
    }
  }, [])

  const handleToggleSchedule = useCallback(
    async (id: string) => {
      const current = scheduledQueries.find((s) => s.id === id)
      if (!current) return
      try {
        await fetch(`/api/scheduled-queries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !current.isActive }),
        })
        setScheduledQueries((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
        )
      } catch {
        toast.error('Failed to update schedule')
      }
    },
    [scheduledQueries]
  )

  return {
    dashboardWidgets,
    setDashboardWidgets,
    scheduledQueries,
    setScheduledQueries,
    isRefreshingWidget,
    schedulerContext,
    handlePinToDashboard,
    handleRemoveWidget,
    handleRefreshWidget,
    handleReorderWidgets,
    handleOpenScheduler,
    handleUploadCSV,
    handleCloseScheduler,
    handleCreateSchedule,
    handleDeleteSchedule,
    handleToggleSchedule,
  }
}
