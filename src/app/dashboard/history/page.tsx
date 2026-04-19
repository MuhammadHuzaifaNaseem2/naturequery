import { Metadata } from 'next'
import { HistoryClient } from './HistoryClient'

export const metadata: Metadata = {
  title: 'Query History - NatureQuery',
  description: 'View and manage your complete query history',
}

export default function HistoryPage() {
  return <HistoryClient />
}
