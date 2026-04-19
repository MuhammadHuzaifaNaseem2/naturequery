import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set — billing features disabled')
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : (null as unknown as Stripe)

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// Plan configuration — keep in sync with Stripe Dashboard products
export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    stripePriceId: null,
    limits: {
      queriesPerMonth: 50,
      connections: 1,
      teamMembers: 0,
      savedQueries: 10,      // can save up to 10 queries
      dashboardWidgets: 0,   // no pinned widgets
      scheduledQueries: 0,   // no scheduled queries
      apiKeys: 0,            // no API access
    },
  },
  PRO: {
    name: 'Pro',
    price: 2900, // cents
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: {
      queriesPerMonth: -1, // unlimited
      connections: 10,
      teamMembers: 5,
      savedQueries: -1,      // unlimited
      dashboardWidgets: 20,  // up to 20 pinned widgets
      scheduledQueries: 10,  // up to 10 scheduled queries
      apiKeys: 5,            // up to 5 API keys
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 9900, // cents
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
    limits: {
      queriesPerMonth: -1,
      connections: -1,
      teamMembers: -1,
      savedQueries: -1,
      dashboardWidgets: -1,
      scheduledQueries: -1,
      apiKeys: 10,           // up to 10 API keys
    },
  },
} as const

export type PlanKey = keyof typeof PLANS
