'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Trash2,
  Crown,
  Shield,
  UserCircle,
  Eye,
  Loader2,
  UserPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  createTeam,
  getUserTeams,
  deleteTeam,
  inviteTeamMember,
  updateMemberRole,
  removeTeamMember,
  getPendingInvites,
  respondToInvite,
} from '@/actions/team'

interface TeamMember {
  id: string
  role: string
  status: string
  user: { id: string; name: string | null; email: string; image: string | null }
}

interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  members: TeamMember[]
  _count: { connections: number; queries: number }
}

const ROLE_ICONS = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: UserCircle,
  VIEWER: Eye,
}

const ROLE_COLORS = {
  OWNER: 'text-amber-500',
  ADMIN: 'text-blue-500',
  MEMBER: 'text-foreground',
  VIEWER: 'text-muted-foreground',
}

export function TeamSettings({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  // Confirmation Modals
  const [memberToRemove, setMemberToRemove] = useState<{ teamId: string; memberId: string; name: string } | null>(null)
  const [teamToDelete, setTeamToDelete] = useState<{ id: string; name: string } | null>(null)

  // Invite state
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [invites, setInvites] = useState<any[]>([])

  useEffect(() => {
    loadTeams()
    loadPendingInvites()
  }, [])

  async function loadPendingInvites() {
    const result = await getPendingInvites()
    if (result.success && result.data) {
      setInvites(result.data as any[])
    }
  }

  async function loadTeams() {
    setLoading(true)
    const result = await getUserTeams()
    if (result.success && result.data) {
      setTeams(result.data as Team[])
    }
    setLoading(false)
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return
    setCreating(true)
    setError(null)

    const result = await createTeam(newTeamName.trim(), newTeamDesc.trim() || undefined)
    setCreating(false)

    if (result.success) {
      setNewTeamName('')
      setNewTeamDesc('')
      setShowCreate(false)
      await loadTeams()
    } else {
      setError(result.error || 'Failed to create team')
    }
  }

  async function handleDeleteTeam(teamId: string) {
    const result = await deleteTeam(teamId)
    if (result.success) {
      setTeams((prev) => prev.filter((t) => t.id !== teamId))
      setTeamToDelete(null)
    } else {
      setError(result.error || 'Failed to delete team')
    }
  }

  async function handleInvite() {
    if (!inviteTeamId || !inviteEmail.trim()) return
    setInviting(true)
    setError(null)

    const result = await inviteTeamMember(inviteTeamId, inviteEmail.trim(), inviteRole)
    setInviting(false)

    if (result.success) {
      setInviteEmail('')
      setInviteTeamId(null)
      await loadTeams()
    } else {
      setError(result.error || 'Failed to invite member')
    }
  }

  async function handleRoleChange(teamId: string, memberId: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
    const result = await updateMemberRole(teamId, memberId, role)
    if (result.success) {
      await loadTeams()
    } else {
      setError(result.error || 'Failed to update role')
    }
  }

  async function handleRemoveMember(teamId: string, memberId: string) {
    const result = await removeTeamMember(teamId, memberId)
    if (result.success) {
      await loadTeams()
      setMemberToRemove(null)
    } else {
      setError(result.error || 'Failed to remove member')
    }
  }

  function getUserRole(team: Team): string {
    const member = team.members.find((m) => m.user.id === userId)
    return member?.role || 'MEMBER'
  }

  async function handleRespondToInvite(teamId: string, accept: boolean) {
    const result = await respondToInvite(teamId, accept)
    if (result.success) {
      await loadPendingInvites()
      await loadTeams()
    } else {
      setError(result.error || 'Failed to process invite')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Modals */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Remove Member</h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove <span className="font-medium text-foreground">{memberToRemove.name}</span> from the team? They will immediately lose access to all shared connections and queries.
              </p>
            </div>
            <div className="px-6 py-4 bg-secondary/50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setMemberToRemove(null)} className="btn-secondary text-sm">Cancel</button>
              <button 
                onClick={() => handleRemoveMember(memberToRemove.teamId, memberToRemove.memberId)} 
                className="btn-primary bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {teamToDelete && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2 text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete Team
              </h3>
              <p className="text-sm text-muted-foreground">
                Are you absolutely sure you want to delete <span className="font-medium text-foreground">"{teamToDelete.name}"</span>? 
                This will permanently delete the team and remove access for all {teams.find(t => t.id === teamToDelete.id)?.members.length} members. 
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-secondary/50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setTeamToDelete(null)} className="btn-secondary text-sm">Cancel</button>
              <button 
                onClick={() => handleDeleteTeam(teamToDelete.id)} 
                className="btn-primary bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-sm"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invites Banner */}
      {invites.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-sm text-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Pending Invitations
          </h4>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 bg-background rounded-md p-3 border border-border shadow-sm">
                <div>
                  <p className="text-sm font-medium">{inv.team.name}</p>
                  {inv.team.description && <p className="text-xs text-muted-foreground">{inv.team.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleRespondToInvite(inv.teamId, true)} className="btn-primary text-xs py-1.5 px-3">
                    Accept
                  </button>
                  <button onClick={() => handleRespondToInvite(inv.teamId, false)} className="btn-secondary text-xs py-1.5 px-3 text-destructive hover:bg-destructive/10">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Team */}
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <h4 className="font-medium text-sm">Create a New Team</h4>
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Team name"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="text"
            value={newTeamDesc}
            onChange={(e) => setNewTeamDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-2">
            <button onClick={handleCreateTeam} disabled={creating || !newTeamName.trim()} className="btn-primary text-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Teams List */}
      {teams.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No teams yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create a team to collaborate with others.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const isExpanded = expandedTeam === team.id
            const userRole = getUserRole(team)
            const canManage = ['OWNER', 'ADMIN'].includes(userRole)

            return (
              <div key={team.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-sm">{team.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {team.members.length} member{team.members.length !== 1 ? 's' : ''} &middot;{' '}
                        {team._count.connections} connection{team._count.connections !== 1 ? 's' : ''} &middot;{' '}
                        {team._count.queries} quer{team._count.queries !== 1 ? 'ies' : 'y'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('text-xs font-medium capitalize', ROLE_COLORS[userRole as keyof typeof ROLE_COLORS])}>
                      {userRole.toLowerCase()}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {team.description && (
                      <p className="text-sm text-muted-foreground">{team.description}</p>
                    )}

                    {/* Members */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground">Members</h5>
                        {canManage && (
                          <button
                            onClick={() => setInviteTeamId(inviteTeamId === team.id ? null : team.id)}
                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Invite
                          </button>
                        )}
                      </div>

                      {/* Invite form */}
                      {inviteTeamId === team.id && (
                        <div className="flex gap-2 mb-3">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="user@email.com"
                            className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                            className="px-2 py-1.5 bg-secondary border border-border rounded-lg text-sm"
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button onClick={handleInvite} disabled={inviting} className="btn-primary text-sm py-1.5">
                            {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                          </button>
                        </div>
                      )}

                      <div className="space-y-2">
                        {team.members.map((member) => {
                          const RoleIcon = ROLE_ICONS[member.role as keyof typeof ROLE_ICONS] || UserCircle
                          return (
                            <div key={member.id} className="flex items-center justify-between py-1.5">
                              <div className="flex items-center gap-2">
                                <RoleIcon
                                  className={clsx('w-4 h-4', ROLE_COLORS[member.role as keyof typeof ROLE_COLORS])}
                                />
                                <span className="text-sm">{member.user.name || member.user.email}</span>
                                {member.user.name && (
                                  <span className="text-xs text-muted-foreground">{member.user.email}</span>
                                )}
                                {member.status === 'PENDING' && (
                                  <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-medium uppercase tracking-wide border border-border">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {canManage && member.role !== 'OWNER' && member.user.id !== userId ? (
                                  <>
                                    <select
                                      value={member.role}
                                      onChange={(e) =>
                                        handleRoleChange(team.id, member.id, e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')
                                      }
                                      className="px-2 py-1 bg-secondary border border-border rounded text-xs"
                                    >
                                      <option value="ADMIN">Admin</option>
                                      <option value="MEMBER">Member</option>
                                      <option value="VIEWER">Viewer</option>
                                    </select>
                                    <button
                                      onClick={() => setMemberToRemove({ 
                                        teamId: team.id, 
                                        memberId: member.id, 
                                        name: member.user.name || member.user.email 
                                      })}
                                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                                      title="Remove member"
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </button>
                                  </>
                                ) : (
                                  <span
                                    className={clsx(
                                      'text-xs font-medium capitalize',
                                      ROLE_COLORS[member.role as keyof typeof ROLE_COLORS]
                                    )}
                                  >
                                    {member.role.toLowerCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Delete team */}
                    {userRole === 'OWNER' && (
                      <div className="pt-3 border-t border-border">
                        <button
                          onClick={() => setTeamToDelete({ id: team.id, name: team.name })}
                          className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Team
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
