'use client'

import { useState } from 'react'

export interface QueryTemplate {
  id: string
  name: string
  description: string
  question: string
  category: 'analytics' | 'sales' | 'inventory' | 'custom'
}

const DEFAULT_TEMPLATES: QueryTemplate[] = [
  {
    id: '1',
    name: 'Total Count',
    description: 'Count all records in a table',
    question: 'How many records are in the table?',
    category: 'analytics',
  },
  {
    id: '2',
    name: 'Recent Records',
    description: 'Get the most recent entries',
    question: 'Show me the 10 most recent records',
    category: 'analytics',
  },
  {
    id: '3',
    name: 'Top Customers',
    description: 'Find highest-value customers',
    question: 'Who are the top 10 customers by total orders?',
    category: 'sales',
  },
  {
    id: '4',
    name: 'Monthly Sales',
    description: 'Sales breakdown by month',
    question: 'Show me total sales grouped by month',
    category: 'sales',
  },
  {
    id: '5',
    name: 'Low Stock',
    description: 'Items running low on inventory',
    question: 'Which products have less than 10 items in stock?',
    category: 'inventory',
  },
  {
    id: '6',
    name: 'Revenue by Product',
    description: 'Product revenue ranking',
    question: 'What are the top 10 products by revenue?',
    category: 'sales',
  },
]

const CATEGORY_COLORS = {
  analytics: 'bg-primary/10 text-primary',
  sales: 'bg-success/10 text-success',
  inventory: 'bg-warning/10 text-warning',
  custom: 'bg-accent/10 text-accent',
}

const CATEGORY_ICONS = {
  analytics: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  sales: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  inventory: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  custom: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
}

interface QueryTemplatesProps {
  onSelectTemplate: (question: string) => void
}

export function QueryTemplates({ onSelectTemplate }: QueryTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  const filteredTemplates = selectedCategory
    ? DEFAULT_TEMPLATES.filter((t) => t.category === selectedCategory)
    : DEFAULT_TEMPLATES

  const categories = ['analytics', 'sales', 'inventory'] as const

  return (
    <div className="flex flex-col">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-3 text-sm font-medium hover:text-primary transition-colors border-b border-border"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Quick Templates
      </button>

      {isExpanded && (
        <>
          {/* Category filters */}
          <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1 text-xs rounded-full capitalize transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.question)}
                className="w-full p-2.5 text-left rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all group"
              >
                <div className="flex items-start gap-2">
                  <span className={`p-1.5 rounded ${CATEGORY_COLORS[template.category]}`}>
                    {CATEGORY_ICONS[template.category]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {template.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
