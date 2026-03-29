import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Team, TeamMembership, TeamRole } from '@/types'
import {
  getTeams,
  getTeamsByIds,
  createTeam,
  updateTeam,
  getTeamMemberships,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
} from '@/lib/firestore'

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: getTeams,
  })
}

export function useUserTeams(teamIds: string[]) {
  return useQuery<Team[]>({
    queryKey: ['userTeams', teamIds],
    queryFn: () => getTeamsByIds(teamIds),
    enabled: teamIds.length > 0,
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      creator_uid: string
      creator_display_name: string
      creator_email: string
    }) => createTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['userTeams'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Team, 'name'>> }) =>
      updateTeam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['userTeams'] })
    },
  })
}

export function useTeamMemberships(teamId: string | null | undefined) {
  return useQuery<TeamMembership[]>({
    queryKey: ['teamMemberships', teamId],
    queryFn: () => getTeamMemberships(teamId!),
    enabled: !!teamId,
  })
}

export function useAddTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      teamId,
      user,
      role,
    }: {
      teamId: string
      user: { uid: string; display_name: string; email: string }
      role?: TeamRole
    }) => addTeamMember(teamId, user, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMemberships'] })
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      queryClient.invalidateQueries({ queryKey: ['userTeams'] })
    },
  })
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, uid }: { teamId: string; uid: string }) =>
      removeTeamMember(teamId, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMemberships'] })
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      queryClient.invalidateQueries({ queryKey: ['userTeams'] })
    },
  })
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, uid, role }: { teamId: string; uid: string; role: TeamRole }) =>
      updateTeamMemberRole(teamId, uid, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMemberships'] })
      queryClient.invalidateQueries({ queryKey: ['teamMembership'] })
    },
  })
}
