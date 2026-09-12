import type { ReconciliationRow } from '@/lib/reconciliation'

export const WOOCOMMERCE_ORDER_FIELDS = [
  'order_id',
  'transaction_id',
  'gross_amount',
  'refund_amount',
  'net_amount',
  'currency',
  'status',
  'payment_method',
  'date_created',
] as const

interface WooCommerceRefund {
  total?: string
}

export interface WooCommerceOrder {
  id: number
  number?: string
  total?: string
  currency?: string
  status?: string
  payment_method_title?: string
  payment_method?: string
  transaction_id?: string
  date_created_gmt?: string | null
  date_created?: string | null
  refunds?: WooCommerceRefund[]
}

function finiteAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function wooCommerceOrdersToRows(orders: WooCommerceOrder[]): ReconciliationRow[] {
  return orders.map((order) => {
    const grossAmount = finiteAmount(order.total)
    const refundAmount = (order.refunds || []).reduce(
      (sum, refund) => sum + Math.abs(finiteAmount(refund.total)),
      0
    )
    return {
      order_id: String(order.number || order.id),
      transaction_id: order.transaction_id || '',
      gross_amount: grossAmount,
      refund_amount: refundAmount,
      net_amount: grossAmount - refundAmount,
      currency: order.currency || '',
      status: order.status || '',
      payment_method: order.payment_method_title || order.payment_method || '',
      date_created: order.date_created_gmt || order.date_created || '',
    }
  })
}

export function isWooCommerceOrder(value: unknown): value is WooCommerceOrder {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as Partial<WooCommerceOrder>).id === 'number'
  )
}
