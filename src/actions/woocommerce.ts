'use server'

import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/encryption'
import { rateLimitAsync } from '@/lib/rate-limit'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import {
  isWooCommerceOrder,
  wooCommerceOrdersToRows,
  WOOCOMMERCE_ORDER_FIELDS,
  type WooCommerceOrder,
} from '@/lib/woocommerce'

interface WooCommerceCredentials {
  consumerKey: string
  consumerSecret: string
}

export interface CommerceConnectionInfo {
  id: string
  name: string
  provider: 'woocommerce'
  storeUrl: string
  isActive: boolean
  createdAt: string
}

const MAX_IMPORT_ORDERS = 1_000
const PAGE_SIZE = 100

async function requireUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number)
    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
      parts[0] >= 224
    )
  }
  const normalized = address.toLowerCase()
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('::ffff:')
  )
}

async function normalizeAndValidateStoreUrl(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Enter a valid WooCommerce store URL')
  }
  if (url.protocol !== 'https:') throw new Error('WooCommerce connections require HTTPS')
  if (url.username || url.password) throw new Error('Do not include credentials in the store URL')
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private store addresses are not supported')
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('The store URL must resolve to a public internet address')
  }
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString().replace(/\/$/, '')
}

function ordersUrl(
  storeUrl: string,
  options: { page?: number; after?: string; before?: string; status?: string; test?: boolean }
) {
  const url = new URL(storeUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/wp-json/wc/v3/orders`
  url.searchParams.set('per_page', options.test ? '1' : String(PAGE_SIZE))
  url.searchParams.set('page', String(options.page || 1))
  url.searchParams.set('orderby', 'date')
  url.searchParams.set('order', 'asc')
  if (options.after) url.searchParams.set('after', `${options.after}T00:00:00.000Z`)
  if (options.before) url.searchParams.set('before', `${options.before}T23:59:59.999Z`)
  if (options.status && options.status !== 'any') url.searchParams.set('status', options.status)
  return url
}

async function fetchOrdersPage(
  storeUrl: string,
  credentials: WooCommerceCredentials,
  options: { page?: number; after?: string; before?: string; status?: string; test?: boolean }
) {
  const response = await fetch(ordersUrl(storeUrl, options), {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64')}`,
      'User-Agent': 'NatureQuery-WooCommerce/1.0',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  if (response.status >= 300 && response.status < 400) {
    throw new Error('The store redirected the API request. Enter its final HTTPS URL.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    if (response.status === 401 || response.status === 403) {
      throw new Error('WooCommerce rejected the API keys. Use read-only keys with order access.')
    }
    throw new Error(body?.message || `WooCommerce returned HTTP ${response.status}`)
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every(isWooCommerceOrder)) {
    throw new Error('WooCommerce returned an unexpected orders response')
  }
  return {
    orders: data as WooCommerceOrder[],
    totalPages: Math.max(1, Number(response.headers.get('x-wp-totalpages')) || 1),
  }
}

export async function getCommerceConnections(): Promise<{
  success: boolean
  data?: CommerceConnectionInfo[]
  error?: string
}> {
  try {
    const userId = await requireUserId()
    const records = await prisma.commerceConnection.findMany({
      where: { userId, provider: 'woocommerce', isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return {
      success: true,
      data: records.map((record) => ({
        id: record.id,
        name: record.name,
        provider: 'woocommerce',
        storeUrl: record.storeUrl,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load stores',
    }
  }
}

export async function saveWooCommerceConnection(input: {
  name: string
  storeUrl: string
  consumerKey: string
  consumerSecret: string
}): Promise<{ success: boolean; data?: CommerceConnectionInfo; error?: string }> {
  try {
    const userId = await requireUserId()
    const limit = await rateLimitAsync(`woocommerce_connect:${userId}`, {
      maxRequests: 5,
      windowSeconds: 60,
    })
    if (!limit.allowed)
      throw new Error(`Too many attempts. Try again in ${limit.retryAfterSeconds}s.`)

    const name = input.name.trim()
    const consumerKey = input.consumerKey.trim()
    const consumerSecret = input.consumerSecret.trim()
    if (!name || name.length > 100) throw new Error('Use a store name under 100 characters')
    if (!/^ck_[A-Za-z0-9]+$/.test(consumerKey)) throw new Error('Enter a valid consumer key')
    if (!/^cs_[A-Za-z0-9]+$/.test(consumerSecret)) throw new Error('Enter a valid consumer secret')
    const storeUrl = await normalizeAndValidateStoreUrl(input.storeUrl)
    const credentials = { consumerKey, consumerSecret }
    await fetchOrdersPage(storeUrl, credentials, { test: true })

    const record = await prisma.commerceConnection.upsert({
      where: { userId_provider_storeUrl: { userId, provider: 'woocommerce', storeUrl } },
      update: { name, credentials: encrypt(JSON.stringify(credentials)), isActive: true },
      create: {
        name,
        provider: 'woocommerce',
        storeUrl,
        credentials: encrypt(JSON.stringify(credentials)),
        userId,
      },
    })
    await writeImmutableAuditLog({
      userId,
      action: 'COMMERCE_CONNECTION_SAVED',
      resource: 'commerce_connection',
      resourceId: record.id,
      metadata: { provider: 'woocommerce', name, storeUrl },
    })
    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        provider: 'woocommerce',
        storeUrl: record.storeUrl,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect WooCommerce',
    }
  }
}

export async function importWooCommerceOrders(input: {
  connectionId: string
  after: string
  before: string
  status: string
}): Promise<{
  success: boolean
  data?: {
    name: string
    storeUrl: string
    rows: ReturnType<typeof wooCommerceOrdersToRows>
    fields: string[]
    currency: string
    truncated: boolean
  }
  error?: string
}> {
  try {
    const userId = await requireUserId()
    const limit = await rateLimitAsync(`woocommerce_import:${userId}`, {
      maxRequests: 10,
      windowSeconds: 60,
    })
    if (!limit.allowed)
      throw new Error(`Too many imports. Try again in ${limit.retryAfterSeconds}s.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.after) || !/^\d{4}-\d{2}-\d{2}$/.test(input.before)) {
      throw new Error('Choose a valid start and end date')
    }
    if (input.after > input.before) throw new Error('Start date must be before the end date')
    const allowedStatuses = new Set(['any', 'completed', 'processing', 'on-hold', 'refunded'])
    if (!allowedStatuses.has(input.status)) throw new Error('Choose a valid order status')

    const connection = await prisma.commerceConnection.findFirst({
      where: { id: input.connectionId, userId, provider: 'woocommerce', isActive: true },
    })
    if (!connection) throw new Error('WooCommerce connection not found')
    await normalizeAndValidateStoreUrl(connection.storeUrl)
    const credentials = JSON.parse(decrypt(connection.credentials)) as WooCommerceCredentials

    const orders: WooCommerceOrder[] = []
    let page = 1
    let totalPages = 1
    do {
      const result = await fetchOrdersPage(connection.storeUrl, credentials, {
        page,
        after: input.after,
        before: input.before,
        status: input.status,
      })
      orders.push(...result.orders)
      totalPages = result.totalPages
      page += 1
    } while (page <= totalPages && orders.length < MAX_IMPORT_ORDERS)

    const limitedOrders = orders.slice(0, MAX_IMPORT_ORDERS)
    const rows = wooCommerceOrdersToRows(limitedOrders)
    await writeImmutableAuditLog({
      userId,
      action: 'WOOCOMMERCE_ORDERS_IMPORTED',
      resource: 'commerce_connection',
      resourceId: connection.id,
      metadata: {
        after: input.after,
        before: input.before,
        status: input.status,
        rowCount: rows.length,
      },
    })
    return {
      success: true,
      data: {
        name: `${connection.name} orders`,
        storeUrl: connection.storeUrl,
        rows,
        fields: [...WOOCOMMERCE_ORDER_FIELDS],
        currency: String(rows.find((row) => row.currency)?.currency || ''),
        truncated: totalPages * PAGE_SIZE > MAX_IMPORT_ORDERS,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import WooCommerce orders',
    }
  }
}
