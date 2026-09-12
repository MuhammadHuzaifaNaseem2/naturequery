'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Link2, Plus, RefreshCcw, ShoppingBag, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCommerceConnections,
  importWooCommerceOrders,
  saveWooCommerceConnection,
  type CommerceConnectionInfo,
} from '@/actions/woocommerce'
import type { ReconciliationRow } from '@/lib/reconciliation'
import { getWooCommerceDemoReconciliation } from '@/lib/woocommerce-demo'

export interface WooCommerceImportResult {
  name: string
  rows: ReconciliationRow[]
  fields: string[]
  currency: string
  period: string
  connectionName: string
  comparison?: {
    name: string
    rows: ReconciliationRow[]
    fields: string[]
  }
}

function defaultDateRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return {
    after: start.toISOString().slice(0, 10),
    before: now.toISOString().slice(0, 10),
  }
}

export function WooCommerceImportPanel({
  onImport,
}: {
  onImport: (result: WooCommerceImportResult) => void
}) {
  const initialRange = defaultDateRange()
  const [connections, setConnections] = useState<CommerceConnectionInfo[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [name, setName] = useState('My WooCommerce store')
  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [after, setAfter] = useState(initialRange.after)
  const [before, setBefore] = useState(initialRange.before)
  const [status, setStatus] = useState('completed')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    getCommerceConnections().then((response) => {
      if (!response.success || !response.data) return
      setConnections(response.data)
      setSelectedId(response.data[0]?.id || '')
      setShowConnect(response.data.length === 0)
    })
  }, [])

  const connectStore = async () => {
    setIsConnecting(true)
    const response = await saveWooCommerceConnection({
      name,
      storeUrl,
      consumerKey,
      consumerSecret,
    })
    setIsConnecting(false)
    if (!response.success || !response.data) {
      toast.error('Could not connect the store', { description: response.error })
      return
    }
    setConnections((current) => [
      response.data!,
      ...current.filter((connection) => connection.id !== response.data!.id),
    ])
    setSelectedId(response.data.id)
    setConsumerKey('')
    setConsumerSecret('')
    setShowConnect(false)
    toast.success('WooCommerce connected', {
      description: 'NatureQuery verified order access and encrypted the API credentials.',
    })
  }

  const importOrders = async () => {
    if (!selectedId) {
      setShowConnect(true)
      toast.error('Connect a WooCommerce store first')
      return
    }
    setIsImporting(true)
    const response = await importWooCommerceOrders({
      connectionId: selectedId,
      after,
      before,
      status,
    })
    setIsImporting(false)
    if (!response.success || !response.data) {
      toast.error('Could not import WooCommerce orders', { description: response.error })
      return
    }
    if (response.data.rows.length === 0) {
      toast.error('No orders found', { description: 'Try a wider date range or another status.' })
      return
    }
    const connection = connections.find((item) => item.id === selectedId)
    onImport({
      name: response.data.name,
      rows: response.data.rows,
      fields: response.data.fields,
      currency: response.data.currency,
      period: `${after} to ${before}`,
      connectionName: connection?.name || 'WooCommerce',
    })
    toast.success(`${response.data.rows.length} WooCommerce orders imported`, {
      description: response.data.truncated
        ? 'The import reached the 1,000-order limit. Use a shorter date range.'
        : 'Now upload the matching payment settlement as Report B.',
    })
  }

  const loadDemo = () => {
    const demo = getWooCommerceDemoReconciliation()
    onImport({
      name: demo.source.name,
      rows: demo.source.rows,
      fields: demo.source.fields,
      currency: demo.currency,
      period: demo.period,
      connectionName: 'WooCommerce demo',
      comparison: demo.comparison,
    })
    setShowConnect(false)
    toast.success('Demo reconciliation loaded', {
      description: 'Review the fee, missing payout, and unknown settlement differences below.',
    })
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold">WooCommerce orders</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Import store orders directly into Report A, then compare them with a payment CSV or
              Excel settlement.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={loadDemo} className="btn-secondary text-sm">
            <Sparkles className="w-4 h-4" /> Load demo
          </button>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground min-w-52">
            Store
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="input block w-full text-sm font-normal text-foreground"
            >
              <option value="">Choose a store</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            From
            <input
              type="date"
              value={after}
              max={before}
              onChange={(event) => setAfter(event.target.value)}
              className="input block text-sm font-normal text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            To
            <input
              type="date"
              value={before}
              min={after}
              onChange={(event) => setBefore(event.target.value)}
              className="input block text-sm font-normal text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground min-w-36">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="input block w-full text-sm font-normal text-foreground"
            >
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="on-hold">On hold</option>
              <option value="refunded">Refunded</option>
              <option value="any">Any status</option>
            </select>
          </label>
          <button
            onClick={importOrders}
            disabled={isImporting || !selectedId}
            className="btn-gradient text-sm disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${isImporting ? 'animate-spin' : ''}`} />
            {isImporting ? 'Importing...' : 'Import orders'}
          </button>
          <button
            onClick={() => setShowConnect((current) => !current)}
            className="btn-secondary text-sm"
          >
            <Plus className="w-4 h-4" /> Connect store
          </button>
        </div>
      </div>

      {showConnect && (
        <div className="border-t border-border bg-secondary/20 p-5">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="xl:w-64">
              <p className="text-sm font-semibold">Connect with read-only API keys</p>
              <p className="text-xs text-muted-foreground mt-1">
                In WordPress, open WooCommerce → Settings → Advanced → REST API, add a key, and
                choose Read permission.
              </p>
              <a
                href="https://developer.woocommerce.com/docs/apis/rest-api/authentication"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                WooCommerce instructions <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground flex-1">
              Store name
              <input
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                className="input block w-full text-sm font-normal text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground flex-[1.4]">
              Store HTTPS URL
              <input
                type="url"
                value={storeUrl}
                placeholder="https://shop.example.com"
                onChange={(event) => setStoreUrl(event.target.value)}
                className="input block w-full text-sm font-normal text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground flex-1">
              Consumer key
              <input
                type="password"
                autoComplete="off"
                value={consumerKey}
                placeholder="ck_..."
                onChange={(event) => setConsumerKey(event.target.value)}
                className="input block w-full text-sm font-normal text-foreground"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground flex-1">
              Consumer secret
              <input
                type="password"
                autoComplete="off"
                value={consumerSecret}
                placeholder="cs_..."
                onChange={(event) => setConsumerSecret(event.target.value)}
                className="input block w-full text-sm font-normal text-foreground"
              />
            </label>
            <button
              onClick={connectStore}
              disabled={
                isConnecting || !name.trim() || !storeUrl.trim() || !consumerKey || !consumerSecret
              }
              className="btn-gradient text-sm disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {isConnecting ? 'Verifying...' : 'Verify & save'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Credentials are encrypted on the server. NatureQuery requests order data only and never
            asks for write access.
          </p>
        </div>
      )}
    </section>
  )
}
