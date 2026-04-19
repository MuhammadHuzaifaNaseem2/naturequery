import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DashboardWidget } from '@/components/DashboardWidgets'
import { ScheduledQuery } from '@/components/QueryScheduler'
import { executeSQLByConnection } from '@/actions/connections'
import { updateChecklistItem } from '@/actions/onboarding-checklist'
import { uploadDataset } from '@/actions/upload-dataset'
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
  const [schedulerContext, setSchedulerContext] = useState<{ question: string; sql: string } | null>(null)

  const handlePinToDashboard = useCallback(async (question: string, sql: string, data: import('@/actions/db').QueryResultRow[], fields: string[]) => {
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
      setDashboardWidgets(prev => [...prev, {
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
      }])
      window.dispatchEvent(new Event('switchToDashboard'))
      toast.success('Pinned to dashboard')
      updateChecklistItem('pinnedChart', true).catch(() => {})
      window.dispatchEvent(new CustomEvent('onboarding:complete', { detail: { item: 'pinnedChart' } }))
    } catch {
      toast.error('Failed to pin query')
    }
  }, [activeConnectionId, activeConnection])

  const handleRemoveWidget = useCallback(async (id: string) => {
    try {
      await fetch(`/api/dashboard/widgets/${id}`, { method: 'DELETE' })
      setDashboardWidgets(prev => prev.filter(w => w.id !== id))
    } catch {
      toast.error('Failed to remove widget')
    }
  }, [])

  const handleRefreshWidget = useCallback(async (id: string) => {
    const widget = dashboardWidgets.find(w => w.id === id)
    if (!widget || !activeConnection) return
    setIsRefreshingWidget(id)
    try {
      if (activeConnection.isDemo) return
      const result = await executeSQLByConnection(activeConnection.id, widget.sql)
      if (result.success && result.data) {
        setDashboardWidgets(prev => prev.map(w =>
          w.id === id ? { ...w, data: result.data!.rows, lastRefreshed: new Date() } : w
        ))
      }
    } finally {
      setIsRefreshingWidget(null)
    }
  }, [dashboardWidgets, activeConnection])

  const handleReorderWidgets = useCallback((widgets: DashboardWidget[]) => {
    setDashboardWidgets(widgets)
  }, [])

  const handleOpenScheduler = useCallback((question: string, sql: string) => {
    setSchedulerContext({ question, sql })
    setShowScheduler(true)
  }, [setShowScheduler])

  const handleUploadCSV = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const loadingToast = toast.loading(`Uploading magic dataset ${file.name}...`)
    try {
      const result = await uploadDataset(formData)
      if (result.success) {
        toast.success('Magic Dataset created!', { id: loadingToast })
        const serverConns = await getUserConnections()
        setConnections(prev => {
          const prevById = new Map(prev.map(c => [c.id, c]))
          return serverConns.map((c) => {
            const existing = prevById.get(c.id)
            return {
              id: c.id, name: c.name, host: c.host, port: c.port,
              database: c.database, user: c.user, dbType: c.dbType,
              isActive: c.isActive, status: 'active' as const,
              schema: existing?.schema,
            }
          })
        })
        const newConn = serverConns.find(c => c.name === `CSV: ${file.name}`)
        if (newConn) setActiveConnectionId(newConn.id)
      } else {
        const isLimitError = result.error?.toLowerCase().includes('limit') || result.error?.toLowerCase().includes('upgrade')
        if (isLimitError) {
          toast.dismiss(loadingToast)
          setPlanLimitReason('connection')
          setShowPlanLimit(true)
        } else {
          toast.error('Upload Failed', { description: result.error, id: loadingToast })
        }
      }
    } catch (err: any) {
      toast.error('Upload Failed', { description: err.message, id: loadingToast })
    }
  }, [setConnections, setActiveConnectionId, setShowPlanLimit, setPlanLimitReason])

  const handleCloseScheduler = useCallback(() => {
    setShowScheduler(false)
    setSchedulerContext(null)
  }, [setShowScheduler])

  const handleCreateSchedule = useCallback(async (schedule: Omit<ScheduledQuery, 'id' | 'lastRun' | 'nextRun' | 'createdAt'>) => {
    const frequencyMap: Record<string, string> = {
      hourly: 'HOURLY', daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY',
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
      if (!json.success) throw new Error(json.error)
      const s = json.data
      setScheduledQueries(prev => [...prev, {
        id: s.id,
        name: s.name,
        question: s.question,
        sql: s.sql,
        connectionId: s.connectionId ?? '',
        connectionName: s.connectionName ?? '',
        schedule: { type: (s.frequency as string).toLowerCase() as 'hourly' | 'daily' | 'weekly' | 'monthly', time: '09:00' },
        notifications: {},
        notifyEmails: s.notifyEmails ?? [],
        isActive: s.enabled,
        lastStatus: s.lastStatus ?? null,
        lastError: s.lastError ?? null,
        createdAt: new Date(s.createdAt),
        nextRun: s.nextRunAt ? new Date(s.nextRunAt) : undefined,
      }])
      setShowScheduler(false)
      toast.success('Query scheduled')
      updateChecklistItem('setupSchedule', true).catch(() => {})
      window.dispatchEvent(new CustomEvent('onboarding:complete', { detail: { item: 'setupSchedule' } }))
    } catch {
      toast.error('Failed to create schedule')
    }
  }, [setShowScheduler])

  const handleDeleteSchedule = useCallback(async (id: string) => {
    try {
      await fetch(`/api/scheduled-queries/${id}`, { method: 'DELETE' })
      setScheduledQueries(prev => prev.filter(s => s.id !== id))
    } catch {
      toast.error('Failed to delete schedule')
    }
  }, [])

  const handleToggleSchedule = useCallback(async (id: string) => {
    const current = scheduledQueries.find(s => s.id === id)
    if (!current) return
    try {
      await fetch(`/api/scheduled-queries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !current.isActive }),
      })
      setScheduledQueries(prev => prev.map(s =>
        s.id === id ? { ...s, isActive: !s.isActive } : s
      ))
    } catch {
      toast.error('Failed to update schedule')
    }
  }, [scheduledQueries])

  return {
    dashboardWidgets, setDashboardWidgets,
    scheduledQueries, setScheduledQueries,
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
