import type { DocumentSnapshot, UpdateData, DocumentData } from 'firebase-admin/firestore'

// gRPC FAILED_PRECONDITION: el documento cambió desde que se leyó.
const FAILED_PRECONDITION = 9

/**
 * Escribe `update` solo si el documento sigue igual que cuando se leyó en
 * `snap` (spec 12). Si alguien lo editó mientras corría la migración, no lo
 * pisa y devuelve `false`: como los scripts son idempotentes, basta volver a
 * correrlos para procesar esos documentos con sus datos nuevos.
 */
export async function updateIfUnchanged(
  snap: DocumentSnapshot,
  update: UpdateData<DocumentData>,
): Promise<boolean> {
  try {
    await snap.ref.update(update, { lastUpdateTime: snap.updateTime! })
    return true
  } catch (err) {
    if ((err as { code?: number }).code === FAILED_PRECONDITION) return false
    throw err
  }
}
