import { doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore'
import type { Client } from '@/types'
import type { ClientChange, ClientMutation } from '@/lib/processMutations'
import { uppercaseClientFields } from '@/lib/clientUtils'

/**
 * Aplica una mutación sobre el documento ACTUAL del cliente dentro de una
 * transacción. Si otro cambio llega en medio, Firestore reintenta la
 * transacción con los datos nuevos, así que ningún pago se pierde.
 *
 * Recibe la instancia de Firestore para poder probarse contra el emulador.
 */
export async function runClientMutation(
  fs: Firestore,
  workspaceId: string,
  clientId: string,
  mutation: ClientMutation,
): Promise<ClientChange> {
  return runTransaction(fs, async (tx) => {
    const ref = doc(fs, 'workspaces', workspaceId, 'clients', clientId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Cliente no encontrado')
    const change = mutation({ id: snap.id, ...snap.data() } as Client)
    tx.update(ref, { ...uppercaseClientFields({ ...change }), updated_at: Timestamp.now() })
    return change
  })
}
