import { useCallback, useMemo, useRef } from 'react'
import { Bookmark, PanelLeft, Play, Square, WandSparkles } from 'lucide-react'
import { SQLEditor } from '@web/components/SQLEditor'
import { DB_TYPE_INFO, usesSql } from '@shared/db-types'
import { Button, IconButton, Kbd, modKey } from '../../components/ui'
import { formatSql, editorMode } from '../../lib/sql'
import { isDarkTheme } from '../../lib/theme'
import {
  cancelTab,
  openDialog,
  runTab,
  setTabSql,
  toggleSchemaPanel,
  useApp,
  useConnection,
  type QueryTab,
} from '../../store/app-store'

export function QueryEditor({ tab }: { tab: QueryTab }) {
  const connection = useConnection(tab.connectionId)
  const schema = useApp((state) => state.schemas[tab.connectionId]?.snapshot)
  const dark = useApp((state) => isDarkTheme(state.resolvedTheme))
  const fontSize = useApp((state) => state.settings.editorFontSize)
  const schemaOpen = useApp((state) => state.schemaPanelOpen)

  // The shared editor captures its callbacks once when it mounts, so route
  // them through refs that always point at the current tab.
  const tabRef = useRef(tab)
  tabRef.current = tab
  const onChange = useCallback((value: string) => setTabSql(tabRef.current.id, value), [])
  const onExecute = useCallback(() => void runTab(tabRef.current.id), [])

  const completionSchema = useMemo(
    () =>
      schema
        ? {
            tables: schema.tables.map((table) => ({
              tableName: table.qualifiedName,
              columns: table.columns.map((column) => ({
                name: column.name,
                type: column.type,
                nullable: column.nullable,
                defaultValue: null,
                isPrimaryKey: column.isPrimaryKey,
              })),
            })),
          }
        : undefined,
    [schema]
  )

  if (!connection) return null
  const running = tab.status === 'running'
  const sqlBased = usesSql(connection.type)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border/70 px-2">
        <IconButton
          label={schemaOpen ? 'Hide tables' : 'Show tables'}
          active={schemaOpen}
          onClick={toggleSchemaPanel}
        >
          <PanelLeft className="h-4 w-4" />
        </IconButton>
        <div className="mx-1 h-4 w-px bg-border" />
        {running ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Square className="h-3 w-3 fill-current" />}
            onClick={() => void cancelTab(tab.id)}
          >
            Cancel
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon={<Play className="h-3 w-3 fill-current" />}
            onClick={() => void runTab(tab.id)}
            disabled={!tab.sql.trim()}
          >
            Run
          </Button>
        )}
        <span className="hidden items-center gap-1 pl-1 text-[11px] text-muted-foreground lg:flex">
          <Kbd>{modKey()}</Kbd>
          <Kbd>Enter</Kbd>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<WandSparkles className="h-3.5 w-3.5" />}
            onClick={() => setTabSql(tab.id, formatSql(connection.type, tab.sql))}
            disabled={!tab.sql.trim()}
            title="Format the query for readability"
          >
            Format
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Bookmark className="h-3.5 w-3.5" />}
            onClick={() => openDialog({ kind: 'save-query', tabId: tab.id })}
            disabled={!tab.sql.trim()}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="nq-editor-fill min-h-0 flex-1" style={{ fontSize }}>
        <SQLEditor
          key={tab.id}
          value={tab.sql}
          onChange={onChange}
          onExecute={onExecute}
          schema={completionSchema}
          dbType={editorMode(connection.type)}
          isDark={dark}
          height="100%"
          placeholder={
            sqlBased
              ? `Write a ${DB_TYPE_INFO[connection.type].label} query.\n\nPress ${modKey()}+Enter to run, ${modKey()}+Space for suggestions.`
              : 'Write a query as JSON, for example:\n{ "collection": "orders", "pipeline": [{ "$limit": 50 }] }'
          }
        />
      </div>
    </div>
  )
}
