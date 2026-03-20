import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Client, ClientStatus } from '@/types'
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'

interface ClientFilters {
  status?: ClientStatus
  search?: string
}

export function useClients(filters?: ClientFilters) {
  const { user } = useAuth()
  return useQuery<Client[]>({
    queryKey: ['clients', user?.uid, filters],
    queryFn: () => getClients(user!.uid, filters),
    enabled: !!user,
  })
}

export function useClient(id: string | undefined) {
  const { user } = useAuth()
  return useQuery<Client | null>({
    queryKey: ['clients', user?.uid, id],
    queryFn: () => getClientById(user!.uid, id!),
    enabled: !!id && !!user,
  })
}

export function useCreateClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) =>
      createClient(user!.uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      updateClient(user!.uid, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(user!.uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
