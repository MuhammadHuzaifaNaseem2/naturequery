import { useState, useCallback, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DBCredentials, DatabaseSchema } from '@/actions/db'
import { schemaCache } from '@/lib/schema-cache'
import {
  generateSQL,
  fixSQL,
  discoverSchema,
  refineQueryWithFilter,
  recommendChart,
} from '@/actions/ai'
import { updateChecklistItem } from '@/actions/onboarding-checklist'
import { exportToExcel, exportToCSV } from '@/actions/export'
import { analyzeResults, InsightResult } from '@/actions/insights'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'
import {
  addHistoryEntry,
  getQueryHistory,
  clearQueryHistory as clearQueryHistoryAction,
  deleteHistoryEntry,
  saveQuery as saveQueryAction,
  getSavedQueries,
  deleteSavedQuery as deleteSavedQueryAction,
  toggleFavorite as toggleFavoriteAction,
  migrateLocalData,
} from '@/actions/queries'
import { uploadDataset } from '@/actions/upload-dataset'
import { generateShareLink } from '@/actions/sharing'
import { DashboardWidget } from '@/components/DashboardWidgets'
import { ScheduledQuery } from '@/components/QueryScheduler'
import { toast } from 'sonner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTheme } from '@/components/ThemeProvider'
import { SavedConnection, QueryResults } from './types'
import { DEMO_SCHEMA, DEMO_DATA } from './demo-data'
import { useDashboardUI } from '@/hooks/dashboard/useDashboardUI'
import { useDashboardHistory } from '@/hooks/dashboard/useDashboardHistory'
import { useDashboardWidgets } from '@/hooks/dashboard/useDashboardWidgets'
import {
  getUserConnections,
  saveConnection,
  deleteConnection as deleteConnectionAction,
  fetchSchemaByConnection,
  refreshSchemaByConnection,
  executeSQLByConnection,
} from '@/actions/connections'

export function useDashboard() {
  const { t } = useTranslation()
  // Get user session for user-specific storage
  const { data: session } = useSession()
  const userId = session?.user?.id

  // Helper function to generate user-specific localStorage keys
  const getStorageKey = useCallback(
    (key: string) => {
      return userId ? `${key}_${userId}` : key
    },
    [userId]
  )

  // Connection state
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)

  // Query state
  const [nlQuery, setNlQuery] = useState('')
  const [generatedSQL, setGeneratedSQL] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [queryResults, setQueryResults] = useState<QueryResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // AI Insights state
  const [insights, setInsights] = useState<InsightResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Schema discovery ("What Can I Ask?") state
  const [schemaSuggestions, setSchemaSuggestions] = useState<{
    summary: string
    suggestions: string[]
  } | null>(null)
  const [isDiscovering, setIsDiscovering] = useState(false)

  // Conversational follow-up context (per connection)
  const conversationRef = useRef<
    Map<string, { question: string; sql: string; rowCount?: number }[]>
  >(new Map())
  const [conversationLength, setConversationLength] = useState(0)
  const MAX_CONVERSATION_TURNS = 5

  // NL filter state
  const [activeFilters, setActiveFilters] = useState<
    { id: string; label: string; nlQuery: string }[]
  >([])
  const [isApplyingFilter, setIsApplyingFilter] = useState(false)
  // Track the "base SQL" before any filters (so we can rebuild from it)
  const baseSqlRef = useRef<string>('')

  // Extract UI state
  const {
    showLeftSidebar,
    setShowLeftSidebar,
    showRightSidebar,
    setShowRightSidebar,
    showCommandPalette,
    setShowCommandPalette,
    showAddConnection,
    setShowAddConnection,
    showHistory,
    setShowHistory,
    showSchema,
    setShowSchema,
    showExportMenu,
    setShowExportMenu,
    showShortcutsHelp,
    setShowShortcutsHelp,
    showProfileMenu,
    setShowProfileMenu,
    searchQuery,
    setSearchQuery,
    showPlanLimit,
    setShowPlanLimit,
    planLimitReason,
    setPlanLimitReason,
    showScheduler,
    setShowScheduler,
    queryInputRef,
    profileRef,
  } = useDashboardUI()

  // Track whether localStorage has been loaded
  const [hydrated, setHydrated] = useState(false)
  // Track whether connections have been fetched from server
  const [connectionsLoaded, setConnectionsLoaded] = useState(false)

  // Get active connection
  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // Dashboard widgets state
  const {
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
  } = useDashboardWidgets(
    activeConnectionId,
    activeConnection,
    setConnections,
    setActiveConnectionId,
    setShowPlanLimit,
    setPlanLimitReason,
    setShowScheduler
  )

  // Extract History State & Logic
  const {
    queryHistory,
    setQueryHistory,
    queryHistoryTotal,
    setQueryHistoryTotal,
    savedQueries,
    setSavedQueries,
    cachedSavedCount,
    handleSaveQuery,
    handleDeleteSavedQuery,
    handleToggleFavorite,
    handleShareQuery,
    handleClearHistory,
    handleDeleteHistoryEntry,
  } = useDashboardHistory(activeConnectionId, activeConnection)

  // Filter connections by search
  const filteredConnections = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.database.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Theme
  const { setTheme, theme } = useTheme()

  // Load connections from server + query data from DB on mount
  useEffect(() => {
    if (!userId) return

    let cancelled = false

    // Load active connection ID from localStorage (UI preference only)
    let savedActive: string | null = null
    let cachedConnections: SavedConnection[] = []
    try {
      savedActive = localStorage.getItem(getStorageKey('rf_activeConnectionId'))
      if (savedActive) setActiveConnectionId(savedActive)

      const cached = localStorage.getItem(getStorageKey('rf_connections'))
      if (cached) {
        cachedConnections = JSON.parse(cached)
        setConnections(cachedConnections)
        setConnectionsLoaded(true)
      }
    } catch {}

    // Show the UI immediately — don't wait for the server call
    setHydrated(true)

    // Load connections from server and auto-fetch schema for active connection
    // Also load widgets after connections are known so we can resolve connectionId fallbacks
    getUserConnections()
      .then(async (serverConns) => {
        if (cancelled) return
        const cachedById = new Map(cachedConnections.map((c) => [c.id, c]))
        const mapped: SavedConnection[] = serverConns.map((c) => ({
          id: c.id,
          name: c.name,
          host: c.host,
          port: c.port,
          database: c.database,
          user: c.user,
          dbType: c.dbType,
          isActive: c.isActive,
          status: 'active' as const,
          teamId: c.teamId,
          teamName: c.teamName,
          // Preserve cached schema so table counts show immediately on reload
          schema: cachedById.get(c.id)?.schema,
        }))
        const demoConn = cachedConnections.find((c) => c.isDemo)
        const merged = demoConn ? [...mapped, demoConn] : mapped
        setConnections(merged)
        setConnectionsLoaded(true)
        try {
          localStorage.setItem(getStorageKey('rf_connections'), JSON.stringify(merged))
        } catch {}

        // Best connection to use as fallback: savedActive → first connection
        const fallbackConnId = savedActive || mapped[0]?.id || null

        // Load and execute dashboard widgets now that we know available connections
        fetch('/api/dashboard/widgets')
          .then((r) => r.json())
          .then(async (res) => {
            if (cancelled || !res.success) return
            const widgets = res.data.map((w: any) => ({
              id: w.id,
              name: w.title,
              question: w.question,
              sql: w.sql,
              connectionId: w.connectionId,
              connectionName: w.connectionName,
              chartType: 'bar' as const,
              data: [] as import('@/actions/db').QueryResultRow[],
              fields: [] as string[],
              createdAt: new Date(w.createdAt),
              lastRefreshed: new Date(w.createdAt),
              position: w.position,
            }))
            setDashboardWidgets(widgets)

            // Execute each widget's SQL — use saved connectionId or fall back to best available
            const execResults = await Promise.allSettled(
              res.data
                .filter((w: any) => w.sql && (w.connectionId || fallbackConnId))
                .map((w: any) =>
                  executeSQLByConnection(w.connectionId || fallbackConnId, w.sql).then(
                    (result) => ({
                      id: w.id,
                      result,
                    })
                  )
                )
            )

            if (cancelled) return

            setDashboardWidgets((prev) =>
              prev.map((widget) => {
                const found = execResults.find(
                  (r) => r.status === 'fulfilled' && (r as any).value.id === widget.id
                )
                if (found && found.status === 'fulfilled') {
                  const { result } = (found as any).value
                  if (result.success && result.data) {
                    return {
                      ...widget,
                      data: result.data.rows,
                      fields: result.data.fields,
                      lastRefreshed: new Date(),
                    }
                  }
                }
                return widget
              })
            )
          })
          .catch(() => {})

        // Prefetch schemas for ALL connections in parallel so table counts show immediately
        const nonDemo = mapped.filter((c) => !c.isDemo)
        if (nonDemo.length > 0) {
          // Fire all fetches in parallel — active connection first for perceived speed
          const sorted = savedActive
            ? [
                ...nonDemo.filter((c) => c.id === savedActive),
                ...nonDemo.filter((c) => c.id !== savedActive),
              ]
            : nonDemo

          await Promise.allSettled(
            sorted.map(async (conn) => {
              if (cancelled) return
              const cached = schemaCache.get(conn.id)
              if (cached) {
                setConnections((prev) =>
                  prev.map((c) =>
                    c.id === conn.id ? { ...c, schema: cached, status: 'active' as const } : c
                  )
                )
                return
              }
              const result = await fetchSchemaByConnection(conn.id)
              if (cancelled) return
              if (result.success && result.data) {
                schemaCache.set(conn.id, result.data)
                setConnections((prev) =>
                  prev.map((c) =>
                    c.id === conn.id
                      ? {
                          ...c,
                          schema: result.data,
                          status: 'active' as const,
                          schemaError: undefined,
                        }
                      : c
                  )
                )
              } else {
                const errMsg = result.error || 'Failed to load schema'
                console.error(`[schema-fetch] ${conn.name} (${conn.dbType}):`, errMsg)
                setConnections((prev) =>
                  prev.map((c) =>
                    c.id === conn.id ? { ...c, status: 'error' as const, schemaError: errMsg } : c
                  )
                )
              }
            })
          )
        }
      })
      .catch(() => {
        // Silently fail - user will see empty connections
      })

    // Migrate localStorage data to DB if present, then load from DB
    async function loadQueryData() {
      try {
        // Check for localStorage data to migrate
        const localHistory = localStorage.getItem(getStorageKey('rf_queryHistory'))
        const localSaved = localStorage.getItem(getStorageKey('rf_savedQueries'))

        if (localHistory || localSaved) {
          const historyItems = localHistory ? JSON.parse(localHistory) : []
          const savedItems = localSaved ? JSON.parse(localSaved) : []

          const migrationResult = await migrateLocalData({
            history: historyItems.map((h: any) => ({
              question: h.question,
              sql: h.sql,
              timestamp: h.timestamp || new Date().toISOString(),
              rowCount: h.rowCount,
            })),
            savedQueries: savedItems.map((q: any) => ({
              name: q.name,
              question: q.question,
              sql: q.sql,
              connectionId: q.connectionId,
            })),
          })

          if (migrationResult.success) {
            // Clear localStorage keys after successful migration
            localStorage.removeItem(getStorageKey('rf_queryHistory'))
            localStorage.removeItem(getStorageKey('rf_savedQueries'))
          }
        }
      } catch {}

      if (cancelled) return

      // Load from DB
      const [historyResult, savedResult] = await Promise.all([
        getQueryHistory({ pageSize: 50 }),
        getSavedQueries({ pageSize: 100 }),
      ])

      if (cancelled) return

      if (historyResult.success && historyResult.data) {
        setQueryHistory(historyResult.data.items)
        setQueryHistoryTotal(historyResult.data.total)
      }
      if (savedResult.success && savedResult.data) {
        setSavedQueries(savedResult.data.items)
      }
    }

    loadQueryData()

    // Load scheduled queries from DB
    fetch('/api/scheduled-queries')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return
        setScheduledQueries(
          res.data.map((s: any) => ({
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
            isActive: s.enabled,
            createdAt: new Date(s.createdAt),
            nextRun: s.nextRunAt ? new Date(s.nextRunAt) : undefined,
            lastRun: s.lastRunAt ? new Date(s.lastRunAt) : undefined,
          }))
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [userId, getStorageKey])

  // Save active connection ID to localStorage
  useEffect(() => {
    if (!hydrated || !userId) return
    if (activeConnectionId) {
      localStorage.setItem(getStorageKey('rf_activeConnectionId'), activeConnectionId)
    } else {
      localStorage.removeItem(getStorageKey('rf_activeConnectionId'))
    }
  }, [activeConnectionId, hydrated, userId, getStorageKey])

  // Persist connections (with fetched schemas) to localStorage so table counts survive reload
  useEffect(() => {
    if (!hydrated || !userId || !connectionsLoaded) return
    try {
      localStorage.setItem(getStorageKey('rf_connections'), JSON.stringify(connections))
    } catch {}
  }, [connections, hydrated, userId, connectionsLoaded, getStorageKey])

  // Handle selecting a saved query
  const handleSelectSavedQuery = useCallback((query: SavedQueryItem) => {
    setNlQuery(query.question)
    setGeneratedSQL(query.sql)
  }, [])

  // Handle adding a new connection
  const handleAddConnection = useCallback(
    async (credentials: DBCredentials, schema: DatabaseSchema) => {
      // Save connection to server (password encrypted server-side)
      const result = await saveConnection({
        name: `${credentials.database}@${credentials.host}`,
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password,
        dbType: credentials.dbType || 'postgresql',
        teamId: credentials.teamId || undefined,
      })

      if (!result.success || !result.connection) {
        const isLimitError =
          result.error?.toLowerCase().includes('limit') ||
          result.error?.toLowerCase().includes('upgrade')
        if (isLimitError) {
          setPlanLimitReason('connection')
          setShowPlanLimit(true)
        } else {
          setError(result.error || 'Failed to save connection')
          toast.error('Connection failed', {
            description: result.error || 'Failed to save connection',
          })
        }
        return
      }

      const newConnection: SavedConnection = {
        id: result.connection.id,
        name: result.connection.name,
        host: result.connection.host,
        port: result.connection.port,
        database: result.connection.database,
        user: result.connection.user,
        dbType: result.connection.dbType,
        isActive: true,
        schema,
        status: 'active',
        teamId: result.connection.teamId,
        teamName: result.connection.teamName,
      }
      setConnections((prev) => [...prev, newConnection])
      setActiveConnectionId(newConnection.id)
      setShowAddConnection(false)
      toast.success('Connection added', { description: result.connection.name })

      // Onboarding: mark "connected DB" step
      updateChecklistItem('connectedDb', true).catch(() => {})
      window.dispatchEvent(
        new CustomEvent('onboarding:complete', { detail: { item: 'connectedDb' } })
      )
    },
    []
  )

  // Handle adding demo connection
  const handleAddDemoConnection = useCallback(() => {
    const demoConnection: SavedConnection = {
      id: 'demo',
      name: 'Demo Database',
      host: 'demo',
      port: 5432,
      database: 'demo_store',
      user: 'demo',
      dbType: 'postgresql',
      schema: DEMO_SCHEMA,
      status: 'active',
      isDemo: true,
      isActive: true,
    }
    setConnections((prev) => {
      if (prev.find((c) => c.id === 'demo')) return prev
      return [...prev, demoConnection]
    })
    setActiveConnectionId('demo')
  }, [])

  // Cache for schema discovery suggestions (per connection ID)
  const discoveryCache = useRef(new Map<string, { summary: string; suggestions: string[] }>())

  // Trigger AI schema discovery for a connection's schema
  const runDiscovery = useCallback(async (connId: string, schema: DatabaseSchema) => {
    // Check discovery cache
    const cached = discoveryCache.current.get(connId)
    if (cached) {
      setSchemaSuggestions(cached)
      return
    }
    setIsDiscovering(true)
    setSchemaSuggestions(null)
    const result = await discoverSchema(schema)
    setIsDiscovering(false)
    if (result.success && result.data) {
      discoveryCache.current.set(connId, result.data)
      setSchemaSuggestions(result.data)
    }
  }, [])

  // Handle selecting a connection
  const handleSelectConnection = useCallback(
    async (connectionId: string) => {
      setActiveConnectionId(connectionId)
      setGeneratedSQL('')
      setQueryResults(null)
      setError(null)
      setSchemaSuggestions(discoveryCache.current.get(connectionId) || null)
      setConversationLength(conversationRef.current.get(connectionId)?.length ?? 0)

      const connection = connections.find((c) => c.id === connectionId)
      if (connection && !connection.schema) {
        // Demo connections don't need server fetch
        if (connection.isDemo) return

        // Check cache first
        const cached = schemaCache.get(connectionId)
        if (cached) {
          setConnections((prev) =>
            prev.map((c) =>
              c.id === connectionId ? { ...c, schema: cached, status: 'active' as const } : c
            )
          )
          runDiscovery(connectionId, cached)
        } else {
          // Fetch schema server-side (credentials decrypted on server)
          const result = await fetchSchemaByConnection(connectionId)
          if (result.success && result.data) {
            schemaCache.set(connectionId, result.data)
            setConnections((prev) =>
              prev.map((c) =>
                c.id === connectionId
                  ? {
                      ...c,
                      schema: result.data,
                      status: 'active' as const,
                      schemaError: undefined,
                    }
                  : c
              )
            )
            runDiscovery(connectionId, result.data)
          } else {
            const errMsg = result.error || 'Failed to load schema'
            console.error(`[schema-fetch] ${connection.name} (${connection.dbType}):`, errMsg)
            setConnections((prev) =>
              prev.map((c) =>
                c.id === connectionId ? { ...c, status: 'error' as const, schemaError: errMsg } : c
              )
            )
          }
        }
      } else if (connection?.schema) {
        // Schema already loaded — run discovery if not cached
        runDiscovery(connectionId, connection.schema)
      }
    },
    [connections, runDiscovery]
  )

  // Handle deleting a connection
  const handleDeleteConnection = useCallback(async (connectionId: string) => {
    // Demo connection is client-only
    if (connectionId !== 'demo') {
      const result = await deleteConnectionAction(connectionId)
      if (!result.success) {
        setError(result.error || 'Failed to delete connection')
        toast.error('Failed to delete connection')
        return
      }
    }
    setConnections((prev) => prev.filter((c) => c.id !== connectionId))
    setActiveConnectionId((prev) => (prev === connectionId ? null : prev))
    toast.success('Connection removed')
  }, [])

  // Refresh schema — clears Redis + local cache and refetches from live DB
  const [isRefreshingSchema, setIsRefreshingSchema] = useState(false)
  const handleRefreshSchema = useCallback(async () => {
    if (!activeConnection || activeConnection.isDemo) return
    setIsRefreshingSchema(true)
    try {
      const result = await refreshSchemaByConnection(activeConnection.id)
      if (result.success && result.data) {
        setConnections((prev) =>
          prev.map((c) => (c.id === activeConnection.id ? { ...c, schema: result.data } : c))
        )
        toast.success('Schema refreshed')
      } else {
        toast.error(result.error || 'Failed to refresh schema')
      }
    } catch {
      toast.error('Failed to refresh schema')
    } finally {
      setIsRefreshingSchema(false)
    }
  }, [activeConnection])

  // Handle SQL delivered by the streaming panel (CoT mode)
  // Executes directly without touching generatedSQL — avoids the duplicate
  // "Generated SQL" card that the standard panel would render.
  const handleStreamingSQL = useCallback(
    async (sql: string, question: string) => {
      if (!activeConnection) return
      setNlQuery(question)
      setQueryResults(null)
      setError(null)
      setIsExecuting(true)

      const startTime = Date.now()
      const result = await executeSQLByConnection(activeConnection.id, sql)
      const executionTimeMs = Date.now() - startTime
      setIsExecuting(false)

      if (result.success && result.data) {
        setQueryResults(result.data)
        toast.success(`Query returned ${result.data.rowCount} rows`, {
          description: `${executionTimeMs}ms`,
        })

        // Record into conversation context for follow-ups
        const connId = activeConnection.id
        const history = conversationRef.current.get(connId) ?? []
        history.push({ question, sql, rowCount: result.data.rowCount })
        if (history.length > MAX_CONVERSATION_TURNS) history.shift()
        conversationRef.current.set(connId, history)
        setConversationLength(history.length)

        addHistoryEntry({
          question,
          sql,
          connectionId: activeConnection.id,
          connectionName: activeConnection.name,
          rowCount: result.data.rowCount,
          executionTimeMs,
          status: 'success',
        }).then((res) => {
          if (res.success && res.data) setQueryHistory((prev) => [res.data!, ...prev])
        })
      } else {
        const errMsg = result.error || 'Failed to execute query'
        const isLimitError =
          errMsg.toLowerCase().includes('query limit') || errMsg.toLowerCase().includes('upgrade')
        if (isLimitError) {
          setPlanLimitReason('query')
          setShowPlanLimit(true)
        } else {
          setError(errMsg)
          toast.error('Query failed', { description: errMsg })
        }
      }
    },
    [activeConnection, setShowPlanLimit]
  )

  // Handle generating SQL from natural language
  const handleGenerateSQL = useCallback(async () => {
    if (!activeConnection?.schema || !nlQuery.trim()) return

    setIsGenerating(true)
    setError(null)
    setGeneratedSQL('')
    setQueryResults(null)

    // Get conversation context for this connection
    const connId = activeConnection.id
    const history = conversationRef.current.get(connId) ?? []

    const result = await generateSQL({
      question: nlQuery,
      schema: activeConnection.schema,
      conversationContext: history.length > 0 ? history : undefined,
      dbType: activeConnection.dbType,
    })

    setIsGenerating(false)

    if (result.success && result.sql) {
      setGeneratedSQL(result.sql)
      // Onboarding: mark "asked first question"
      updateChecklistItem('askedFirstQuestion', true).catch(() => {})
      window.dispatchEvent(
        new CustomEvent('onboarding:complete', { detail: { item: 'askedFirstQuestion' } })
      )
    } else {
      setError(result.error || 'Failed to generate SQL')
      toast.error('SQL generation failed', { description: result.error })
    }
  }, [activeConnection, nlQuery])

  // Handle executing the generated SQL
  const handleExecuteSQL = useCallback(
    async (overrideSql?: string) => {
      // If called via synthetic event (e.g. onClick), overrideSql will be an Event object, not a string.
      const sqlToRun = typeof overrideSql === 'string' ? overrideSql : generatedSQL
      if (!activeConnection || !sqlToRun) return

      setIsExecuting(true)
      setError(null)

      // Demo mode - return fake data
      if (activeConnection.isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const sqlLower = sqlToRun.toLowerCase()
        let demoRows = DEMO_DATA.customers
        let fields = ['id', 'name', 'email', 'city', 'created_at']

        if (sqlLower.includes('orders')) {
          demoRows = DEMO_DATA.orders
          fields = ['id', 'customer_id', 'product', 'amount', 'status', 'order_date']
        } else if (sqlLower.includes('products')) {
          demoRows = DEMO_DATA.products
          fields = ['id', 'name', 'price', 'category', 'stock']
        }

        const limitMatch = sqlLower.match(/limit\s+(\d+)/)
        if (limitMatch) {
          const limit = parseInt(limitMatch[1])
          demoRows = demoRows.slice(0, limit)
        }

        const results = {
          rows: demoRows,
          fields,
          rowCount: demoRows.length,
          executionTime: Math.floor(Math.random() * 50) + 10,
        }

        setIsExecuting(false)
        setQueryResults(results)
        toast.success(`Query returned ${results.rowCount} rows`, {
          description: `${results.executionTime}ms`,
        })

        // Record into conversation context for follow-ups
        const demoHistory = conversationRef.current.get('demo') ?? []
        demoHistory.push({ question: nlQuery, sql: sqlToRun, rowCount: results.rowCount })
        if (demoHistory.length > MAX_CONVERSATION_TURNS) demoHistory.shift()
        conversationRef.current.set('demo', demoHistory)
        setConversationLength(demoHistory.length)

        // Record demo history via server action (fire-and-forget)
        addHistoryEntry({
          question: nlQuery,
          sql: sqlToRun,
          connectionId: 'demo',
          connectionName: 'Demo Database',
          rowCount: results.rowCount,
          executionTimeMs: results.executionTime,
          status: 'success',
        }).then((res) => {
          if (res.success && res.data) {
            setQueryHistory((prev) => [res.data!, ...prev])
          }
        })
        return
      }

      // Real connection - execute via server action (credentials decrypted server-side)
      const startTime = Date.now()
      const result = await executeSQLByConnection(activeConnection.id, sqlToRun)
      const executionTimeMs = Date.now() - startTime

      setIsExecuting(false)

      if (result.success && result.data) {
        // In the background, get an AI chart recommendation
        recommendChart({
          question: nlQuery,
          sql: sqlToRun,
          fields: result.data.fields,
          sampleRows: result.data.rows.slice(0, 5),
        })
          .then((rec) => {
            if (rec.success && rec.recommendation) {
              setQueryResults((prev) =>
                prev ? { ...prev, chartRecommendation: rec.recommendation } : null
              )
            }
          })
          .catch(console.error)

        setQueryResults(result.data)
        toast.success(`Query returned ${result.data.rowCount} rows`, {
          description: `${executionTimeMs}ms`,
        })

        // Record into conversation context for follow-ups
        const connId = activeConnection.id
        const history = conversationRef.current.get(connId) ?? []
        history.push({ question: nlQuery, sql: sqlToRun, rowCount: result.data.rowCount })
        if (history.length > MAX_CONVERSATION_TURNS) history.shift()
        conversationRef.current.set(connId, history)
        setConversationLength(history.length)

        // Record success history via server action (fire-and-forget)
        addHistoryEntry({
          question: nlQuery,
          sql: sqlToRun,
          connectionId: activeConnection.id,
          connectionName: activeConnection.name,
          rowCount: result.data.rowCount,
          executionTimeMs,
          status: 'success',
        }).then((res) => {
          if (res.success && res.data) {
            setQueryHistory((prev) => [res.data!, ...prev])
          }
        })
      } else {
        const errMsg = result.error || 'Failed to execute query'
        const isLimitError =
          errMsg.toLowerCase().includes('query limit') || errMsg.toLowerCase().includes('upgrade')
        if (isLimitError) {
          setPlanLimitReason('query')
          setShowPlanLimit(true)
        } else {
          setError(errMsg)
          toast.error('Query failed', { description: errMsg })
        }

        // Record error history via server action (fire-and-forget)
        addHistoryEntry({
          question: nlQuery,
          sql: sqlToRun,
          connectionId: activeConnection.id,
          connectionName: activeConnection.name,
          executionTimeMs,
          status: 'error',
          errorMessage: errMsg,
        }).then((res) => {
          if (res.success && res.data) {
            setQueryHistory((prev) => [res.data!, ...prev])
          }
        })
      }
    },
    [activeConnection, generatedSQL, nlQuery, setShowPlanLimit]
  )

  const handleFixSQL = useCallback(async () => {
    if (!activeConnection?.schema || !error || !nlQuery.trim()) return

    setIsFixing(true)
    try {
      const result = await fixSQL({
        failedSql: generatedSQL,
        errorMessage: error,
        question: nlQuery,
        schema: activeConnection.schema,
      })

      if (result.success && result.sql) {
        setGeneratedSQL(result.sql)
        setError(null)
        setQueryResults(null)
        toast.success(t('dashboard.queryPanel.aiFixedSql'))
      } else {
        toast.error(result.error || t('common.error'))
      }
    } catch (err) {
      toast.error(t('common.error'))
    } finally {
      setIsFixing(false)
    }
  }, [activeConnection, generatedSQL, error, nlQuery, t])

  // Handle export
  const handleExport = useCallback(
    async (format: 'excel' | 'csv') => {
      if (!queryResults) return

      setIsExporting(true)
      setShowExportMenu(false)

      const filename = `report_${new Date().toISOString().split('T')[0]}`

      const result =
        format === 'excel'
          ? await exportToExcel({
              rows: queryResults.rows,
              fields: queryResults.fields,
              filename: `${filename}.xlsx`,
              title: 'Query Results',
            })
          : await exportToCSV({
              rows: queryResults.rows,
              fields: queryResults.fields,
              filename: `${filename}.csv`,
            })

      setIsExporting(false)

      if (result.success && result.data) {
        const binaryString = atob(result.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const mimeType =
          format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv'

        const blob = new Blob([bytes], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename || `report.${format === 'excel' ? 'xlsx' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`Exported as ${format === 'excel' ? 'Excel' : 'CSV'}`)
      } else {
        setError(result.error || 'Failed to export')
        toast.error('Export failed', { description: result.error })
      }
    },
    [queryResults]
  )

  // Handle template selection
  const handleSelectTemplate = useCallback((question: string) => {
    setNlQuery(question)
    queryInputRef.current?.focus()
  }, [])

  // Handle history selection
  const handleSelectHistoryItem = useCallback((item: QueryHistoryItem) => {
    setNlQuery(item.question)
    setGeneratedSQL(item.sql)
    setShowHistory(false)
  }, [])

  // Handle AI insights analysis
  const handleAnalyze = useCallback(async () => {
    if (!queryResults || isAnalyzing) return

    setIsAnalyzing(true)
    setInsights(null)

    const result = await analyzeResults({
      rows: queryResults.rows,
      fields: queryResults.fields,
      originalQuestion: nlQuery,
      schema: activeConnection?.schema,
    })

    setIsAnalyzing(false)

    if (result.success && result.insights) {
      setInsights(result.insights)
    }
  }, [queryResults, nlQuery, activeConnection, isAnalyzing])

  // ── NL Filter handlers ──────────────────────────────────────────────
  const handleAddFilter = useCallback(
    async (filterText: string) => {
      if (!activeConnection?.schema || !generatedSQL) return
      setIsApplyingFilter(true)
      const currentSql = generatedSQL
      const result = await refineQueryWithFilter(currentSql, filterText, activeConnection.schema)
      setIsApplyingFilter(false)
      if (result.success && result.sql) {
        // Store the original SQL before first filter
        if (activeFilters.length === 0) {
          baseSqlRef.current = currentSql
        }
        setGeneratedSQL(result.sql)
        setActiveFilters((prev) => [
          ...prev,
          {
            id: `f_${Date.now()}`,
            label: result.filterLabel || filterText.slice(0, 30),
            nlQuery: filterText,
          },
        ])
        // Auto-execute the filtered query
        setQueryResults(null)
        setError(null)
      } else {
        toast.error('Filter failed', { description: result.error })
      }
    },
    [activeConnection, generatedSQL, activeFilters]
  )

  const handleRemoveFilter = useCallback(
    async (filterId: string) => {
      const remaining = activeFilters.filter((f) => f.id !== filterId)
      setActiveFilters(remaining)

      if (remaining.length === 0 && baseSqlRef.current) {
        // Revert to the original SQL
        setGeneratedSQL(baseSqlRef.current)
        baseSqlRef.current = ''
      }
      // Note: we don't auto-rebuild with remaining filters for simplicity;
      // user can re-execute or add filters again
    },
    [activeFilters]
  )

  const handleClearFilters = useCallback(() => {
    if (baseSqlRef.current) {
      setGeneratedSQL(baseSqlRef.current)
      baseSqlRef.current = ''
    }
    setActiveFilters([])
  }, [])

  // Handle follow-up question click from insights
  const handleFollowUpClick = useCallback((question: string) => {
    setNlQuery(question)
    setInsights(null) // Clear old insights
    queryInputRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    // Query actions
    onSubmitQuery: handleGenerateSQL,
    onRunSQL: handleExecuteSQL,
    onFormatSQL: () => {
      if (generatedSQL) {
        try {
          const { format } = require('sql-formatter')
          setGeneratedSQL(format(generatedSQL, { language: 'sql' }))
          toast.success('SQL formatted')
        } catch {
          toast.error('Could not format SQL')
        }
      }
    },
    onSaveQuery: () => {
      if (nlQuery && generatedSQL) {
        const name = nlQuery.slice(0, 40)
        handleSaveQuery(name, nlQuery, generatedSQL)
      }
    },
    // Navigation
    onOpenCommandPalette: () => setShowCommandPalette(true),
    onToggleSchema: () => {
      setShowHistory(false)
      setShowSchema((prev) => !prev)
    },
    onToggleHistory: () => {
      setShowSchema(false)
      setShowHistory((prev) => !prev)
    },
    onToggleSettings: () => setShowAddConnection(true),
    // Data
    onExportExcel: () => handleExport('excel'),
    onExportCSV: () => handleExport('csv'),
    // General
    onToggleTheme: () =>
      setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'),
    onClearInput: () => setNlQuery(''),
    onToggleHelp: () => setShowShortcutsHelp((prev) => !prev),
  })

  return {
    // Connection state
    connections,
    activeConnectionId,
    activeConnection,
    filteredConnections,
    showAddConnection,
    setShowAddConnection,
    searchQuery,
    setSearchQuery,

    // Query state
    nlQuery,
    setNlQuery,
    generatedSQL,
    setGeneratedSQL,
    isGenerating,
    isExecuting,
    isExporting,
    isFixing,
    queryResults,
    error,
    setError,

    // Plan limit modal
    showPlanLimit,
    setShowPlanLimit,
    planLimitReason,

    // UI state
    queryHistory,
    queryHistoryTotal,
    showHistory,
    setShowHistory,
    showSchema,
    setShowSchema,
    showExportMenu,
    setShowExportMenu,
    showShortcutsHelp,
    setShowShortcutsHelp,
    showProfileMenu,
    setShowProfileMenu,
    hydrated,
    connectionsLoaded,
    showLeftSidebar,
    setShowLeftSidebar,
    showRightSidebar,
    setShowRightSidebar,
    showCommandPalette,
    setShowCommandPalette,
    showScheduler,
    setShowScheduler,

    // Refs
    queryInputRef,
    profileRef,

    // Handlers
    handleAddConnection,
    handleAddDemoConnection,
    handleSelectConnection,
    handleDeleteConnection,
    handleGenerateSQL,
    handleStreamingSQL,
    handleFixSQL,
    handleExecuteSQL,
    handleExport,
    handleSelectTemplate,
    handleSelectHistoryItem,

    // Saved queries
    savedQueries,
    cachedSavedCount,
    handleSaveQuery,
    handleDeleteSavedQuery,
    handleSelectSavedQuery,
    handleToggleFavorite,
    handleShareQuery,

    // History
    handleClearHistory,
    handleDeleteHistoryEntry,
    handleRefreshSchema,
    isRefreshingSchema,

    // AI Insights
    insights,
    isAnalyzing,
    handleAnalyze,
    handleFollowUpClick,

    // Schema Discovery
    schemaSuggestions,
    isDiscovering,

    // NL Filters
    activeFilters,
    isApplyingFilter,
    handleAddFilter,
    handleRemoveFilter,
    handleClearFilters,

    // Conversation context
    conversationLength,
    conversationContext: activeConnectionId
      ? (conversationRef.current.get(activeConnectionId) ?? [])
      : [],
    handleClearConversation: useCallback(() => {
      if (activeConnectionId) {
        conversationRef.current.delete(activeConnectionId)
        setConversationLength(0)
      }
    }, [activeConnectionId]),

    // Dashboard widgets
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

// Helper function to calculate next run time
function calculateNextRun(schedule: ScheduledQuery['schedule'], from: Date): Date {
  const next = new Date(from)
  const [hours, minutes] = (schedule.time || '09:00').split(':').map(Number)

  switch (schedule.type) {
    case 'hourly':
      next.setHours(next.getHours() + 1)
      next.setMinutes(0, 0, 0)
      break
    case 'daily':
      next.setDate(next.getDate() + 1)
      next.setHours(hours, minutes, 0, 0)
      break
    case 'weekly':
      const daysUntilTarget = ((schedule.dayOfWeek || 1) - next.getDay() + 7) % 7 || 7
      next.setDate(next.getDate() + daysUntilTarget)
      next.setHours(hours, minutes, 0, 0)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      next.setDate(schedule.dayOfMonth || 1)
      next.setHours(hours, minutes, 0, 0)
      break
  }
  return next
}
