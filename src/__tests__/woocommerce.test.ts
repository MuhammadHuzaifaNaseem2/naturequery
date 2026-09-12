import { describe, expect, it } from 'vitest'
import { wooCommerceOrdersToRows } from '@/lib/woocommerce'

describe('wooCommerceOrdersToRows', () => {
  it('normalizes order numbers, transactions, refunds, and totals for reconciliation', () => {
    const rows = wooCommerceOrdersToRows([
      {
        id: 42,
        number: 'WC-1042',
        total: '125.50',
        currency: 'USD',
        status: 'completed',
        payment_method_title: 'Card',
        transaction_id: 'txn_123',
        date_created_gmt: '2026-09-12T10:30:00',
        refunds: [{ total: '-20.00' }, { total: '-5.50' }],
      },
    ])

    expect(rows).toEqual([
      {
        order_id: 'WC-1042',
        transaction_id: 'txn_123',
        gross_amount: 125.5,
        refund_amount: 25.5,
        net_amount: 100,
        currency: 'USD',
        status: 'completed',
        payment_method: 'Card',
        date_created: '2026-09-12T10:30:00',
      },
    ])
  })
})
