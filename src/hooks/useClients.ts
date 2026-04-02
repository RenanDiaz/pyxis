import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Client, ClientStatus } from '@/types'
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  findClientsByPhone,
} from '@/lib/firestore'
import { useUserProfile } from '@/hooks/useUserProfile'

interface ClientFilters {
  status?: ClientStatus
  search?: string
  archived?: boolean
}

export function useClients(filters?: ClientFilters) {
  const { roleCtx } = useUserProfile()
  return useQuery<Client[]>({
    queryKey: ['clients', roleCtx?.uid, roleCtx?.globalRole, roleCtx?.activeTeamId, roleCtx?.activeTeamRole, filters],
    queryFn: () => getClients(roleCtx!, filters),
    enabled: !!roleCtx,
  })
}

export function useClient(id: string | undefined) {
  return useQuery<Client | null>({
    queryKey: ['clients', id],
    queryFn: () => getClientById(id!),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const { roleCtx } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_uid' | 'team_id'>) =>
      createClient(roleCtx!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useFindClientsByPhone(phone: string) {
  return useQuery<Client[]>({
    queryKey: ['clients', 'phone-lookup', phone],
    queryFn: () => findClientsByPhone(phone),
    enabled: phone.trim().length >= 7,
  })
}
