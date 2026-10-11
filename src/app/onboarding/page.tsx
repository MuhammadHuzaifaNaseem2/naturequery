'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowRight } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import SettingsForm from '@/components/SettingsForm'
import { completeOnboarding } from '@/actions/onboarding'
import { useTranslation } from '@/contexts/LocaleContext'

const label = 'font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground'

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

  const firstName = session?.user?.name?.split(' ')[0] || ''

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-8">
        <AppLogo size="xs" textClassName="text-[15px] font-semibold tracking-[-0.01em]" />
        {/* Progress */}
        <div className="flex items-center gap-3">
          <span className={label}>
            {t('onboarding.progress', { step: String(step), total: '3' })}
          </span>
          <span
            className="block h-[3px] w-24 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step}
          >
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-16 pt-14 sm:pt-20">
        {/* Step 1: what NatureQuery does */}
        {step === 1 && (
          <section className="animate-fadeIn">
            <p className={label}>{t('onboarding.welcome.label')}</p>
            <h1 className="mt-4 text-balance font-serif text-[clamp(2.2rem,5vw,3.2rem)] font-normal leading-[1.05] tracking-[-0.02em]">
              {firstName
                ? t('onboarding.welcome.welcomeName', { name: firstName })
                : t('onboarding.welcome.title')}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {t('onboarding.welcome.description')}
            </p>

            <ol className="mt-10 border-t border-border">
              {[
                {
                  title: t('onboarding.welcome.connectDb'),
                  sub: t('onboarding.welcome.connectDbSub'),
                },
                {
                  title: t('onboarding.welcome.askPlain'),
                  sub: `“${t('onboarding.welcome.askPlainExample')}”`,
                  serif: true,
                },
                {
                  title: t('onboarding.welcome.instantResults'),
                  sub: t('onboarding.welcome.instantResultsSub'),
                },
              ].map((item, index) => (
                <li
                  key={item.title}
                  className="grid grid-cols-[2.5rem_1fr] gap-x-2 border-b border-border py-4"
                >
                  <span
                    className={`font-mono text-xs leading-6 ${index === 2 ? 'text-signal-ink' : 'text-primary'}`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium">{item.title}</p>
                    <p
                      className={
                        item.serif
                          ? 'mt-0.5 font-serif text-[15px] italic text-muted-foreground'
                          : 'mt-0.5 text-sm text-muted-foreground'
                      }
                    >
                      {item.sub}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button onClick={() => setStep(2)} className="btn-primary h-10 px-5">
                {t('common.getStarted')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={handleComplete} className="btn-ghost h-10 px-4">
                {t('onboarding.welcome.skipSetup')}
              </button>
            </div>
          </section>
        )}

        {/* Step 2: connect a database */}
        {step === 2 && (
          <section className="animate-fadeIn">
            <p className={label}>{t('onboarding.step1.label')}</p>
            <h1 className="mt-4 font-serif text-[clamp(2rem,4.4vw,2.8rem)] font-normal leading-[1.08] tracking-[-0.02em]">
              {t('onboarding.step1.title')}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {t('onboarding.step2.description')}
            </p>

            <div className="mt-8">
              <SettingsForm
                onConnectionSuccess={() => {
                  setConnectionAdded(true)
                  setStep(3)
                }}
                onClose={() => setStep(3)}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => setStep(1)} className="btn-ghost h-10 px-4">
                {t('common.back')}
              </button>
              <button onClick={() => setStep(3)} className="btn-secondary h-10 px-4">
                {t('onboarding.step2.skipStep')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: ready */}
        {step === 3 && (
          <section className="animate-fadeIn">
            <p className={label}>{t('onboarding.complete.label')}</p>
            <h1 className="mt-4 font-serif text-[clamp(2.2rem,5vw,3.2rem)] font-normal leading-[1.05] tracking-[-0.02em]">
              {t('onboarding.complete.title')}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {connectionAdded
                ? t('onboarding.complete.dbConnected')
                : t('onboarding.complete.noDatabase')}
            </p>

            <figure className="mt-10 border-l-0 border-t border-border pt-6">
              <figcaption className={label}>{t('onboarding.complete.tryAsking')}</figcaption>
              <blockquote className="mt-3 font-serif text-2xl italic leading-snug">
                “{t('onboarding.complete.exampleQuery')}”
              </blockquote>
            </figure>

            <button onClick={handleComplete} className="btn-primary mt-10 h-10 px-5">
              {t('onboarding.complete.goToDashboard')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
