'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pause, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  runReconciliationMonitorNow,
  setReconciliationMonitorEnabled,
} from '@/actions/reconciliation-monitors'

export function MonitorActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [toggling, setToggling] = useState(false)

  const runNow = async () => {
    setRunning(true)
    const response = await runReconciliationMonitorNow(id)
    setRunning(false)
    if (!response.success || !response.data) {
      toast.error('Monitor run failed', { description: response.error })
    } else if (response.data.status === 'alert') {
      toast.error('Difference detected', {
        description: 'NatureQuery created a new investigation and notification.',
      })
    } else if (response.data.status === 'within_threshold') {
      toast.warning('Differences found below your alert threshold')
    } else {
      toast.success('Reports match within the comparison tolerance')
    }
    router.refresh()
  }

  const toggle = async () => {
    setToggling(true)
    const response = await setReconciliationMonitorEnabled(id, !enabled)
    setToggling(false)
    if (!response.success) toast.error('Could not update monitor', { description: response.error })
    else toast.success(enabled ? 'Monitor paused' : 'Monitor resumed')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={runNow} disabled={running} className="btn-gradient text-xs">
        {running ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        {running ? 'Running...' : 'Run now'}
      </button>
      <button onClick={toggle} disabled={toggling} className="btn-secondary text-xs">
        {toggling ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : enabled ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {enabled ? 'Pause' : 'Resume'}
      </button>
    </div>
  )
}
