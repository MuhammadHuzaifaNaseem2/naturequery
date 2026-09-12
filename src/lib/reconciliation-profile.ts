export interface ReconciliationProfileDefinition {
  version: 1
  name: string
  metric: string
  currency: string
  sourceLabel: string
  comparisonLabel: string
  sourceKey: string
  sourceAmount: string
  comparisonKey: string
  comparisonAmount: string
}

export interface SavedReconciliationProfile {
  id: string
  savedAt: string
  definition: ReconciliationProfileDefinition
}

export function isReconciliationProfileDefinition(
  value: unknown
): value is ReconciliationProfileDefinition {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<ReconciliationProfileDefinition>
  return (
    profile.version === 1 &&
    typeof profile.name === 'string' &&
    typeof profile.metric === 'string' &&
    typeof profile.currency === 'string' &&
    typeof profile.sourceLabel === 'string' &&
    typeof profile.comparisonLabel === 'string' &&
    typeof profile.sourceKey === 'string' &&
    typeof profile.sourceAmount === 'string' &&
    typeof profile.comparisonKey === 'string' &&
    typeof profile.comparisonAmount === 'string'
  )
}

export function resolveProfileColumns(
  fields: string[],
  preferredKey: string,
  preferredAmount: string
) {
  const key = fields.includes(preferredKey) ? preferredKey : fields[0] || ''
  const amount = fields.includes(preferredAmount)
    ? preferredAmount
    : fields.find((field) => field !== key) || fields[0] || ''
  return { key, amount }
}
