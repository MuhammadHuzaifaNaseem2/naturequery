import { useState, useRef, useEffect } from 'react'

export function useDashboardUI() {
  // Mobile sidebar state
  const [showLeftSidebar, setShowLeftSidebar] = useState(false)
  const [showRightSidebar, setShowRightSidebar] = useState(false)

  // Command palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showAddConnection, setShowAddConnection] = useState(false)
  
  // UI toggles
  const [showHistory, setShowHistory] = useState(false)
  const [showSchema, setShowSchema] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showScheduler, setShowScheduler] = useState(false)

  // Plan Limits
  const [showPlanLimit, setShowPlanLimit] = useState(false)
  const [planLimitReason, setPlanLimitReason] = useState<'query' | 'connection'>('connection')

  // Refs
  const queryInputRef = useRef<HTMLTextAreaElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  return {
    showLeftSidebar, setShowLeftSidebar,
    showRightSidebar, setShowRightSidebar,
    showCommandPalette, setShowCommandPalette,
    showAddConnection, setShowAddConnection,
    showHistory, setShowHistory,
    showSchema, setShowSchema,
    showExportMenu, setShowExportMenu,
    showShortcutsHelp, setShowShortcutsHelp,
    showProfileMenu, setShowProfileMenu,
    searchQuery, setSearchQuery,
    showScheduler, setShowScheduler,
    showPlanLimit, setShowPlanLimit,
    planLimitReason, setPlanLimitReason,
    queryInputRef, profileRef
  }
}
