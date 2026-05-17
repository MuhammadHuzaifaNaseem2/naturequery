// Translates cryptic SQL / driver errors into plain-English messages users can act on.
// Keep the original error available — power users still want it for debugging.

export interface FriendlyError {
  title: string
  description: string
  hint?: string
}

interface Rule {
  match: RegExp
  build: (m: RegExpMatchArray) => FriendlyError
}

const RULES: Rule[] = [
  {
    match: /function\s+pg_catalog\.extract\(unknown,\s*text\)\s*does not exist/i,
    build: () => ({
      title: 'Date function failed',
      description:
        'The column is stored as text, not as a date. The query is trying to extract a date part from it.',
      hint: 'Try re-uploading the file so column types are detected, or cast the column with CAST(column AS TIMESTAMP).',
    }),
  },
  {
    match: /column\s+"([^"]+)"\s+does not exist/i,
    build: (m) => ({
      title: `Column "${m[1]}" not found`,
      description: 'That column does not exist on the selected table.',
      hint: 'Check spelling, or expand the table in the right sidebar to see available columns.',
    }),
  },
  {
    match: /relation\s+"([^"]+)"\s+does not exist/i,
    build: (m) => ({
      title: `Table "${m[1]}" not found`,
      description: 'That table does not exist in this database.',
      hint: 'Check the schema sidebar for available tables, or refresh the schema.',
    }),
  },
  {
    match: /syntax error at or near\s+"([^"]+)"/i,
    build: (m) => ({
      title: 'SQL syntax error',
      description: `Something is wrong near "${m[1]}".`,
      hint: 'Try rephrasing your question, or click "AI Fix It" to let the AI correct it.',
    }),
  },
  {
    match: /permission denied|access denied/i,
    build: () => ({
      title: 'Permission denied',
      description: "Your database user doesn't have permission to read this table.",
      hint: 'Update the connection with a user that has SELECT privileges.',
    }),
  },
  {
    match: /statement timeout|canceling statement due to statement timeout/i,
    build: () => ({
      title: 'Query timed out',
      description: 'The query took longer than 30 seconds to run.',
      hint: 'Add a LIMIT, filter by date, or narrow your question to a smaller range.',
    }),
  },
  {
    match: /connection terminated|connection refused|ECONNREFUSED|ETIMEDOUT/i,
    build: () => ({
      title: 'Connection lost',
      description: 'Lost connection to the database mid-query.',
      hint: 'Try again. If it keeps happening, check that the database server is reachable.',
    }),
  },
  {
    match: /password authentication failed/i,
    build: () => ({
      title: 'Wrong database password',
      description: 'The database rejected your credentials.',
      hint: 'Open the connection settings and update the password.',
    }),
  },
  {
    match: /division by zero/i,
    build: () => ({
      title: 'Division by zero',
      description: 'The query tried to divide by zero.',
      hint: 'Add a WHERE clause that excludes zero values, or use NULLIF(denominator, 0).',
    }),
  },
  {
    match: /invalid input syntax for type\s+(\w+)/i,
    build: (m) => ({
      title: 'Type mismatch',
      description: `A value couldn't be converted to ${m[1]}.`,
      hint: 'The column might contain unexpected values. Try re-uploading with cleaner data.',
    }),
  },
  {
    match: /query limit|upgrade your plan/i,
    build: () => ({
      title: 'Plan limit reached',
      description: 'You\'ve used all your queries for this billing period.',
      hint: 'Upgrade your plan to keep querying.',
    }),
  },
]

const FALLBACK: FriendlyError = {
  title: 'Query failed',
  description: 'Something went wrong running this query.',
  hint: 'Try "AI Fix It" to let the AI correct the SQL, or rephrase your question.',
}

export function friendlySqlError(raw: string | undefined | null): FriendlyError {
  if (!raw) return FALLBACK
  for (const rule of RULES) {
    const m = raw.match(rule.match)
    if (m) return rule.build(m)
  }
  // No specific rule matched — keep the raw message but soften the framing.
  return {
    title: 'Query failed',
    description: raw.length > 200 ? raw.slice(0, 200) + '…' : raw,
    hint: 'Try "AI Fix It" to let the AI correct it.',
  }
}
