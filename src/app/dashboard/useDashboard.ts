import { useState, useCallback, useRef, useEffect } from 'react'
import { DBCredentials, DatabaseSchema, fetchSchema, executeSQL } from '@/actions/db'
import { schemaCache } from '@/lib/schema-cache'
import { generateSQL } from '@/actions/ai'
import { exportToExcel, exportToCSV } from '@/actions/export'
import { HistoryItem } from '@/components/QueryHistory'
import { SavedQuery } from '@/components/SavedQueries'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTheme } from '@/components/ThemeProvider'
import { SavedConnection, QueryResults } from './types'
import { DEMO_SCHEMA, DEMO_DATA } from './demo-data'

export function useDashboard() {
  // Connection state
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Query state
  const [nlQuery, setNlQuery] = useState('')
  const [generatedSQL, setGeneratedSQL] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [queryResults, setQueryResults] = useState<QueryResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Track whether localStorage has been loaded
  const [hydrated, setHydrated] = useState(false)

  // UI state
  const [queryHistory, setQueryHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showSchema, setShowSchema] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])

  // Refs
  const queryInputRef = useRef<HTMLTextAreaElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Theme
  const { setTheme, theme } = useTheme()

  // Get active connection
  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // Filter connections by search
  const filteredConnections = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.credentials.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.credentials.database.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  // Load state from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const savedConns = localStorage.getItem('rf_connections')
      if (savedConns) setConnections(JSON.parse(savedConns))

      const savedActive = localStorage.getItem('rf_activeConnectionId')
      if (savedActive) setActiveConnectionId(savedActive)

      const savedHistory = localStorage.getItem('rf_queryHistory')
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory)
        const restored = parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
        setQueryHistory(restored)
      }

      const savedQueriesData = localStorage.getItem('rf_savedQueries')
      if (savedQueriesData) {
        const parsed = JSON.parse(savedQueriesData)
        setSavedQueries(parsed.map((q: any) => ({ ...q, savedAt: new Date(q.savedAt) })))
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Save state to localStorage when it changes (only after initial load)
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem('rf_connections', JSON.stringify(connections)) } catch {}
  }, [connections, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (activeConnectionId) {
      localStorage.setItem('rf_activeConnectionId', activeConnectionId)
    } else {
      localStorage.removeItem('rf_activeConnectionId')
    }
  }, [activeConnectionId, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem('rf_queryHistory', JSON.stringify(queryHistory)) } catch {}
  }, [queryHistory, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem('rf_savedQueries', JSON.stringify(savedQueries)) } catch {}
  }, [savedQueries, hydrated])

  // Handle saving a query
  const handleSaveQuery = useCallback((name: string, question: string, sql: string) => {
    if (!activeConnectionId) return
    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      name,
      question,
      sql,
      connectionId: activeConnectionId,
      savedAt: new Date(),
    }
    setSavedQueries((prev) => [newQuery, ...prev])
  }, [activeConnectionId])

  // Handle deleting a saved query
  const handleDeleteSavedQuery = useCallback((id: string) => {
    setSavedQueries((prev) => prev.filter((q) => q.id !== id))
  }, [])

  // Handle selecting a saved query
  const handleSelectSavedQuery = useCallback((query: SavedQuery) => {
    setNlQuery(query.question)
    setGeneratedSQL(query.sql)
  }, [])

  // Handle adding a new connection
  const handleAddConnection = useCallback(
    async (credentials: DBCredentials, schema: DatabaseSchema) => {
      const newConnection: SavedConnection = {
        id: Date.now().toString(),
        name: `${credentials.database}@${credentials.host}`,
        credentials,
        schema,
        status: 'active',
      }
      setConnections((prev) => [...prev, newConnection])
      setActiveConnectionId(newConnection.id)
      setShowAddConnection(false)
    },
    []
  )

  // Handle adding demo connection
  const handleAddDemoConnection = useCallback(() => {
    const demoConnection: SavedConnection = {
      id: 'demo',
      name: 'Demo Database',
      credentials: {
        host: 'demo',
        port: 5432,
        database: 'demo_store',
        user: 'demo',
        password: 'demo',
      },
      schema: DEMO_SCHEMA,
      status: 'active',
      isDemo: true,
    }
    setConnections((prev) => {
      if (prev.find((c) => c.id === 'demo')) return prev
      return [...prev, demoConnection]
    })
    setActiveConnectionId('demo')
  }, [])

  // Handle selecting a connection
  const handleSelectConnection = useCallback(
    async (connectionId: string) => {
      setActiveConnectionId(connectionId)
      setGeneratedSQL('')
      setQueryResults(null)
      setError(null)

      const connection = connections.find((c) => c.id === connectionId)
      if (connection && !connection.schema) {
        const { host, port, database } = connection.credentials
        // Check cache first
        const cached = schemaCache.get(host, port, database)
        if (cached) {
          setConnections((prev) =>
            prev.map((c) =>
              c.id === connectionId ? { ...c, schema: cached, status: 'active' } : c
            )
          )
        } else {
          const result = await fetchSchema(connection.credentials)
          if (result.success && result.data) {
            schemaCache.set(host, port, database, result.data)
            setConnections((prev) =>
              prev.map((c) =>
                c.id === connectionId ? { ...c, schema: result.data, status: 'active' } : c
              )
            )
          }
        }
      }
    },
    [connections]
  )

  // Handle deleting a connection
  const handleDeleteConnection = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId))
    setActiveConnectionId((prev) => (prev === connectionId ? null : prev))
  }, [])

  // Handle generating SQL from natural language
  const handleGenerateSQL = useCallback(async () => {
    if (!activeConnection?.schema || !nlQuery.trim()) return

    setIsGenerating(true)
    setError(null)
    setGeneratedSQL('')
    setQueryResults(null)

    const result = await generateSQL({
      question: nlQuery,
      schema: activeConnection.schema,
    })

    setIsGenerating(false)

    if (result.success && result.sql) {
      setGeneratedSQL(result.sql)
    } else {
      setError(result.error || 'Failed to generate SQL')
    }
  }, [activeConnection, nlQuery])

  // Handle executing the generated SQL
  const handleExecuteSQL = useCallback(async () => {
    if (!activeConnection || !generatedSQL) return

    setIsExecuting(true)
    setError(null)

    // Demo mode - return fake data
    if (activeConnection.isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 500))

      const sqlLower = generatedSQL.toLowerCase()
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

      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        question: nlQuery,
        sql: generatedSQL,
        timestamp: new Date(),
        rowCount: results.rowCount,
      }
      setQueryHistory((prev) => [historyItem, ...prev].slice(0, 50))
      return
    }

    const result = await executeSQL(activeConnection.credentials, generatedSQL)

    setIsExecuting(false)

    if (result.success && result.data) {
      setQueryResults(result.data)

      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        question: nlQuery,
        sql: generatedSQL,
        timestamp: new Date(),
        rowCount: result.data.rowCount,
      }
      setQueryHistory((prev) => [historyItem, ...prev].slice(0, 50))
    } else {
      setError(result.error || 'Failed to execute query')
    }
  }, [activeConnection, generatedSQL, nlQuery])

  // Handle export
  const handleExport = useCallback(async (format: 'excel' | 'csv') => {
    if (!queryResults) return

    setIsExporting(true)
    setShowExportMenu(false)

    const filename = `report_${new Date().toISOString().split('T')[0]}`

    const result = format === 'excel'
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

      const mimeType = format === 'excel'
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
    } else {
      setError(result.error || 'Failed to export')
    }
  }, [queryResults])

  // Handle template selection
  const handleSelectTemplate = useCallback((question: string) => {
    setNlQuery(question)
    queryInputRef.current?.focus()
  }, [])

  // Handle history selection
  const handleSelectHistoryItem = useCallback((item: HistoryItem) => {
    setNlQuery(item.question)
    setGeneratedSQL(item.sql)
    setShowHistory(false)
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSubmitQuery: handleGenerateSQL,
    onExportExcel: () => handleExport('excel'),
    onExportCSV: () => handleExport('csv'),
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'),
    onFocusInput: () => queryInputRef.current?.focus(),
    onClearInput: () => setNlQuery(''),
    onToggleSettings: () => setShowAddConnection(true),
  })

  // Listen for ? key to show shortcuts help
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          setShowShortcutsHelp((prev) => !prev)
        }
      }
    }
    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [])

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
    isGenerating,
    isExecuting,
    isExporting,
    queryResults,
    error,

    // UI state
    queryHistory,
    setQueryHistory,
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

    // Refs
    queryInputRef,
    profileRef,

    // Handlers
    handleAddConnection,
    handleAddDemoConnection,
    handleSelectConnection,
    handleDeleteConnection,
    handleGenerateSQL,
    handleExecuteSQL,
    handleExport,
    handleSelectTemplate,
    handleSelectHistoryItem,

    // Saved queries
    savedQueries,
    handleSaveQuery,
    handleDeleteSavedQuery,
    handleSelectSavedQuery,
  }
}
