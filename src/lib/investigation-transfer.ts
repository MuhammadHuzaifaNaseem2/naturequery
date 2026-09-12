import type { QueryResultRow } from '@/actions/db'
import type { ReconciliationRow, ReconciliationValue } from '@/lib/reconciliation'

export const INVESTIGATION_BASELINE_KEY = 'naturequery_investigation_baseline_v1'
export const INVESTIGATION_TRANSFER_KEY = 'naturequery_investigation_transfer_v1'

export interface InvestigationReport {
  name: string
  question: string
  sql?: string
  connectionId?: string
  connectionName: string
  rows: ReconciliationRow[]
  fields: string[]
  capturedAt: string
}

export interface InvestigationTransfer {
  source: InvestigationReport
  comparison: InvestigationReport
}

function browserSafeValue(value: unknown): ReconciliationValue {
  if (value === null || value === undefined) return value ?? null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Array.from(value).join(',')

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function createInvestigationReport({
  name,
  question,
  sql,
  connectionId,
  connectionName,
  rows,
  fields,
}: {
  name: string
  question: string
  sql?: string
  connectionId?: string
  connectionName: string
  rows: QueryResultRow[]
  fields: string[]
}): InvestigationReport {
  return {
    name,
    question,
    sql: sql ?? '',
    connectionId: connectionId ?? '',
    connectionName,
    fields: [...fields],
    rows: rows.map((row) =>
      Object.fromEntries(fields.map((field) => [field, browserSafeValue(row[field])]))
    ),
    capturedAt: new Date().toISOString(),
  }
}

export function isInvestigationReport(value: unknown): value is InvestigationReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<InvestigationReport>
  return (
    typeof report.name === 'string' &&
    Array.isArray(report.rows) &&
    Array.isArray(report.fields) &&
    report.fields.length > 0 &&
    report.fields.every((field) => typeof field === 'string')
  )
}

export function isInvestigationTransfer(value: unknown): value is InvestigationTransfer {
  if (!value || typeof value !== 'object') return false
  const transfer = value as Partial<InvestigationTransfer>
  return isInvestigationReport(transfer.source) && isInvestigationReport(transfer.comparison)
}

export function suggestInvestigationColumns(fields: string[]) {
  const key =
    fields.find((field) => /(^id$|_id$|reference|record|order|invoice|transaction)/i.test(field)) ??
    fields[0] ??
    ''
  const amount =
    fields.find(
      (field) =>
        field !== key && /amount|total|revenue|price|cost|balance|value|net|gross/i.test(field)
    ) ??
    fields.find((field) => field !== key) ??
    key

  return { key, amount }
}
