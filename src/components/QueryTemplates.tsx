'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { getUserTemplates, saveAsTemplate, deleteSavedQuery } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'

export interface QueryTemplate {
  id: string
  name: string
  description: string
  question: string
  category: 'analytics' | 'sales' | 'inventory' | 'custom'
  isUserTemplate?: boolean
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

const CATEGORY_COLORS: Record<string, string> = {
  analytics: 'bg-primary/10 text-primary',
  sales: 'bg-success/10 text-success',
  inventory: 'bg-warning/10 text-warning',
  custom: 'bg-accent/10 text-accent',
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
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

const ALL_CATEGORIES = ['analytics', 'sales', 'inventory', 'custom'] as const

interface QueryTemplatesProps {
  onSelectTemplate: (question: string) => void
}

export function QueryTemplates({ onSelectTemplate }: QueryTemplatesProps) {
  const { t } = useTranslation()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [userTemplates, setUserTemplates] = useState<QueryTemplate[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newCategory, setNewCategory] = useState<string>('custom')
  const [isSaving, setIsSaving] = useState(false)

  // Load user templates
  useEffect(() => {
    getUserTemplates().then((res) => {
      if (res.success && res.data) {
        setUserTemplates(
          res.data.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description || t.question,
            question: t.question,
            category: (t.templateCategory as QueryTemplate['category']) || 'custom',
            isUserTemplate: true,
          }))
        )
      }
    })
  }, [])

  const allTemplates = [...DEFAULT_TEMPLATES, ...userTemplates]

  const filteredTemplates = selectedCategory
    ? allTemplates.filter((t) => t.category === selectedCategory)
    : allTemplates

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newQuestion.trim()) return
    setIsSaving(true)
    const res = await saveAsTemplate({
      name: newName.trim(),
      question: newQuestion.trim(),
      category: newCategory,
    })
    setIsSaving(false)
    if (res.success && res.data) {
      setUserTemplates((prev) => [
        ...prev,
        {
          id: res.data!.id,
          name: res.data!.name,
          description: res.data!.question,
          question: res.data!.question,
          category: (res.data!.templateCategory as QueryTemplate['category']) || 'custom',
          isUserTemplate: true,
        },
      ])
      setNewName('')
      setNewQuestion('')
      setNewCategory('custom')
      setShowCreateForm(false)
    }
  }, [newName, newQuestion, newCategory])

  const handleDelete = useCallback(async (id: string) => {
    const res = await deleteSavedQuery(id)
    if (res.success) {
      setUserTemplates((prev) => prev.filter((t) => t.id !== id))
    }
  }, [])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center gap-2 p-3 text-sm font-medium hover:text-primary transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {t('dashboard.quickTemplates.title')}
          {userTemplates.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({DEFAULT_TEMPLATES.length + userTemplates.length})
            </span>
          )}
        </button>
        {isExpanded && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-2 mr-1 text-muted-foreground hover:text-primary rounded-md hover:bg-secondary transition-colors"
            title="Create custom template"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Create Template Form */}
          {showCreateForm && (
            <div className="p-3 border-b border-border bg-secondary/30 space-y-2">
              <input
                type="text"
                placeholder="Template name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <textarea
                placeholder="Question (e.g. Show me the top 10 customers by revenue)"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="capitalize">
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCreate}
                  disabled={isSaving || !newName.trim() || !newQuestion.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          )}

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
              {t('common.filter')}
            </button>
            {ALL_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1 text-xs rounded-full capitalize transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {t(`dashboard.quickTemplates.${category}` as any)}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
            {filteredTemplates.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No templates in this category
              </p>
            )}
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="w-full p-2.5 text-left rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all group relative"
              >
                <button
                  onClick={() => onSelectTemplate(template.question)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className={`p-1.5 rounded ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom}`}>
                      {CATEGORY_ICONS[template.category] || CATEGORY_ICONS.custom}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">
                        {template.name}
                        {template.isUserTemplate && (
                          <span className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                            Custom
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </button>
                {template.isUserTemplate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(template.id)
                    }}
                    className="absolute top-2 right-2 p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
