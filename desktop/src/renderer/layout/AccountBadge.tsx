import { LogIn, LogOut, Sparkles, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Menu } from '../components/ui'
import { api } from '../lib/nq'
import { openDialog, useApp } from '../store/app-store'
import { startSignIn } from '../store/assistant'

export function AccountBadge() {
  const auth = useApp((state) => state.auth)

  if (auth.status !== 'signed-in') {
    return (
      <button
        type="button"
        onClick={() =>
          auth.status === 'pending' ? openDialog({ kind: 'sign-in' }) : void startSignIn()
        }
        className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1">
          {auth.status === 'pending' ? 'Waiting for sign-in…' : 'Sign in for AI'}
        </span>
        <LogIn className="h-3.5 w-3.5" />
      </button>
    )
  }

  const plan = auth.plan
  const initial = (auth.user.name || auth.user.email).trim().charAt(0).toUpperCase()
  return (
    <Menu
      label="Account"
      align="start"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-secondary/70"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-semibold text-white">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium leading-tight">
              {auth.user.name || auth.user.email}
            </span>
            {plan && (
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {plan.planName}
                {plan.queryLimit > 0
                  ? ` · ${plan.queriesUsed} of ${plan.queryLimit} AI questions`
                  : ''}
              </span>
            )}
          </span>
        </button>
      )}
      items={[
        {
          label: 'Manage account',
          icon: <UserRound className="h-4 w-4" />,
          onSelect: () => void api.auth.openAccount(),
        },
        {
          label: 'Plans and billing',
          icon: <Sparkles className="h-4 w-4" />,
          onSelect: () => void api.auth.openAccount('/settings/billing'),
        },
        'separator',
        {
          label: 'Sign out',
          icon: <LogOut className="h-4 w-4" />,
          onSelect: () =>
            void api.auth.signOut().then(
              () =>
                toast.success('Signed out. Your connections and history stay on this computer.'),
              (error) => toast.error((error as Error).message)
            ),
        },
      ]}
    />
  )
}
