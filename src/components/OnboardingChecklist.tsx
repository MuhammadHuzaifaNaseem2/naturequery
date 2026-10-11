'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  Circle,
  Database,
  MessageSquare,
  Pin,
  Users,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getChecklistState,
  dismissChecklist,
  type ChecklistState,
} from '@/actions/onboarding-checklist'
import { useTranslation } from '@/contexts/LocaleContext'

interface ChecklistStep {
  key: keyof Omit<ChecklistState, 'dismissed'>
  icon: typeof Database
  titleKey: string
  descriptionKey: string
}

const STEPS: ChecklistStep[] = [
  {
    key: 'connectedDb',
    icon: Database,
    titleKey: 'onboarding.checklist.steps.connectedDb',
    descriptionKey: 'onboarding.checklist.steps.connectedDbDesc',
  },
  {
    key: 'askedFirstQuestion',
    icon: MessageSquare,
    titleKey: 'onboarding.checklist.steps.askedFirstQuestion',
    descriptionKey: 'onboarding.checklist.steps.askedFirstQuestionDesc',
  },
  {
    key: 'pinnedChart',
    icon: Pin,
    titleKey: 'onboarding.checklist.steps.pinnedChart',
    descriptionKey: 'onboarding.checklist.steps.pinnedChartDesc',
  },
  {
    key: 'invitedTeamMember',
    icon: Users,
    titleKey: 'onboarding.checklist.steps.invitedTeamMember',
    descriptionKey: 'onboarding.checklist.steps.invitedTeamMemberDesc',
  },
  {
    key: 'setupSchedule',
    icon: Clock,
    titleKey: 'onboarding.checklist.steps.setupSchedule',
    descriptionKey: 'onboarding.checklist.steps.setupScheduleDesc',
  },
]

interface OnboardingChecklistProps {
  // Optional callbacks to trigger actions from the checklist
  onConnectDb?: () => void
  onAskQuestion?: () => void
  onInviteTeam?: () => void
}

export function OnboardingChecklist({
  onConnectDb,
  onAskQuestion,
  onInviteTeam,
}: OnboardingChecklistProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<ChecklistState | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    getChecklistState().then((res) => {
      if (res.success && res.data) {
        setState(res.data)
      }
    })
  }, [])

  // Listen for checklist events from the dashboard
  useEffect(() => {
    const handleChecklistEvent = (
      e: CustomEvent<{ item: keyof Omit<ChecklistState, 'dismissed'> }>
    ) => {
      setState((prev) => {
        if (!prev || prev[e.detail.item]) return prev
        return { ...prev, [e.detail.item]: true }
      })
    }

    window.addEventListener('onboarding:complete' as any, handleChecklistEvent)
    return () => window.removeEventListener('onboarding:complete' as any, handleChecklistEvent)
  }, [])

  const handleDismiss = useCallback(async () => {
    await dismissChecklist()
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev))
  }, [])

  if (!state || state.dismissed) return null

  const completedCount = STEPS.filter((s) => state[s.key]).length
  const totalSteps = STEPS.length
  const progress = Math.round((completedCount / totalSteps) * 100)
  const allDone = completedCount === totalSteps

  // Show confetti when all done
  if (allDone && !showConfetti) {
    setShowConfetti(true)
    // Auto-dismiss after celebration
    setTimeout(() => handleDismiss(), 5000)
  }

  if (allDone && showConfetti) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-card p-3 animate-fadeIn">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('onboarding.checklist.allSet')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('onboarding.checklist.allSetDescription')}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label={t('onboarding.checklist.dismiss')}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-2 animate-fadeIn">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {/* Header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          className="w-full px-3 pb-2.5 pt-3 text-left transition-colors hover:bg-secondary/40"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t('onboarding.checklist.gettingStarted')}</span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {completedCount}/{totalSteps}
              </span>
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
            </span>
          </span>
          {/* Progress */}
          <span
            className="mt-2.5 block h-[3px] overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={`${completedCount} of ${totalSteps} ${t('onboarding.checklist.completed')}`}
          >
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </span>
        </button>

        {/* Steps */}
        {!isCollapsed && (
          <div className="space-y-0.5 border-t border-border px-1.5 pb-2 pt-1.5">
            {STEPS.map((step) => {
              const done = state[step.key]
              return (
                <div
                  key={step.key}
                  className={clsx(
                    'flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors',
                    done ? 'text-muted-foreground' : 'cursor-pointer hover:bg-secondary/60'
                  )}
                  onClick={() => {
                    if (done) return
                    if (step.key === 'connectedDb') onConnectDb?.()
                    if (step.key === 'askedFirstQuestion') onAskQuestion?.()
                    if (step.key === 'invitedTeamMember') onInviteTeam?.()
                  }}
                >
                  {done ? (
                    <CheckCircle2
                      className="mt-px h-4 w-4 flex-shrink-0 text-primary"
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="mt-px h-4 w-4 flex-shrink-0 text-muted-foreground/50"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-xs font-medium', done && 'line-through')}>
                      {t(step.titleKey as any)}
                    </p>
                    {!done && (
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {t(step.descriptionKey as any)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Dismiss link */}
            <div className="flex justify-end px-2 pt-1">
              <button
                onClick={handleDismiss}
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('onboarding.checklist.dismiss')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
