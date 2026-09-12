import type { ReconciliationRow } from '@/lib/reconciliation'
import { wooCommerceOrdersToRows, WOOCOMMERCE_ORDER_FIELDS } from '@/lib/woocommerce'

export interface WooCommerceDemoReconciliation {
  source: { name: string; rows: ReconciliationRow[]; fields: string[] }
  comparison: { name: string; rows: ReconciliationRow[]; fields: string[] }
  currency: string
  period: string
}

export function getWooCommerceDemoReconciliation(): WooCommerceDemoReconciliation {
  const sourceRows = wooCommerceOrdersToRows([
    {
      id: 1001,
      number: 'WC-1001',
      total: '1200.00',
      currency: 'USD',
      status: 'completed',
      payment_method_title: 'Card',
      transaction_id: 'txn_wc_1001',
      date_created_gmt: '2026-09-02T09:15:00',
    },
    {
      id: 1002,
      number: 'WC-1002',
      total: '800.00',
      currency: 'USD',
      status: 'completed',
      payment_method_title: 'Card',
      transaction_id: 'txn_wc_1002',
      date_created_gmt: '2026-09-05T11:20:00',
    },
    {
      id: 1003,
      number: 'WC-1003',
      total: '500.00',
      currency: 'USD',
      status: 'completed',
      payment_method_title: 'Card',
      transaction_id: 'txn_wc_1003',
      date_created_gmt: '2026-09-08T14:05:00',
      refunds: [{ total: '-50.00' }],
    },
    {
      id: 1004,
      number: 'WC-1004',
      total: '900.00',
      currency: 'USD',
      status: 'completed',
      payment_method_title: 'Bank transfer',
      transaction_id: 'txn_wc_1004',
      date_created_gmt: '2026-09-12T16:40:00',
    },
  ])

  return {
    source: {
      name: 'Demo WooCommerce orders',
      rows: sourceRows,
      fields: [...WOOCOMMERCE_ORDER_FIELDS],
    },
    comparison: {
      name: 'Demo payment settlement',
      fields: [
        'reference',
        'gross_amount',
        'fee_amount',
        'refund_amount',
        'net_amount',
        'settled_at',
      ],
      rows: [
        {
          reference: 'WC-1001',
          gross_amount: 1200,
          fee_amount: 36,
          refund_amount: 0,
          net_amount: 1164,
          settled_at: '2026-09-03T02:00:00Z',
        },
        {
          reference: 'WC-1002',
          gross_amount: 800,
          fee_amount: 0,
          refund_amount: 0,
          net_amount: 800,
          settled_at: '2026-09-06T02:00:00Z',
        },
        {
          reference: 'WC-1003',
          gross_amount: 500,
          fee_amount: 0,
          refund_amount: 50,
          net_amount: 450,
          settled_at: '2026-09-09T02:00:00Z',
        },
        {
          reference: 'WC-9999',
          gross_amount: 300,
          fee_amount: 0,
          refund_amount: 0,
          net_amount: 300,
          settled_at: '2026-09-11T02:00:00Z',
        },
      ],
    },
    currency: 'USD',
    period: 'September 2026 demo',
  }
}
