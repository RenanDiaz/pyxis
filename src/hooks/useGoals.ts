import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import type { Goal, GoalType, UserRole } from '@/types'
import { getGoalsForAgent, getTeamGoals, createGoal } from '@/lib/firestore'
import { useUserProfile } from '@/hooks/useUserProfile'

function todayPeriod(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function monthPeriod(): string {
  return format(new Date(), 'yyyy-MM')
}

export function useGoals(targetUid: string | undefined) {
  const dailyPeriod = todayPeriod()
  const monthlyPeriod = monthPeriod()

  const dailyQuery = useQuery<Goal | null>({
    queryKey: ['goals', targetUid, 'daily', dailyPeriod],
    queryFn: async () => {
      const goals = await getGoalsForAgent(targetUid!, 'daily', dailyPeriod)
      return goals[0] ?? null
    },
    enabled: !!targetUid,
  })

  const monthlyQuery = useQuery<Goal | null>({
    queryKey: ['goals', targetUid, 'monthly', monthlyPeriod],
    queryFn: async () => {
      const goals = await getGoalsForAgent(targetUid!, 'monthly', monthlyPeriod)
      return goals[0] ?? null
    },
    enabled: !!targetUid,
  })

  return {
    dailyGoal: dailyQuery.data ?? null,
    monthlyGoal: monthlyQuery.data ?? null,
    isLoading: dailyQuery.isLoading || monthlyQuery.isLoading,
  }
}

export function useTeamGoalsForPeriod(teamId: string | null, type: GoalType, period: string) {
  return useQuery<Goal[]>({
    queryKey: ['goals', 'team', teamId, type, period],
    queryFn: () => getTeamGoals(teamId!, type, period),
    enabled: !!teamId,
  })
}

export function useCreateGoal() {
  const { roleCtx, role } = useUserProfile()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      target_uid: string
      team_id: string | null
      type: GoalType
      value: number
      period: string
    }) =>
      createGoal({
        target_uid: data.target_uid,
        team_id: data.team_id,
        type: data.type,
        value: data.value,
        period: data.period,
        set_by_uid: roleCtx!.uid,
        set_by_role: role as UserRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}
