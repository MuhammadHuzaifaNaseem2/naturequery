/**
 * Centralized RBAC (Role-Based Access Control) permission system.
 *
 * Instead of scattering role checks across server actions, all permission
 * decisions go through this module. Add new permissions here and they are
 * automatically enforced everywhere.
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Permission definitions ──────────────────────────────────────────────────

export const PERMISSIONS = {
  // Query permissions
  'query:execute':    ['OWNER', 'ADMIN', 'MEMBER'],
  'query:save':       ['OWNER', 'ADMIN', 'MEMBER'],
  'query:share':      ['OWNER', 'ADMIN', 'MEMBER'],
  'query:delete_own': ['OWNER', 'ADMIN', 'MEMBER'],
  'query:delete_any': ['OWNER', 'ADMIN'],
  'query:schedule':   ['OWNER', 'ADMIN', 'MEMBER'],

  // Connection permissions
  'connection:view':   ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'connection:create': ['OWNER', 'ADMIN'],
  'connection:edit':   ['OWNER', 'ADMIN'],
  'connection:delete': ['OWNER', 'ADMIN'],
  'connection:test':   ['OWNER', 'ADMIN'],

  // Dashboard permissions
  'dashboard:view':   ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'dashboard:edit':   ['OWNER', 'ADMIN', 'MEMBER'],
  'dashboard:share':  ['OWNER', 'ADMIN'],

  // Export permissions
  'export:csv':   ['OWNER', 'ADMIN', 'MEMBER'],
  'export:excel': ['OWNER', 'ADMIN', 'MEMBER'],

  // Team management
  'team:view':          ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'team:invite':        ['OWNER', 'ADMIN'],
  'team:remove_member': ['OWNER', 'ADMIN'],
  'team:change_role':   ['OWNER'],
  'team:edit':          ['OWNER', 'ADMIN'],
  'team:delete':        ['OWNER'],

  // Billing (owner only)
  'billing:view':   ['OWNER'],
  'billing:manage': ['OWNER'],

  // API keys
  'apikey:create': ['OWNER', 'ADMIN', 'MEMBER'],
  'apikey:delete': ['OWNER', 'ADMIN', 'MEMBER'],

  // Audit logs
  'audit:view': ['OWNER', 'ADMIN'],
} as const

export type Permission = keyof typeof PERMISSIONS
export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

// ── Low-level helpers ──────────────────────────────────────────────────────

/**
 * Check if a role has a given permission.
 * This is a pure synchronous function — no DB call needed.
 */
export function hasPermission(role: TeamRole, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[]
  return allowed.includes(role)
}

// ── Session-aware guards ───────────────────────────────────────────────────

/**
 * Get the calling user's session, throwing 'Unauthorized' if not logged in.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Assert that the current user is a platform ADMIN.
 * Use for admin-panel server actions.
 */
export async function requireAdmin() {
  const session = await requireSession()
  const role = (session.user as any).role as string | undefined
  if (role !== 'ADMIN') {
    throw new Error('Forbidden: admin access required')
  }
  return session
}

/**
 * Assert that the current user has the given permission within a team.
 * Returns the TeamMember record so callers can use the role/teamId downstream.
 *
 * @example
 * const member = await requireTeamPermission(teamId, 'connection:create')
 */
export async function requireTeamPermission(teamId: string, permission: Permission) {
  const session = await requireSession()
  const userId = session.user.id!

  // Platform admins bypass all team-level permission checks
  const role = (session.user as any).role as string | undefined
  if (role === 'ADMIN') {
    return { userId, teamId, role: 'OWNER' as TeamRole }
  }

  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true, teamId: true },
  })

  if (!member) {
    throw new Error('Forbidden: you are not a member of this team')
  }

  if (!hasPermission(member.role as TeamRole, permission)) {
    throw new Error(
      `Forbidden: your role (${member.role}) does not have the '${permission}' permission`
    )
  }

  return { userId, teamId: member.teamId, role: member.role as TeamRole }
}

/**
 * Assert that the current user owns a resource or has team-level permission.
 * Use for personal resources that can optionally be shared to a team.
 *
 * @param ownerId   The userId stored on the resource
 * @param teamId    The teamId stored on the resource (if shared to a team)
 * @param permission  The permission to check at the team level
 */
export async function requireOwnerOrTeamPermission(
  ownerId: string | null | undefined,
  teamId: string | null | undefined,
  permission: Permission
) {
  const session = await requireSession()
  const userId = session.user.id!

  // Platform admins bypass everything
  const role = (session.user as any).role as string | undefined
  if (role === 'ADMIN') {
    return { userId }
  }

  // Direct owner
  if (ownerId && ownerId === userId) {
    return { userId }
  }

  // Team-shared resource: check team-level permission
  if (teamId) {
    await requireTeamPermission(teamId, permission)
    return { userId }
  }

  throw new Error('Forbidden: you do not have access to this resource')
}
