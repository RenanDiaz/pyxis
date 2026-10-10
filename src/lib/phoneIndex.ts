import {
  deleteField,
  doc,
  getDoc,
  type Firestore,
  type Transaction,
  type WriteBatch,
} from 'firebase/firestore'
import type { Client, ClientPhone } from '@/types'
import { phoneDigits } from '@/lib/leads'

// Teléfonos duplicados (spec 07). Cada número tiene un doc
// `workspaces/{wId}/phone_index/{10 dígitos}` con los ids de los clientes que
// lo usan. Cualquier miembro puede leer UN número por su id (no listar), así
// que puede enterarse de que un número ya es cliente de otro agente sin poder
// recorrer los teléfonos del workspace ni ver datos del cliente.

export const PHONE_INDEX = 'phone_index'

/** Todos los teléfonos del cliente (principal y secundarios), en 10 dígitos y sin repetir. */
export function clientPhoneDigits(client: { phone?: string; phones?: ClientPhone[] }): string[] {
  const all = [client.phone ?? '', ...(client.phones ?? []).map((p) => p.number)]
  return [...new Set(all.map(phoneDigits).filter(Boolean))]
}

const indexRef = (fs: Firestore, workspaceId: string, digits: string) =>
  doc(fs, 'workspaces', workspaceId, PHONE_INDEX, digits)

/**
 * Agrega el cliente a los números nuevos y lo quita de los que ya no usa.
 * Va en el mismo batch o transacción que escribe `phone_digits` en el
 * cliente: las reglas comparan contra el cliente al terminar la escritura.
 */
export function writePhoneIndex(
  writer: WriteBatch | Transaction,
  fs: Firestore,
  workspaceId: string,
  clientId: string,
  before: string[],
  after: string[],
): void {
  const set = (digits: string, value: true | ReturnType<typeof deleteField>) =>
    // `last_client_id` dice a las reglas qué cliente cambió en este número.
    (writer as WriteBatch).set(
      indexRef(fs, workspaceId, digits),
      { client_ids: { [clientId]: value }, last_client_id: clientId },
      { merge: true },
    )
  for (const d of after) if (!before.includes(d)) set(d, true)
  for (const d of before) if (!after.includes(d)) set(d, deleteField())
}

export interface PhoneMatches {
  /** Clientes con ese número que el usuario puede ver. */
  visible: Client[]
  /** Cuántos son de otros agentes (el usuario no puede leerlos). */
  hiddenCount: number
}

/** Clientes que ya usan alguno de esos números, salvo `excludeId` (el que se edita). */
export async function findPhoneMatches(
  fs: Firestore,
  workspaceId: string,
  digitsList: string[],
  excludeId?: string,
): Promise<PhoneMatches> {
  const ids = new Set<string>()
  const snaps = await Promise.all([...new Set(digitsList)].map((d) => getDoc(indexRef(fs, workspaceId, d))))
  for (const snap of snaps) {
    for (const id of Object.keys((snap.get('client_ids') as Record<string, true> | undefined) ?? {})) {
      if (id !== excludeId) ids.add(id)
    }
  }
  const visible: Client[] = []
  let hiddenCount = 0
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const snap = await getDoc(doc(fs, 'workspaces', workspaceId, 'clients', id))
        if (snap.exists()) visible.push({ id: snap.id, ...snap.data() } as Client)
      } catch (err) {
        // Sin permiso de lectura: es cliente de otro agente (o de otro subequipo).
        if ((err as { code?: string }).code === 'permission-denied') hiddenCount++
        else throw err
      }
    }),
  )
  return { visible, hiddenCount }
}
