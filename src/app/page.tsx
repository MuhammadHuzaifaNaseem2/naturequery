'use client'

import { X } from 'lucide-react'
import SettingsForm from '@/components/SettingsForm'
import { ShortcutsHelp } from '@/hooks/useKeyboardShortcuts'
import { useDashboard } from './dashboard/useDashboard'
import { ConnectionSidebar } from './dashboard/ConnectionSidebar'
import { WorkspaceHeader } from './dashboard/WorkspaceHeader'
import { QueryPanel } from './dashboard/QueryPanel'
import { RightSidebar } from './dashboard/RightSidebar'

export default function DashboardPage() {
  const dashboard = useDashboard()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar */}
      <ConnectionSidebar
        connections={dashboard.connections}
        filteredConnections={dashboard.filteredConnections}
        activeConnectionId={dashboard.activeConnectionId}
        searchQuery={dashboard.searchQuery}
        onSearchChange={dashboard.setSearchQuery}
        onSelectConnection={dashboard.handleSelectConnection}
        onDeleteConnection={dashboard.handleDeleteConnection}
        onAddConnection={() => dashboard.setShowAddConnection(true)}
        onAddDemoConnection={dashboard.handleAddDemoConnection}
        onSelectTemplate={dashboard.handleSelectTemplate}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <WorkspaceHeader
          activeConnection={dashboard.activeConnection}
          queryHistory={dashboard.queryHistory}
          showHistory={dashboard.showHistory}
          onToggleHistory={() => {
            dashboard.setShowHistory(!dashboard.showHistory)
            if (!dashboard.showHistory) dashboard.setShowSchema(false)
          }}
          onShowShortcuts={() => dashboard.setShowShortcutsHelp(true)}
          showProfileMenu={dashboard.showProfileMenu}
          onToggleProfileMenu={() => dashboard.setShowProfileMenu(!dashboard.showProfileMenu)}
          profileRef={dashboard.profileRef}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <QueryPanel
            activeConnection={dashboard.activeConnection}
            nlQuery={dashboard.nlQuery}
            onNlQueryChange={dashboard.setNlQuery}
            generatedSQL={dashboard.generatedSQL}
            isGenerating={dashboard.isGenerating}
            isExecuting={dashboard.isExecuting}
            isExporting={dashboard.isExporting}
            queryResults={dashboard.queryResults}
            error={dashboard.error}
            showExportMenu={dashboard.showExportMenu}
            onToggleExportMenu={dashboard.setShowExportMenu}
            onGenerateSQL={dashboard.handleGenerateSQL}
            onExecuteSQL={dashboard.handleExecuteSQL}
            onExport={dashboard.handleExport}
            onSaveQuery={dashboard.handleSaveQuery}
            queryInputRef={dashboard.queryInputRef}
          />

          {/* Right Sidebar */}
          {dashboard.activeConnection && (
            <RightSidebar
              activeConnection={dashboard.activeConnection}
              showSchema={dashboard.showSchema}
              showHistory={dashboard.showHistory}
              onShowSchema={() => {
                dashboard.setShowHistory(false)
                dashboard.setShowSchema(true)
              }}
              onShowHistory={() => {
                dashboard.setShowSchema(false)
                dashboard.setShowHistory(true)
              }}
              queryHistory={dashboard.queryHistory}
              onSelectHistoryItem={dashboard.handleSelectHistoryItem}
              onClearHistory={() => dashboard.setQueryHistory([])}
              nlQuery={dashboard.nlQuery}
              onNlQueryChange={dashboard.setNlQuery}
              savedQueries={dashboard.savedQueries}
              onSelectSavedQuery={dashboard.handleSelectSavedQuery}
              onDeleteSavedQuery={dashboard.handleDeleteSavedQuery}
              activeConnectionId={dashboard.activeConnectionId}
            />
          )}
        </div>
      </main>

      {/* Add Connection Modal */}
      {dashboard.showAddConnection && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="relative animate-scaleIn">
            <button
              onClick={() => dashboard.setShowAddConnection(false)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors z-10 shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
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

      {/* Click outside to close export menu */}
      {dashboard.showExportMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => dashboard.setShowExportMenu(false)}
        />
      )}
    </div>
  )
}
