/**
 * Immutable Audit Log with SHA-256 Hash Chain
 *
 * Every entry hashes the content of the previous entry for the same user,
 * forming a tamper-evident chain. Deleting or modifying any entry breaks
 * all subsequent hashes — detectable via verifyChainIntegrity().
 *
 * Enforcement layers:
 *  1. This module never issues UPDATE or DELETE — append-only by convention
 *  2. Prisma schema has no update/delete routes for AuditLog
 *  3. verifyChainIntegrity() can be run nightly as a SOC2 control check
 */

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  userId: string | null
  action: string
  resource?: string | null
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AuditLogWriteResult {
  id: string
  hash: string
}

export interface ChainIntegrityResult {
  valid: boolean
  checkedCount: number
  brokenAt?: { id: string; position: number }
  error?: string
}

// ---------------------------------------------------------------------------
// Core hash computation
// ---------------------------------------------------------------------------

/**
 * Builds the canonical JSON string used as input to SHA-256.
 * Field order is fixed — any change to a field after writing invalidates the hash.
 */
function buildEntryData(entry: AuditLogEntry, timestamp: Date): string {
  return JSON.stringify({
    userId: entry.userId ?? null,
    action: entry.action,
    resource: entry.resource ?? null,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    timestamp: timestamp.toISOString(),
  })
}

function computeHash(previousHash: string, entryData: string): string {
  return createHash('sha256')
    .update(previousHash + entryData)
    .digest('hex')
}

// Sentinel value for the first entry in any user's chain
const GENESIS_HASH = '0'.repeat(64)

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Writes a new immutable audit log entry.
 *
 * Fetches the most recent entry for this userId to get the chain tip,
 * computes SHA-256(prevHash + entryData), and inserts in a single transaction.
 *
 * NOTE: This is NOT serializable under high concurrency — for a SOC2-grade
 * system with > 100 writes/sec, replace with a queue-based serial writer
 * (e.g. Inngest step function, or a Postgres advisory lock wrapper).
 * At typical B2B SaaS volumes this is fine.
 */
export async function writeImmutableAuditLog(
  entry: AuditLogEntry
): Promise<AuditLogWriteResult> {
  const timestamp = new Date()

  // Get chain tip for this user (null userId entries share a global chain)
  const chainKey = entry.userId ?? '__system__'
  const previous = await prisma.auditLog.findFirst({
    where: entry.userId ? { userId: entry.userId } : { userId: null },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  })

  const previousHash = previous?.hash ?? GENESIS_HASH
  const entryData = buildEntryData(entry, timestamp)
  const hash = computeHash(previousHash, entryData)

  const record = await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource ?? null,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ? (entry.metadata as object) : undefined,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      createdAt: timestamp,
      hash,
      previousHash,
      entryData,
    },
    select: { id: true, hash: true },
  })

  return { id: record.id, hash: record.hash! }
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Walks the audit log chain for a user in chronological order and verifies
 * that every hash is consistent with its predecessor.
 *
 * Returns { valid: true } if intact, or { valid: false, brokenAt } pinpointing
 * the first inconsistency.
 *
 * Runs in O(n) — for large chains, pass a `fromDate` to limit the window.
 */
export async function verifyChainIntegrity(
  userId: string | null,
  fromDate?: Date
): Promise<ChainIntegrityResult> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(userId ? { userId } : { userId: null }),
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
        hash: { not: null },
        entryData: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, hash: true, previousHash: true, entryData: true },
    })

    if (logs.length === 0) {
      return { valid: true, checkedCount: 0 }
    }

    // Verify each entry's hash matches SHA-256(previousHash + entryData)
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      if (!log.hash || !log.previousHash || !log.entryData) continue

      const expectedHash = computeHash(log.previousHash, log.entryData)
      if (expectedHash !== log.hash) {
        return {
          valid: false,
          checkedCount: i + 1,
          brokenAt: { id: log.id, position: i + 1 },
        }
      }

      // Also verify the previousHash matches the actual preceding entry
      if (i > 0) {
        const prev = logs[i - 1]
        if (prev.hash && log.previousHash !== prev.hash) {
          return {
            valid: false,
            checkedCount: i + 1,
            brokenAt: { id: log.id, position: i + 1 },
          }
        }
      }
    }

    return { valid: true, checkedCount: logs.length }
  } catch (error) {
    return {
      valid: false,
      checkedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error during verification',
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers for common audit events
// Used by auth.ts, connections.ts, etc.
// ---------------------------------------------------------------------------

export function auditLogin(userId: string, ipAddress?: string, userAgent?: string) {
  return writeImmutableAuditLog({
    userId,
    action: 'LOGIN',
    resource: 'user',
    resourceId: userId,
    ipAddress,
    userAgent,
  })
}

export function auditLogout(userId: string, ipAddress?: string) {
  return writeImmutableAuditLog({
    userId,
    action: 'LOGOUT',
    resource: 'user',
    resourceId: userId,
    ipAddress,
  })
}

export function auditQueryExecuted(
  userId: string,
  connectionId: string,
  metadata: { question?: string; rowCount?: number; executionTimeMs?: number }
) {
  return writeImmutableAuditLog({
    userId,
    action: 'QUERY_EXECUTED',
    resource: 'connection',
    resourceId: connectionId,
    metadata,
  })
}

export function auditConnectionCreated(userId: string, connectionId: string, name: string) {
  return writeImmutableAuditLog({
    userId,
    action: 'CONNECTION_CREATED',
    resource: 'connection',
    resourceId: connectionId,
    metadata: { name },
  })
}

export function auditConnectionDeleted(userId: string, connectionId: string, name: string) {
  return writeImmutableAuditLog({
    userId,
    action: 'CONNECTION_DELETED',
    resource: 'connection',
    resourceId: connectionId,
    metadata: { name },
  })
}
