import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import ResultsTable from './ResultsTable'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let container: HTMLDivElement
function renderTable(count: number) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() =>
    root.render(
      <ResultsTable
        rows={rows.slice(0, count)}
        fields={['order_id', 'amount']}
        rowCount={count}
        executionTime={20}
      />
    )
  )
}
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
const rows = Array.from({ length: 25 }, (_, i) => ({ order_id: `order-${i + 1}`, amount: i + 1 }))

describe('ResultsTable scrolling', () => {
  it('lets a ten-row result use the workspace scroll rather than a nested capped viewport', () => {
    renderTable(10)
    expect(container.querySelector('[class~="max-h-[500px]"]')).toBeNull()
    expect(container.textContent).toContain('order-10')
  })

  it('bounds larger pages, keeps the footer outside scrolling rows, and removes the cap for short filtered results', () => {
    renderTable(25)
    expect(container.querySelector('[class~="max-h-[500px]"]')).toBeInTheDocument()
    expect(container.querySelector('.shrink-0')).toBeInTheDocument()
    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search all columns..."]'
    )!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        search,
        'order-25'
      )
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('order-25')
    expect(container.querySelector('[class~="max-h-[500px]"]')).toBeNull()
  })
})
