/**
 * Email service — supports Resend (preferred for production) and SMTP fallback.
 *
 * Priority:
 *  1. Resend (set RESEND_API_KEY in .env.local)
 *  2. SMTP (set SMTP_USER + SMTP_PASSWORD)
 *  3. Dev mode — logs to console, returns URL
 */

import { rateLimitAsync } from '@/lib/rate-limit'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const from = process.env.EMAIL_FROM || 'NatureQuery <noreply@naturequery.com>'

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASSWORD))
}

// ---------- Email templates ----------

function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden; }
    .header { padding: 24px 32px; border-bottom: 1px solid #e4e4e7; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #18181b; }
    .body { padding: 32px; color: #3f3f46; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 28px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 32px; background: #fafafa; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 12px; text-align: center; }
    .code { font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #6366f1; background: #eef2ff; padding: 12px 20px; border-radius: 8px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>NatureQuery</h1></div>
    <div class="body">${content}</div>
    <div class="footer">&copy; ${new Date().getFullYear()} NatureQuery. All rights reserved.</div>
  </div>
</body>
</html>`
}

// ---------- Send implementation ----------

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  // Global rate limit: max 5 emails per minute per recipient (prevents abuse)
  const rl = await rateLimitAsync(`email:${to}`, { maxRequests: 5, windowSeconds: 60 })
  if (!rl.allowed) {
    throw new Error('Too many emails sent to this address. Please try again later.')
  }

  // 1. Try Resend first
  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Resend error: ${err}`)
    }
    return
  }

  // 2. SMTP fallback
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
    await transporter.sendMail({ from, to, subject, html })
    return
  }

  throw new Error('No email provider configured')
}

// ---------- Send functions ----------

export async function sendVerificationEmail(email: string, token: string): Promise<string> {
  const verifyUrl = `${appUrl}/verify-email?token=${token}`

  if (!isEmailConfigured()) {
    console.log(`\n📧 [DEV] Verification email for ${email}`)
    console.log(`   Link: ${verifyUrl}\n`)
    return verifyUrl
  }

  const html = baseTemplate(`
    <p>Welcome to NatureQuery!</p>
    <p>Please verify your email address by clicking the button below:</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${verifyUrl}" class="btn">Verify Email</a>
    </p>
    <p style="font-size:13px; color:#71717a;">If you didn't create an account, you can safely ignore this email.</p>
    <p style="font-size:12px; color:#a1a1aa; word-break:break-all;">Or copy this link: ${verifyUrl}</p>
  `)

  await sendEmail(email, 'Verify your email — NatureQuery', html)
  return verifyUrl
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<string> {
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  if (!isEmailConfigured()) {
    console.log(`\n📧 [DEV] Password reset email for ${email}`)
    console.log(`   Link: ${resetUrl}\n`)
    return resetUrl
  }

  const html = baseTemplate(`
    <p>You requested a password reset for your NatureQuery account.</p>
    <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </p>
    <p style="font-size:13px; color:#71717a;">If you didn't request this, you can safely ignore this email.</p>
    <p style="font-size:12px; color:#a1a1aa; word-break:break-all;">Or copy this link: ${resetUrl}</p>
  `)

  await sendEmail(email, 'Reset your password — NatureQuery', html)
  return resetUrl
}

export async function sendTeamInviteEmail(
  email: string,
  teamName: string,
  inviterName: string,
  token: string
): Promise<string> {
  const inviteUrl = `${appUrl}/invite?token=${token}`

  if (!isEmailConfigured()) {
    console.log(`\n📧 [DEV] Team invite for ${email} to "${teamName}"`)
    console.log(`   Link: ${inviteUrl}\n`)
    return inviteUrl
  }

  const html = baseTemplate(`
    <p><strong>${inviterName}</strong> invited you to join <strong>${teamName}</strong> on NatureQuery.</p>
    <p>Click the button below to accept the invitation:</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
    </p>
    <p style="font-size:13px; color:#71717a;">If you don't know this person, you can safely ignore this email.</p>
    <p style="font-size:12px; color:#a1a1aa; word-break:break-all;">Or copy this link: ${inviteUrl}</p>
  `)

  await sendEmail(email, `You're invited to ${teamName} — NatureQuery`, html)
  return inviteUrl
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`\n📧 [DEV] Welcome email for ${email}\n`)
    return
  }

  const html = baseTemplate(`
    <p>Welcome to NatureQuery, ${name || 'there'}!</p>
    <p>You're all set to start querying your databases in plain English.</p>
    <p>Here's what you can do next:</p>
    <ul style="color:#3f3f46; padding-left: 20px;">
      <li>Connect your first database</li>
      <li>Ask a question in natural language</li>
      <li>Export results to Excel or CSV</li>
    </ul>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${appUrl}/dashboard" class="btn">Go to Dashboard</a>
    </p>
  `)

  await sendEmail(email, 'Welcome to NatureQuery!', html)
}

export interface ScheduleEmailResult {
  rows: Record<string, unknown>[]
  fields: string[]
  rowCount: number
  executionTimeMs: number
  truncated?: boolean
}

const EMAIL_PREVIEW_ROWS = 20

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '<span style="color:#a1a1aa;">null</span>'
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderResultTable(result: ScheduleEmailResult): string {
  const { rows, fields, rowCount, executionTimeMs, truncated } = result
  const preview = rows.slice(0, EMAIL_PREVIEW_ROWS)
  const hiddenRows = rowCount - preview.length

  if (preview.length === 0 || fields.length === 0) {
    return `
      <p style="background:#f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px 16px; color: #52525b; font-size: 13px;">
        Query returned no rows (completed in ${executionTimeMs}ms).
      </p>
    `
  }

  const header = fields
    .map(
      (f) =>
        `<th style="text-align:left; padding:8px 12px; background:#f4f4f5; border-bottom:1px solid #e4e4e7; font-weight:600; font-size:12px; color:#52525b; text-transform:uppercase; letter-spacing:0.03em;">${escapeHtml(f)}</th>`
    )
    .join('')

  const body = preview
    .map((row) => {
      const cells = fields
        .map(
          (f) =>
            `<td style="padding:8px 12px; border-bottom:1px solid #f4f4f5; font-size:13px; color:#18181b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(row[f])}</td>`
        )
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  const caption = `
    <p style="font-size:13px; color:#52525b; margin: 8px 0 16px;">
      Showing ${preview.length.toLocaleString()} of ${rowCount.toLocaleString()} row${rowCount !== 1 ? 's' : ''}
      · completed in ${executionTimeMs}ms${truncated ? ' · result set was capped by row limit' : ''}
    </p>
  `

  const footer =
    hiddenRows > 0
      ? `<p style="font-size:12px; color:#71717a; margin-top:8px;">… ${hiddenRows.toLocaleString()} more row${hiddenRows !== 1 ? 's' : ''} not shown. Open the dashboard to view the full result.</p>`
      : ''

  return `
    ${caption}
    <div style="overflow-x:auto; border:1px solid #e4e4e7; border-radius: 8px;">
      <table style="width:100%; border-collapse: collapse;">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${footer}
  `
}

export async function sendScheduleNotificationEmail(
  email: string,
  scheduleName: string,
  status: 'success' | 'failed',
  errorMessage?: string | null,
  result?: ScheduleEmailResult
): Promise<void> {
  const isSuccess = status === 'success'
  const subject = isSuccess
    ? `Scheduled query "${scheduleName}" ran successfully — NatureQuery`
    : `Scheduled query "${scheduleName}" failed — NatureQuery`

  if (!isEmailConfigured()) {
    console.log(`[DEV] Schedule notification for ${email}: ${scheduleName} → ${status}`)
    return
  }

  const html = baseTemplate(
    isSuccess
      ? `
      <p>Your scheduled query <strong>${escapeHtml(scheduleName)}</strong> completed successfully.</p>
      ${result ? renderResultTable(result) : ''}
      <p style="text-align:center; margin: 24px 0;">
        <a href="${appUrl}/dashboard" class="btn">Open Dashboard</a>
      </p>
    `
      : `
      <p>Your scheduled query <strong>${escapeHtml(scheduleName)}</strong> failed with an error:</p>
      <p style="background:#fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; color: #dc2626; font-family: monospace; font-size: 13px;">${escapeHtml(errorMessage || 'Unknown error')}</p>
      <p>Please check your connection settings and query, then re-enable the schedule.</p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="${appUrl}/dashboard" class="btn">Fix Schedule</a>
      </p>
    `
  )

  await sendEmail(email, subject, html)
}

export async function sendLoginNotificationEmail(
  email: string,
  ipAddress: string,
  userAgent: string,
  loginTime: Date
): Promise<void> {
  const timeStr = loginTime.toUTCString()
  const securityUrl = `${appUrl}/settings/security`

  // Parse a friendly browser/OS string from user-agent
  let device = 'Unknown device'
  if (userAgent) {
    if (/iPhone|iPad/.test(userAgent)) device = 'iPhone / iPad'
    else if (/Android/.test(userAgent)) device = 'Android device'
    else if (/Windows/.test(userAgent)) device = 'Windows PC'
    else if (/Macintosh|Mac OS/.test(userAgent)) device = 'Mac'
    else if (/Linux/.test(userAgent)) device = 'Linux'
    if (/Chrome/.test(userAgent) && !/Edg/.test(userAgent)) device += ' · Chrome'
    else if (/Firefox/.test(userAgent)) device += ' · Firefox'
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) device += ' · Safari'
    else if (/Edg/.test(userAgent)) device += ' · Edge'
  }

  if (!isEmailConfigured()) {
    console.log(`[DEV] Login notification for ${email} — IP: ${ipAddress}, Device: ${device}`)
    return
  }

  const html = baseTemplate(`
    <p>We detected a new sign-in to your NatureQuery account.</p>
    <table style="width:100%; border-collapse:collapse; margin: 20px 0; font-size:14px;">
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #e4e4e7; color:#71717a; width:35%;">Time</td>
        <td style="padding:10px 0; border-bottom:1px solid #e4e4e7; color:#18181b; font-weight:500;">${timeStr}</td>
      </tr>
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #e4e4e7; color:#71717a;">IP Address</td>
        <td style="padding:10px 0; border-bottom:1px solid #e4e4e7; color:#18181b; font-weight:500;">${ipAddress || 'Unknown'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0; color:#71717a;">Device</td>
        <td style="padding:10px 0; color:#18181b; font-weight:500;">${device}</td>
      </tr>
    </table>
    <p>If this was you, no action is needed.</p>
    <p>If you <strong>don't recognize this sign-in</strong>, secure your account immediately by changing your password.</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${securityUrl}" class="btn">Secure My Account</a>
    </p>
    <p style="font-size:12px; color:#a1a1aa;">You can manage login notifications in your account settings.</p>
  `)

  await sendEmail(email, 'New sign-in to your NatureQuery account', html)
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[DEV] Password changed notification for', email)
    return
  }

  const html = baseTemplate(`
    <p>Your NatureQuery password was recently changed.</p>
    <p>If you made this change, no further action is required.</p>
    <p>If you did <strong>not</strong> make this change, reset your password immediately.</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${appUrl}/forgot-password" class="btn">Reset Password</a>
    </p>
  `)

  await sendEmail(email, 'Your NatureQuery password was changed', html)
}
