import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addHistoryEntry,
  clearQueryHistory,
  deleteHistoryEntry,
  getQueryHistory,
} from '@/actions/queries'
import type { QueryHistoryItem } from '@/actions/queries'
import { useDashboardHistory } from './useDashboardHistory'

vi.mock('@/actions/queries', () => ({
  addHistoryEntry: vi.fn(),
  saveQuery: vi.fn(),
  deleteSavedQuery: vi.fn(),
  toggleFavorite: vi.fn(),
  clearQueryHistory: vi.fn(),
  deleteHistoryEntry: vi.fn(),
  getQueryHistory: vi.fn(),
}))
vi.mock('@/actions/sharing', () => ({ generateShareLink: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

type HistoryState = ReturnType<typeof useDashboardHistory>
let state: HistoryState
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

function entry(id: string, status = 'success'): QueryHistoryItem {
  return {
    id,
    question: 'Count orders by status',
    sql: 'SELECT order_status, COUNT(*) FROM orders GROUP BY order_status;',
    connectionId: 'csv-connection',
    connectionName: 'QA CSV',
    rowCount: status === 'success' ? 8 : null,
    executionTimeMs: 100,
    status,
    errorMessage: status === 'error' ? 'Query failed' : null,
    createdAt: '2026-10-04T12:00:00.000Z',
  }
}

function historyPage(items: QueryHistoryItem[], total: number) {
  return { success: true, data: { items, total, page: 1, totalPages: Math.ceil(total / 50) } }
}

function Probe() {
  state = useDashboardHistory('csv-connection', undefined)
  return (
    <div>
      <output data-testid="total">{state.queryHistoryTotal}</output>
      <output data-testid="loaded">{state.queryHistory.length}</output>
    </div>
  )
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
  localStorage.clear()
  localStorage.setItem('rf_sidebar_counts', JSON.stringify({ history: 27, saved: 0 }))
  container = document.createElement('div')
  root = createRoot(container)
  act(() =>
    root.render(
      <StrictMode>
        <Probe />
      </StrictMode>
    )
  )
  vi.mocked(getQueryHistory).mockResolvedValue(
    historyPage(
      Array.from({ length: 27 }, (_, i) => entry(`old-${i}`)),
      27
    )
  )
  await act(async () => {
    await state.refreshHistory()
  })
})

afterEach(() => {
  act(() => root.unmount())
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('dashboard history recording', () => {
  it.each(['success', 'error'])(
    'updates the list, badge total and cache for a saved %s entry',
    async (status) => {
      const saved = entry('new-entry', status)
      vi.mocked(addHistoryEntry).mockResolvedValue({ success: true, data: saved })
      let recorded: boolean | undefined

      await act(async () => {
        recorded = await state.handleRecordHistoryEntry({
          question: saved.question,
          sql: saved.sql,
          status,
        })
      })

      expect(recorded).toBe(true)
      expect(state.queryHistory[0]).toEqual(saved)
      expect(container.querySelector('[data-testid="loaded"]')?.textContent).toBe('28')
      expect(container.querySelector('[data-testid="total"]')?.textContent).toBe('28')
      expect(JSON.parse(localStorage.getItem('rf_sidebar_counts')!).history).toBe(28)
    }
  )

  it('reproduces the 27-to-30 scenario without stale counters', async () => {
    vi.mocked(addHistoryEntry)
      .mockResolvedValueOnce({ success: true, data: entry('first') })
      .mockResolvedValueOnce({ success: true, data: entry('second') })
      .mockResolvedValueOnce({ success: true, data: entry('third') })
    vi.mocked(getQueryHistory).mockResolvedValue(
      historyPage(
        [
          entry('first'),
          entry('second'),
          entry('third'),
          ...Array.from({ length: 27 }, (_, i) => entry(`old-${i}`)),
        ],
        30
      )
    )

    await act(async () => {
      await Promise.all(
        Array.from({ length: 3 }, () =>
          state.handleRecordHistoryEntry({
            question: 'Count orders',
            sql: 'SELECT COUNT(*) FROM orders;',
          })
        )
      )
    })

    expect(state.queryHistory).toHaveLength(30)
    expect(state.queryHistoryTotal).toBe(30)
    expect(JSON.parse(localStorage.getItem('rf_sidebar_counts')!).history).toBe(30)
  })

  it('increments the server total instead of replacing it with the loaded page length', async () => {
    vi.mocked(getQueryHistory).mockResolvedValue(
      historyPage(
        Array.from({ length: 50 }, (_, i) => entry(`page-${i}`)),
        127
      )
    )
    await act(async () => {
      await state.refreshHistory()
    })
    vi.mocked(addHistoryEntry).mockResolvedValue({ success: true, data: entry('new-entry') })

    await act(async () => {
      await state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
    })

    expect(state.queryHistory).toHaveLength(51)
    expect(state.queryHistoryTotal).toBe(128)
  })

  it('handles overlapping saves that finish out of order without losing increments', async () => {
    type Result = Awaited<ReturnType<typeof addHistoryEntry>>
    let resolveFirst!: (result: Result) => void
    let resolveSecond!: (result: Result) => void
    vi.mocked(addHistoryEntry)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          })
      )
    vi.mocked(getQueryHistory).mockResolvedValue(
      historyPage(
        [
          entry('first'),
          entry('second'),
          ...Array.from({ length: 27 }, (_, i) => entry(`old-${i}`)),
        ],
        29
      )
    )

    const first = state.handleRecordHistoryEntry({ question: 'First', sql: 'SELECT 1;' })
    const second = state.handleRecordHistoryEntry({ question: 'Second', sql: 'SELECT 2;' })
    expect(state.queryHistoryTotal).toBe(27)

    await act(async () => {
      resolveSecond({ success: true, data: entry('second') })
      await second
    })
    await act(async () => {
      resolveFirst({ success: true, data: entry('first') })
      await first
    })

    expect(state.queryHistory).toHaveLength(29)
    expect(state.queryHistoryTotal).toBe(29)
  })

  it.each([{ success: false, error: 'Could not save history' }, { success: true }])(
    'does not increment when persistence has no saved entry: %j',
    async (result) => {
      vi.mocked(addHistoryEntry).mockResolvedValue(result)
      let recorded: boolean | undefined

      await act(async () => {
        recorded = await state.handleRecordHistoryEntry({
          question: 'Count orders',
          sql: 'SELECT 1;',
        })
      })

      expect(recorded).toBe(false)
      expect(state.queryHistory).toHaveLength(27)
      expect(state.queryHistoryTotal).toBe(27)
    }
  )

  it('contains network failures so non-blocking recording cannot reject a completed query', async () => {
    vi.mocked(addHistoryEntry).mockRejectedValue(new Error('Network unavailable'))

    await act(async () => {
      expect(
        await state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
      ).toBe(false)
    })

    expect(state.queryHistory).toHaveLength(27)
    expect(state.queryHistoryTotal).toBe(27)
  })

  it('re-fetches instead of applying a page fetched before a new history write', async () => {
    type HistoryResult = Awaited<ReturnType<typeof getQueryHistory>>
    let resolveStale!: (result: HistoryResult) => void
    vi.mocked(getQueryHistory)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve
          })
      )
      .mockResolvedValueOnce(
        historyPage(
          [entry('new-entry'), ...Array.from({ length: 27 }, (_, i) => entry(`old-${i}`))],
          28
        )
      )

    const staleLoad = state.refreshHistory()
    vi.mocked(addHistoryEntry).mockResolvedValue({ success: true, data: entry('new-entry') })
    await act(async () => {
      await state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
    })
    await act(async () => {
      resolveStale(
        historyPage(
          Array.from({ length: 27 }, (_, i) => entry(`old-${i}`)),
          27
        )
      )
      await staleLoad
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(state.queryHistoryTotal).toBe(28)
    expect(state.queryHistory).toHaveLength(28)
    expect(vi.mocked(getQueryHistory)).toHaveBeenCalledTimes(3)
  })

  it('does not double-count when a read would include an in-flight write', async () => {
    type AddResult = Awaited<ReturnType<typeof addHistoryEntry>>
    let resolveSave!: (result: AddResult) => void
    vi.mocked(addHistoryEntry).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )

    const save = state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
    const read = await state.refreshHistory()
    expect(read).toBe(false)
    expect(vi.mocked(getQueryHistory)).toHaveBeenCalledTimes(1)

    vi.mocked(getQueryHistory).mockResolvedValueOnce(
      historyPage(
        [entry('new-entry'), ...Array.from({ length: 27 }, (_, i) => entry(`old-${i}`))],
        28
      )
    )
    await act(async () => {
      resolveSave({ success: true, data: entry('new-entry') })
      await save
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(state.queryHistoryTotal).toBe(28)
    expect(state.queryHistory).toHaveLength(28)
    expect(vi.mocked(getQueryHistory)).toHaveBeenCalledTimes(2)
  })

  it('discards a read that includes a save before the save response arrives', async () => {
    type HistoryResult = Awaited<ReturnType<typeof getQueryHistory>>
    type AddResult = Awaited<ReturnType<typeof addHistoryEntry>>
    let resolveRead!: (result: HistoryResult) => void
    let resolveSave!: (result: AddResult) => void
    vi.mocked(getQueryHistory)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve
          })
      )
      .mockResolvedValueOnce(
        historyPage(
          [entry('new-entry'), ...Array.from({ length: 27 }, (_, i) => entry(`old-${i}`))],
          28
        )
      )
    vi.mocked(addHistoryEntry).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )

    const read = state.refreshHistory()
    const save = state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
    await act(async () => {
      resolveRead(
        historyPage(
          [entry('new-entry'), ...Array.from({ length: 27 }, (_, i) => entry(`old-${i}`))],
          28
        )
      )
      await read
    })
    expect(state.queryHistoryTotal).toBe(27)

    await act(async () => {
      resolveSave({ success: true, data: entry('new-entry') })
      await save
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(state.queryHistoryTotal).toBe(28)
    expect(state.queryHistory).toHaveLength(28)
  })

  it('does not let a delete refresh overwrite a newer saved entry', async () => {
    type HistoryResult = Awaited<ReturnType<typeof getQueryHistory>>
    let resolveDeleteRefresh!: (result: HistoryResult) => void
    vi.mocked(deleteHistoryEntry).mockResolvedValue({ success: true })
    vi.mocked(getQueryHistory).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeleteRefresh = resolve
        })
    )

    await act(async () => {
      await state.handleDeleteHistoryEntry('old-0')
    })
    expect(state.queryHistoryTotal).toBe(26)

    vi.mocked(addHistoryEntry).mockResolvedValue({ success: true, data: entry('new-entry') })
    await act(async () => {
      await state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
    })
    vi.mocked(getQueryHistory).mockResolvedValueOnce(
      historyPage(
        [entry('new-entry'), ...Array.from({ length: 26 }, (_, i) => entry(`old-${i + 1}`))],
        27
      )
    )
    await act(async () => {
      resolveDeleteRefresh(
        historyPage(
          Array.from({ length: 26 }, (_, i) => entry(`old-${i + 1}`)),
          26
        )
      )
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(state.queryHistoryTotal).toBe(27)
    expect(state.queryHistory[0].id).toBe('new-entry')
  })

  it('restores an optimistic deletion when the server rejects it', async () => {
    vi.mocked(deleteHistoryEntry).mockResolvedValue({ success: false, error: 'Could not delete' })
    vi.mocked(getQueryHistory).mockResolvedValueOnce(
      historyPage(
        Array.from({ length: 27 }, (_, i) => entry(`old-${i}`)),
        27
      )
    )

    await act(async () => {
      await state.handleDeleteHistoryEntry('old-0')
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(state.queryHistoryTotal).toBe(27)
    expect(state.queryHistory).toHaveLength(27)
  })

  it('restores an optimistic deletion when the network rejects the action', async () => {
    vi.mocked(deleteHistoryEntry).mockRejectedValue(new Error('Network unavailable'))
    vi.mocked(getQueryHistory).mockRejectedValueOnce(new Error('Network unavailable'))

    await act(async () => {
      await state.handleDeleteHistoryEntry('old-0')
    })
    expect(state.queryHistoryTotal).toBe(27)
    expect(state.queryHistory).toHaveLength(27)
  })

  it('does not apply a history load after its dashboard effect is cancelled', async () => {
    type HistoryResult = Awaited<ReturnType<typeof getQueryHistory>>
    let resolveRead!: (result: HistoryResult) => void
    vi.mocked(getQueryHistory).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve
        })
    )

    let current = true
    const read = state.refreshHistory(() => current)
    current = false
    await act(async () => {
      resolveRead(historyPage([entry('another-account')], 1))
      await read
    })

    expect(state.queryHistoryTotal).toBe(27)
    expect(state.queryHistory.some((item) => item.id === 'another-account')).toBe(false)
  })

  it('reconciles the count when clear commits after an in-flight add', async () => {
    type AddResult = Awaited<ReturnType<typeof addHistoryEntry>>
    let resolveSave!: (result: AddResult) => void
    vi.mocked(addHistoryEntry).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )
    vi.mocked(clearQueryHistory).mockResolvedValue({ success: true })
    vi.mocked(getQueryHistory).mockResolvedValueOnce(historyPage([], 0))

    const save = state.handleRecordHistoryEntry({ question: 'Count orders', sql: 'SELECT 1;' })
    await act(async () => {
      await state.handleClearHistory()
    })
    expect(state.queryHistoryTotal).toBe(0)

    await act(async () => {
      resolveSave({ success: true, data: entry('already-cleared') })
      await save
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(state.queryHistoryTotal).toBe(0)
    expect(state.queryHistory).toHaveLength(0)
    expect(vi.mocked(getQueryHistory)).toHaveBeenCalledTimes(2)
  })
})
