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
          aria-expanded={isExpanded}
          className="flex-1 flex items-center gap-1.5 px-4 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {t('dashboard.quickTemplates.title')}
          {userTemplates.length > 0 && (
            <span className="tabular-nums">{DEFAULT_TEMPLATES.length + userTemplates.length}</span>
          )}
        </button>
        {isExpanded && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-1.5 mr-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            title="Create custom template"
            aria-label="Create custom template"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Create Template Form */}
          {showCreateForm && (
            <div className="p-3 border-b border-border space-y-2">
              <input
                type="text"
                placeholder="Template name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
              />
              <textarea
                placeholder="Question (e.g. Show me the top 10 customers by revenue)"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 font-serif text-sm rounded-md border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-md border border-input bg-card text-foreground focus:outline-none focus:border-foreground/40"
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
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  {isSaving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          )}

          {/* Category filters */}
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                selectedCategory === null
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('common.filter')}
            </button>
            {ALL_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1 text-xs rounded-md capitalize transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`dashboard.quickTemplates.${category}` as any)}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="p-1.5 space-y-0.5 max-h-[300px] overflow-y-auto">
            {filteredTemplates.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No templates in this category
              </p>
            )}
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="w-full px-2.5 py-2 text-left rounded-md hover:bg-secondary/60 transition-colors group relative"
              >
                <button
                  onClick={() => onSelectTemplate(template.question)}
                  className="w-full text-left"
                >
                  <div className="min-w-0 pr-5">
                    <p className="text-sm text-foreground">
                      {template.name}
                      {template.isUserTemplate && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                          Custom
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {template.description}
                    </p>
                  </div>
                </button>
                {template.isUserTemplate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(template.id)
                    }}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete template"
                    aria-label={`Delete template ${template.name}`}
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
