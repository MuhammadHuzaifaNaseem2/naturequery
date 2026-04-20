'use client'

import { X } from 'lucide-react'
import SettingsForm from '@/components/SettingsForm'
import { ShortcutsHelp } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/CommandPalette'
import { QueryScheduler } from '@/components/QueryScheduler'
import { useDashboard } from './useDashboard'
import { ConnectionSidebar } from './ConnectionSidebar'
import { WorkspaceHeader } from './WorkspaceHeader'
import { QueryPanel } from './QueryPanel'
import { RightSidebar } from './RightSidebar'
import { StatusBar } from './StatusBar'
import { ProductTour } from '@/components/ProductTour'
import { TrialBanner } from '@/components/TrialBanner'
import { DashboardWidgets } from '@/components/DashboardWidgets'
import { NotificationCenter } from '@/components/NotificationCenter'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'
import { PlanLimitModal } from '@/components/PlanLimitModal'
import { useState, useEffect } from 'react'

export default function DashboardPage() {
  const dashboard = useDashboard()
  const [viewMode, setViewMode] = useState<'editor' | 'dashboard'>('editor')

  useEffect(() => {
    const handleSwitch = () => setViewMode('dashboard')
    window.addEventListener('switchToDashboard', handleSwitch)
    return () => window.removeEventListener('switchToDashboard', handleSwitch)
  }, [])

  const rightSidebarProps = {
    activeConnection: dashboard.activeConnection!,
    showSchema: dashboard.showSchema,
    showHistory: dashboard.showHistory,
    onShowSchema: () => {
      dashboard.setShowHistory(false)
      dashboard.setShowSchema(true)
    },
    onShowHistory: () => {
      dashboard.setShowSchema(false)
      dashboard.setShowHistory(true)
    },
    queryHistory: dashboard.queryHistory,
    queryHistoryTotal: dashboard.queryHistoryTotal,
    onSelectHistoryItem: dashboard.handleSelectHistoryItem,
    onClearHistory: dashboard.handleClearHistory,
    onDeleteHistoryEntry: dashboard.handleDeleteHistoryEntry,
    nlQuery: dashboard.nlQuery,
    onNlQueryChange: dashboard.setNlQuery,
    savedQueries: dashboard.savedQueries,
    onSelectSavedQuery: dashboard.handleSelectSavedQuery,
    onDeleteSavedQuery: dashboard.handleDeleteSavedQuery,
    onToggleFavorite: dashboard.handleToggleFavorite,
    onShareQuery: dashboard.handleShareQuery,
    activeConnectionId: dashboard.activeConnectionId,
    isLoading: !dashboard.connectionsLoaded,
    onRefreshSchema: dashboard.handleRefreshSchema,
    isRefreshingSchema: dashboard.isRefreshingSchema,
  }

  const connectionSidebarProps = {
    connections: dashboard.connections,
    filteredConnections: dashboard.filteredConnections,
    activeConnectionId: dashboard.activeConnectionId,
    searchQuery: dashboard.searchQuery,
    onSearchChange: dashboard.setSearchQuery,
    onSelectConnection: dashboard.handleSelectConnection,
    onDeleteConnection: dashboard.handleDeleteConnection,
    onAddConnection: () => dashboard.setShowAddConnection(true),
    onAddDemoConnection: dashboard.handleAddDemoConnection,
    onSelectTemplate: dashboard.handleSelectTemplate,
    onNewChat: () => {
      dashboard.setNlQuery('')
      dashboard.queryInputRef.current?.focus()
    },
    isLoading: !dashboard.connectionsLoaded,
    onUploadCSV: dashboard.handleUploadCSV,
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar - Desktop: always visible */}
      <div className="hidden lg:block">
        <ConnectionSidebar {...connectionSidebarProps} />
      </div>

      {/* Left Sidebar - Mobile overlay */}
      {dashboard.showLeftSidebar && (
        <>
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => dashboard.setShowLeftSidebar(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-slideInLeft">
            <ConnectionSidebar
              {...connectionSidebarProps}
              onClose={() => dashboard.setShowLeftSidebar(false)}
            />
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TrialBanner />
        <WorkspaceHeader
          activeConnection={dashboard.activeConnection}
          queryHistory={dashboard.queryHistory}
          queryHistoryTotal={dashboard.queryHistoryTotal}
          showHistory={dashboard.showHistory}
          onToggleHistory={() => {
            const opening = !dashboard.showHistory
            dashboard.setShowHistory(opening)
            if (opening) {
              dashboard.setShowSchema(false)
              dashboard.setShowRightSidebar(true)
            }
          }}
          onShowShortcuts={() => dashboard.setShowShortcutsHelp(true)}
          showProfileMenu={dashboard.showProfileMenu}
          onToggleProfileMenu={() => dashboard.setShowProfileMenu(!dashboard.showProfileMenu)}
          profileRef={dashboard.profileRef}
          onToggleLeftSidebar={() => dashboard.setShowLeftSidebar(!dashboard.showLeftSidebar)}
          onToggleRightSidebar={() => dashboard.setShowRightSidebar(!dashboard.showRightSidebar)}
          onOpenCommandPalette={() => dashboard.setShowCommandPalette(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden bg-secondary/10">
          {viewMode === 'editor' ? (
            <QueryPanel
              isLoading={!dashboard.connectionsLoaded}
              activeConnection={dashboard.activeConnection}
              nlQuery={dashboard.nlQuery}
              onNlQueryChange={(q) => {
                dashboard.setNlQuery(q)
                if (dashboard.error) dashboard.setError(null)
              }}
              generatedSQL={dashboard.generatedSQL}
              onSQLChange={dashboard.setGeneratedSQL}
              isGenerating={dashboard.isGenerating}
              isExecuting={dashboard.isExecuting}
              isExporting={dashboard.isExporting}
              isFixing={dashboard.isFixing}
              queryResults={dashboard.queryResults}
              error={dashboard.error}
              showExportMenu={dashboard.showExportMenu}
              onToggleExportMenu={dashboard.setShowExportMenu}
              onGenerateSQL={dashboard.handleGenerateSQL}
              onStreamingSQL={dashboard.handleStreamingSQL}
              onExecuteSQL={dashboard.handleExecuteSQL}
              onFixQuery={dashboard.handleFixSQL}
              onExport={dashboard.handleExport}
              onSaveQuery={dashboard.handleSaveQuery}
              onScheduleQuery={dashboard.handleOpenScheduler}
              onPinToDashboard={dashboard.handlePinToDashboard}
              queryInputRef={dashboard.queryInputRef}
              insights={dashboard.insights}
              isAnalyzing={dashboard.isAnalyzing}
              onAnalyze={dashboard.handleAnalyze}
              onFollowUpClick={dashboard.handleFollowUpClick}
              onAddDemoConnection={dashboard.handleAddDemoConnection}
              onAddConnection={() => dashboard.setShowAddConnection(true)}
              queryHistory={dashboard.queryHistory}
              savedQueries={dashboard.savedQueries}
              schemaSuggestions={dashboard.schemaSuggestions}
              isDiscovering={dashboard.isDiscovering}
              conversationLength={dashboard.conversationLength}
              conversationContext={dashboard.conversationContext}
              onClearConversation={dashboard.handleClearConversation}
              activeFilters={dashboard.activeFilters}
              isApplyingFilter={dashboard.isApplyingFilter}
              onAddFilter={dashboard.handleAddFilter}
              onRemoveFilter={dashboard.handleRemoveFilter}
              onClearFilters={dashboard.handleClearFilters}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <DashboardWidgets
                widgets={dashboard.dashboardWidgets}
                onAddWidget={() => {}} // Usually done from QueryPanel
                onRemoveWidget={dashboard.handleRemoveWidget}
                onRefreshWidget={dashboard.handleRefreshWidget}
                onReorderWidgets={dashboard.handleReorderWidgets}
                isRefreshing={dashboard.isRefreshingWidget}
              />
            </div>
          )}

          {/* Right Sidebar - Desktop: always visible */}
          {dashboard.activeConnection && (
            <div className="hidden lg:block">
              <RightSidebar {...rightSidebarProps} />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <StatusBar
          activeConnection={dashboard.activeConnection}
          queryResults={dashboard.queryResults}
          queryHistory={dashboard.queryHistory}
          queryHistoryTotal={dashboard.queryHistoryTotal}
        />
      </main>

      {/* Right Sidebar - Mobile overlay */}
      {dashboard.showRightSidebar && dashboard.activeConnection && (
        <>
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => dashboard.setShowRightSidebar(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 lg:hidden animate-slideInRight">
            <RightSidebar {...rightSidebarProps} />
          </div>
        </>
      )}

      {/* Command Palette */}
      <CommandPalette
        open={dashboard.showCommandPalette}
        onOpenChange={dashboard.setShowCommandPalette}
        connections={dashboard.connections}
        activeConnectionId={dashboard.activeConnectionId}
        onSelectConnection={dashboard.handleSelectConnection}
        queryHistory={dashboard.queryHistory}
        savedQueries={dashboard.savedQueries}
        onSelectQuery={(question, sql) => {
          dashboard.setNlQuery(question)
        }}
        onExport={dashboard.handleExport}
        onClearHistory={dashboard.handleClearHistory}
        onNewQuery={() => {
          dashboard.setNlQuery('')
          dashboard.queryInputRef.current?.focus()
        }}
      />

      {/* Add Connection Modal */}
      {dashboard.showAddConnection && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="relative animate-scaleIn">
            <SettingsForm
              onSchemaFetched={() => {}}
              onConnectionSuccess={(credentials, schema) => {
                dashboard.handleAddConnection(credentials, schema)
              }}
              onClose={() => dashboard.setShowAddConnection(false)}
            />
          </div>
        </div>
      )}

      {/* Shortcuts Help Modal */}
      {dashboard.showShortcutsHelp && (
        <ShortcutsHelp onClose={() => dashboard.setShowShortcutsHelp(false)} />
      )}

      {/* Query Scheduler Modal */}
      {dashboard.showScheduler && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="relative w-full max-w-3xl animate-scaleIn">
            <button
              onClick={dashboard.handleCloseScheduler}
              className="absolute -top-2 -right-2 w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors z-10 shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <QueryScheduler
              queries={dashboard.scheduledQueries}
              onCreateSchedule={dashboard.handleCreateSchedule}
              onDeleteSchedule={dashboard.handleDeleteSchedule}
              onToggleSchedule={dashboard.handleToggleSchedule}
              onEditSchedule={() => {}}
              currentQuestion={dashboard.schedulerContext?.question}
              currentSql={dashboard.schedulerContext?.sql}
              connectionId={dashboard.activeConnectionId ?? ''}
              connectionName={dashboard.activeConnection?.name ?? ''}
            />
          </div>
        </div>
      )}

      {/* Product Tour */}
      <ProductTour />

      {/* Plan Limit Modal */}
      {dashboard.showPlanLimit && (
        <PlanLimitModal
          onClose={() => dashboard.setShowPlanLimit(false)}
          reason={dashboard.planLimitReason}
          title={
            dashboard.planLimitReason === 'query'
              ? 'Query Limit Reached'
              : 'Connection Limit Reached'
          }
          description={
            dashboard.planLimitReason === 'query'
              ? "You've reached the maximum number of queries allowed on the Free plan this month."
              : "You've reached the maximum number of database connections allowed on the Free plan."
          }
        />
      )}
    </div>
  )
}
