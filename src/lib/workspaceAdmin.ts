import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { PHONE_INDEX, writePhoneIndex } from '@/lib/phoneIndex'

// Operaciones de administración del workspace (spec 06). Todas las hace el
// owner desde el navegador, en el orden que exigen las reglas, y se pueden
// reintentar: si algo se corta a mitad, volver a correrlas termina el trabajo.
// Reciben la instancia de Firestore para poder probarse contra el emulador.

/** Borra un archivo de Storage; se inyecta para no acoplar esto a Storage. */
export type DeleteFile = (storagePath: string) => Promise<void>

export interface AdminProgress {
  step: string
  done: number
  total: number
}
type OnProgress = (progress: AdminProgress) => void

const BATCH_LIMIT = 400

const wsCol = (fs: Firestore, workspaceId: string, sub: string) =>
  collection(fs, 'workspaces', workspaceId, sub)
const wsDoc = (fs: Firestore, workspaceId: string, sub: string, id: string) =>
  doc(fs, 'workspaces', workspaceId, sub, id)

async function commitInChunks(
  fs: Firestore,
  refs: DocumentReference[],
  op: (batch: ReturnType<typeof writeBatch>, ref: DocumentReference) => void,
  onChunk?: (done: number) => void,
): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(fs)
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) op(batch, ref)
    await batch.commit()
    onChunk?.(Math.min(i + BATCH_LIMIT, refs.length))
  }
}

const deleteAll = (fs: Firestore, refs: DocumentReference[], onChunk?: (done: number) => void) =>
  commitInChunks(fs, refs, (batch, ref) => batch.delete(ref), onChunk)

/**
 * Quita al miembro de los datos de su perfil. Su `users/{uid}` puede no
 * existir o apuntar a otro lado: entonces se borra solo el member y, al
 * entrar, la app lo manda a onboarding (workspace inválido).
 */
async function detachMember(fs: Firestore, workspaceId: string, uid: string): Promise<void> {
  const memberRef = wsDoc(fs, workspaceId, 'members', uid)
  try {
    const batch = writeBatch(fs)
    batch.delete(memberRef)
    batch.update(doc(fs, 'users', uid), { workspace_id: null })
    await batch.commit()
  } catch {
    const batch = writeBatch(fs)
    batch.delete(memberRef)
    await batch.commit()
  }
}

// ── Quitar miembro ──

export interface ReassignTarget {
  uid: string
  subteam_id: string | null
}

export interface MemberHoldings {
  clients: number
  calls: number
}

export async function countMemberHoldings(
  fs: Firestore,
  workspaceId: string,
  uid: string,
): Promise<MemberHoldings> {
  const [clients, calls] = await Promise.all([
    getDocs(query(wsCol(fs, workspaceId, 'clients'), where('owner_uid', '==', uid))),
    getDocs(query(wsCol(fs, workspaceId, 'calls'), where('owner_uid', '==', uid))),
  ])
  return { clients: clients.size, calls: calls.size }
}

/**
 * Reasigna todos los clientes y llamadas del miembro a `target` y después lo
 * quita del workspace. Sin esto, sus registros quedaban con un `owner_uid`
 * huérfano que solo veía el owner.
 */
export async function removeMemberWithReassign(
  fs: Firestore,
  workspaceId: string,
  uid: string,
  target: ReassignTarget,
): Promise<MemberHoldings> {
  if (target.uid === uid) throw new Error('No se puede reasignar al mismo miembro')
  const [clients, calls] = await Promise.all([
    getDocs(query(wsCol(fs, workspaceId, 'clients'), where('owner_uid', '==', uid))),
    getDocs(query(wsCol(fs, workspaceId, 'calls'), where('owner_uid', '==', uid))),
  ])
  const owner = { owner_uid: target.uid, subteam_id: target.subteam_id }
  await commitInChunks(
    fs,
    [...clients.docs, ...calls.docs].map((d) => d.ref),
    (batch, ref) => batch.update(ref, owner),
  )
  await detachMember(fs, workspaceId, uid)
  return { clients: clients.size, calls: calls.size }
}

// ── Transferir propiedad ──

/**
 * Un solo batch: el workspace cambia de owner, el nuevo queda con rol owner y
 * el anterior baja a supervisor (las reglas solo permiten bajarse así).
 */
export async function transferOwnership(
  fs: Firestore,
  workspaceId: string,
  fromUid: string,
  toUid: string,
): Promise<void> {
  if (fromUid === toUid) return
  const batch = writeBatch(fs)
  batch.update(doc(fs, 'workspaces', workspaceId), { owner_uid: toUid })
  batch.update(wsDoc(fs, workspaceId, 'members', toUid), { role: 'owner' })
  batch.update(wsDoc(fs, workspaceId, 'members', fromUid), { role: 'supervisor' })
  await batch.commit()
}

// ── Borrar cliente ──

export interface ClientDependents {
  calls: number
  documents: number
}

export async function countClientDependents(
  fs: Firestore,
  workspaceId: string,
  clientId: string,
): Promise<ClientDependents> {
  const [calls, documents] = await Promise.all([
    getDocs(query(wsCol(fs, workspaceId, 'calls'), where('client_id', '==', clientId))),
    getDocs(collection(fs, 'workspaces', workspaceId, 'clients', clientId, 'documents')),
  ])
  return { calls: calls.size, documents: documents.size }
}

/**
 * Archivos del cliente: primero en Storage (las reglas de Storage leen el
 * cliente, así que debe seguir existiendo) y después sus registros.
 */
async function deleteClientDocuments(
  fs: Firestore,
  workspaceId: string,
  clientId: string,
  deleteFile?: DeleteFile,
): Promise<void> {
  const docs = await getDocs(collection(fs, 'workspaces', workspaceId, 'clients', clientId, 'documents'))
  if (deleteFile) {
    for (const d of docs.docs) {
      const path = d.get('storage_path')
      if (typeof path === 'string' && path) {
        // Un archivo que ya no existe no debe frenar el borrado.
        await deleteFile(path).catch(() => {})
      }
    }
  }
  await deleteAll(fs, docs.docs.map((d) => d.ref))
}

/** Borra el cliente con sus llamadas, documentos y archivos (solo owner). */
export async function deleteClientCascade(
  fs: Firestore,
  workspaceId: string,
  clientId: string,
  deleteFile?: DeleteFile,
): Promise<void> {
  await deleteClientDocuments(fs, workspaceId, clientId, deleteFile)
  const calls = await getDocs(query(wsCol(fs, workspaceId, 'calls'), where('client_id', '==', clientId)))
  await deleteAll(fs, calls.docs.map((d) => d.ref))
  // El cliente sale del índice de teléfonos en el mismo batch (spec 07).
  const client = await getDoc(wsDoc(fs, workspaceId, 'clients', clientId))
  const batch = writeBatch(fs)
  writePhoneIndex(batch, fs, workspaceId, clientId, (client.get('phone_digits') as string[] | undefined) ?? [], [])
  batch.delete(client.ref)
  await batch.commit()
}

// ── Borrar workspace ──

/**
 * Borra TODO el workspace. Orden impuesto por las reglas: los archivos antes
 * que sus clientes, los demás miembros (con su perfil) antes que el
 * workspace, y el member del owner al final, porque mientras exista es lo
 * que le da permiso.
 */
export async function deleteWorkspaceCascade(
  fs: Firestore,
  workspaceId: string,
  ownerUid: string,
  options: { deleteFile?: DeleteFile; logoPath?: string | null; onProgress?: OnProgress } = {},
): Promise<void> {
  const { deleteFile, logoPath, onProgress } = options
  const report = (step: string, done: number, total: number) => onProgress?.({ step, done, total })

  const clients = await getDocs(wsCol(fs, workspaceId, 'clients'))
  let done = 0
  report('Clientes y sus documentos', 0, clients.size)
  for (const client of clients.docs) {
    await deleteClientDocuments(fs, workspaceId, client.id, deleteFile)
    await deleteAll(fs, [client.ref])
    report('Clientes y sus documentos', ++done, clients.size)
  }

  const collections: [string, string][] = [
    ['calls', 'Llamadas'],
    ['goals', 'Metas'],
    ['invitations', 'Invitaciones'],
    ['subteams', 'Subequipos'],
    [PHONE_INDEX, 'Índice de teléfonos'],
  ]
  for (const [sub, label] of collections) {
    const snap = await getDocs(wsCol(fs, workspaceId, sub))
    report(label, 0, snap.size)
    await deleteAll(fs, snap.docs.map((d) => d.ref), (n) => report(label, n, snap.size))
  }

  if (logoPath && deleteFile) await deleteFile(logoPath).catch(() => {})

  const members = await getDocs(wsCol(fs, workspaceId, 'members'))
  const others = members.docs.filter((m) => m.id !== ownerUid)
  report('Miembros', 0, others.length)
  for (const [i, member] of others.entries()) {
    await detachMember(fs, workspaceId, member.id)
    report('Miembros', i + 1, others.length)
  }

  report('Workspace', 0, 1)
  await deleteAll(fs, [doc(fs, 'workspaces', workspaceId)])
  await deleteAll(fs, [wsDoc(fs, workspaceId, 'members', ownerUid)])
  const batch = writeBatch(fs)
  batch.update(doc(fs, 'users', ownerUid), { workspace_id: null })
  await batch.commit()
  report('Workspace', 1, 1)
}
