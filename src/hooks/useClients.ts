import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Client, ClientStatus } from '@/types'
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  mutateClient,
} from '@/lib/firestore'
import type { ClientMutation } from '@/lib/processMutations'
import type { StatusTrigger } from '@/lib/statusUtils'
import { useUserProfile } from '@/hooks/useUserProfile'
import { db } from '@/lib/firebase'
import { deleteClientCascade } from '@/lib/workspaceAdmin'
import { deleteFileFromStorage } from '@/lib/adminStorage'
import { findPhoneMatches, type PhoneMatches } from '@/lib/phoneIndex'

interface ClientFilters {
  status?: ClientStatus
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
    meta: { errorMessage: 'No se pudo crear el cliente' },
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
    meta: { errorMessage: 'No se pudo guardar el cliente' },
    mutationFn: ({ id, data, trigger }: { id: string; data: Partial<Client>; trigger?: StatusTrigger }) =>
      updateClient(workspaceId!, id, data, trigger),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

/** Mutaciones transaccionales de procesos y pagos (`clientMutations`). */
export function useClientMutation() {
  const { workspaceId } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo guardar el cambio' },
    mutationFn: ({ clientId, mutation }: { clientId: string; mutation: ClientMutation }) =>
      mutateClient(workspaceId!, clientId, mutation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const { workspaceId } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo eliminar el cliente' },
    // Con sus llamadas, documentos y archivos; solo el owner (spec 06).
    mutationFn: (id: string) => deleteClientCascade(db!, workspaceId!, id, deleteFileFromStorage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}

/**
 * Clientes que ya usan alguno de estos números (spec 07), incluidos los de
 * otros agentes, que solo se cuentan. Un error no rompe el formulario.
 */
export function usePhoneMatches(digits: string[], excludeId?: string) {
  const { workspaceId } = useUserProfile()
  const key = [...new Set(digits.filter(Boolean))].sort()
  return useQuery<PhoneMatches>({
    queryKey: ['clients', 'phone-matches', workspaceId, key, excludeId ?? null],
    queryFn: async () => {
      try {
        return await findPhoneMatches(db!, workspaceId!, key, excludeId)
      } catch (err) {
        console.error('No se pudo revisar si el teléfono ya es cliente', err)
        return { visible: [], hiddenCount: 0 }
      }
    },
    enabled: key.length > 0 && !!workspaceId && !!db,
  })
}
