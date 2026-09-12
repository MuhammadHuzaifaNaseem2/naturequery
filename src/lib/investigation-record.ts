import type { ReconciliationRow } from '@/lib/reconciliation'

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
