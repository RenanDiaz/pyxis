import { doc, runTransaction, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'
import type { Client } from '@/types'
import type { ClientChange, ClientMutation } from '@/lib/processMutations'
import { uppercaseClientFields } from '@/lib/clientUtils'
import { statusChangeFields } from '@/lib/statusHistory'
import { inferStatus, type StatusTrigger } from '@/lib/statusUtils'

// Escrituras del documento del cliente que dependen de su estado actual.
// Reciben la instancia de Firestore para poder probarse contra el emulador.

function clientRef(fs: Firestore, workspaceId: string, clientId: string) {
  return doc(fs, 'workspaces', workspaceId, 'clients', clientId)
}

/**
 * Aplica una mutación sobre el documento ACTUAL del cliente dentro de una
 * transacción. Si otro cambio llega en medio, Firestore reintenta la
 * transacción con los datos nuevos, así que ningún pago se pierde. Si la
 * mutación cambia el status, se registra en el historial.
 */
export async function runClientMutation(
  fs: Firestore,
  workspaceId: string,
  clientId: string,
  mutation: ClientMutation,
  by: string | null = null,
): Promise<ClientChange> {
  return runTransaction(fs, async (tx) => {
    const ref = clientRef(fs, workspaceId, clientId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Cliente no encontrado')
    const client = { id: snap.id, ...snap.data() } as Client
    const { status, ...change } = mutation(client)
    const statusFields = status ? statusChangeFields(client, status, by) : null
    tx.update(ref, {
      ...uppercaseClientFields({ ...change }),
      ...statusFields,
      updated_at: Timestamp.now(),
    })
    return status ? { ...change, status } : change
  })
}

export interface ClientUpdateOptions {
  /**
   * Transición automática (`info_added`, `document_uploaded`…) que se evalúa
   * contra el status ACTUAL del documento. Usar esto en vez de mandar un
   * `status` calculado sobre la copia en caché, que podría revertir un cambio
   * hecho mientras tanto (p. ej. un pago que cerró al cliente).
   */
  trigger?: StatusTrigger
  by?: string | null
}

/**
 * Actualiza campos del cliente. Si cambia el status (explícito o por
 * `trigger`), pasa por una transacción para registrarlo en el historial sobre
 * el status real actual y fijar `contacted_at` / `closed_at`.
 */
export async function runClientUpdate(
  fs: Firestore,
  workspaceId: string,
  clientId: string,
  data: Partial<Omit<Client, 'id' | 'created_at'>>,
  { trigger, by = null }: ClientUpdateOptions = {},
): Promise<void> {
  const ref = clientRef(fs, workspaceId, clientId)
  const { status, ...rest } = data
  const fields = { ...uppercaseClientFields(rest), updated_at: Timestamp.now() }
  if (!status && !trigger) {
    await updateDoc(ref, fields)
    return
  }
  await runTransaction(fs, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Cliente no encontrado')
    const current = snap.data() as Client
    const to = status ?? (trigger ? inferStatus(current.status, trigger) : null)
    const statusFields = to ? statusChangeFields(current, to, by) : null
    tx.update(ref, { ...fields, ...statusFields })
  })
}
