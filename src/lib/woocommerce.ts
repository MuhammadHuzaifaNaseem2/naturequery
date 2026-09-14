import { parseReconciliationAmount, type ReconciliationRow } from '@/lib/reconciliation'

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
  return typeof value === 'string' || typeof value === 'number'
    ? parseReconciliationAmount(value)
    : null
}

export function wooCommerceOrdersToRows(orders: WooCommerceOrder[]): ReconciliationRow[] {
  return orders.map((order) => {
    const grossAmount = finiteAmount(order.total)
    const refunds = (order.refunds || []).map((refund) => finiteAmount(refund.total))
    const refundAmount = refunds.some((value) => value === null)
      ? null
      : refunds.reduce<number>((sum, value) => sum + Math.abs(value!), 0)
    return {
      order_id: String(order.number || order.id),
      transaction_id: order.transaction_id || '',
      gross_amount: grossAmount,
      refund_amount: refundAmount,
      net_amount: grossAmount === null || refundAmount === null ? null : grossAmount - refundAmount,
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
