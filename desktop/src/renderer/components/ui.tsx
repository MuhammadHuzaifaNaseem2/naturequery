import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { clsx } from 'clsx'
import { AlertTriangle, Check, ChevronDown, Copy, Loader2, X } from 'lucide-react'
import type { AppError } from '@shared/types'
import { api } from '../lib/nq'

// ─── Buttons ─────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'border border-border bg-card text-foreground hover:bg-secondary',
  ghost: 'text-foreground hover:bg-secondary',
  subtle: 'bg-secondary text-foreground hover:bg-secondary/70',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    icon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-secondary text-foreground',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={clsx('h-4 w-4 animate-spin text-muted-foreground', className)}
      aria-hidden
    />
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-secondary px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

export function modKey(): string {
  return api.platform === 'darwin' ? '⌘' : 'Ctrl'
}

// ─── Form fields ─────────────────────────────────────────────────────

const fieldBase =
  'w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input ref={ref} className={clsx(fieldBase, 'h-8', className)} spellCheck={false} {...rest} />
    )
  }
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(fieldBase, 'py-2', className)}
      spellCheck={false}
      {...rest}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={clsx(fieldBase, 'h-8 appearance-none pr-8', className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2 h-4 w-4 text-muted-foreground" />
      </div>
    )
  }
)

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
  optional,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
  optional?: boolean
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline gap-1.5 text-xs font-medium text-foreground/90"
      >
        {label}
        {optional && <span className="font-normal text-muted-foreground">Optional</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; icon?: ReactNode; title?: string }[]
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-border bg-secondary/60 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded px-2.5 font-medium transition-colors',
            size === 'sm' ? 'h-6 text-xs' : 'h-7 text-[13px]',
            value === option.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ─── Dialog ──────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  dismissible?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onMouseDown={(event) => {
        if (dismissible && event.target === ref.current) onClose()
      }}
      className={clsx(
        'max-h-[calc(100vh-64px)] overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-scale-in',
        { sm: 'w-[420px]', md: 'w-[560px]', lg: 'w-[720px]', xl: 'w-[880px]' }[width],
        'max-w-[calc(100vw-48px)]'
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100vh-64px)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-0.5">
                <X className="h-4 w-4" />
              </IconButton>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}

// ─── Menu ────────────────────────────────────────────────────────────

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  shortcut?: string
}

export function Menu({
  trigger,
  items,
  align = 'end',
  label,
}: {
  trigger: (props: {
    onClick: () => void
    'aria-expanded': boolean
    'aria-haspopup': 'menu'
  }) => ReactNode
  items: (MenuItem | 'separator')[]
  align?: 'start' | 'end'
  label: string
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    list.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const buttons = [
      ...(list.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []),
    ]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.stopPropagation()
      setOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      buttons[(index + 1) % buttons.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    }
  }

  return (
    <div ref={container} className="relative" onKeyDown={onKeyDown}>
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label={label}
          className={clsx(
            'absolute top-full z-50 mt-1 min-w-[200px] animate-fade-in rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, index) =>
            item === 'separator' ? (
              <div key={`sep-${index}`} className="my-1 h-px bg-border" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors focus:outline-none disabled:opacity-40',
                  item.danger
                    ? 'text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
                    : 'hover:bg-secondary focus:bg-secondary'
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[11px] text-muted-foreground">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Feedback ────────────────────────────────────────────────────────

export function ErrorNotice({
  error,
  className,
  compact,
}: {
  error: AppError
  className?: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const details = [error.message, error.hint, error.detail].filter(Boolean).join('\n\n')
  return (
    <div
      role="alert"
      className={clsx(
        'selectable rounded-lg border border-destructive/30 bg-destructive/[0.07] text-[13px]',
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
        className
      )}
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-snug text-foreground">{error.message}</p>
          {error.hint && <p className="leading-relaxed text-muted-foreground">{error.hint}</p>}
          {error.detail && (
            <details className="group pt-1">
              <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11.5px] text-muted-foreground">
                {error.detail}
              </pre>
            </details>
          )}
        </div>
        <IconButton
          label={copied ? 'Copied' : 'Copy error'}
          onClick={async () => {
            await api.clipboard.write(details).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center px-6 py-10 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-[13.5px] font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
