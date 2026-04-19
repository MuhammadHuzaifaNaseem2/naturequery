/**
 * Environment variable validation.
 * Validates required secrets at startup and throws in production
 * if critical variables are missing or using placeholder values.
 */

const PLACEHOLDER_SECRETS = [
  'development-only-secret-do-not-use-in-production',
  'CHANGE_ME_generate_with_openssl_rand_base64_32',
  'your-super-secret-key-change-this-in-production-use-openssl-rand-base64-32',
]

const PLACEHOLDER_ENCRYPTION_KEYS = [
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'CHANGE_ME_generate_with_openssl_rand_hex_32',
]

/**
 * Estimates the entropy of a string in bits.
 * A 32-byte random hex string should score >= 100 bits.
 */
function estimateEntropy(value: string): number {
  const freq: Record<string, number> = {}
  for (const ch of value) freq[ch] = (freq[ch] ?? 0) + 1
  let entropy = 0
  const len = value.length
  for (const count of Object.values(freq)) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy * len // total bits
}

export function validateEnv() {
  const warnings: string[] = []
  const isProduction = process.env.NODE_ENV === 'production'

  // ── DATABASE_URL ────────────────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    const msg = 'DATABASE_URL is not set. Database features will not work.'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  }

  // ── NEXTAUTH_SECRET ─────────────────────────────────────────────────────────
  if (!process.env.NEXTAUTH_SECRET) {
    const msg =
      'NEXTAUTH_SECRET is not set. Authentication will not work.'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  } else if (PLACEHOLDER_SECRETS.includes(process.env.NEXTAUTH_SECRET)) {
    const msg =
      'NEXTAUTH_SECRET is a placeholder value. Generate a real secret: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  } else if (isProduction && process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error(
      'CRITICAL: NEXTAUTH_SECRET is too short. It must be at least 32 characters.'
    )
  }

  // ── ENCRYPTION_KEY ──────────────────────────────────────────────────────────
  if (!process.env.ENCRYPTION_KEY) {
    const msg =
      'ENCRYPTION_KEY is not set. Database credential encryption will not work.'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  } else if (PLACEHOLDER_ENCRYPTION_KEYS.includes(process.env.ENCRYPTION_KEY)) {
    const msg =
      'ENCRYPTION_KEY is a placeholder value. Generate a real key: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  } else {
    // Validate format: must be 64 hex characters (32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
      const msg =
        'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
        'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      if (isProduction) throw new Error(`CRITICAL: ${msg}`)
      warnings.push(msg)
    } else if (isProduction) {
      // Entropy check: a proper random 64-hex key should have > 80 bits of entropy
      const bits = estimateEntropy(process.env.ENCRYPTION_KEY)
      if (bits < 80) {
        throw new Error(
          'CRITICAL: ENCRYPTION_KEY has suspiciously low entropy. ' +
          'It may not be truly random. Generate a new one: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        )
      }
    }
  }

  // ── STRIPE_WEBHOOK_SECRET ───────────────────────────────────────────────────
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
    const msg =
      'STRIPE_WEBHOOK_SECRET is not set. Anyone can forge Stripe webhook events, ' +
      'potentially granting free Pro/Enterprise access. ' +
      'Get it from: Stripe Dashboard → Webhooks → your endpoint → Signing secret'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  }

  // ── NEXTAUTH_URL ────────────────────────────────────────────────────────────
  if (isProduction && !process.env.NEXTAUTH_URL) {
    throw new Error(
      'CRITICAL: NEXTAUTH_URL must be set in production (e.g., https://yourdomain.com)'
    )
  }

  // ── CRON_SECRET ─────────────────────────────────────────────────────────────
  if (!process.env.CRON_SECRET) {
    const msg =
      'CRON_SECRET is not set. The scheduled query endpoint is disabled until this is set. ' +
      'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    if (isProduction) throw new Error(`CRITICAL: ${msg}`)
    warnings.push(msg)
  } else if (isProduction && process.env.CRON_SECRET.length < 32) {
    throw new Error('CRITICAL: CRON_SECRET is too short. It must be at least 32 characters.')
  }

  // ── Optional but recommended ────────────────────────────────────────────────
  if (!process.env.GROQ_API_KEYS && !process.env.GROQ_API_KEY) {
    warnings.push('GROQ_API_KEYS / GROQ_API_KEY is not set. AI features will run in mock mode.')
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push(
      'Upstash Redis is not configured. Rate limiting will use in-memory fallback ' +
      '(not suitable for multi-instance deployments).'
    )
  }

  // ── Email Configuration ──────────────────────────────────────────────────
  if (!process.env.RESEND_API_KEY && (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD)) {
    const msg = 'No email provider configured (Resend or SMTP). Transactional emails will be logged to console only.'
    if (isProduction) {
      throw new Error(`CRITICAL: ${msg} In production, users will not receive verification emails.`)
    }
    warnings.push(msg)
  }

  if (process.env.RESEND_API_KEY && isProduction) {
    if (!process.env.EMAIL_FROM || process.env.EMAIL_FROM.includes('localhost')) {
      throw new Error('CRITICAL: EMAIL_FROM must be a verified domain address in production.')
    }
  }

  // ── Log warnings ────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.warn('\n⚠️  NatureQuery Environment Warnings:')
    warnings.forEach((w) => console.warn(`   - ${w}`))
    console.warn('')
  }

  return warnings
}
