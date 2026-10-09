import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { Call, ClientStatus } from '@/types'
import { addWorkspaceRoleConstraints, type WorkspaceCtx } from '@/lib/roleScope'

// Conversión de un lead en cliente (spec 19). Recibe la instancia de
// Firestore para poder probarse contra el emulador.

/** Llamadas a ese lead (por teléfono) que el usuario puede ver. */
export async function getLeadCalls(fs: Firestore, ctx: WorkspaceCtx, digits: string): Promise<Call[]> {
  const snap = await getDocs(
    query(
      collection(fs, 'workspaces', ctx.workspaceId, 'calls'),
      where('lead.phone_digits', '==', digits),
      ...addWorkspaceRoleConstraints(ctx),
    ),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Call)
}

/** Status inicial del cliente convertido: contactado si ya se habló con él. */
export function convertedClientStatus(leadCalls: Call[]): ClientStatus {
  return leadCalls.some((c) => c.outcome === 'completada') ? 'contactado' : 'nuevo'
}

/**
 * Vincula al cliente nuevo todas las llamadas visibles del lead: pasan a
 * `client_id`, pierden `lead` y guardan `converted_client_id`. Devuelve
 * cuántas se vincularon.
 */
export async function convertLeadCalls(
  fs: Firestore,
  ctx: WorkspaceCtx,
  digits: string,
  clientId: string,
): Promise<number> {
  const calls = await getLeadCalls(fs, ctx, digits)
  if (calls.length === 0) return 0
  const batch = writeBatch(fs)
  for (const call of calls) {
    batch.update(doc(fs, 'workspaces', ctx.workspaceId, 'calls', call.id), {
      client_id: clientId,
      lead: deleteField(),
      converted_client_id: clientId,
    })
  }
  await batch.commit()
  return calls.length
}
