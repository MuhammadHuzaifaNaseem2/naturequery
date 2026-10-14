// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: {} } }))

import { writeImmutableAuditLog } from '@/lib/audit-immutable'

/** Every source file except tests, walked from src/. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe('the tamper-evident audit log', () => {
  it('is written only through writeImmutableAuditLog', () => {
    const direct = sourceFiles(path.join(process.cwd(), 'src'))
      .filter((file) => !file.endsWith(path.join('lib', 'audit-immutable.ts')))
      .filter((file) =>
        /\.auditLog\s*\.\s*(create|createMany|upsert|update|updateMany)\s*\(/.test(
          fs.readFileSync(file, 'utf8')
        )
      )
      .map((file) => path.relative(process.cwd(), file))
    // A direct write lands outside the hash chain, where it can be changed unnoticed.
    expect(direct).toEqual([])
  })

  it('chains each entry to the previous one, inside a given transaction', async () => {
    const tx = {
      auditLog: {
        findFirst: vi.fn().mockResolvedValue({ hash: 'a'.repeat(64) }),
        create: vi.fn(async ({ data }) => ({ id: 'entry-1', hash: data.hash })),
      },
    }
    const result = await writeImmutableAuditLog(
      { userId: 'user-1', action: 'CHANGE_USER_ROLE', resource: 'user', resourceId: 'user-2' },
      tx as never
    )
    expect(tx.auditLog.findFirst).toHaveBeenCalledOnce()
    const { data } = tx.auditLog.create.mock.calls[0][0]
    expect(data).toMatchObject({
      userId: 'user-1',
      action: 'CHANGE_USER_ROLE',
      previousHash: 'a'.repeat(64),
    })
    expect(data.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(result).toEqual({ id: 'entry-1', hash: data.hash })
  })
})
