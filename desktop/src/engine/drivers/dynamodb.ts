import {
  DescribeTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ListTablesCommand,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { NqError } from '@shared/errors'
import type { TableInfo } from '@shared/types'
import { assertReadOnlySql } from '../safety/sql'
import { documentsToTable, inferFields } from './documents'
import { SCHEMA_TABLE_LIMIT, type Driver, type DriverFactory } from './types'

const SAMPLE_SIZE = 20
const DESCRIBE_LIMIT = 200

/** Numbers stay exact: values a JavaScript number cannot hold are kept as text. */
function numberValue(text: string): number | string {
  const number = Number(text)
  return Number.isFinite(number) && String(number) === text ? number : text
}

/** Converts DynamoDB's typed attribute values into plain values. */
export function unmarshall(value: AttributeValue): unknown {
  if (value.S !== undefined) return value.S
  if (value.N !== undefined) return numberValue(value.N)
  if (value.BOOL !== undefined) return value.BOOL
  if (value.NULL !== undefined) return null
  if (value.B !== undefined) return value.B
  if (value.M !== undefined) return unmarshallItem(value.M)
  if (value.L !== undefined) return value.L.map(unmarshall)
  if (value.SS !== undefined) return value.SS
  if (value.NS !== undefined) return value.NS.map(numberValue)
  if (value.BS !== undefined) return value.BS
  return null
}

export function unmarshallItem(item: Record<string, AttributeValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, unmarshall(value)]))
}

/** Amazon DynamoDB, queried with PartiQL SELECT statements. */
export const createDynamoDbDriver: DriverFactory = (config, secrets) => {
  const client = new DynamoDBClient({
    region: config.dynamodb?.region,
    endpoint: config.dynamodb?.endpoint || undefined,
    credentials: { accessKeyId: config.user ?? '', secretAccessKey: secrets.secretAccessKey ?? '' },
    maxAttempts: 2,
  })
  const running = new Map<string, AbortController>()

  async function tableNames(): Promise<string[]> {
    const names: string[] = []
    let start: string | undefined
    do {
      const page = await client.send(
        new ListTablesCommand({ ExclusiveStartTableName: start, Limit: 100 })
      )
      names.push(...(page.TableNames ?? []))
      start = page.LastEvaluatedTableName
    } while (start && names.length < SCHEMA_TABLE_LIMIT)
    return names
  }

  const driver: Driver = {
    async test() {
      await client.send(new ListTablesCommand({ Limit: 1 }))
      return { serverVersion: `Amazon DynamoDB (${config.dynamodb?.region})` }
    },

    async schema() {
      const names = await tableNames()
      const tables: TableInfo[] = []
      for (const name of names) {
        if (tables.length >= DESCRIBE_LIMIT) {
          tables.push({
            name,
            kind: 'table',
            columns: [],
            foreignKeys: [],
            qualifiedName: `"${name}"`,
          })
          continue
        }
        const [description, sample] = await Promise.all([
          client.send(new DescribeTableCommand({ TableName: name })).catch(() => null),
          client.send(new ScanCommand({ TableName: name, Limit: SAMPLE_SIZE })).catch(() => null),
        ])
        const keys = (description?.Table?.KeySchema ?? [])
          .map((key) => key.AttributeName ?? '')
          .filter(Boolean)
        const items = (sample?.Items ?? []).map(unmarshallItem)
        const columns = inferFields(items, keys)
        // Key attributes always exist, even when the sample is empty.
        for (const key of keys) {
          if (!columns.some((column) => column.name === key)) {
            const type = description?.Table?.AttributeDefinitions?.find(
              (a) => a.AttributeName === key
            )?.AttributeType
            columns.unshift({
              name: key,
              type: type === 'N' ? 'number' : type === 'B' ? 'binary' : 'string',
              nullable: false,
              isPrimaryKey: true,
            })
          }
        }
        tables.push({
          name,
          kind: 'table',
          columns,
          foreignKeys: [],
          qualifiedName: `"${name.replaceAll('"', '""')}"`,
          rowEstimate: description?.Table?.ItemCount,
        })
      }
      return { tables, truncated: names.length >= SCHEMA_TABLE_LIMIT }
    },

    async query(text, options) {
      assertReadOnlySql(text, 'partiql')
      const controller = new AbortController()
      running.set(options.queryId, controller)
      const timer = setTimeout(() => controller.abort('timeout'), Math.max(1000, options.timeoutMs))
      const items: Record<string, unknown>[] = []
      let nextToken: string | undefined
      let truncated = false
      try {
        do {
          const page = await client.send(
            new ExecuteStatementCommand({
              Statement: text,
              NextToken: nextToken,
              Limit: Math.min(1000, options.rowLimit + 1 - items.length),
            }),
            { abortSignal: controller.signal }
          )
          items.push(...(page.Items ?? []).map(unmarshallItem))
          nextToken = page.NextToken
        } while (nextToken && items.length <= options.rowLimit)
        truncated = items.length > options.rowLimit || !!nextToken
        if (items.length > options.rowLimit) items.length = options.rowLimit
        return { ...documentsToTable(items), truncated, executedText: text }
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason === 'timeout') {
            throw new NqError(
              'TIMEOUT',
              `The query ran longer than ${Math.round(options.timeoutMs / 1000)} seconds and was stopped.`,
              {
                hint: 'Query by partition key with WHERE to avoid scanning the whole table.',
              }
            )
          }
          throw new NqError('CANCELED', 'The query was canceled.')
        }
        throw error
      } finally {
        clearTimeout(timer)
        running.delete(options.queryId)
      }
    },

    async cancel(queryId) {
      running.get(queryId)?.abort('canceled')
    },

    async close() {
      client.destroy()
    },
  }
  return driver
}
