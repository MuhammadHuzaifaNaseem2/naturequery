'use client'

import { AppLogo } from '@/components/AppLogo'
import { Sparkles, BarChart3, Database, Zap, Shield, Users } from 'lucide-react'

interface AuthLayoutProps {
    children: React.ReactNode
    title?: string
    subtitle?: string
}

const features = [
    { icon: Sparkles, label: 'AI-Powered SQL', description: 'Natural language to SQL' },
    { icon: Database, label: 'Multi-Database', description: '5+ database types' },
    { icon: BarChart3, label: 'Smart Insights', description: 'Automatic analysis' },
    { icon: Zap, label: 'Instant Results', description: 'Sub-second queries' },
]

export function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex">
            {/* Left Side - Product Showcase (hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-gradient-to-br from-primary via-accent to-primary">
                {/* Animated Background Blobs */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-blob" />
                    <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
                    <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
                </div>

                {/* Grid Pattern Overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-12">
                        <AppLogo size="xl" showText={false} />
                        <div>
                            <h1 className="text-2xl font-bold text-white">NatureQuery</h1>
                            <p className="text-sm text-white/70">Natural Language to SQL</p>
                        </div>
                    </div>

                    {/* Main Headline */}
                    <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
                        Turn Questions into
                        <span className="block text-white/90">Data Insights</span>
                    </h2>

                    <p className="text-lg text-white/80 mb-10 max-w-md">
                        Connect your database, ask questions in plain English, and get instant SQL queries with AI-powered insights.
                    </p>

                    {/* Feature Grid */}
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                        {features.map((feature, index) => (
                            <div
                                key={feature.label}
                                className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-colors"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <feature.icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm">{feature.label}</h3>
                                    <p className="text-xs text-white/70">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-16 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-8 text-white/70 text-sm">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                <span>SOC 2 Compliant</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>10K+ Users</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Auth Form */}
            <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-6 lg:p-12 bg-background relative">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

                {/* Floating decorative elements */}
                <div className="absolute top-20 right-20 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                <div className="absolute bottom-20 left-10 w-40 h-40 bg-accent/5 rounded-full blur-2xl" />

                {/* Form Container */}
                <div className="relative z-10 w-full max-w-md">
                    {children}
                </div>
            </div>
        </div>
    )
}
