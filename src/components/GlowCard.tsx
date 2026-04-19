'use client'

import React, { useRef, useState } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    className?: string
}

export const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
    ({ children, className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'relative rounded-2xl border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-lg transition-colors hover:bg-white/50 dark:hover:bg-black/50 hover:border-white/20',
                    className
                )}
                {...props}
            >
                <div className="relative z-20 h-full">
                    {children}
                </div>
            </div>
        )
    }
)

GlowCard.displayName = 'GlowCard'
