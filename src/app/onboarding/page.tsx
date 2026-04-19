'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppLogo } from '@/components/AppLogo'
import { Database, MessageSquare, ArrowRight, Sparkles, SkipForward } from 'lucide-react'
import SettingsForm from '@/components/SettingsForm'
import { completeOnboarding } from '@/actions/onboarding'
import { useTranslation } from '@/contexts/LocaleContext'

export default function OnboardingPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session, update } = useSession()
  const [step, setStep] = useState(1)
  const [connectionAdded, setConnectionAdded] = useState(false)

  const handleComplete = async () => {
    await completeOnboarding()
    // Update the JWT token so middleware knows onboarding is done
    await update({ onboardingCompleted: true })
    router.push('/dashboard')
    router.refresh()
  }

  const handleSkip = async () => {
    await handleComplete()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-primary' : s < step ? 'w-8 bg-primary/40' : 'w-8 bg-secondary'
                }`}
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">{step}/3</span>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="glass-card rounded-2xl p-8 text-center animate-fadeIn">
            <div className="flex justify-center mb-6">
              <AppLogo size="2xl" showText={false} />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {t('onboarding.welcome.welcomeName', { name: session?.user?.name?.split(' ')[0] || '' })}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t('onboarding.welcome.description')}
            </p>

            <div className="space-y-3 text-left mb-8">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                <Database className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('onboarding.welcome.connectDb')}</p>
                  <p className="text-xs text-muted-foreground">{t('onboarding.welcome.connectDbSub')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                <MessageSquare className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('onboarding.welcome.askPlain')}</p>
                  <p className="text-xs text-muted-foreground">{t('onboarding.welcome.askPlainExample')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{t('onboarding.welcome.instantResults')}</p>
                  <p className="text-xs text-muted-foreground">{t('onboarding.welcome.instantResultsSub')}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSkip} className="btn-secondary flex-1 text-sm">
                <SkipForward className="w-4 h-4 mr-1" />
                {t('common.skip')}
              </button>
              <button onClick={() => setStep(2)} className="btn-gradient flex-1">
                {t('common.getStarted')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connect a database */}
        {step === 2 && (
          <div className="glass-card rounded-2xl p-8 animate-fadeIn">
            <h2 className="text-xl font-bold mb-1">{t('onboarding.step1.title')}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t('onboarding.step2.description')}
            </p>

            <SettingsForm
              onConnectionSuccess={() => {
                setConnectionAdded(true)
                setStep(3)
              }}
              onClose={() => setStep(3)}
            />

            <div className="mt-4 flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 text-sm">
                {t('common.back')}
              </button>
              <button onClick={() => setStep(3)} className="btn-secondary flex-1 text-sm">
                {t('onboarding.step2.skipStep')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Try your first query */}
        {step === 3 && (
          <div className="glass-card rounded-2xl p-8 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">{t('onboarding.complete.title')}</h2>
            <p className="text-muted-foreground mb-6">
              {connectionAdded
                ? t('onboarding.complete.dbConnected')
                : t('onboarding.complete.noDatabase')}
            </p>

            <div className="p-4 rounded-xl bg-secondary/30 mb-6">
              <p className="text-xs text-muted-foreground mb-2">{t('onboarding.complete.tryAsking')}</p>
              <p className="text-sm font-medium italic">{t('onboarding.complete.exampleQuery')}</p>
            </div>

            <button onClick={handleComplete} className="btn-gradient w-full">
              {t('onboarding.complete.goToDashboard')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
