'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  RefreshCcw,
  Save,
  Scale,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { getInvestigation, saveInvestigation } from '@/actions/investigations'
import {
  getReconciliationProfiles,
  saveReconciliationProfile,
} from '@/actions/reconciliation-profiles'
import {
  reconcileReports,
  type ReconciliationRow,
  type ReconciliationStatus,
} from '@/lib/reconciliation'
import {
  INVESTIGATION_TRANSFER_KEY,
  isInvestigationTransfer,
  suggestInvestigationColumns,
} from '@/lib/investigation-transfer'
import {
  INVESTIGATION_STATUSES,
  type InvestigationCaseStatus,
  type InvestigationSnapshot,
} from '@/lib/investigation-record'
import { suggestReconciliationCauses } from '@/lib/cause-engine'
import { createReconciliationMonitor } from '@/actions/reconciliation-monitors'
import type { MonitorFrequency } from '@/lib/reconciliation-monitor'
import {
  resolveProfileColumns,
  type ReconciliationProfileDefinition,
  type SavedReconciliationProfile,
} from '@/lib/reconciliation-profile'
import { parseXlsxBuffer } from '@/lib/spreadsheet-import'
import {
  WooCommerceImportPanel,
  type WooCommerceImportResult,
} from '@/components/WooCommerceImportPanel'

interface ReportData {
  name: string
  rows: ReconciliationRow[]
  fields: string[]
  question?: string
  sql?: string
  connectionId?: string
  connectionName?: string
}

const SAMPLE_SOURCE: ReportData = {
  name: 'Application revenue report',
  fields: ['order_id', 'amount'],
  rows: [
    { order_id: 'ORD-1001', amount: 1200 },
    { order_id: 'ORD-1002', amount: 800 },
    { order_id: 'ORD-1002', amount: 800 },
    { order_id: 'ORD-1003', amount: 500 },
    { order_id: 'ORD-1004', amount: 900 },
    { order_id: 'ORD-1005', amount: 400 },
  ],
}

const SAMPLE_COMPARISON: ReportData = {
  name: 'Payment provider export',
  fields: ['reference', 'net_amount'],
  rows: [
    { reference: 'ORD-1001', net_amount: 1200 },
    { reference: 'ORD-1002', net_amount: 800 },
    { reference: 'ORD-1003', net_amount: 450 },
    { reference: 'ORD-1004', net_amount: 900 },
    { reference: 'ORD-1006', net_amount: 300 },
  ],
}

const CAUSES = [
  'Unresolved',
  'Duplicate row',
  'Refund treatment',
  'Fee / net vs gross',
  'Filter / scope difference',
  'Cutoff / timing',
  'Missing mapping',
  'Other confirmed cause',
] as const

const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  matched: 'Matched',
  amount_mismatch: 'Amount differs',
  only_in_source: 'Only in report A',
  only_in_comparison: 'Only in report B',
  duplicate_key: 'Duplicate identifier',
}

const STATUS_STYLES: Record<ReconciliationStatus, string> = {
  matched: 'bg-success/10 text-success border-success/20',
  amount_mismatch: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
  only_in_source: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20',
  only_in_comparison: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20',
  duplicate_key: 'bg-destructive/10 text-destructive border-destructive/20',
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function ReconciliationWorkspace({ investigationId }: { investigationId?: string }) {
  const [source, setSource] = useState<ReportData>(SAMPLE_SOURCE)
  const [comparison, setComparison] = useState<ReportData>(SAMPLE_COMPARISON)
  const [sourceKey, setSourceKey] = useState('order_id')
  const [sourceAmount, setSourceAmount] = useState('amount')
  const [comparisonKey, setComparisonKey] = useState('reference')
  const [comparisonAmount, setComparisonAmount] = useState('net_amount')
  const [metric, setMetric] = useState('Collected revenue')
  const [period, setPeriod] = useState('September 2026')
  const [currency, setCurrency] = useState('USD')
  const [causes, setCauses] = useState<Record<string, string>>({})
  const [investigationName, setInvestigationName] = useState('Revenue report investigation')
  const [caseStatus, setCaseStatus] = useState<InvestigationCaseStatus>('OPEN')
  const [savedId, setSavedId] = useState<string | undefined>(investigationId)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [showMonitorSetup, setShowMonitorSetup] = useState(false)
  const [monitorFrequency, setMonitorFrequency] = useState<MonitorFrequency>('DAILY')
  const [monitorThreshold, setMonitorThreshold] = useState('0')
  const [isCreatingMonitor, setIsCreatingMonitor] = useState(false)
  const [profiles, setProfiles] = useState<SavedReconciliationProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>()
  const [profileName, setProfileName] = useState('Monthly revenue check')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const sourceInput = useRef<HTMLInputElement>(null)
  const comparisonInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getReconciliationProfiles().then((response) => {
      if (response.success && response.data) setProfiles(response.data)
    })
  }, [])

  useEffect(() => {
    if (investigationId) {
      getInvestigation(investigationId).then((response) => {
        if (!response.success || !response.data) {
          toast.error('Could not open this investigation', { description: response.error })
          return
        }

        const { snapshot, savedAt } = response.data
        setSource(snapshot.source)
        setComparison(snapshot.comparison)
        setSourceKey(snapshot.sourceKey)
        setSourceAmount(snapshot.sourceAmount)
        setComparisonKey(snapshot.comparisonKey)
        setComparisonAmount(snapshot.comparisonAmount)
        setMetric(snapshot.metric)
        setPeriod(snapshot.period)
        setCurrency(snapshot.currency)
        setCauses(snapshot.causes)
        setInvestigationName(snapshot.name)
        setCaseStatus(snapshot.status)
        setSavedId(response.data.id)
        setLastSavedAt(savedAt)
      })
      return
    }

    try {
      const saved = sessionStorage.getItem(INVESTIGATION_TRANSFER_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!isInvestigationTransfer(parsed)) return

      const sourceColumns = suggestInvestigationColumns(parsed.source.fields)
      const comparisonColumns = suggestInvestigationColumns(parsed.comparison.fields)
      setSource({
        name: parsed.source.name,
        rows: parsed.source.rows,
        fields: parsed.source.fields,
        question: parsed.source.question,
        sql: parsed.source.sql,
        connectionId: parsed.source.connectionId,
        connectionName: parsed.source.connectionName,
      })
      setComparison({
        name: parsed.comparison.name,
        rows: parsed.comparison.rows,
        fields: parsed.comparison.fields,
        question: parsed.comparison.question,
        sql: parsed.comparison.sql,
        connectionId: parsed.comparison.connectionId,
        connectionName: parsed.comparison.connectionName,
      })
      setSourceKey(sourceColumns.key)
      setSourceAmount(sourceColumns.amount)
      setComparisonKey(comparisonColumns.key)
      setComparisonAmount(comparisonColumns.amount)
      setMetric('Query result comparison')
      setPeriod('Live query results')
      setInvestigationName(
        `${parsed.source.name || 'Report A'} vs ${parsed.comparison.name || 'Report B'}`.slice(
          0,
          120
        )
      )
      setCaseStatus('OPEN')
      setCauses({})
      toast.success('Query results loaded', {
        description: 'Confirm the suggested ID and amount columns before reviewing differences.',
      })
    } catch {
      sessionStorage.removeItem(INVESTIGATION_TRANSFER_KEY)
      toast.error('The saved query comparison could not be opened')
    }
  }, [investigationId])

  const result = useMemo(
    () =>
      reconcileReports({
        sourceRows: source.rows,
        comparisonRows: comparison.rows,
        sourceKey,
        sourceAmount,
        comparisonKey,
        comparisonAmount,
      }),
    [source, comparison, sourceKey, sourceAmount, comparisonKey, comparisonAmount]
  )

  const issues = result.items.filter((item) => item.status !== 'matched')
  const suggestions = useMemo(
    () =>
      suggestReconciliationCauses({
        items: result.items,
        source: {
          ...source,
          keyColumn: sourceKey,
          amountColumn: sourceAmount,
        },
        comparison: {
          ...comparison,
          keyColumn: comparisonKey,
          amountColumn: comparisonAmount,
        },
      }),
    [result.items, source, comparison, sourceKey, sourceAmount, comparisonKey, comparisonAmount]
  )
  const resolvedDifference = issues.reduce(
    (sum, item) =>
      sum + (causes[item.key] && causes[item.key] !== 'Unresolved' ? item.difference : 0),
    0
  )
  const unresolvedDifference = result.difference - resolvedDifference
  const resolvedCount = issues.filter(
    (item) => causes[item.key] && causes[item.key] !== 'Unresolved'
  ).length

  useEffect(() => {
    if (issues.length > 0 && resolvedCount === issues.length && caseStatus !== 'RESOLVED') {
      setCaseStatus('RESOLVED')
    } else if (resolvedCount < issues.length && caseStatus === 'RESOLVED') {
      setCaseStatus(resolvedCount > 0 ? 'IN_REVIEW' : 'OPEN')
    }
  }, [caseStatus, issues.length, resolvedCount])

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.trim().toUpperCase() || 'USD',
      }).format(value)
    } catch {
      return `${currency.trim().toUpperCase() || 'USD'} ${value.toFixed(2)}`
    }
  }

  const activeProfile = profiles.find((profile) => profile.id === selectedProfileId)

  const applyLoadedReport = (
    file: File,
    side: 'source' | 'comparison',
    rows: ReconciliationRow[],
    fields: string[],
    sheetName?: string
  ) => {
    if (fields.length < 2 || rows.length === 0) {
      toast.error('Could not read this report', {
        description: 'Include a header row, at least two columns, and one data row.',
      })
      return
    }

    const definition = activeProfile?.definition
    const preferredKey =
      side === 'source'
        ? definition?.sourceKey || sourceKey
        : definition?.comparisonKey || comparisonKey
    const preferredAmount =
      side === 'source'
        ? definition?.sourceAmount || sourceAmount
        : definition?.comparisonAmount || comparisonAmount
    const columns = resolveProfileColumns(fields, preferredKey, preferredAmount)
    const name = sheetName ? `${file.name} · ${sheetName}` : file.name
    const report = { name, rows, fields }

    if (side === 'source') {
      setSource(report)
      setSourceKey(columns.key)
      setSourceAmount(columns.amount)
    } else {
      setComparison(report)
      setComparisonKey(columns.key)
      setComparisonAmount(columns.amount)
    }
    setCauses({})
    toast.success(`${file.name} loaded`, {
      description: `${rows.length} rows found${definition ? ' · saved column mapping applied' : ''}`,
    })
  }

  const loadFile = async (file: File, side: 'source' | 'comparison') => {
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const parsed = await parseXlsxBuffer(await file.arrayBuffer())
        applyLoadedReport(file, side, parsed.rows, parsed.fields, parsed.sheetName)
      } catch (error) {
        toast.error('Could not read this Excel workbook', {
          description: error instanceof Error ? error.message : 'Use a valid .xlsx file.',
        })
      }
      return
    }

    if (!/\.csv$/i.test(file.name)) {
      toast.error('Unsupported report file', { description: 'Upload a .csv or .xlsx file.' })
      return
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: ({ data, meta, errors }) => {
        const fields = meta.fields?.filter(Boolean) ?? []
        if (errors.length) {
          toast.error('Could not read this CSV', {
            description: errors[0]?.message,
          })
          return
        }
        applyLoadedReport(file, side, data, fields)
      },
      error: (error) => toast.error('Could not read this CSV', { description: error.message }),
    })
  }

  const applyProfile = (profile: SavedReconciliationProfile) => {
    const definition = profile.definition
    setSelectedProfileId(profile.id)
    setProfileName(definition.name)
    setMetric(definition.metric)
    setCurrency(definition.currency)
    const sourceColumns = resolveProfileColumns(
      source.fields,
      definition.sourceKey,
      definition.sourceAmount
    )
    const comparisonColumns = resolveProfileColumns(
      comparison.fields,
      definition.comparisonKey,
      definition.comparisonAmount
    )
    setSourceKey(sourceColumns.key)
    setSourceAmount(sourceColumns.amount)
    setComparisonKey(comparisonColumns.key)
    setComparisonAmount(comparisonColumns.amount)
    setCauses({})
    toast.success(`${definition.name} applied`, {
      description:
        'Upload this period’s files; matching column names will be selected automatically.',
    })
  }

  const saveCurrentProfile = async () => {
    const definition: ReconciliationProfileDefinition = {
      version: 1,
      name: profileName.trim(),
      metric,
      currency,
      sourceLabel: source.name,
      comparisonLabel: comparison.name,
      sourceKey,
      sourceAmount,
      comparisonKey,
      comparisonAmount,
    }
    setIsSavingProfile(true)
    const response = await saveReconciliationProfile({ id: selectedProfileId, definition })
    setIsSavingProfile(false)
    if (!response.success || !response.data) {
      toast.error('Could not save profile', { description: response.error })
      return
    }

    setSelectedProfileId(response.data.id)
    setProfiles((current) => [
      response.data!,
      ...current.filter((profile) => profile.id !== response.data!.id),
    ])
    toast.success(selectedProfileId ? 'Profile updated' : 'Reusable profile saved', {
      description: 'Mappings and rules were saved. Report rows were not stored in the profile.',
    })
  }

  const resetSample = () => {
    sessionStorage.removeItem(INVESTIGATION_TRANSFER_KEY)
    setSource(SAMPLE_SOURCE)
    setComparison(SAMPLE_COMPARISON)
    setSourceKey('order_id')
    setSourceAmount('amount')
    setComparisonKey('reference')
    setComparisonAmount('net_amount')
    setInvestigationName('Sample revenue investigation')
    setCaseStatus('OPEN')
    setSavedId(undefined)
    setLastSavedAt(null)
    setSelectedProfileId(undefined)
    setProfileName('Monthly revenue check')
    setCauses({})
  }

  const loadWooCommerceOrders = (imported: WooCommerceImportResult) => {
    setSource({ name: imported.name, rows: imported.rows, fields: imported.fields })
    setSourceKey('order_id')
    setSourceAmount('net_amount')
    setComparison(
      imported.comparison || {
        name: 'Upload payment settlement',
        rows: [],
        fields: ['reference', 'net_amount'],
      }
    )
    setComparisonKey('reference')
    setComparisonAmount('net_amount')
    setMetric('WooCommerce orders vs payment settlement')
    setPeriod(imported.period)
    if (imported.currency) setCurrency(imported.currency)
    setInvestigationName(`${imported.connectionName} payment reconciliation`.slice(0, 120))
    setCaseStatus('OPEN')
    setSavedId(undefined)
    setLastSavedAt(null)
    setCauses({})
  }

  const saveCurrentInvestigation = async () => {
    if (!investigationName.trim()) {
      toast.error('Give this investigation a name')
      return
    }

    const snapshot: InvestigationSnapshot = {
      version: 1,
      name: investigationName.trim(),
      status: caseStatus,
      metric,
      period,
      currency,
      source,
      comparison,
      sourceKey,
      sourceAmount,
      comparisonKey,
      comparisonAmount,
      causes,
      sourceTotal: result.sourceTotal,
      comparisonTotal: result.comparisonTotal,
      difference: result.difference,
      unresolvedDifference,
      issueCount: issues.length,
      resolvedCount,
    }

    setIsSaving(true)
    const response = await saveInvestigation({ id: savedId, snapshot })
    setIsSaving(false)
    if (!response.success || !response.data) {
      toast.error('Could not save investigation', { description: response.error })
      return
    }

    setSavedId(response.data.id)
    setLastSavedAt(response.data.savedAt)
    toast.success(savedId ? 'Investigation updated' : 'Investigation saved', {
      description: 'The evidence is preserved in the tamper-evident audit history.',
    })
  }

  const canCreateMonitor = Boolean(
    source.sql && source.connectionId && comparison.sql && comparison.connectionId
  )

  const createMonitor = async () => {
    if (!canCreateMonitor) {
      toast.error('Run and compare two queries before creating a monitor')
      return
    }
    setIsCreatingMonitor(true)
    const response = await createReconciliationMonitor({
      name: investigationName.trim() || 'Report reconciliation monitor',
      frequency: monitorFrequency,
      threshold: Number(monitorThreshold) || 0,
      currency,
      source: {
        name: source.name,
        question: source.question,
        sql: source.sql!,
        connectionId: source.connectionId!,
        connectionName: source.connectionName,
        keyColumn: sourceKey,
        amountColumn: sourceAmount,
      },
      comparison: {
        name: comparison.name,
        question: comparison.question,
        sql: comparison.sql!,
        connectionId: comparison.connectionId!,
        connectionName: comparison.connectionName,
        keyColumn: comparisonKey,
        amountColumn: comparisonAmount,
      },
    })
    setIsCreatingMonitor(false)
    if (!response.success) {
      toast.error('Could not create monitor', { description: response.error })
      return
    }
    setShowMonitorSetup(false)
    toast.success('Automatic monitor created', {
      description: 'Open Monitors to run it now or review its schedule.',
    })
  }

  const exportInvestigation = () => {
    const rows = [
      ['record_id', 'report_a', 'report_b', 'difference', 'status', 'confirmed_cause'],
      ...issues.map((item) => [
        item.key,
        item.sourceAmount,
        item.comparisonAmount,
        item.difference,
        STATUS_LABELS[item.status],
        causes[item.key] || 'Unresolved',
      ]),
    ]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `reconciliation-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-accent to-success" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <Scale className="w-3.5 h-3.5" /> Investigation prototype
                </span>
                <span className="text-xs text-muted-foreground">Runs locally in your browser</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Explain why two reports disagree
              </h1>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Match records by a shared identifier, isolate the exact differences, then confirm
                each cause. NatureQuery keeps unexplained variance visible instead of inventing an
                answer.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMonitorSetup((current) => !current)}
                disabled={!canCreateMonitor}
                className="btn-secondary text-sm disabled:opacity-40"
                title={
                  canCreateMonitor
                    ? 'Schedule this comparison'
                    : 'Create a fresh comparison from two query results first'
                }
              >
                <Clock3 className="w-4 h-4" /> Monitor
              </button>
              <button onClick={resetSample} className="btn-secondary text-sm">
                <RefreshCcw className="w-4 h-4" /> Reset sample
              </button>
              <button
                onClick={exportInvestigation}
                disabled={issues.length === 0}
                className="btn-gradient text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export evidence
              </button>
              <button
                onClick={saveCurrentInvestigation}
                disabled={isSaving}
                className="btn-gradient text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />{' '}
                {isSaving ? 'Saving...' : savedId ? 'Save update' : 'Save case'}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-[2fr_1fr] gap-3 mt-6">
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              Investigation name
              <input
                value={investigationName}
                maxLength={120}
                onChange={(event) => setInvestigationName(event.target.value)}
                className="input w-full text-sm font-normal text-foreground"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              Case status
              <select
                value={caseStatus}
                onChange={(event) => setCaseStatus(event.target.value as InvestigationCaseStatus)}
                className="input w-full text-sm font-normal text-foreground"
              >
                {INVESTIGATION_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {lastSavedAt && (
            <p className="mt-2 text-xs text-success">
              Saved {new Date(lastSavedAt).toLocaleString()} · future saves create a new audit
              version.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">Reusable reconciliation profile</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Save column mappings once, then apply them to next month’s CSV or Excel files.
                  Profiles never contain uploaded report rows.
                </p>
              </div>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground lg:w-56">
                Saved profile
                <select
                  value={selectedProfileId || ''}
                  onChange={(event) => {
                    const profile = profiles.find((item) => item.id === event.target.value)
                    if (profile) applyProfile(profile)
                    else {
                      setSelectedProfileId(undefined)
                      setProfileName('Monthly revenue check')
                    }
                  }}
                  className="input block w-full text-sm font-normal text-foreground"
                >
                  <option value="">New profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.definition.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-muted-foreground lg:w-64">
                Profile name
                <input
                  value={profileName}
                  maxLength={120}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="input block w-full text-sm font-normal text-foreground"
                />
              </label>
              <button
                onClick={saveCurrentProfile}
                disabled={isSavingProfile || !profileName.trim()}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSavingProfile
                  ? 'Saving...'
                  : selectedProfileId
                    ? 'Update profile'
                    : 'Save profile'}
              </button>
            </div>
          </div>

          {showMonitorSetup && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Automatic reconciliation monitor</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    NatureQuery will rerun both read-only queries and create an alert when the
                    difference exceeds your threshold.
                  </p>
                </div>
                <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                  Frequency
                  <select
                    value={monitorFrequency}
                    onChange={(event) =>
                      setMonitorFrequency(event.target.value as MonitorFrequency)
                    }
                    className="input block min-w-36 text-sm text-foreground"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                  Alert above ({currency})
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monitorThreshold}
                    onChange={(event) => setMonitorThreshold(event.target.value)}
                    className="input block w-36 text-sm text-foreground"
                  />
                </label>
                <button
                  onClick={createMonitor}
                  disabled={isCreatingMonitor}
                  className="btn-gradient text-sm disabled:opacity-50"
                >
                  <Clock3 className="w-4 h-4" />
                  {isCreatingMonitor ? 'Creating...' : 'Create monitor'}
                </button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              Metric being compared
              <input
                value={metric}
                onChange={(event) => setMetric(event.target.value)}
                className="input w-full text-sm font-normal text-foreground"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              Reporting period
              <input
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="input w-full text-sm font-normal text-foreground"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              Currency
              <input
                value={currency}
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                className="input w-full text-sm font-normal text-foreground uppercase"
              />
            </label>
          </div>
        </div>
      </section>

      <WooCommerceImportPanel onImport={loadWooCommerceOrders} />

      <div className="grid lg:grid-cols-2 gap-4">
        <ReportCard
          label="Report A"
          report={source}
          keyColumn={sourceKey}
          amountColumn={sourceAmount}
          onKeyChange={setSourceKey}
          onAmountChange={setSourceAmount}
          onUpload={() => sourceInput.current?.click()}
        />
        <ReportCard
          label="Report B"
          report={comparison}
          keyColumn={comparisonKey}
          amountColumn={comparisonAmount}
          onKeyChange={setComparisonKey}
          onAmountChange={setComparisonAmount}
          onUpload={() => comparisonInput.current?.click()}
        />
        <input
          ref={sourceInput}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void loadFile(file, 'source')
            event.target.value = ''
          }}
        />
        <input
          ref={comparisonInput}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void loadFile(file, 'comparison')
            event.target.value = ''
          }}
        />
      </div>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard
          label="Report A total"
          value={money(result.sourceTotal)}
          detail={source.name}
        />
        <SummaryCard
          label="Report B total"
          value={money(result.comparisonTotal)}
          detail={comparison.name}
        />
        <SummaryCard
          label="Original difference"
          value={money(result.difference)}
          detail="Report A minus Report B"
          tone={Math.abs(result.difference) > 0.01 ? 'warning' : 'success'}
        />
        <SummaryCard
          label="Still unexplained"
          value={money(unresolvedDifference)}
          detail={`${resolvedCount} of ${issues.length} issues classified`}
          tone={Math.abs(unresolvedDifference) > 0.01 ? 'danger' : 'success'}
        />
      </section>

      {(result.invalidSourceRows > 0 || result.invalidComparisonRows > 0) && (
        <div className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p>
            {result.invalidSourceRows} row(s) from Report A and {result.invalidComparisonRows}{' '}
            row(s) from Report B were skipped because their ID or amount was empty or invalid.
          </p>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">Investigation evidence</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {metric || 'Selected metric'} · {period || 'No period set'} · {issues.length}{' '}
              issue(s), {result.matchedCount} matched ID(s)
            </p>
          </div>
          <div className="text-xs text-muted-foreground rounded-lg bg-secondary px-3 py-2">
            Confirmed causes explain {money(resolvedDifference)}
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
            <h3 className="font-semibold">No differences found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Every valid identifier and amount matches within one cent.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Record ID</th>
                  <th className="text-right px-4 py-3 font-semibold">Report A</th>
                  <th className="text-right px-4 py-3 font-semibold">Report B</th>
                  <th className="text-right px-4 py-3 font-semibold">Difference</th>
                  <th className="text-left px-4 py-3 font-semibold">Evidence</th>
                  <th className="text-left px-4 py-3 font-semibold">Confirmed cause</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((item) => (
                  <tr key={item.key} className="border-t border-border/60 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{item.key}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(item.sourceAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(item.comparisonAmount)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-semibold ${item.difference > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-violet-600 dark:text-violet-300'}`}
                    >
                      {money(item.difference)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.status === 'duplicate_key' && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          A: {item.sourceCount} rows · B: {item.comparisonCount} rows
                        </p>
                      )}
                      {suggestions[item.key] && (
                        <div className="mt-2 max-w-xs rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                            <Sparkles className="w-3.5 h-3.5" />
                            Suggested: {suggestions[item.key].cause}
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase">
                              {suggestions[item.key].confidence}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {suggestions[item.key].evidence}
                          </p>
                          {causes[item.key] !== suggestions[item.key].cause && (
                            <button
                              onClick={() =>
                                setCauses((current) => ({
                                  ...current,
                                  [item.key]: suggestions[item.key].cause,
                                }))
                              }
                              className="mt-2 text-[11px] font-semibold text-primary hover:underline"
                            >
                              Confirm suggestion
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[190px]">
                      <select
                        value={causes[item.key] || 'Unresolved'}
                        onChange={(event) =>
                          setCauses((current) => ({ ...current, [item.key]: event.target.value }))
                        }
                        className="input w-full py-1.5 text-xs"
                        aria-label={`Confirmed cause for ${item.key}`}
                      >
                        {CAUSES.map((cause) => (
                          <option key={cause}>{cause}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Prototype rule: totals and differences are deterministic. A human must confirm every
        business cause. Uploaded CSV and Excel files are processed in this browser session and are
        not sent to an AI service.
      </p>
    </div>
  )
}

function ReportCard({
  label,
  report,
  keyColumn,
  amountColumn,
  onKeyChange,
  onAmountChange,
  onUpload,
}: {
  label: string
  report: ReportData
  keyColumn: string
  amountColumn: string
  onKeyChange: (value: string) => void
  onAmountChange: (value: string) => void
  onUpload: () => void
}) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <h2 className="font-semibold truncate" title={report.name}>
              {report.name}
            </h2>
            <p className="text-xs text-muted-foreground">{report.rows.length} input rows</p>
          </div>
        </div>
        <button onClick={onUpload} className="btn-secondary text-xs whitespace-nowrap">
          <UploadCloud className="w-3.5 h-3.5" /> Upload CSV / Excel
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
          Record ID column
          <select
            value={keyColumn}
            onChange={(event) => onKeyChange(event.target.value)}
            className="input w-full text-sm font-normal text-foreground"
          >
            {report.fields.map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
          Amount column
          <select
            value={amountColumn}
            onChange={(event) => onAmountChange(event.target.value)}
            className="input w-full text-sm font-normal text-foreground"
          >
            {report.fields.map((field) => (
              <option key={field}>{field}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'warning' | 'danger' | 'success'
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-300'
        : tone === 'success'
          ? 'text-success'
          : 'text-foreground'
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-2 tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 truncate" title={detail}>
        {detail}
      </p>
    </div>
  )
}
