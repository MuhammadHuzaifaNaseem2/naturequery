'use client'

import React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

// The name is historical: this is a plain surface with a hairline edge.
export const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative rounded-lg border border-border bg-card', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlowCard.displayName = 'GlowCard'
