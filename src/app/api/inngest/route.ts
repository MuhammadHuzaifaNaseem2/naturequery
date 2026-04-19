/**
 * Inngest webhook endpoint
 *
 * Inngest calls this route to:
 *  - Deliver function triggers (events)
 *  - Poll for function step completions
 *  - Handle retries and fan-outs
 *
 * Local dev: start the Inngest Dev Server alongside Next.js:
 *   npx inngest-cli@latest dev
 * Then visit http://localhost:8288 to see and trigger functions manually.
 *
 * Production: add your app's URL in the Inngest dashboard under "Apps".
 */

import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import {
  nightlyInsightOrchestrator,
  tenantAnalysisPipeline,
  auditChainVerifier,
} from '@/inngest/functions/nightly-insights'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    nightlyInsightOrchestrator,
    tenantAnalysisPipeline,
    auditChainVerifier,
  ],
})
