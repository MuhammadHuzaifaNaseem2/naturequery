'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ============================================
// Team CRUD
// ============================================

export async function createTeam(name: string, description?: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const slug = name
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
        },
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } } },
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
    where: { members: { some: { userId: session.user.id } } },
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

  // Check user is OWNER or ADMIN
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data,
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

export async function inviteTeamMember(teamId: string, email: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Check inviter is OWNER or ADMIN
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { success: false, error: 'User not found. They must register first.' }

  // Check if already a member
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  })
  if (existing) return { success: false, error: 'User is already a team member' }

  const member = await prisma.teamMember.create({
    data: { userId: user.id, teamId, role },
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

  return { success: true, data: member }
}

export async function updateMemberRole(teamId: string, memberId: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Check caller is OWNER
  const callerMembership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: session.user.id, teamId } },
  })
  if (!callerMembership || callerMembership.role !== 'OWNER') {
    return { success: false, error: 'Only the team owner can change roles' }
  }

  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data: { role },
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
