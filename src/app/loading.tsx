import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  )
}
