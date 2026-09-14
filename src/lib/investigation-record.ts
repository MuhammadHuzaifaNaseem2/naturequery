import { reconcileReports, type ReconciliationRow } from '@/lib/reconciliation'

export type InvestigationCaseStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED'

export interface InvestigationReportSnapshot {
  name: string
  rows: ReconciliationRow[]
  fields: string[]
  question?: string
  sql?: string
  connectionId?: string
  connectionName?: string
}

export interface InvestigationSnapshot {
  version: 1
  name: string
  status: InvestigationCaseStatus
  metric: string
  period: string
  currency: string
  source: InvestigationReportSnapshot
  comparison: InvestigationReportSnapshot
  sourceKey: string
  sourceAmount: string
  comparisonKey: string
  comparisonAmount: string
  causes: Record<string, string>
  sourceTotal: number
  comparisonTotal: number
  difference: number
  unresolvedDifference: number
  issueCount: number
  resolvedCount: number
}

export interface SavedInvestigation {
  id: string
  savedAt: string
  snapshot: InvestigationSnapshot
}

export interface SavedInvestigationSummary {
  needsReview?: boolean
  id: string
  name: string
  status: InvestigationCaseStatus
  metric: string
  period: string
  currency: string
  difference: number
  unresolvedDifference: number
  issueCount: number
  resolvedCount: number
  savedAt: string
}

export const INVESTIGATION_STATUSES: {
  value: InvestigationCaseStatus
  label: string
}[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'RESOLVED', label: 'Resolved' },
]

export function isInvestigationSnapshot(value: unknown): value is InvestigationSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<InvestigationSnapshot>
  const validStatus =
    snapshot.status === 'OPEN' || snapshot.status === 'IN_REVIEW' || snapshot.status === 'RESOLVED'
  const validReport = (report: unknown) => {
    if (!report || typeof report !== 'object') return false
    const candidate = report as Partial<InvestigationReportSnapshot>
    return (
      typeof candidate.name === 'string' &&
      Array.isArray(candidate.rows) &&
      candidate.rows.every(
        (row) =>
          row &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          Object.values(row).every(
            (value) =>
              value == null ||
              typeof value === 'string' ||
              typeof value === 'boolean' ||
              (typeof value === 'number' && Number.isFinite(value))
          )
      ) &&
      Array.isArray(candidate.fields) &&
      candidate.fields.every((field) => typeof field === 'string')
    )
  }

  return (
    snapshot.version === 1 &&
    typeof snapshot.name === 'string' &&
    validStatus &&
    typeof snapshot.metric === 'string' &&
    typeof snapshot.period === 'string' &&
    typeof snapshot.currency === 'string' &&
    validReport(snapshot.source) &&
    validReport(snapshot.comparison) &&
    typeof snapshot.sourceKey === 'string' &&
    typeof snapshot.sourceAmount === 'string' &&
    typeof snapshot.comparisonKey === 'string' &&
    typeof snapshot.comparisonAmount === 'string' &&
    !!snapshot.causes &&
    typeof snapshot.causes === 'object' &&
    typeof snapshot.difference === 'number' &&
    typeof snapshot.unresolvedDifference === 'number'
  )
}

export function investigationSummary(
  id: string,
  savedAt: string,
  snapshot: InvestigationSnapshot
): SavedInvestigationSummary {
  return {
    id,
    name: snapshot.name,
    status: snapshot.status,
    metric: snapshot.metric,
    period: snapshot.period,
    currency: snapshot.currency,
    difference: snapshot.difference,
    unresolvedDifference: snapshot.unresolvedDifference,
    issueCount: snapshot.issueCount,
    resolvedCount: snapshot.resolvedCount,
    savedAt,
  }
}

export const CONFIRMED_CAUSES = [
  'Duplicate row',
  'Refund treatment',
  'Fee / net vs gross',
  'Filter / scope difference',
  'Cutoff / timing',
  'Missing mapping',
  'Other confirmed cause',
] as const

export function recomputeInvestigation(snapshot: InvestigationSnapshot): InvestigationSnapshot {
  const result = reconcileReports({
    sourceRows: snapshot.source.rows,
    comparisonRows: snapshot.comparison.rows,
    sourceKey: snapshot.sourceKey,
    sourceAmount: snapshot.sourceAmount,
    comparisonKey: snapshot.comparisonKey,
    comparisonAmount: snapshot.comparisonAmount,
    currency: snapshot.currency,
  })
  if (!result.isComplete) throw new Error(result.validationErrors.join(' '))
  const issues = result.items.filter((item) => item.status !== 'matched')
  const causes: Record<string, string> = Object.create(null)
  for (const item of issues) {
    const cause = Object.hasOwn(snapshot.causes, item.key) ? snapshot.causes[item.key] : ''
    if (CONFIRMED_CAUSES.some((value) => value === cause)) causes[item.key] = cause
  }
  const unresolved = issues.filter((item) => !Object.hasOwn(causes, item.key))
  const unresolvedDifference =
    unresolved.reduce(
      (sum, item) => sum + Math.round(Math.abs(item.difference) / result.minorUnit),
      0
    ) /
    (1 / result.minorUnit)
  return {
    ...snapshot,
    causes,
    sourceTotal: result.sourceTotal,
    comparisonTotal: result.comparisonTotal,
    difference: result.difference,
    unresolvedDifference,
    issueCount: issues.length,
    resolvedCount: issues.length - unresolved.length,
    status:
      unresolved.length === 0
        ? 'RESOLVED'
        : snapshot.status === 'IN_REVIEW' || Object.keys(causes).length > 0
          ? 'IN_REVIEW'
          : 'OPEN',
  }
}
