import { describe, it, expect } from 'vitest'
import { classifyColumn, formatCellValue } from '../format-cell-value'

// ── classifyColumn ────────────────────────────────────────────────────────

describe('classifyColumn', () => {
  describe('id columns', () => {
    it('classifies exact "id" as id', () => expect(classifyColumn('id')).toBe('id'))
    it('classifies "customer_id" as id', () => expect(classifyColumn('customer_id')).toBe('id'))
    it('classifies "product_id" as id', () => expect(classifyColumn('product_id')).toBe('id'))
    it('classifies "order_id" as id', () => expect(classifyColumn('order_id')).toBe('id'))
    it('does NOT classify "ideal" as id', () => expect(classifyColumn('ideal')).toBe('default'))
  })

  describe('currency columns', () => {
    it('classifies "revenue" as currency', () => expect(classifyColumn('revenue')).toBe('currency'))
    it('classifies "total_revenue" as currency', () =>
      expect(classifyColumn('total_revenue')).toBe('currency'))
    it('classifies "amount" as currency', () => expect(classifyColumn('amount')).toBe('currency'))
    it('classifies "total_amount" as currency', () =>
      expect(classifyColumn('total_amount')).toBe('currency'))
    it('classifies "price" as currency', () => expect(classifyColumn('price')).toBe('currency'))
    it('classifies "unit_price" as currency', () =>
      expect(classifyColumn('unit_price')).toBe('currency'))
    it('classifies "cost" as currency', () => expect(classifyColumn('cost')).toBe('currency'))
    it('classifies "shipping_cost" as currency', () =>
      expect(classifyColumn('shipping_cost')).toBe('currency'))
    it('classifies "salary" as currency', () => expect(classifyColumn('salary')).toBe('currency'))
    it('classifies "balance" as currency', () => expect(classifyColumn('balance')).toBe('currency'))
    it('classifies "earnings" as currency', () =>
      expect(classifyColumn('earnings')).toBe('currency'))
    it('classifies "income" as currency', () => expect(classifyColumn('income')).toBe('currency'))
    it('classifies "fee" as currency', () => expect(classifyColumn('fee')).toBe('currency'))
    it('classifies "transaction_fee" as currency', () =>
      expect(classifyColumn('transaction_fee')).toBe('currency'))
    it('classifies standalone "total" as currency', () =>
      expect(classifyColumn('total')).toBe('currency'))
    it('classifies "grand_total" as currency', () =>
      expect(classifyColumn('grand_total')).toBe('currency'))
    it('classifies "order_total" as currency', () =>
      expect(classifyColumn('order_total')).toBe('currency'))
    it('classifies "subtotal" as currency', () =>
      expect(classifyColumn('subtotal')).toBe('currency'))
    it('classifies "discount" as currency', () =>
      expect(classifyColumn('discount')).toBe('currency'))
    it('classifies "budget" as currency', () => expect(classifyColumn('budget')).toBe('currency'))
  })

  describe('count columns', () => {
    it('classifies "count" as count', () => expect(classifyColumn('count')).toBe('count'))
    it('classifies "order_count" as count', () =>
      expect(classifyColumn('order_count')).toBe('count'))
    it('classifies "quantity" as count', () => expect(classifyColumn('quantity')).toBe('count'))
    it('classifies "qty" as count', () => expect(classifyColumn('qty')).toBe('count'))
    it('classifies "stock" as count', () => expect(classifyColumn('stock')).toBe('count'))
    it('classifies "stock_quantity" as count', () =>
      expect(classifyColumn('stock_quantity')).toBe('count'))
    it('classifies "inventory" as count', () => expect(classifyColumn('inventory')).toBe('count'))
    it('classifies "total_products_in_stock" as count', () =>
      expect(classifyColumn('total_products_in_stock')).toBe('count'))
    it('classifies "total_quantity" as count', () =>
      expect(classifyColumn('total_quantity')).toBe('count'))
    it('classifies "total_orders" as count', () =>
      expect(classifyColumn('total_orders')).toBe('count'))
    it('classifies "num_users" as count', () => expect(classifyColumn('num_users')).toBe('count'))
    it('classifies "number_of_items" as count', () =>
      expect(classifyColumn('number_of_items')).toBe('count'))
    it('classifies "items" as count', () => expect(classifyColumn('items')).toBe('count'))
  })

  describe('percent columns', () => {
    it('classifies "percent" as percent', () => expect(classifyColumn('percent')).toBe('percent'))
    it('classifies "percent_complete" as percent', () =>
      expect(classifyColumn('percent_complete')).toBe('percent'))
    it('classifies "completion_pct" as percent', () =>
      expect(classifyColumn('completion_pct')).toBe('percent'))
    it('classifies "conversion_rate" as percent', () =>
      expect(classifyColumn('conversion_rate')).toBe('percent'))
    it('classifies "tax_rate" as percent', () => expect(classifyColumn('tax_rate')).toBe('percent'))
    it('classifies "ratio" as percent', () => expect(classifyColumn('ratio')).toBe('percent'))
    it('classifies "click_ratio" as percent', () =>
      expect(classifyColumn('click_ratio')).toBe('percent'))
  })

  describe('default columns', () => {
    it('classifies "age" as default', () => expect(classifyColumn('age')).toBe('default'))
    it('classifies "rank" as default', () => expect(classifyColumn('rank')).toBe('default'))
    it('classifies "score" as default', () => expect(classifyColumn('score')).toBe('default'))
  })
})

// ── formatCellValue ───────────────────────────────────────────────────────

describe('formatCellValue', () => {
  describe('null / undefined / missing', () => {
    it('returns em dash for null', () => expect(formatCellValue(null)).toBe('—'))
    it('returns em dash for undefined', () => expect(formatCellValue(undefined)).toBe('—'))
    it('returns em dash for null with field name', () =>
      expect(formatCellValue(null, 'price')).toBe('—'))
  })

  describe('booleans', () => {
    it('formats true as "true"', () => expect(formatCellValue(true)).toBe('true'))
    it('formats false as "false"', () => expect(formatCellValue(false)).toBe('false'))
  })

  describe('id columns — no formatting', () => {
    it('id=12345 → "12345"', () => expect(formatCellValue(12345, 'id')).toBe('12345'))
    it('customer_id=999 → "999"', () => expect(formatCellValue(999, 'customer_id')).toBe('999'))
    it('product_id=1000000 → "1000000" (no separator)', () =>
      expect(formatCellValue(1000000, 'product_id')).toBe('1000000'))
  })

  describe('currency columns', () => {
    it('revenue=3993.74 → "$3,993.74"', () =>
      expect(formatCellValue(3993.74, 'revenue')).toBe('$3,993.74'))
    it('total_amount=0 → "$0.00"', () => expect(formatCellValue(0, 'total_amount')).toBe('$0.00'))
    it('price=25.99 → "$25.99"', () => expect(formatCellValue(25.99, 'price')).toBe('$25.99'))
    it('total_revenue=2324 → "$2,324.00"', () =>
      expect(formatCellValue(2324, 'total_revenue')).toBe('$2,324.00'))
    it('balance=-500.5 → "-$500.50"', () =>
      expect(formatCellValue(-500.5, 'balance')).toBe('-$500.50'))
  })

  describe('count columns', () => {
    it('stock_quantity=2490 → "2,490"', () =>
      expect(formatCellValue(2490, 'stock_quantity')).toBe('2,490'))
    it('total_products_in_stock=2490 → "2,490"', () =>
      expect(formatCellValue(2490, 'total_products_in_stock')).toBe('2,490'))
    it('order_count=100 → "100"', () => expect(formatCellValue(100, 'order_count')).toBe('100'))
    it('inventory=1000000 → "1,000,000"', () =>
      expect(formatCellValue(1000000, 'inventory')).toBe('1,000,000'))
  })

  describe('percent columns', () => {
    it('ratio ≤1 is treated as fraction (0.155 → "15.50%")', () =>
      expect(formatCellValue(0.155, 'tax_rate')).toBe('15.50%'))
    it('ratio=0 → "0.00%"', () => expect(formatCellValue(0, 'conversion_rate')).toBe('0.00%'))
    it('value >1 is already a percentage (45.5 → "45.50%")', () =>
      expect(formatCellValue(45.5, 'percent_complete')).toBe('45.50%'))
    it('value=100 → "100.00%"', () =>
      expect(formatCellValue(100, 'completion_pct')).toBe('100.00%'))
  })

  describe('default numeric columns', () => {
    it('small integer → raw string', () => expect(formatCellValue(42, 'age')).toBe('42'))
    it('large integer ≥10000 → comma-separated', () =>
      expect(formatCellValue(12345, 'score')).toBe('12,345'))
    it('decimal → 2dp formatted', () => expect(formatCellValue(3.14159, 'avg_score')).toBe('3.14'))
  })

  describe('strings and dates', () => {
    it('plain string passes through', () => expect(formatCellValue('hello', 'name')).toBe('hello'))
    it('ISO date string is formatted', () => {
      const result = formatCellValue('2025-01-15', 'created_at')
      expect(result).toMatch(/Jan 15, 2025/)
    })
    it('non-date string is not touched', () =>
      expect(formatCellValue('not-a-date', 'label')).toBe('not-a-date'))
  })

  describe('no field name provided', () => {
    it('large number gets comma separator', () => expect(formatCellValue(50000)).toBe('50,000'))
    it('small integer passes through raw', () => expect(formatCellValue(99)).toBe('99'))
  })
})
