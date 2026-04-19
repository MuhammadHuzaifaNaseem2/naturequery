import { Inngest } from 'inngest'

/**
 * Inngest client — single instance shared across all functions.
 *
 * In development (no INNGEST_EVENT_KEY set), Inngest runs in "mock" mode:
 * functions are triggered locally via the Inngest Dev Server at localhost:8288.
 *
 * In production, set:
 *   INNGEST_EVENT_KEY  — from your Inngest dashboard (app.inngest.com)
 *   INNGEST_SIGNING_KEY — for webhook signature verification
 */
export const inngest = new Inngest({
  id: 'naturequery',
  name: 'NatureQuery',
})

// ---------------------------------------------------------------------------
// Typed event catalogue
// Keep all event names + payload shapes here for end-to-end type safety.
// ---------------------------------------------------------------------------

export type NatureQueryEvents = {
  // Nightly agent pipeline per tenant
  'agent/tenant.analyze': {
    data: { tenantId: string }
  }
  // Schema changed — re-embed for RAG
  'schema/connection.updated': {
    data: { userId: string; connectionId: string }
  }
  // HITL correction threshold reached — trigger embedding retrain
  'hitl/retrain-embeddings': {
    data: { tenantId: string; correctionCount: number }
  }
  // Audit chain integrity check (nightly SOC2 control)
  'audit/verify-chain': {
    data: { userId: string | null }
  }
}
