import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import type { Goal, GoalType, WorkspaceRole } from '@/types'
import { getGoalsForAgent, getWorkspaceGoals, createGoal } from '@/lib/firestore'
import { useUserProfile } from '@/hooks/useUserProfile'

function todayPeriod(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function monthPeriod(): string {
  return format(new Date(), 'yyyy-MM')
}

export function useGoals(targetUid: string | undefined) {
  const { workspaceId } = useUserProfile()
  const dailyPeriod = todayPeriod()
  const monthlyPeriod = monthPeriod()

  const dailyQuery = useQuery<Goal | null>({
    queryKey: ['goals', workspaceId, targetUid, 'daily', dailyPeriod],
    queryFn: async () => {
      const goals = await getGoalsForAgent(workspaceId!, targetUid!, 'daily', dailyPeriod)
      return goals[0] ?? null
    },
    enabled: !!targetUid && !!workspaceId,
  })

  const monthlyQuery = useQuery<Goal | null>({
    queryKey: ['goals', workspaceId, targetUid, 'monthly', monthlyPeriod],
    queryFn: async () => {
      const goals = await getGoalsForAgent(workspaceId!, targetUid!, 'monthly', monthlyPeriod)
      return goals[0] ?? null
    },
    enabled: !!targetUid && !!workspaceId,
  })

  return {
    dailyGoal: dailyQuery.data ?? null,
    monthlyGoal: monthlyQuery.data ?? null,
    isLoading: dailyQuery.isLoading || monthlyQuery.isLoading,
  }
}

export function useWorkspaceGoalsForPeriod(type: GoalType, period: string) {
  const { workspaceId } = useUserProfile()
  return useQuery<Goal[]>({
    queryKey: ['goals', 'workspace', workspaceId, type, period],
    queryFn: () => getWorkspaceGoals(workspaceId!, type, period),
    enabled: !!workspaceId,
  })
}

export function useCreateGoal() {
  const { wsCtx, role } = useUserProfile()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      target_uid: string
      type: GoalType
      value: number
      period: string
    }) =>
      createGoal(wsCtx!.workspaceId, {
        target_uid: data.target_uid,
        subteam_id: wsCtx!.subteamId,
        type: data.type,
        value: data.value,
        period: data.period,
        set_by_uid: wsCtx!.uid,
        set_by_role: role as WorkspaceRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}
