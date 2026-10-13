/**
 * Some NatureQuery links carry a secret: shared dashboards, password resets, email
 * verification, team invites and email unsubscribe links. Error reports and
 * analytics record page addresses, so those secrets are blanked out first.
 */

const SECRET_PARAMS = new Set(['token', 't', 'code', 'key', 'secret'])
const SECRET_PATH = /(\/public\/dashboard\/)[^/?#]+/g
const REDACTED = 'redacted'

/** The address with every secret replaced by "redacted". Works on full and relative URLs. */
export function redactUrl(url: string): string {
  const path = url.replace(SECRET_PATH, `$1${REDACTED}`)
  return path.replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, separator: string, name: string) =>
    SECRET_PARAMS.has(decodeName(name).toLowerCase()) ? `${separator}${name}=${REDACTED}` : match
  )
}

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

type QueryParams = string | Record<string, string> | Array<[string, string]>

interface RequestLike {
  url?: string
  query_string?: QueryParams
  headers?: Record<string, string>
}

/** Blanks out secrets in the request part of an error report (Sentry events). */
export function redactRequest(request: RequestLike | undefined): void {
  if (!request) return
  if (request.url) request.url = redactUrl(request.url)
  const query = request.query_string
  if (typeof query === 'string') {
    request.query_string = redactUrl(`?${query}`).slice(1)
  } else if (Array.isArray(query)) {
    request.query_string = query.map(([name, value]): [string, string] => [
      name,
      SECRET_PARAMS.has(name.toLowerCase()) ? REDACTED : value,
    ])
  } else if (query) {
    for (const name of Object.keys(query)) {
      if (SECRET_PARAMS.has(name.toLowerCase())) query[name] = REDACTED
    }
  }
  for (const name of Object.keys(request.headers ?? {})) {
    if (/^referer$/i.test(name)) request.headers![name] = redactUrl(request.headers![name])
  }
}

/** Redacts every string value in an object whose key names an address. */
export function redactUrlFields<T extends Record<string, unknown>>(
  fields: T | undefined
): T | undefined {
  if (!fields) return fields
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && /url|referrer|pathname|href|^from$|^to$/i.test(key)) {
      ;(fields as Record<string, unknown>)[key] = redactUrl(value)
    }
  }
  return fields
}
