'use client'

import { useState } from 'react'
import {
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    Lightbulb,
    BarChart3,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info,
    Activity,
    Zap,
    ArrowRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { InsightResult, KeyFinding, Anomaly, Trend, FieldStatistics, ChartRecommendation } from '@/actions/insights'

interface DataInsightsProps {
    insights: InsightResult | null | undefined
    onFollowUpClick?: (question: string) => void
    onApplyChartType?: (type: ChartRecommendation['type']) => void
    isLoading?: boolean
}

// Helper components
function FindingBadge({ type }: { type: KeyFinding['type'] }) {
    const config = {
        positive: { icon: CheckCircle, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
        negative: { icon: XCircle, className: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
        warning: { icon: AlertCircle, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
        neutral: { icon: Info, className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    }
    const { icon: Icon, className } = config[type]
    return (
        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', className)}>
            <Icon className="w-3 h-3" />
            {type}
        </span>
    )
}

function TrendIndicator({ direction, percentage }: { direction: Trend['direction']; percentage?: number }) {
    const config = {
        up: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        down: { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10' },
        stable: { icon: Minus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        volatile: { icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    }
    const { icon: Icon, color, bg } = config[direction]
    return (
        <div className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-lg', bg)}>
            <Icon className={clsx('w-4 h-4', color)} />
            {percentage !== undefined && (
                <span className={clsx('text-sm font-medium', color)}>
                    {percentage > 0 ? '+' : ''}{percentage}%
                </span>
            )}
        </div>
    )
}

function SeverityBadge({ severity }: { severity: Anomaly['severity'] }) {
    const config = {
        high: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
        medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
        low: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    }
    return (
        <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium border', config[severity])}>
            {severity}
        </span>
    )
}

function DataQualityMeter({ score }: { score: number }) {
    const getColor = () => {
        if (score >= 80) return 'bg-emerald-500'
        if (score >= 60) return 'bg-amber-500'
        return 'bg-rose-500'
    }

    const getLabel = () => {
        if (score >= 80) return 'Excellent'
        if (score >= 60) return 'Good'
        if (score >= 40) return 'Fair'
        return 'Poor'
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Data Quality</span>
                <span className="font-medium">{getLabel()} ({score}%)</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                    className={clsx('h-full rounded-full transition-all duration-500', getColor())}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    )
}

// Section components
function SummaryCard({ summary, recommendedChart, onApplyChartType }: {
    summary: string
    recommendedChart: ChartRecommendation
    onApplyChartType?: (type: ChartRecommendation['type']) => void
}) {
    return (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">AI Summary</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
                </div>
            </div>

            {recommendedChart && (
                <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BarChart3 className="w-4 h-4" />
                        <span>Recommended: <strong className="text-foreground capitalize">{recommendedChart.type}</strong> chart</span>
                        <span className="text-primary/60">({Math.round(recommendedChart.confidence * 100)}% confidence)</span>
                    </div>
                    {onApplyChartType && (
                        <button
                            onClick={() => onApplyChartType(recommendedChart.type)}
                            className="text-xs text-primary hover:underline font-medium"
                        >
                            Apply →
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

function KeyFindingsSection({ findings }: { findings: KeyFinding[] }) {
    const [expanded, setExpanded] = useState(true)

    if (findings.length === 0) return null

    return (
        <div className="space-y-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Key Findings
                    <span className="text-xs text-muted-foreground">({findings.length})</span>
                </h4>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
                <div className="space-y-2 animate-slideDown">
                    {findings.map((finding, i) => (
                        <div
                            key={i}
                            className="bg-card border border-border rounded-lg p-3 space-y-1.5"
                        >
                            <div className="flex items-center justify-between">
                                <h5 className="font-medium text-sm">{finding.title}</h5>
                                <FindingBadge type={finding.type} />
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{finding.description}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function TrendsSection({ trends }: { trends: Trend[] }) {
    const [expanded, setExpanded] = useState(true)

    if (trends.length === 0) return null

    return (
        <div className="space-y-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Trends Detected
                    <span className="text-xs text-muted-foreground">({trends.length})</span>
                </h4>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
                <div className="space-y-2 animate-slideDown">
                    {trends.map((trend, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between bg-card border border-border rounded-lg p-3"
                        >
                            <div>
                                <span className="font-medium text-sm">{trend.field}</span>
                                <p className="text-xs text-muted-foreground mt-0.5">{trend.description}</p>
                            </div>
                            <TrendIndicator direction={trend.direction} percentage={trend.percentage} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function AnomaliesSection({ anomalies }: { anomalies: Anomaly[] }) {
    const [expanded, setExpanded] = useState(true)

    if (anomalies.length === 0) return null

    return (
        <div className="space-y-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Anomalies Detected
                    <span className="text-xs text-muted-foreground">({anomalies.length})</span>
                </h4>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
                <div className="space-y-2 animate-slideDown">
                    {anomalies.slice(0, 5).map((anomaly, i) => (
                        <div
                            key={i}
                            className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">
                                    {anomaly.field}: <code className="text-rose-500">{String(anomaly.value)}</code>
                                </span>
                                <SeverityBadge severity={anomaly.severity} />
                            </div>
                            <p className="text-xs text-muted-foreground">{anomaly.reason}</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">Row #{anomaly.rowIndex + 1}</p>
                        </div>
                    ))}
                    {anomalies.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            +{anomalies.length - 5} more anomalies
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

function StatisticsSection({ statistics }: { statistics: FieldStatistics[] }) {
    const [expanded, setExpanded] = useState(false)

    const numericStats = statistics.filter(s => s.type === 'numeric')
    if (numericStats.length === 0) return null

    return (
        <div className="space-y-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Field Statistics
                    <span className="text-xs text-muted-foreground">({numericStats.length} numeric)</span>
                </h4>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
                <div className="overflow-x-auto animate-slideDown">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-2 font-medium">Field</th>
                                <th className="text-right py-2 px-2 font-medium">Min</th>
                                <th className="text-right py-2 px-2 font-medium">Max</th>
                                <th className="text-right py-2 px-2 font-medium">Mean</th>
                                <th className="text-right py-2 px-2 font-medium">Median</th>
                                <th className="text-right py-2 px-2 font-medium">Std Dev</th>
                            </tr>
                        </thead>
                        <tbody>
                            {numericStats.map((stat, i) => (
                                <tr key={i} className="border-b border-border/50">
                                    <td className="py-2 px-2 font-medium">{stat.field}</td>
                                    <td className="text-right py-2 px-2 text-muted-foreground">{stat.min?.toLocaleString()}</td>
                                    <td className="text-right py-2 px-2 text-muted-foreground">{stat.max?.toLocaleString()}</td>
                                    <td className="text-right py-2 px-2 text-muted-foreground">{stat.mean?.toLocaleString()}</td>
                                    <td className="text-right py-2 px-2 text-muted-foreground">{stat.median?.toLocaleString()}</td>
                                    <td className="text-right py-2 px-2 text-muted-foreground">{stat.stdDev?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function FollowUpSection({ questions, onQuestionClick }: {
    questions: string[]
    onQuestionClick?: (question: string) => void
}) {
    if (questions.length === 0) return null

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Explore Further
            </h4>
            <div className="flex flex-wrap gap-2">
                {questions.map((question, i) => (
                    <button
                        key={i}
                        onClick={() => onQuestionClick?.(question)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border hover:border-primary/30 rounded-full text-xs transition-all"
                    >
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                            {question}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                ))}
            </div>
        </div>
    )
}

// Main component
export function DataInsights({
    insights,
    onFollowUpClick,
    onApplyChartType,
    isLoading,
}: DataInsightsProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-primary" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium">Analyzing your data...</p>
                    <p className="text-xs text-muted-foreground mt-1">AI is detecting patterns and insights</p>
                </div>
            </div>
        )
    }

    // Handle null/undefined insights
    if (!insights) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Sparkles className="w-10 h-10 text-muted-foreground/50" />
                <div className="text-center">
                    <p className="text-sm font-medium">No insights yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Run a query to see AI-powered analysis</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 p-4">
            {/* Summary Card */}
            <SummaryCard
                summary={insights.summary}
                recommendedChart={insights.recommendedChart}
                onApplyChartType={onApplyChartType}
            />

            {/* Data Quality */}
            <DataQualityMeter score={insights.dataQualityScore} />

            {/* Key Findings */}
            <KeyFindingsSection findings={insights.keyFindings} />

            {/* Trends */}
            <TrendsSection trends={insights.trends} />

            {/* Anomalies */}
            <AnomaliesSection anomalies={insights.anomalies} />

            {/* Statistics */}
            <StatisticsSection statistics={insights.statistics} />

            {/* Follow-up Questions */}
            <FollowUpSection
                questions={insights.followUpQuestions}
                onQuestionClick={onFollowUpClick}
            />

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground/60 text-center pt-2 border-t border-border">
                Analyzed at {new Date(insights.analyzedAt).toLocaleTimeString()}
            </p>
        </div>
    )
}

// Export loading skeleton
export function DataInsightsSkeleton() {
    return (
        <div className="space-y-4 p-4 animate-pulse">
            <div className="h-24 bg-secondary/50 rounded-xl" />
            <div className="h-4 bg-secondary/50 rounded w-full" />
            <div className="space-y-2">
                <div className="h-16 bg-secondary/50 rounded-lg" />
                <div className="h-16 bg-secondary/50 rounded-lg" />
            </div>
        </div>
    )
}
