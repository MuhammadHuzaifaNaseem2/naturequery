// Removes credentials from text before it is logged or shown in error details.

const PATTERNS: [RegExp, string][] = [
  // Tokens first, so later patterns cannot consume only part of them.
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***'],
  // The whole value of an Authorization header.
  [/\b(authorization\s*[=:]\s*)[^\r\n]+/gi, '$1***'],
  // scheme://user:password@host
  [/([a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:)[^@\s/]+@/gi, '$1***@'],
  // key=value and key: value pairs
  [
    /\b(password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|private[_-]?key)(\s*[=:]\s*["']?)[^"'\s,;&}]+/gi,
    '$1$2***',
  ],
  // "password": "value" in JSON
  [
    /("(?:password|secret|token|accessToken|refreshToken|apiKey|privateKey|private_key|authToken|secretAccessKey|connectionString)"\s*:\s*")[^"]*"/gi,
    '$1***"',
  ],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private key]'],
]

export function redact(text: string): string {
  let output = text
  for (const [pattern, replacement] of PATTERNS) output = output.replace(pattern, replacement)
  return output
}
