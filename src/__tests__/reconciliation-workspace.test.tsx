import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/actions/investigations', () => ({
  getInvestigation: mocks.get,
  saveInvestigation: vi.fn(),
}))
vi.mock('@/actions/reconciliation-profiles', () => ({
  getReconciliationProfiles: async () => ({ success: true, data: [] }),
  saveReconciliationProfile: vi.fn(),
}))
vi.mock('@/actions/reconciliation-monitors', () => ({ createReconciliationMonitor: vi.fn() }))
vi.mock('@/components/WooCommerceImportPanel', () => ({ WooCommerceImportPanel: () => null }))
import { ReconciliationWorkspace } from '@/components/ReconciliationWorkspace'
let root: Root
let container: HTMLDivElement
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
const button = (name: string) =>
  Array.from(container.querySelectorAll('button')).find((element) =>
    element.textContent?.includes(name)
  )!
const load = async (rows: Array<Record<string, string | number>>, comparison = rows) => {
  mocks.get.mockResolvedValue({
    success: true,
    data: {
      id: 'test',
      savedAt: '2026-09-14T00:00:00Z',
      snapshot: {
        name: 'Test',
        source: { name: 'A', fields: ['id', 'amount'], rows },
        comparison: { name: 'B', fields: ['id', 'amount'], rows: comparison },
        sourceKey: 'id',
        sourceAmount: 'amount',
        comparisonKey: 'id',
        comparisonAmount: 'amount',
        currency: 'USD',
        metric: 'Revenue',
        period: 'September',
        causes: {},
        status: 'RESOLVED',
      },
    },
  })
  await act(async () => root.render(<ReconciliationWorkspace investigationId="test" />))
}
it('blocks save and success messaging for invalid imported amounts', async () => {
  await load([{ id: 'a', amount: 'invalid' }])
  expect(container).toHaveTextContent('1 invalid row')
  expect(container).not.toHaveTextContent('No differences found')
  expect(button('Save update')).toBeDisabled()
  expect(button('Export evidence')).toBeDisabled()
})
it('keeps offsetting discrepancies unresolved in the UI', async () => {
  await load(
    [
      { id: 'a', amount: 100 },
      { id: 'b', amount: 50 },
    ],
    [
      { id: 'a', amount: 50 },
      { id: 'b', amount: 100 },
    ]
  )
  expect(container).toHaveTextContent('0 of 2 issues classified')
  expect(
    Array.from(container.querySelectorAll('p')).find(
      (element) => element.textContent === 'Still unexplained'
    )?.parentElement
  ).toHaveTextContent('$100.00')
  expect(container).not.toHaveTextContent('No differences found')
})
it('allows a complete matching comparison and evidence export', async () => {
  await load([{ id: 'a', amount: 10 }])
  expect(container).toHaveTextContent('No differences found')
  expect(button('Export evidence')).toBeEnabled()
})
