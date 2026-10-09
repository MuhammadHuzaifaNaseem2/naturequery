import { describe, expect, it } from 'vitest'
import { BigQueryDate, BigQueryInt, BigQueryTimestamp } from '@google-cloud/bigquery'
import { NqError } from '../../src/shared/errors'
import { parseMongoQuery } from '../../src/engine/drivers/mongodb'
import { parseFirestoreQuery } from '../../src/engine/drivers/firestore'
import { unmarshall, unmarshallItem } from '../../src/engine/drivers/dynamodb'
import { bigQueryValue, formatTimestamp } from '../../src/engine/drivers/bigquery'
import { normalizeAccount } from '../../src/engine/drivers/snowflake'
import { documentsToTable, inferFields } from '../../src/engine/drivers/documents'
import { describeError, type ErrorContext } from '../../src/engine/errors'
import { assertReadOnlySql } from '../../src/engine/safety/sql'

function rejects(run: () => unknown, message: RegExp) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(NqError)
    expect((error as NqError).code).toBe('VALIDATION')
    expect((error as NqError).message).toMatch(message)
    return
  }
  throw new Error('Expected the query to be rejected')
}

describe('MongoDB queries', () => {
  it('accepts pipelines and find-style queries, with Extended JSON values', () => {
    expect(
      parseMongoQuery('{"collection":"orders","pipeline":[{"$match":{"status":"paid"}}]}')
    ).toEqual({
      collection: 'orders',
      pipeline: [{ $match: { status: 'paid' } }],
    })
    const spec = parseMongoQuery(
      '{"collection":"orders","filter":{"placedAt":{"$gte":{"$date":"2026-01-01T00:00:00Z"}}},"sort":{"total":-1},"limit":5}'
    )
    expect(spec.filter?.placedAt.$gte).toBeInstanceOf(Date)
    expect(spec.limit).toBe(5)
  })

  it('rejects stages that write data or run server-side code', () => {
    rejects(
      () => parseMongoQuery('{"collection":"a","pipeline":[{"$out":"b"}]}'),
      /\$out writes data/
    )
    rejects(
      () =>
        parseMongoQuery(
          '{"collection":"a","pipeline":[{"$lookup":{"from":"b","pipeline":[{"$merge":"c"}]}}]}'
        ),
      /\$merge writes data/
    )
    rejects(() => parseMongoQuery('{"collection":"a","filter":{"$where":"sleep(1)"}}'), /runs code/)
    rejects(
      () =>
        parseMongoQuery(
          '{"collection":"a","pipeline":[{"$group":{"_id":1,"x":{"$accumulator":{}}}}]}'
        ),
      /runs code/
    )
  })

  it('explains malformed queries', () => {
    rejects(() => parseMongoQuery('db.orders.find()'), /not valid JSON/)
    rejects(() => parseMongoQuery('[1,2]'), /JSON object/)
    rejects(() => parseMongoQuery('{"pipeline":[]}'), /which collection/)
    rejects(() => parseMongoQuery('{"collection":"a","pipeline":{}}'), /list of stages/)
    rejects(() => parseMongoQuery('{"collection":"a","update":{}}'), /"update" is not a supported/)
  })
})

describe('Firestore queries', () => {
  it('accepts where, orderBy, select and limit', () => {
    const spec = parseFirestoreQuery(
      '{"collection":"orders","where":[["status","==","paid"],["placedAt",">=",{"$date":"2026-01-01"}]],"orderBy":[["placedAt","desc"]],"select":["status"],"limit":10}'
    )
    expect(spec.collection).toBe('orders')
    expect(spec.where?.[0]).toEqual(['status', '==', 'paid'])
    expect(spec.where?.[1][2]).toBeInstanceOf(Date)
    expect(spec.orderBy).toEqual([['placedAt', 'desc']])
    expect(spec.select).toEqual(['status'])
    expect(spec.limit).toBe(10)
  })

  it('also accepts the shape the website generates', () => {
    const spec = parseFirestoreQuery(
      '{"collection":"users","conditions":[{"field":"age","op":">","value":18}],"orderBy":"age","desc":true}'
    )
    expect(spec.where).toEqual([['age', '>', 18]])
    expect(spec.orderBy).toEqual([['age', 'desc']])
  })

  it('supports collection group queries', () => {
    expect(parseFirestoreQuery('{"collectionGroup":"items"}').collectionGroup).toBe('items')
  })

  it('explains malformed queries', () => {
    rejects(() => parseFirestoreQuery('{"where":[]}'), /which collection/)
    rejects(
      () => parseFirestoreQuery('{"collection":"a","collectionGroup":"b"}'),
      /which collection/
    )
    rejects(
      () => parseFirestoreQuery('{"collection":"a","where":[["x","like","y"]]}'),
      /not a Firestore operator/
    )
    rejects(() => parseFirestoreQuery('{"collection":"a","limit":0}'), /whole number/)
    rejects(
      () => parseFirestoreQuery('{"collection":"a","delete":true}'),
      /"delete" is not a supported/
    )
    rejects(
      () => parseFirestoreQuery('{"collection":"a","where":[["d","==",{"$date":"soon"}]]}'),
      /not a valid date/
    )
    rejects(() => parseFirestoreQuery('select * from users'), /not valid JSON/)
  })
})

describe('DynamoDB values', () => {
  it('converts attribute values and keeps large numbers exact', () => {
    expect(unmarshall({ S: 'a' })).toBe('a')
    expect(unmarshall({ N: '42' })).toBe(42)
    expect(unmarshall({ N: '12345678901234567890' })).toBe('12345678901234567890')
    expect(unmarshall({ N: '0.1' })).toBe(0.1)
    expect(unmarshall({ NULL: true })).toBeNull()
    expect(unmarshall({ NS: ['1', '99999999999999999999'] })).toEqual([1, '99999999999999999999'])
    expect(
      unmarshallItem({
        id: { S: 'o-1' },
        lines: { L: [{ M: { sku: { S: 'X' }, qty: { N: '2' } } }] },
        paid: { BOOL: true },
      })
    ).toEqual({ id: 'o-1', lines: [{ sku: 'X', qty: 2 }], paid: true })
  })
})

describe('BigQuery values', () => {
  it('formats timestamps like the BigQuery console', () => {
    expect(formatTimestamp('2026-01-02T03:04:05.000Z')).toBe('2026-01-02 03:04:05 UTC')
    expect(formatTimestamp('2026-01-02T03:04:05.120000Z')).toBe('2026-01-02 03:04:05.12 UTC')
    expect(formatTimestamp('not a timestamp')).toBe('not a timestamp')
  })

  it('unwraps typed values, including inside structs and arrays', () => {
    expect(bigQueryValue(new BigQueryInt('9007199254740993'))).toBe('9007199254740993')
    expect(bigQueryValue(new BigQueryDate('2026-03-04'))).toBe('2026-03-04')
    expect(
      bigQueryValue({
        when: new BigQueryTimestamp('2026-01-02T03:04:05.000Z'),
        ids: [new BigQueryInt('1'), new BigQueryInt('2')],
      })
    ).toEqual({ when: '2026-01-02 03:04:05 UTC', ids: ['1', '2'] })
    expect(bigQueryValue(null)).toBeNull()
  })
})

describe('Snowflake account identifiers', () => {
  it('accepts identifiers and pasted account URLs', () => {
    expect(normalizeAccount('myorg-myaccount')).toBe('myorg-myaccount')
    expect(normalizeAccount(' https://myorg-myaccount.snowflakecomputing.com/console ')).toBe(
      'myorg-myaccount'
    )
    expect(normalizeAccount('xy12345.eu-central-1.snowflakecomputing.com')).toBe(
      'xy12345.eu-central-1'
    )
  })
})

describe('document results', () => {
  it('builds columns in order of first appearance', () => {
    const table = documentsToTable([
      { a: 1, b: { c: 2 } },
      { b: null, d: 'x' },
    ])
    expect(table.columns.map((column) => column.name)).toEqual(['a', 'b', 'd'])
    expect(table.rows).toEqual([
      [1, { c: 2 }, null],
      [null, null, 'x'],
    ])
  })

  it('infers field types and optional fields from samples', () => {
    const fields = inferFields(
      [
        { _id: 'a', n: 1, tags: ['x'] },
        { _id: 'b', n: 1.5 },
      ],
      ['_id']
    )
    expect(fields).toEqual([
      { name: '_id', type: 'string', nullable: false, isPrimaryKey: true },
      { name: 'n', type: 'int | double', nullable: false, isPrimaryKey: false },
      { name: 'tags', type: 'array', nullable: true, isPrimaryKey: false },
    ])
  })
})

describe('read-only guard for CQL and PartiQL', () => {
  it('allows SELECT and blocks writes', () => {
    expect(() => assertReadOnlySql('SELECT * FROM shop.orders LIMIT 10', 'cql')).not.toThrow()
    expect(() =>
      assertReadOnlySql('SELECT * FROM "Orders" WHERE pk = \'o-1\'', 'partiql')
    ).not.toThrow()
    rejects(() => assertReadOnlySql("INSERT INTO shop.orders (id) VALUES ('x')", 'cql'), /INSERT/)
    rejects(
      () => assertReadOnlySql('BEGIN BATCH DELETE FROM t WHERE id = 1; APPLY BATCH', 'cql'),
      /BEGIN|one statement/
    )
    rejects(() => assertReadOnlySql('UPDATE "Orders" SET paid = true', 'partiql'), /UPDATE/)
    rejects(() => assertReadOnlySql('USE shop', 'cql'), /USE/)
  })
})

describe('engine error messages', () => {
  const context = (type: ErrorContext['type']): ErrorContext => ({ type, phase: 'connect' })

  it('explains cloud sign-in problems', () => {
    expect(
      describeError(
        new Error('Incorrect username or password was specified.'),
        context('snowflake')
      )
    ).toMatchObject({
      code: 'AUTH_FAILED',
      message: 'Snowflake rejected the user name or password.',
    })
    expect(
      describeError(
        new Error('Multi-factor authentication is required for this account. (394508)'),
        context('snowflake')
      ).message
    ).toMatch(/multi-factor/)
    expect(
      describeError(
        Object.assign(new Error('The security token included in the request is invalid.'), {
          name: 'UnrecognizedClientException',
        }),
        context('dynamodb')
      )
    ).toMatchObject({ code: 'AUTH_FAILED', message: 'AWS did not recognize the access key ID.' })
    expect(
      describeError(new Error('invalid_grant: Invalid JWT Signature.'), context('bigquery')).message
    ).toBe('Google rejected the service account key.')
    expect(
      describeError(
        new Error(
          'Access Denied: Project acme: User does not have bigquery.jobs.create permission'
        ),
        context('bigquery')
      ).hint
    ).toMatch(/BigQuery Job User/)
  })

  it('names the data centers when the Cassandra data center is wrong', () => {
    const error = new Error(
      "ArgumentError: localDataCenter was configured as 'dc1', but only found hosts in data centers: [datacenter1]"
    )
    expect(describeError(error, context('cassandra'))).toMatchObject({
      code: 'VALIDATION',
      hint: "This cluster's data centers are: datacenter1.",
    })
  })

  it('does not print an empty host name for connection strings', () => {
    const error = Object.assign(
      new Error('querySrv ENOTFOUND _mongodb._tcp.cluster0.example.net'),
      { code: 'ENOTFOUND' }
    )
    expect(describeError(error, context('mongodb')).message).toBe(
      'The server in the connection settings could not be found.'
    )
  })
})
