'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useTranslation } from '@/contexts/LocaleContext'
import { useSession } from 'next-auth/react'
import { completeOnboarding } from '@/actions/onboarding'

export function ProductTour() {
    const { t } = useTranslation()
    const { data: session, update } = useSession()
    const driverRef = useRef<any>(null)

    useEffect(() => {
        // If session isn't loaded yet, or user has already completed the tour, do nothing
        if (!session?.user || session.user.onboardingCompleted) return;

        const startTour = async () => {
            // High-reliability check: Only start if the first step element is physically present in the DOM
            const step1 = document.querySelector('.tour-step-1')
            if (!step1) return false;

            const driverObj = driver({
                showProgress: true,
                nextBtnText: (t('common.next') || 'Next') + ' →',
                prevBtnText: '← ' + (t('common.back') || 'Back'),
                doneBtnText: '🎉 ' + (t('common.finish') || 'Done'),
                popoverClass: 'driverjs-theme',
                overlayOpacity: 0.45,
                stagePadding: 10,
                stageRadius: 10,
                smoothScroll: true,
                allowClose: true,
                steps: [
                    { element: '.tour-step-1', popover: { title: '⚡ Connect in Seconds', description: 'Link your PostgreSQL, MySQL, or SQLite database — or launch our 1-click sandbox to explore instantly. No setup required.', side: "bottom", align: 'start' } },
                    { element: '.tour-step-2', popover: { title: '✨ Ask in Plain English', description: 'Type any question about your data in natural language. Our AI generates accurate SQL instantly — no query expertise needed.', side: "bottom", align: 'start' } },
                    { element: '.tour-step-3', popover: { title: '📋 History & Saved Queries', description: 'Every query is logged automatically. Revisit, rerun, or bookmark your best queries to build a personal library of insights.', side: "bottom", align: 'start' } },
                    { element: '.tour-step-4', popover: { title: '🎛️ Your Command Center', description: 'Access your profile, billing, team settings, and admin controls — everything in one place, always one click away.', side: "bottom", align: 'end' } },
                ],
                onDestroyStarted: async () => {
                    // Mark as completed in Database
                    try {
                        await completeOnboarding()
                        // Update local session immediately so the tour doesn't trigger again
                        await update({ onboardingCompleted: true })
                        localStorage.setItem('naturequery-tour-completed', 'true')
                    } catch (err) {
                        console.error('Failed to update onboarding status:', err)
                    }
                    driverObj.destroy();
                },
            });

            driverRef.current = driverObj;
            driverObj.drive();
            return true;
        }

        // Poll for the step elements to be ready in the dashboard
        const checkInterval = setInterval(async () => {
            const started = await startTour();
            if (started) {
                clearInterval(checkInterval);
            }
        }, 600);

        // Fail-safe cleanup after 10 seconds
        const failSafeCleanup = setTimeout(() => clearInterval(checkInterval), 10000);

        return () => {
            clearInterval(checkInterval)
            clearTimeout(failSafeCleanup)
            if (driverRef.current) {
                driverRef.current.destroy()
            }
        }
    }, [session, t, update])

    // External listener for manual restart button
    useEffect(() => {
        const handleRestart = async () => {
            // Even for manual restart, we check if elements are ready
            const driverObj = driver({
                showProgress: true,
                nextBtnText: (t('common.next') || 'Next') + ' →',
                prevBtnText: '← ' + (t('common.back') || 'Back'),
                doneBtnText: '🎉 ' + (t('common.finish') || 'Done'),
                popoverClass: 'driverjs-theme',
                overlayOpacity: 0.45,
                stagePadding: 10,
                stageRadius: 10,
                smoothScroll: true,
                allowClose: true,
                steps: [
                    { element: '.tour-step-1', popover: { title: '⚡ Connect in Seconds', description: 'Link your PostgreSQL, MySQL, or SQLite database — or launch our 1-click sandbox to explore instantly. No setup required.', side: "bottom", align: 'start' } },
                    { element: '.tour-step-2', popover: { title: '✨ Ask in Plain English', description: 'Type any question about your data in natural language. Our AI generates accurate SQL instantly — no query expertise needed.', side: "bottom", align: 'start' } },
                    { element: '.tour-step-3', popover: { title: '📋 History & Saved Queries', description: 'Every query is logged automatically. Revisit, rerun, or bookmark your best queries to build a personal library of insights.', side: "bottom", align: 'start' } },
                    { element: '.tour-step-4', popover: { title: '🎛️ Your Command Center', description: 'Access your profile, billing, team settings, and admin controls — everything in one place, always one click away.', side: "bottom", align: 'end' } },
                ],
            });
            driverObj.drive();
        }

        window.addEventListener('restart-product-tour', handleRestart)
        return () => window.removeEventListener('restart-product-tour', handleRestart)
    }, [t])

    return null
}
