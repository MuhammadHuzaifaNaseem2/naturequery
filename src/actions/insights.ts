'use server'

import { QueryResultRow } from './db'
import { DatabaseSchema } from './db'
import { getGroqClient, withKeyRotation } from '@/lib/groq-keys'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KeyFinding {
  type: 'positive' | 'negative' | 'neutral' | 'warning'
  title: string
  description: string
  metric?: string
  value?: string | number
}

export interface Anomaly {
  field: string
  value: unknown
  rowIndex: number
  reason: string
  severity: 'low' | 'medium' | 'high'
}

export interface Trend {
  field: string
  direction: 'up' | 'down' | 'stable' | 'volatile'
  percentage?: number
  description: string
}

export interface FieldStatistics {
  field: string
  type: 'numeric' | 'categorical' | 'date' | 'text'
  count: number
  nullCount: number
  uniqueCount: number
  // Numeric fields only
  min?: number
  max?: number
  mean?: number
  median?: number
  stdDev?: number
  // Categorical fields only
  topValues?: { value: string; count: number }[]
}

export interface ChartRecommendation {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'table'
  reason: string
  xAxis?: string
  yAxis?: string[]
  confidence: number
}

export interface InsightResult {
  summary: string
  keyFindings: KeyFinding[]
  anomalies: Anomaly[]
  trends: Trend[]
  statistics: FieldStatistics[]
  recommendedChart: ChartRecommendation
  followUpQuestions: string[]
  dataQualityScore: number
  analyzedAt: Date
}

export interface AnalyzeRequest {
  rows: QueryResultRow[]
  fields: string[]
  originalQuestion: string
  schema?: DatabaseSchema
}

export interface AnalyzeResult {
  success: boolean
  insights?: InsightResult
  error?: string
}

// ─── Statistical Analysis ───────────────────────────────────────────────────

function calculateStatistics(rows: QueryResultRow[], fields: string[]): FieldStatistics[] {
  return fields.map((field) => {
    const values = rows.map((row) => row[field])
    const nonNullValues = values.filter((v) => v !== null && v !== undefined)
    const nullCount = values.length - nonNullValues.length

    // Determine field type
    const sampleValue = nonNullValues[0]
    const isNumeric =
      typeof sampleValue === 'number' ||
      (typeof sampleValue === 'string' && !isNaN(Number(sampleValue)) && sampleValue.trim() !== '')
    const isDate =
      sampleValue instanceof Date ||
      (typeof sampleValue === 'string' &&
        !isNaN(Date.parse(sampleValue)) &&
        sampleValue.includes('-'))

    const baseStats: FieldStatistics = {
      field,
      type: isNumeric ? 'numeric' : isDate ? 'date' : 'categorical',
      count: values.length,
      nullCount,
      uniqueCount: new Set(nonNullValues.map((v) => String(v))).size,
    }

    if (isNumeric) {
      const numericValues = nonNullValues
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((v) => !isNaN(v))

      if (numericValues.length > 0) {
        const sorted = [...numericValues].sort((a, b) => a - b)
        const sum = numericValues.reduce((a, b) => a + b, 0)
        const mean = sum / numericValues.length

        // Calculate standard deviation
        const squaredDiffs = numericValues.map((v) => Math.pow(v - mean, 2))
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numericValues.length
        const stdDev = Math.sqrt(avgSquaredDiff)

        // Calculate median
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

        return {
          ...baseStats,
          type: 'numeric',
          min: sorted[0],
          max: sorted[sorted.length - 1],
          mean: Math.round(mean * 100) / 100,
          median: Math.round(median * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
        }
      }
    }

    // For categorical fields, get top values
    if (baseStats.type === 'categorical' || baseStats.type === 'text') {
      const valueCounts = new Map<string, number>()
      nonNullValues.forEach((v) => {
        const key = String(v)
        valueCounts.set(key, (valueCounts.get(key) || 0) + 1)
      })

      const topValues = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))

      return { ...baseStats, topValues }
    }

    return baseStats
  })
}

function detectAnomalies(rows: QueryResultRow[], statistics: FieldStatistics[]): Anomaly[] {
  const anomalies: Anomaly[] = []

  statistics.forEach((stat) => {
    if (stat.type === 'numeric' && stat.mean !== undefined && stat.stdDev !== undefined) {
      // Z-score based anomaly detection (values > 2 std devs from mean)
      const threshold = 2
      rows.forEach((row, index) => {
        const value = row[stat.field]
        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
          const numValue = typeof value === 'number' ? value : Number(value)
          const zScore = Math.abs((numValue - stat.mean!) / stat.stdDev!)

          if (zScore > threshold && stat.stdDev! > 0) {
            anomalies.push({
              field: stat.field,
              value: numValue,
              rowIndex: index,
              reason: `Value ${numValue} is ${zScore.toFixed(1)} standard deviations from the mean (${stat.mean})`,
              severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
            })
          }
        }
      })
    }
  })

  // Limit to top 10 most significant anomalies
  return anomalies
    .sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    .slice(0, 10)
}

function detectTrends(rows: QueryResultRow[], statistics: FieldStatistics[]): Trend[] {
  const trends: Trend[] = []

  statistics.forEach((stat) => {
    if (stat.type === 'numeric' && rows.length >= 3) {
      const values = rows
        .map((row) => row[stat.field])
        .filter((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))))
        .map((v) => (typeof v === 'number' ? v : Number(v)))

      if (values.length >= 3) {
        // Simple trend detection: compare first half to second half
        const midpoint = Math.floor(values.length / 2)
        const firstHalf = values.slice(0, midpoint)
        const secondHalf = values.slice(midpoint)

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

        if (firstAvg !== 0) {
          const percentageChange = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100

          // Check volatility (coefficient of variation)
          const cv = stat.stdDev! / Math.abs(stat.mean!)

          let direction: 'up' | 'down' | 'stable' | 'volatile'
          if (cv > 0.5) {
            direction = 'volatile'
          } else if (Math.abs(percentageChange) < 5) {
            direction = 'stable'
          } else {
            direction = percentageChange > 0 ? 'up' : 'down'
          }

          trends.push({
            field: stat.field,
            direction,
            percentage: Math.round(percentageChange * 10) / 10,
            description:
              direction === 'volatile'
                ? `${stat.field} shows high variability (CV: ${(cv * 100).toFixed(0)}%)`
                : direction === 'stable'
                  ? `${stat.field} is relatively stable`
                  : `${stat.field} ${direction === 'up' ? 'increased' : 'decreased'} by ${Math.abs(Math.round(percentageChange))}%`,
          })
        }
      }
    }
  })

  return trends
}

function recommendChart(
  rows: QueryResultRow[],
  fields: string[],
  statistics: FieldStatistics[]
): ChartRecommendation {
  const numericFields = statistics.filter((s) => s.type === 'numeric')
  const categoricalFields = statistics.filter((s) => s.type === 'categorical' || s.type === 'text')
  const dateFields = statistics.filter((s) => s.type === 'date')

  // Time series data → Line chart
  if (dateFields.length > 0 && numericFields.length > 0) {
    return {
      type: 'line',
      reason: 'Time-based data is best visualized with a line chart to show trends over time',
      xAxis: dateFields[0].field,
      yAxis: numericFields.slice(0, 3).map((f) => f.field),
      confidence: 0.9,
    }
  }

  // Few categories with numeric values → Bar chart
  if (categoricalFields.length > 0 && numericFields.length > 0) {
    const primaryCategorical = categoricalFields[0]
    if (primaryCategorical.uniqueCount <= 15) {
      return {
        type: 'bar',
        reason: `Comparing ${primaryCategorical.uniqueCount} categories is best shown with a bar chart`,
        xAxis: primaryCategorical.field,
        yAxis: numericFields.slice(0, 2).map((f) => f.field),
        confidence: 0.85,
      }
    }
  }

  // Proportions with few categories → Pie chart
  if (categoricalFields.length === 1 && numericFields.length === 1) {
    const cat = categoricalFields[0]
    if (cat.uniqueCount <= 8 && cat.uniqueCount >= 2) {
      return {
        type: 'pie',
        reason: 'Distribution across a small number of categories is well-suited for a pie chart',
        xAxis: cat.field,
        yAxis: [numericFields[0].field],
        confidence: 0.8,
      }
    }
  }

  // Two numeric fields → Scatter plot
  if (numericFields.length >= 2 && categoricalFields.length === 0) {
    return {
      type: 'scatter',
      reason: 'Relationship between two numeric variables is best visualized with a scatter plot',
      xAxis: numericFields[0].field,
      yAxis: [numericFields[1].field],
      confidence: 0.75,
    }
  }

  // Cumulative or flowing data → Area chart
  if (numericFields.length === 1 && rows.length > 10) {
    return {
      type: 'area',
      reason: 'Single metric over multiple data points works well as an area chart',
      xAxis: fields[0],
      yAxis: [numericFields[0].field],
      confidence: 0.7,
    }
  }

  // Default to bar chart
  return {
    type: 'bar',
    reason: 'Bar chart provides a clear comparison of values',
    xAxis: fields[0],
    yAxis: numericFields.length > 0 ? [numericFields[0].field] : [],
    confidence: 0.6,
  }
}

function calculateDataQualityScore(statistics: FieldStatistics[]): number {
  if (statistics.length === 0) return 0

  let totalScore = 0
  let fieldCount = 0

  statistics.forEach((stat) => {
    fieldCount++
    let fieldScore = 100

    // Penalize for null values
    const nullRatio = stat.nullCount / stat.count
    fieldScore -= nullRatio * 50

    // Penalize for low uniqueness in non-categorical fields
    if (stat.type === 'numeric') {
      const uniqueRatio = stat.uniqueCount / stat.count
      if (uniqueRatio < 0.1) fieldScore -= 20 // Low variability
    }

    totalScore += Math.max(0, fieldScore)
  })

  return Math.round(totalScore / fieldCount)
}

// ─── AI-Powered Analysis ────────────────────────────────────────────────────

const INSIGHTS_SYSTEM_PROMPT = `You are a data analyst AI. Analyze the provided query results and generate insights.

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "summary": "A 1-2 sentence plain English summary of the data",
  "keyFindings": [
    {"type": "positive|negative|neutral|warning", "title": "Short title", "description": "Detailed finding"}
  ],
  "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"]
}

RULES:
- Summary should highlight the most important insight
- Include 2-4 key findings
- Suggest 3 follow-up questions that would provide deeper insights
- Use specific numbers from the data
- Keep descriptions concise but informative
- DO NOT include any text outside the JSON object`

async function generateAIInsights(
  rows: QueryResultRow[],
  fields: string[],
  statistics: FieldStatistics[],
  originalQuestion: string
): Promise<{ summary: string; keyFindings: KeyFinding[]; followUpQuestions: string[] }> {
  // Create a concise data summary for the AI
  const dataSummary = {
    question: originalQuestion,
    rowCount: rows.length,
    fields: fields,
    statistics: statistics.map((s) => ({
      field: s.field,
      type: s.type,
      ...(s.type === 'numeric' ? { min: s.min, max: s.max, mean: s.mean } : {}),
      ...(s.topValues ? { topValues: s.topValues.slice(0, 3) } : {}),
    })),
    sampleData: rows.slice(0, 5),
  }

  if (!getGroqClient()) {
    return generateMockAIInsights(rows, fields, statistics, originalQuestion)
  }

  try {
    const completion = await withKeyRotation((groq) =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this data:\n${JSON.stringify(dataSummary, null, 2)}` },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      })
    )

    const rawResponse = completion.choices[0]?.message?.content?.trim() || ''

    // Parse JSON response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        summary: parsed.summary || 'Analysis complete.',
        keyFindings: (parsed.keyFindings || []).map((f: any) => ({
          type: f.type || 'neutral',
          title: f.title || 'Finding',
          description: f.description || '',
        })),
        followUpQuestions: parsed.followUpQuestions || [],
      }
    }
  } catch (error) {
    console.error('AI insights generation failed:', error)
  }

  return generateMockAIInsights(rows, fields, statistics, originalQuestion)
}

function generateMockAIInsights(
  rows: QueryResultRow[],
  fields: string[],
  statistics: FieldStatistics[],
  originalQuestion: string
): { summary: string; keyFindings: KeyFinding[]; followUpQuestions: string[] } {
  const numericStats = statistics.filter((s) => s.type === 'numeric')
  const primaryStat = numericStats[0]

  let summary = `Query returned ${rows.length} rows with ${fields.length} columns.`
  if (primaryStat) {
    summary = `Your data shows ${rows.length} records. The ${primaryStat.field} ranges from ${primaryStat.min} to ${primaryStat.max} with an average of ${primaryStat.mean}.`
  }

  const keyFindings: KeyFinding[] = []

  if (primaryStat && primaryStat.max && primaryStat.min) {
    const range = primaryStat.max - primaryStat.min
    keyFindings.push({
      type: 'neutral',
      title: `${primaryStat.field} Analysis`,
      description: `Values span a range of ${range.toLocaleString()}, with median at ${primaryStat.median}`,
    })
  }

  if (rows.length > 0) {
    keyFindings.push({
      type: 'positive',
      title: 'Data Retrieved Successfully',
      description: `Found ${rows.length} matching records across ${fields.length} fields`,
    })
  }

  const nullFields = statistics.filter((s) => s.nullCount > 0)
  if (nullFields.length > 0) {
    keyFindings.push({
      type: 'warning',
      title: 'Missing Data Detected',
      description: `${nullFields.length} field(s) contain null values that may affect analysis`,
    })
  }

  const followUpQuestions = [
    `How does this compare to last month's data?`,
    `Which ${fields[0] || 'category'} has the highest ${numericStats[0]?.field || 'value'}?`,
    `What's the trend over time for these metrics?`,
  ]

  return { summary, keyFindings, followUpQuestions }
}

// ─── Main Export ────────────────────────────────────────────────────────────

export async function analyzeResults(request: AnalyzeRequest): Promise<AnalyzeResult> {
  try {
    const { rows, fields, originalQuestion } = request

    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: 'No data to analyze',
      }
    }

    // Calculate statistics
    const statistics = calculateStatistics(rows, fields)

    // Detect anomalies
    const anomalies = detectAnomalies(rows, statistics)

    // Detect trends
    const trends = detectTrends(rows, statistics)

    // Recommend chart type
    const recommendedChart = recommendChart(rows, fields, statistics)

    // Calculate data quality
    const dataQualityScore = calculateDataQualityScore(statistics)

    // Get AI-powered insights
    const aiInsights = await generateAIInsights(rows, fields, statistics, originalQuestion)

    const insights: InsightResult = {
      summary: aiInsights.summary,
      keyFindings: aiInsights.keyFindings,
      anomalies,
      trends,
      statistics,
      recommendedChart,
      followUpQuestions: aiInsights.followUpQuestions,
      dataQualityScore,
      analyzedAt: new Date(),
    }

    return {
      success: true,
      insights,
    }
  } catch (error) {
    console.error('Analysis failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    }
  }
}
