import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { csvCell, writeCsv, writeJson, writeXlsx } from '../../src/main/exporter'
import { formatDateTime, normalizeValue } from '../../src/engine/normalize'
import { describeError } from '../../src/engine/errors'
import { redact } from '../../src/shared/redact'
import { toNumberIfLossless, toTableData, toTsv } from '../../src/renderer/lib/results'

describe('value normalization', () => {
  it('turns driver values into plain, display-safe values', () => {
    expect(normalizeValue(12n)).toBe('12')
    expect(normalizeValue(Number.NaN)).toBe('NaN')
    expect(normalizeValue(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z')
    expect(normalizeValue(Buffer.from([1, 2, 255]))).toBe('0x0102ff')
    expect(normalizeValue({ a: [1n, null], b: new Date('2026-01-01T00:00:00Z') })).toEqual({
      a: ['1', null],
      b: '2026-01-01T00:00:00.000Z',
    })
    expect(normalizeValue({ _bsontype: 'ObjectId', toHexString: () => 'abc123' })).toBe('abc123')
    expect(String(normalizeValue(Buffer.alloc(100)))).toMatch(/100 bytes/)
  })

  it('formats wall-clock times without a time zone shift', () => {
    expect(formatDateTime(new Date(Date.UTC(2026, 0, 5, 9, 30, 0, 250)), true)).toBe(
      '2026-01-05 09:30:00.250'
    )
    expect(formatDateTime(new Date(Date.UTC(2026, 0, 5)), true)).toBe('2026-01-05 00:00:00')
  })
})

describe('exports', () => {
  it('quotes CSV cells and stops spreadsheet formulas from running', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(null)).toBe('')
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"')
  })

  it('writes CSV, JSON and Excel files', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nq-export-'))
    try {
      const columns = ['id', 'name', 'id']
      const rows = [
        [1, 'Acme', 7],
        [2, '=cmd', 8],
      ]
      await writeCsv(path.join(directory, 'out.csv'), columns, rows)
      const csv = fs.readFileSync(path.join(directory, 'out.csv'), 'utf8')
      expect(csv.startsWith('﻿id,name,id\r\n1,Acme,7\r\n')).toBe(true)
      expect(csv).toContain("'=cmd")

      await writeJson(path.join(directory, 'out.json'), columns, rows)
      expect(JSON.parse(fs.readFileSync(path.join(directory, 'out.json'), 'utf8'))).toEqual([
        { id: 1, name: 'Acme', id_2: 7 },
        { id: 2, name: '=cmd', id_2: 8 },
      ])

      await writeXlsx(path.join(directory, 'out.xlsx'), columns, rows)
      const bytes = fs.readFileSync(path.join(directory, 'out.xlsx'))
      expect(bytes.subarray(0, 2).toString()).toBe('PK')
      expect(bytes.length).toBeGreaterThan(3000)
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})

describe('redaction', () => {
  it('removes credentials from log and error text', () => {
    expect(redact('postgres://reader:s3cret@db.local:5432/sales')).toBe(
      'postgres://reader:***@db.local:5432/sales'
    )
    expect(redact('password=hunter2;user=x')).toBe('password=***;user=x')
    expect(redact('{"password":"abc","name":"x"}')).toBe('{"password":"***","name":"x"}')
    expect(redact('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def')
    expect(
      redact('-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----')
    ).toBe('[private key]')
  })
})

describe('error translation', () => {
  const connect = {
    type: 'postgresql' as const,
    host: '10.0.0.5',
    port: 5432,
    phase: 'connect' as const,
  }
  it('explains common connection failures with a next step', () => {
    expect(
      describeError(
        Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        connect
      )
    ).toMatchObject({
      code: 'CONNECTION_REFUSED',
      message: expect.stringContaining('10.0.0.5:5432'),
    })
    expect(
      describeError(Object.assign(new Error('getaddrinfo ENOTFOUND db'), { code: 'ENOTFOUND' }), {
        ...connect,
        host: 'db',
      }).code
    ).toBe('HOST_NOT_FOUND')
    // Supabase's pooler uses the same code for an unknown project or user.
    expect(
      describeError(
        Object.assign(new Error('tenant/user postgres.abcdefghijkl not found'), {
          code: 'ENOTFOUND',
        }),
        { ...connect, type: 'supabase', host: 'aws-0-us-east-1.pooler.supabase.com' }
      )
    ).toMatchObject({
      code: 'AUTH_FAILED',
      hint: expect.stringContaining('postgres.your-project-ref'),
    })
    expect(
      describeError(
        Object.assign(new Error('password authentication failed for user "x"'), { code: '28P01' }),
        connect
      ).code
    ).toBe('AUTH_FAILED')
    expect(
      describeError(new Error('The server does not support SSL connections'), connect).hint
    ).toMatch(/Prefer encryption/)
    expect(
      describeError(new Error('self-signed certificate in certificate chain'), connect).hint
    ).toMatch(/trust server certificate/)
    expect(
      describeError(new Error('Port for SQLEXPRESS not found in ServerName'), {
        ...connect,
        type: 'sqlserver',
      }).hint
    ).toMatch(/SQL Server Browser/)
  })

  it('passes database query errors through verbatim and reports timeouts', () => {
    const query = { ...connect, phase: 'query' as const, timeoutSeconds: 30 }
    expect(
      describeError(
        Object.assign(new Error('column "nme" does not exist'), { code: '42703' }),
        query
      )
    ).toMatchObject({
      code: 'DATABASE_ERROR',
      message: 'column "nme" does not exist',
    })
    expect(
      describeError(
        Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' }),
        query
      ).message
    ).toMatch(/30 seconds/)
    expect(describeError(new Error('anything'), { ...query, canceled: true }).code).toBe('CANCELED')
  })
})

describe('results for the table and chart', () => {
  it('keeps duplicate columns and converts exact numbers', () => {
    const data = toTableData({
      columns: [
        { name: 'id', type: 'integer' },
        { name: 'total', type: 'numeric' },
        { name: 'id' },
        { name: 'code', type: 'text' },
      ],
      rows: [[1, '1234.50', 9, '007']],
    })
    expect(data.fields).toEqual(['id', 'total', 'id (2)', 'code'])
    expect(data.rows[0]).toEqual({ id: 1, total: 1234.5, 'id (2)': 9, code: '007' })
  })

  it('keeps numbers that would lose precision as text', () => {
    expect(toNumberIfLossless('12345678901234567890')).toBe('12345678901234567890')
    expect(toNumberIfLossless('-0.25')).toBe(-0.25)
    expect(toNumberIfLossless('1e5')).toBe('1e5')
  })

  it('copies as tab-separated text', () => {
    expect(
      toTsv(
        ['a', 'b'],
        [
          [1, 'x\ty'],
          [null, { k: 1 }],
        ]
      )
    ).toBe('a\tb\r\n1\tx y\r\n\t{"k":1}')
  })
})
