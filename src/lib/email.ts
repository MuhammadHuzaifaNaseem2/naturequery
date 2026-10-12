/**
 * Email service — supports Resend (preferred for production) and SMTP fallback.
 *
 * Priority:
 *  1. Resend (set RESEND_API_KEY in .env.local)
 *  2. SMTP (set SMTP_USER + SMTP_PASSWORD)
 *  3. Dev mode — logs to console, returns URL
 */

import { rateLimitAsync } from '@/lib/rate-limit'
import type { InsightMetrics } from '@/lib/nightly-insights'
import { weeklySummaryUnsubscribeUrl } from '@/lib/email-unsubscribe'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const from = process.env.EMAIL_FROM || 'NatureQuery <hello@naturequery.app>'

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
    .btn { display: inline-block; padding: 12px 28px; background: #151127; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 32px; background: #fafafa; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 12px; text-align: center; }
    .code { font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #5336d3; background: #efedfb; padding: 12px 20px; border-radius: 8px; display: inline-block; }
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: {
    replyTo?: string
    rateLimitKey?: string
    text?: string
    headers?: Record<string, string>
  } = {}
): Promise<void> {
  // Global rate limit: max 5 emails per minute per recipient (prevents abuse)
  const rl = await rateLimitAsync(`email:${options.rateLimitKey || to}`, {
    maxRequests: 5,
    windowSeconds: 60,
  })
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
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text: options.text,
        reply_to: options.replyTo,
        headers: options.headers,
      }),
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
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: options.text,
      replyTo: options.replyTo,
      headers: options.headers,
    })
    return
  }

  throw new Error('No email provider configured')
}

// ---------- Send functions ----------

export async function sendVerificationEmail(
  email: string,
  token: string,
  next?: string
): Promise<string> {
  // `next` brings people back to where they signed up, for example NatureQuery Desktop's sign-in.
  const verifyUrl = `${appUrl}/verify-email?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ''}`

  if (!isEmailConfigured()) {
    console.log(`\n📧 [DEV] Verification email for ${email}`)
    console.log(`   Link: ${verifyUrl}\n`)
    return verifyUrl
  }

  const html = baseTemplate(`
    <p>Welcome to NatureQuery!</p>
    <p>Please verify your email address by clicking the button below:</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="${verifyUrl.replace(/&/g, '&amp;')}" class="btn">Verify Email</a>
    </p>
    <p style="font-size:13px; color:#71717a;">If you didn't create an account, you can safely ignore this email.</p>
    <p style="font-size:12px; color:#a1a1aa; word-break:break-all;">Or copy this link: ${verifyUrl.replace(/&/g, '&amp;')}</p>
  `)

  await sendEmail(email, 'Verify your email for NatureQuery', html)
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

  await sendEmail(email, 'Reset your NatureQuery password', html)
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

  await sendEmail(email, `You're invited to ${teamName} on NatureQuery`, html)
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

const CONTACT_REASON_LABELS = {
  general: 'General inquiry',
  sales: 'Sales and enterprise',
  support: 'Technical support',
  partnership: 'Partnership',
  feedback: 'Product feedback',
} as const

export type ContactReason = keyof typeof CONTACT_REASON_LABELS

export async function sendContactEmail(input: {
  name: string
  email: string
  company?: string
  reason: ContactReason
  message: string
}): Promise<void> {
  if (!isEmailConfigured()) throw new Error('No email provider configured')

  const recipient = process.env.CONTACT_EMAIL || 'hello@naturequery.app'
  const reason = CONTACT_REASON_LABELS[input.reason]
  const company = input.company
    ? `<p><strong>Company:</strong> ${escapeHtml(input.company)}</p>`
    : ''
  const html = baseTemplate(`
    <p><strong>New NatureQuery contact request</strong></p>
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    ${company}
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p><strong>Message:</strong></p>
    <div style="white-space:pre-wrap; border:1px solid #e4e4e7; border-radius:8px; padding:16px;">${escapeHtml(input.message)}</div>
  `)

  await sendEmail(recipient, `[NatureQuery contact] ${reason}`, html, {
    replyTo: input.email,
    rateLimitKey: `contact:${input.email}`,
  })
}

export const AI_REPORT_REASON_LABELS = {
  wrong: 'Wrong or misleading',
  offensive: 'Offensive or inappropriate',
  harmful: 'Could cause harm',
  other: 'Something else',
} as const

export type AiReportReason = keyof typeof AI_REPORT_REASON_LABELS

/** Tells the team that someone reported an AI answer in NatureQuery Desktop. */
export async function sendAiReportEmail(input: {
  reporterEmail: string
  reporterName?: string | null
  kind: 'query' | 'explanation' | 'summary'
  reason: AiReportReason
  comment: string
  question: string
  content: string
}): Promise<void> {
  if (!isEmailConfigured()) throw new Error('No email provider configured')

  const recipient = process.env.CONTACT_EMAIL || 'hello@naturequery.app'
  const reason = AI_REPORT_REASON_LABELS[input.reason]
  const block = (value: string) =>
    `<div style="white-space:pre-wrap; border:1px solid #e4e4e7; border-radius:8px; padding:12px; font-family:monospace; font-size:12px;">${escapeHtml(value)}</div>`
  const html = baseTemplate(`
    <p><strong>An AI answer was reported in NatureQuery Desktop</strong></p>
    <p><strong>From:</strong> ${escapeHtml(input.reporterName || input.reporterEmail)} (${escapeHtml(input.reporterEmail)})</p>
    <p><strong>Answer type:</strong> ${escapeHtml(input.kind)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    ${input.comment ? `<p><strong>Comment:</strong></p>${block(input.comment)}` : ''}
    ${input.question ? `<p><strong>What the AI was asked:</strong></p>${block(input.question)}` : ''}
    <p><strong>AI answer:</strong></p>
    ${block(input.content)}
    <p style="font-size:13px; color:#71717a;">The report is also in the audit log (action AI_OUTPUT_REPORTED).</p>
  `)

  await sendEmail(recipient, `[NatureQuery] AI answer reported: ${reason}`, html, {
    replyTo: input.reporterEmail,
    rateLimitKey: `ai-report:${input.reporterEmail}`,
  })
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
    ? `Your scheduled query "${scheduleName}" ran successfully`
    : `Your scheduled query "${scheduleName}" failed`

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

// ---------- Weekly summary ----------

const INK = '#151127'
const MUTED = '#5c5970'
const RULE = '#dcd9e8'
const PAPER = '#f6f5fa'
const VIOLET = '#5336d3'
const MARIGOLD = '#f7b83b'
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'IBM Plex Mono', Consolas, 'Courier New', monospace"

function plain(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function trendText(m: InsightMetrics): string {
  // With nothing last week there is no percentage to give.
  if (m.queries7d_prev === 0)
    return m.queries7d > 0 ? 'none the week before' : 'none last week either'
  if (m.wowDirection === 'up') return `up ${m.wowDelta}% on last week`
  if (m.wowDirection === 'down') return `down ${Math.abs(m.wowDelta)}% on last week`
  return 'about the same as last week'
}

export function weeklySummarySubject(m: InsightMetrics): string {
  return `Your week in NatureQuery: ${m.queries7d} question${m.queries7d !== 1 ? 's' : ''}`
}

/** The weekly summary in the site's look: paper, ink, violet, and marigold for the answer. */
export function weeklySummaryEmailHtml(input: {
  name: string | null
  narrative: string
  metrics: InsightMetrics
  unsubscribeUrl: string
  baseUrl: string
  date?: Date
}): string {
  const { metrics: m, baseUrl } = input
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(input.date ?? new Date())
  const label = `font-family:${MONO}; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:${MUTED};`
  const figure = (name: string, value: string, note?: string) => `
          <td width="50%" valign="top" style="padding:14px 16px; border:1px solid ${RULE}; background:#ffffff;">
            <div style="${label}">${name}</div>
            <div style="font-family:${MONO}; font-size:26px; line-height:1.1; color:${INK}; margin-top:8px;">${value}</div>
            ${note ? `<div style="font-family:${SANS}; font-size:12px; color:${MUTED}; margin-top:6px;">${plain(note)}</div>` : ''}
          </td>`
  const connections = m.topConnections
    .map(
      (c) => `
          <tr>
            <td style="font-family:${SANS}; font-size:14px; color:${INK}; padding:8px 0; border-bottom:1px solid ${RULE};">${plain(c.name)}</td>
            <td align="right" style="font-family:${MONO}; font-size:13px; color:${MUTED}; padding:8px 0; border-bottom:1px solid ${RULE};">${c.count}</td>
          </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plain(weeklySummarySubject(m))}</title>
</head>
<body style="margin:0; padding:0; background:${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="font-family:${SANS}; font-size:15px; font-weight:700; color:${INK}; padding-bottom:20px;">NatureQuery</td></tr>
        <tr><td style="${label}">Weekly summary &middot; ${plain(date)}</td></tr>
        <tr><td style="font-family:${SERIF}; font-size:28px; line-height:1.15; color:${INK}; padding:10px 0 20px;">Your week in NatureQuery${input.name ? `, ${plain(input.name)}` : ''}.</td></tr>
        <tr><td style="border-left:3px solid ${MARIGOLD}; background:#ffffff; padding:16px 20px; font-family:${SANS}; font-size:15px; line-height:1.6; color:${INK};">${plain(input.narrative)}</td></tr>
        <tr><td style="padding-top:20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>${figure('Questions this week', String(m.queries7d), trendText(m))}${figure('This month', String(m.queries30d))}</tr>
            <tr>${figure('Active connections', String(m.connectionCount))}${figure('Saved questions', String(m.savedQueryCount))}</tr>
          </table>
        </td></tr>
        ${
          connections
            ? `<tr><td style="${label} padding-top:24px;">Busiest connections this week</td></tr>
        <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${connections}</table></td></tr>`
            : ''
        }
        <tr><td style="padding:28px 0;">
          <a href="${baseUrl}/dashboard" style="display:inline-block; background:${INK}; color:#ffffff; text-decoration:none; font-family:${SANS}; font-size:14px; font-weight:600; padding:12px 22px; border-radius:6px;">Open NatureQuery</a>
        </td></tr>
        <tr><td style="border-top:1px solid ${RULE}; padding-top:16px; font-family:${SANS}; font-size:12px; line-height:1.6; color:${MUTED};">
          You get this summary every Monday. <a href="${input.unsubscribeUrl}" style="color:${VIOLET};">Stop weekly summaries</a> or manage them in <a href="${baseUrl}/settings" style="color:${VIOLET};">Settings</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function weeklySummaryEmailText(input: {
  name: string | null
  narrative: string
  metrics: InsightMetrics
  unsubscribeUrl: string
  baseUrl: string
}): string {
  const m = input.metrics
  return [
    `Your week in NatureQuery${input.name ? `, ${input.name}` : ''}.`,
    '',
    input.narrative,
    '',
    `Questions this week: ${m.queries7d} (${trendText(m)})`,
    `This month: ${m.queries30d}`,
    `Active connections: ${m.connectionCount}`,
    `Saved questions: ${m.savedQueryCount}`,
    '',
    `Open NatureQuery: ${input.baseUrl}/dashboard`,
    '',
    `You get this summary every Monday. Stop weekly summaries: ${input.unsubscribeUrl}`,
  ].join('\n')
}

export async function sendWeeklySummaryEmail(input: {
  to: string
  name: string | null
  narrative: string
  metrics: InsightMetrics
  unsubscribeToken: string
}): Promise<void> {
  const unsubscribeUrl = weeklySummaryUnsubscribeUrl(appUrl, input.unsubscribeToken)
  // Mail apps offer their own one-click "unsubscribe", which posts to this address.
  const oneClickUrl = `${appUrl.replace(/\/$/, '')}/api/email/unsubscribe?t=${encodeURIComponent(input.unsubscribeToken)}`
  const content = { ...input, unsubscribeUrl, baseUrl: appUrl.replace(/\/$/, '') }

  await sendEmail(input.to, weeklySummarySubject(input.metrics), weeklySummaryEmailHtml(content), {
    text: weeklySummaryEmailText(content),
    headers: {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}
