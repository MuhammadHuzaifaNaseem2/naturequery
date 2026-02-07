/**
 * Environment variable validation.
 * Logs warnings at startup if placeholder/insecure values are detected.
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

export function validateEnv() {
  const warnings: string[] = []
  const isProduction = process.env.NODE_ENV === 'production'

  // Required variables
  if (!process.env.DATABASE_URL) {
    warnings.push('DATABASE_URL is not set. Database features will not work.')
  }

  if (!process.env.NEXTAUTH_SECRET) {
    warnings.push('NEXTAUTH_SECRET is not set. Authentication will not work.')
  } else if (PLACEHOLDER_SECRETS.includes(process.env.NEXTAUTH_SECRET)) {
    if (isProduction) {
      throw new Error(
        'CRITICAL: NEXTAUTH_SECRET is using a placeholder value in production! ' +
        'Generate a real secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
      )
    }
    warnings.push(
      'NEXTAUTH_SECRET is using a placeholder value. Generate a real secret for production.'
    )
  }

  if (!process.env.ENCRYPTION_KEY) {
    warnings.push('ENCRYPTION_KEY is not set. Database credential encryption will not work.')
  } else if (PLACEHOLDER_ENCRYPTION_KEYS.includes(process.env.ENCRYPTION_KEY)) {
    if (isProduction) {
      throw new Error(
        'CRITICAL: ENCRYPTION_KEY is using a placeholder value in production! ' +
        'Generate a real key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      )
    }
    warnings.push(
      'ENCRYPTION_KEY is using a placeholder value. Generate a real key for production.'
    )
  }

  // Optional but recommended
  if (!process.env.GROQ_API_KEY) {
    warnings.push('GROQ_API_KEY is not set. AI features will run in mock mode.')
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  ReportFlow Environment Warnings:')
    warnings.forEach((w) => console.warn(`   - ${w}`))
    console.warn('')
  }

  return warnings
}
