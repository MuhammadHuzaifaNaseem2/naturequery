import type {
  ConnectionConfig,
  ConnectionSecrets,
  Envelope,
  QueryResult,
  SchemaSnapshot,
  TestResult,
} from './types'

/**
 * Messages between the main process and the database engine utility process.
 * Credentials travel only over this local channel and never reach the renderer.
 */
export type EngineRequest =
  | { kind: 'test'; config: ConnectionConfig; secrets: ConnectionSecrets; timeoutMs: number }
  | { kind: 'schema'; config: ConnectionConfig; secrets: ConnectionSecrets; timeoutMs: number }
  | {
      kind: 'query'
      config: ConnectionConfig
      secrets: ConnectionSecrets
      text: string
      queryId: string
      rowLimit: number
      timeoutMs: number
    }
  | { kind: 'cancel'; queryId: string }
  | { kind: 'release'; connectionId: string }
  | { kind: 'ping' }

export interface EngineResultMap {
  test: TestResult
  schema: SchemaSnapshot
  query: QueryResult
  cancel: void
  release: void
  ping: { pid: number; uptimeMs: number }
}

export interface EngineMessage {
  id: number
  request: EngineRequest
}

export interface EngineReply {
  id: number
  result: Envelope<unknown>
}
