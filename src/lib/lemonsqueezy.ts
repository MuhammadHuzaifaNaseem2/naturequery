import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'

export function setupLemonSqueezy() {
  lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY! })
}

export function isLemonSqueezyEnabled(): boolean {
  return !!process.env.LEMONSQUEEZY_API_KEY && !!process.env.LEMONSQUEEZY_STORE_ID
}

export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    lsVariantId: null,
    limits: {
      queriesPerMonth: 50,
      connections: 1,
      teamMembers: 0,
      savedQueries: 10,
      dashboardWidgets: 0,
      scheduledQueries: 0,
      apiKeys: 0,
    },
  },
  PRO: {
    name: 'Pro',
    price: 2900,
    lsVariantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
    limits: {
      queriesPerMonth: -1,
      connections: 10,
      teamMembers: 5,
      savedQueries: -1,
      dashboardWidgets: 20,
      scheduledQueries: 10,
      apiKeys: 5,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 9900,
    lsVariantId: process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID ?? null,
    limits: {
      queriesPerMonth: -1,
      connections: -1,
      teamMembers: -1,
      savedQueries: -1,
      dashboardWidgets: -1,
      scheduledQueries: -1,
      apiKeys: 10,
    },
  },
} as const

export type PlanKey = keyof typeof PLANS
