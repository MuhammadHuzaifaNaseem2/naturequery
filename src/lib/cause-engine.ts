import type { ReconciliationItem, ReconciliationRow } from '@/lib/reconciliation'

export interface CauseSuggestion {
  cause: string
  confidence: 'high' | 'medium'
  evidence: string
}

interface ReportContext {
  rows: ReconciliationRow[]
  keyColumn: string
  amountColumn: string
  name?: string
  question?: string
  sql?: string
}

interface CauseEngineOptions {
  items: ReconciliationItem[]
  source: ReportContext
  comparison: ReportContext
}

function rowForKey(report: ReportContext, key: string) {
  return report.rows.find((row) => String(row[report.keyColumn] ?? '').trim() === key)
}

function definition(report: ReportContext) {
  return [report.name, report.question, report.sql].filter(Boolean).join(' ').toLowerCase()
}

function equalityFilters(report: ReportContext) {
  const filters = new Map<string, string>()
  const text = definition(report)
  const regex = /(?:\w+\.)?["`]?([a-z_][\w]*)["`]?\s*=\s*['"]([^'"]+)['"]/gi
  for (const match of text.matchAll(regex)) filters.set(match[1].toLowerCase(), match[2])

  const statusWord = text.match(
    /\b(completed|pending|shipped|cancelled|canceled|refunded|failed)\b/i
  )
  if (statusWord && /\bonly\b|where\s+/i.test(text)) filters.set('status', statusWord[1])
  return filters
}

function excludedByFilters(row: ReconciliationRow | undefined, report: ReportContext) {
  if (!row) return null
  for (const [column, expected] of equalityFilters(report)) {
    const actual = row[column]
    if (actual !== undefined && String(actual).toLowerCase() !== expected.toLowerCase()) {
      return { column, expected, actual: String(actual) }
    }
  }
  return null
}

export function suggestReconciliationCauses({
  items,
  source,
  comparison,
}: CauseEngineOptions): Record<string, CauseSuggestion> {
  const suggestions: Record<string, CauseSuggestion> = {}

  for (const item of items) {
    if (item.status === 'matched') continue

    if (item.status === 'duplicate_key') {
      suggestions[item.key] = {
        cause: 'Duplicate row',
        confidence: 'high',
        evidence: `Report A contains ${item.sourceCount} row(s) and Report B contains ${item.comparisonCount} row(s) for this ID.`,
      }
      continue
    }

    if (item.status === 'only_in_source') {
      const exclusion = excludedByFilters(rowForKey(source, item.key), comparison)
      if (exclusion) {
        suggestions[item.key] = {
          cause: 'Filter / scope difference',
          confidence: 'high',
          evidence: `Report B requires ${exclusion.column} = ${exclusion.expected}; this record has ${exclusion.column} = ${exclusion.actual}.`,
        }
        continue
      }
    }

    if (item.status === 'only_in_comparison') {
      const exclusion = excludedByFilters(rowForKey(comparison, item.key), source)
      if (exclusion) {
        suggestions[item.key] = {
          cause: 'Filter / scope difference',
          confidence: 'high',
          evidence: `Report A requires ${exclusion.column} = ${exclusion.expected}; this record has ${exclusion.column} = ${exclusion.actual}.`,
        }
        continue
      }
    }

    if (item.status === 'amount_mismatch') {
      const amountDefinitions = `${source.amountColumn} ${comparison.amountColumn}`.toLowerCase()
      if (/net|gross|fee|commission|payout/.test(amountDefinitions)) {
        suggestions[item.key] = {
          cause: 'Fee / net vs gross',
          confidence: 'medium',
          evidence: `The compared amount fields are “${source.amountColumn}” and “${comparison.amountColumn}”; verify whether one includes fees or uses net values.`,
        }
      }
    }
  }

  return suggestions
}
