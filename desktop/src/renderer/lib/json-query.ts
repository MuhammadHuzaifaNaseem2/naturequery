import { json, jsonLanguage, jsonParseLinter } from '@codemirror/lang-json'
import { linter } from '@codemirror/lint'
import type { Completion, CompletionContext } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import type { SchemaSnapshot } from '@shared/types'

/** Editor support for MongoDB and Firestore queries, which are written as JSON. */

const MONGO_WORDS: Completion[] = [
  { label: 'collection', type: 'keyword', detail: 'which collection' },
  { label: 'pipeline', type: 'keyword', detail: 'aggregation stages' },
  { label: 'filter', type: 'keyword', detail: 'find: matching documents' },
  { label: 'projection', type: 'keyword', detail: 'find: fields to return' },
  { label: 'sort', type: 'keyword', detail: 'find: order' },
  { label: 'limit', type: 'keyword', detail: 'find: most documents' },
  ...[
    '$match',
    '$group',
    '$sort',
    '$limit',
    '$skip',
    '$project',
    '$lookup',
    '$unwind',
    '$count',
    '$addFields',
    '$facet',
    '$bucket',
    '$sum',
    '$avg',
    '$min',
    '$max',
    '$first',
    '$last',
    '$push',
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
    '$and',
    '$or',
    '$regex',
    '$exists',
    '$dateToString',
    '$year',
    '$month',
    '$date',
    '$oid',
  ].map((label): Completion => ({ label, type: 'function' })),
]

const FIRESTORE_WORDS: Completion[] = [
  { label: 'collection', type: 'keyword', detail: 'collection path' },
  { label: 'collectionGroup', type: 'keyword', detail: 'every subcollection with this name' },
  { label: 'where', type: 'keyword', detail: '[["field", "==", value]]' },
  { label: 'orderBy', type: 'keyword', detail: '[["field", "desc"]]' },
  { label: 'select', type: 'keyword', detail: 'fields to return' },
  { label: 'limit', type: 'keyword', detail: 'most documents' },
  { label: '$date', type: 'function', detail: 'a date value' },
  ...['==', '!=', '<', '<=', '>', '>=', 'array-contains', 'array-contains-any', 'in', 'not-in'].map(
    (label): Completion => ({ label, type: 'operator' })
  ),
]

function schemaWords(schema: SchemaSnapshot | undefined): Completion[] {
  if (!schema) return []
  const words: Completion[] = []
  const fields = new Set<string>()
  for (const table of schema.tables) {
    words.push({ label: table.name, type: 'class', detail: 'collection' })
    for (const column of table.columns) fields.add(column.name)
  }
  for (const field of fields) words.push({ label: field, type: 'property', detail: 'field' })
  return words
}

export function jsonQueryLanguage(
  kind: 'mongodb' | 'firestore',
  schema: SchemaSnapshot | undefined
): Extension {
  const options = [...(kind === 'mongodb' ? MONGO_WORDS : FIRESTORE_WORDS), ...schemaWords(schema)]
  const complete = (context: CompletionContext) => {
    const word = context.matchBefore(/[\w$.-]*/)
    if (!word || (word.from === word.to && !context.explicit)) return null
    return { from: word.from, options, validFor: /^[\w$.-]*$/ }
  }
  return [
    json(),
    jsonLanguage.data.of({ autocomplete: complete }),
    linter(jsonParseLinter(), { delay: 400 }),
  ]
}
