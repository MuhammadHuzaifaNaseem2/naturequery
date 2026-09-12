import { describe, expect, it } from 'vitest'
import { reconcileReports } from '@/lib/reconciliation'
import { getWooCommerceDemoReconciliation } from '@/lib/woocommerce-demo'

describe('WooCommerce demo reconciliation', () => {
  it('contains matched, fee, missing payout, and unknown settlement examples', () => {
    const demo = getWooCommerceDemoReconciliation()
    const result = reconcileReports({
      sourceRows: demo.source.rows,
      comparisonRows: demo.comparison.rows,
      sourceKey: 'order_id',
      sourceAmount: 'net_amount',
      comparisonKey: 'reference',
      comparisonAmount: 'net_amount',
    })

    expect(result.matchedCount).toBe(2)
    expect(result.items.find((item) => item.key === 'WC-1001')?.status).toBe('amount_mismatch')
    expect(result.items.find((item) => item.key === 'WC-1004')?.status).toBe('only_in_source')
    expect(result.items.find((item) => item.key === 'WC-9999')?.status).toBe('only_in_comparison')
    expect(result.difference).toBe(636)
  })
})
