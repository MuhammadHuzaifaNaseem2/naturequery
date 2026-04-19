'use client'

import { useState, useTransition, useRef } from 'react'
import { User, Moon, Sun, Monitor, Edit2, Check, X, Loader2, Camera } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { clsx } from 'clsx'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'

interface ProfileSettingsProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
  }
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { update: updateSession } = useSession()
  
  const [name, setName] = useState(user.name || '')
  const [isEditing, setIsEditing] = useState(false)
  const [tempName, setTempName] = useState(name)
  const [isPending, startTransition] = useTransition()
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ]

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      toast.error('Name cannot be empty')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tempName }),
        })

        if (!res.ok) throw new Error('Failed to update name')
        
        setName(tempName)
        setIsEditing(false)
        await updateSession({ name: tempName })
        toast.success('Profile updated successfully')
        router.refresh()
      } catch (err) {
        toast.error('Could not update profile')
      }
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit to 2MB to keep base64 strings manageable
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploadingImage(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data }),
        })

        if (!res.ok) throw new Error('Failed to update image')
        
        await updateSession({ image: base64Data })
        toast.success('Profile picture updated successfully')
        router.refresh()
      } catch (err) {
        toast.error('Could not update profile picture')
      } finally {
        setIsUploadingImage(false)
      }
    }
    reader.onerror = () => {
      toast.error('Error reading file')
      setIsUploadingImage(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              {isUploadingImage ? (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : null}
              {user.image && !user.image.includes('twimg') /* handle generic fallback if necessary */ ? (
                <img src={user.image} alt={name} className="w-14 h-14 object-cover" />
              ) : (
                <User className="w-6 h-6 text-primary" />
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                <Camera className="w-5 h-5" />
              </div>
            </button>
            <input
              type="file"
              accept="image/png, image/jpeg, image/gif, image/webp"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="px-3 py-1.5 bg-secondary border border-primary/50 focus:ring-2 focus:ring-primary/30 rounded-lg text-lg font-semibold w-full max-w-[250px] outline-none"
                  disabled={isPending}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={isPending}
                  className="p-1.5 bg-success/10 text-success hover:bg-success/20 rounded-md transition-colors"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setTempName(name)
                  }}
                  disabled={isPending}
                  className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h3 className="font-semibold text-lg">{name || 'User'}</h3>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit Name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium capitalize">
              {(user.role || 'analyst').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Theme Selector */}
      <div className="card p-5">
        <h4 className="font-medium mb-3">Appearance</h4>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={clsx(
                'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                theme === value
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:border-primary/30'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Account Info */}
      <div className="card p-5">
        <h4 className="font-medium mb-3">Account</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{(user.role || 'analyst').toLowerCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
