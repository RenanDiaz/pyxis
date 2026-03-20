import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Client, ClientStatus } from '@/types'
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from '@/lib/firestore'

interface ClientFilters {
  status?: ClientStatus
  search?: string
}

export function useClients(filters?: ClientFilters) {
  return useQuery<Client[]>({
    queryKey: ['clients', filters],
    queryFn: () => getClients(filters),
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClient,
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
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
