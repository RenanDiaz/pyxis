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
  const { wsCtx } = useUserProfile()
  return useQuery<Client[]>({
    queryKey: ['clients', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid, filters],
    queryFn: () => getClients(wsCtx!, filters),
    enabled: !!wsCtx,
  })
}

export function useClient(id: string | undefined) {
  const { workspaceId } = useUserProfile()
  return useQuery<Client | null>({
    queryKey: ['clients', workspaceId, id],
    queryFn: () => getClientById(workspaceId!, id!),
    enabled: !!id && !!workspaceId,
  })
}

export function useCreateClient() {
  const { wsCtx } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      data,
      assignTo,
    }: {
      data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_uid' | 'subteam_id'>
      assignTo?: { owner_uid: string; subteam_id: string | null }
    }) => createClient(wsCtx!, data, assignTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const { workspaceId } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      updateClient(workspaceId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const { workspaceId } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(workspaceId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useFindClientsByPhone(phone: string) {
  const { workspaceId } = useUserProfile()
  return useQuery<Client[]>({
    queryKey: ['clients', 'phone-lookup', workspaceId, phone],
    queryFn: () => findClientsByPhone(workspaceId!, phone),
    enabled: phone.trim().length >= 7 && !!workspaceId,
  })
}
