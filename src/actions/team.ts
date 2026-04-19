'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanLimits } from '@/lib/plan-limits'
import { updateChecklistItem } from '@/actions/onboarding-checklist'
import { rateLimitAsync } from '@/lib/rate-limit'
import {
  validateInput,
  CreateTeamSchema,
  UpdateTeamSchema,
  TeamInviteSchema,
  UpdateMemberRoleSchema,
  RespondToInviteSchema,
  IdSchema,
} from '@/lib/validation'

// ============================================
// Team CRUD
// ============================================

export async function createTeam(name: string, description?: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Rate limit
  const rl = await rateLimitAsync(`team_create:${session.user.id}`, {
    maxRequests: 5,
    windowSeconds: 60,
  })
  if (!rl.allowed) return { success: false, error: 'Too many requests' }

  // Validation
  const validated = validateInput(CreateTeamSchema, { name, description })
  if (!validated.success) return { success: false, error: validated.error }
  const { name: vName, description: vDescription } = validated.data

  // Check plan limits — team creation requires PRO or Enterprise
  const limitCheck = await checkPlanLimits(session.user.id, 'TEAM_CREATE')
  if (!limitCheck.allowed) {
    return {
      success: false,
      error:
        'Team collaboration requires a Pro or Enterprise plan. Upgrade to create and manage teams.',
    }
  }

  const slug = vName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Check slug uniqueness
  const existing = await prisma.team.findUnique({ where: { slug } })
  if (existing) return { success: false, error: 'A team with a similar name already exists' }

  const team = await prisma.team.create({
    data: {
      name,
      slug,
      description,
      members: {
        create: {
          userId: session.user.id,
          role: 'OWNER',
          status: 'ACCEPTED',
        },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE_TEAM',
      resource: 'team',
      resourceId: team.id,
    },
  })

  return { success: true, data: team }
}

export async function getUserTeams() {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: session.user.id, status: 'ACCEPTED' } } },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      _count: { select: { connections: true, queries: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { success: true, data: teams }
}

export async function updateTeam(teamId: string, data: { name?: string; description?: string }) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Rate limit
  const rl = await rateLimitAsync(`team_update:${session.user.id}`, {
    maxRequests: 20,
    windowSeconds: 60,
  })
  if (!rl.allowed) return { success: false, error: 'Too many requests' }

  // Validation
  const validated = validateInput(UpdateTeamSchema, { teamId, ...data })
  if (!validated.success) return { success: false, error: validated.error }
  const { teamId: vTeamId, ...vData } = validated.data

  // Check user is OWNER or ADMIN
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId: vTeamId } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const team = await prisma.team.update({
    where: { id: vTeamId },
    data: vData,
  })

  return { success: true, data: team }
}

export async function deleteTeam(teamId: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Only OWNER can delete
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } },
  })
  if (!membership || membership.role !== 'OWNER') {
    return { success: false, error: 'Only the team owner can delete the team' }
  }

  await prisma.team.delete({ where: { id: teamId } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETE_TEAM',
      resource: 'team',
      resourceId: teamId,
    },
  })

  return { success: true }
}

// ============================================
// Team Members
// ============================================

export async function inviteTeamMember(
  teamId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'
) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Rate limit
  const rl = await rateLimitAsync(`team_invite:${session.user.id}`, {
    maxRequests: 10,
    windowSeconds: 60,
  })
  if (!rl.allowed) return { success: false, error: 'Too many requests' }

  // Validation
  const validated = validateInput(TeamInviteSchema, { teamId, email, role })
  if (!validated.success) return { success: false, error: validated.error }
  const { teamId: vTeamId, email: vEmail, role: vRole } = validated.data

  // Check inviter is OWNER or ADMIN
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId: vTeamId } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Check plan limits for team members
  const limitCheck = await checkPlanLimits(session.user.id, 'TEAM_INVITE')
  if (!limitCheck.allowed) {
    return {
      success: false,
      error:
        limitCheck.limit === 0
          ? 'Team collaboration is not available on the Free plan. Upgrade to Pro to invite members.'
          : `Team member limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more members.`,
    }
  }

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email: vEmail } })
  if (!user) return { success: false, error: 'User not found. They must register first.' }

  // Check if already a member
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  })
  if (existing) return { success: false, error: 'User is already a team member' }

  // They default to PENDING in the schema
  const member = await prisma.teamMember.create({
    data: { userId: user.id, teamId, role, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'INVITE_MEMBER',
      resource: 'team',
      resourceId: teamId,
      metadata: { invitedUserId: user.id, role },
    },
  })

  // Mark the onboarding checklist item as done for the inviter
  await updateChecklistItem('invitedTeamMember', true).catch(() => {})

  return { success: true, data: member }
}

export async function updateMemberRole(
  teamId: string,
  memberId: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'
) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Validation
  const validated = validateInput(UpdateMemberRoleSchema, { teamId, memberId, role })
  if (!validated.success) return { success: false, error: validated.error }
  const { teamId: vTeamId, memberId: vMemberId, role: vRole } = validated.data

  // Check caller is OWNER
  const callerMembership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId: vTeamId } },
  })
  if (!callerMembership || callerMembership.role !== 'OWNER') {
    return { success: false, error: 'Only the team owner can change roles' }
  }

  const member = await prisma.teamMember.update({
    where: { id: vMemberId },
    data: { role: vRole },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })

  return { success: true, data: member }
}

export async function removeTeamMember(teamId: string, memberId: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const target = await prisma.teamMember.findUnique({ where: { id: memberId } })
  if (!target) return { success: false, error: 'Member not found' }

  // Allow self-removal or OWNER/ADMIN removal
  if (target.userId !== session.user.id) {
    const callerMembership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: session.user.id, teamId } },
    })
    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }
    // Cannot remove OWNER
    if (target.role === 'OWNER') {
      return { success: false, error: 'Cannot remove the team owner' }
    }
  }

  await prisma.teamMember.delete({ where: { id: memberId } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'REMOVE_MEMBER',
      resource: 'team',
      resourceId: teamId,
      metadata: { removedMemberId: memberId },
    },
  })

  return { success: true }
}

// ============================================
// Invitation Handling
// ============================================

export async function getPendingInvites() {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const invites = await prisma.teamMember.findMany({
    where: {
      userId: session.user.id,
      status: 'PENDING',
    },
    include: {
      team: {
        select: { id: true, name: true, description: true },
      },
    },
  })

  return { success: true, data: invites }
}

export async function respondToInvite(teamId: string, accept: boolean) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Validation
  if (!IdSchema.safeParse(teamId).success) return { success: false, error: 'Invalid team ID' }

  const invite = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } },
  })

  // Prevent users from responding to invites that are already accepted or fake
  if (!invite || invite.status !== 'PENDING') {
    return { success: false, error: 'Invite not found or already processed' }
  }

  if (accept) {
    const updated = await prisma.teamMember.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' },
    })
    return { success: true, data: updated }
  } else {
    await prisma.teamMember.delete({
      where: { id: invite.id },
    })
    return { success: true, data: null }
  }
}
