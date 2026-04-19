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
  Trophy,
  Sparkles,
  PartyPopper,
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
  { key: 'connectedDb', icon: Database, titleKey: 'onboarding.checklist.steps.connectedDb', descriptionKey: 'onboarding.checklist.steps.connectedDbDesc' },
  { key: 'askedFirstQuestion', icon: MessageSquare, titleKey: 'onboarding.checklist.steps.askedFirstQuestion', descriptionKey: 'onboarding.checklist.steps.askedFirstQuestionDesc' },
  { key: 'pinnedChart', icon: Pin, titleKey: 'onboarding.checklist.steps.pinnedChart', descriptionKey: 'onboarding.checklist.steps.pinnedChartDesc' },
  { key: 'invitedTeamMember', icon: Users, titleKey: 'onboarding.checklist.steps.invitedTeamMember', descriptionKey: 'onboarding.checklist.steps.invitedTeamMemberDesc' },
  { key: 'setupSchedule', icon: Clock, titleKey: 'onboarding.checklist.steps.setupSchedule', descriptionKey: 'onboarding.checklist.steps.setupScheduleDesc' },
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
    const handleChecklistEvent = (e: CustomEvent<{ item: keyof Omit<ChecklistState, 'dismissed'> }>) => {
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
      <div className="mb-2 p-3 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-success/10 border border-primary/20 animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <PartyPopper className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{t('onboarding.checklist.allSet')}</p>
            <p className="text-xs text-muted-foreground">{t('onboarding.checklist.allSetDescription')}</p>
          </div>
          <button onClick={handleDismiss} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-2 animate-fadeIn">
      <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">{t('onboarding.checklist.gettingStarted')}</p>
              <p className="text-[10px] text-muted-foreground">{completedCount}/{totalSteps} {t('onboarding.checklist.completed')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress ring */}
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 transform -rotate-90">
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-secondary"
                />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="text-primary transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">
                {progress}%
              </span>
            </div>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Steps */}
        {!isCollapsed && (
          <div className="px-4 pb-3 space-y-1">
            {STEPS.map((step) => {
              const done = state[step.key]
              const Icon = step.icon
              return (
                <div
                  key={step.key}
                  className={clsx(
                    'flex items-start gap-3 p-2.5 rounded-lg transition-all',
                    done ? 'opacity-60' : 'hover:bg-secondary/40 cursor-pointer'
                  )}
                  onClick={() => {
                    if (done) return
                    if (step.key === 'connectedDb') onConnectDb?.()
                    if (step.key === 'askedFirstQuestion') onAskQuestion?.()
                    if (step.key === 'invitedTeamMember') onInviteTeam?.()
                  }}
                >
                  <div className="mt-0.5">
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-xs font-medium', done && 'line-through text-muted-foreground')}>
                      {t(step.titleKey as any)}
                    </p>
                    {!done && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t(step.descriptionKey as any)}</p>
                    )}
                  </div>
                  {!done && (
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Dismiss link */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleDismiss}
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
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
