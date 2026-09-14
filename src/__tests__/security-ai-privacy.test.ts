import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'user-a' } }) }))
vi.mock('@/lib/groq-keys', () => ({
  getGroqClient: () => ({}),
  withKeyRotation: (callback: (client: unknown) => unknown) =>
    callback({ chat: { completions: { create: mocks.create } } }),
  isRateLimitError: () => false,
  parseRetryDelayMs: () => 0,
}))
import { recommendChart } from '@/actions/ai'
it('recommends a chart without sending result row values to the AI provider', async () => {
  mocks.create.mockResolvedValue({
    choices: [
      {
        message: { content: JSON.stringify({ type: 'bar', xAxis: 'customer', yAxis: ['amount'] }) },
      },
    ],
  })
  const result = await recommendChart({
    question: 'Chart amounts by customer',
    sql: 'SELECT customer, amount FROM orders',
    fields: ['customer', 'amount'],
    sampleRows: [{ customer: 'PRIVATE_CUSTOMER_492', amount: 879123.45 }],
  })
  expect(result.success).toBe(true)
  expect(mocks.create).toHaveBeenCalledOnce()
  const sent = JSON.stringify(mocks.create.mock.calls[0][0])
  expect(sent).toContain('Chart amounts by customer')
  expect(sent).not.toContain('PRIVATE_CUSTOMER_492')
  expect(sent).not.toContain('879123.45')
})
