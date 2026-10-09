import { after, before, beforeEach, describe, it } from 'node:test'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { as, createEnv, seed, WS } from './setup'

let env: RulesTestEnvironment
const db = (user: Parameters<typeof as>[1]) => as(env, user).firestore() as unknown as Firestore

before(async () => {
  env = await createEnv()
})
after(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await seed(env)
})

function acceptBatch(fs: Firestore, uid: string, invId: string, member: Record<string, unknown> = {}) {
  const batch = writeBatch(fs)
  batch.update(doc(fs, `workspaces/${WS}/invitations/${invId}`), {
    status: 'accepted',
    accepted_by: uid,
    accepted_at: serverTimestamp(),
  })
  batch.set(doc(fs, `workspaces/${WS}/members/${uid}`), {
    uid,
    role: 'agent',
    subteam_id: 'A',
    invitation_id: invId,
    ...member,
  })
  batch.update(doc(fs, `users/${uid}`), { workspace_id: WS })
  return batch.commit()
}

describe('members', () => {
  it('un externo NO puede crearse como owner de un workspace ajeno', async () => {
    await assertFails(setDoc(doc(db('out'), `workspaces/${WS}/members/out`), { uid: 'out', role: 'owner', subteam_id: null }))
  })

  it('un agente NO puede subirse el rol ni cambiarse de subequipo', async () => {
    await assertFails(updateDoc(doc(db('ag'), `workspaces/${WS}/members/ag`), { role: 'owner' }))
    await assertFails(updateDoc(doc(db('ag'), `workspaces/${WS}/members/ag`), { subteam_id: 'B' }))
  })

  it('el owner sí cambia el rol de otro miembro', async () => {
    await assertSucceeds(updateDoc(doc(db('own'), `workspaces/${WS}/members/ag`), { role: 'supervisor' }))
  })

  it('fundar un workspace nuevo funciona (workspace + member owner + user en un batch)', async () => {
    const fs = db('out')
    const batch = writeBatch(fs)
    batch.set(doc(fs, 'workspaces/nuevo'), { name: 'Nuevo', owner_uid: 'out' })
    batch.set(doc(fs, 'workspaces/nuevo/members/out'), { uid: 'out', role: 'owner', subteam_id: null })
    batch.update(doc(fs, 'users/out'), { workspace_id: 'nuevo' })
    await assertSucceeds(batch.commit())
  })

  it('un usuario puede leer su propio member aunque no sea miembro (no existe)', async () => {
    await assertSucceeds(getDoc(doc(db('out'), `workspaces/${WS}/members/out`)))
  })
})

describe('invitaciones', () => {
  it('el invitado lee la invitación por ID (token) pero no puede listar', async () => {
    await assertSucceeds(getDoc(doc(db('out'), `workspaces/${WS}/invitations/tok-out`)))
    await assertFails(getDocs(collection(db('out'), `workspaces/${WS}/invitations`)))
    await assertFails(getDocs(collection(db('ag'), `workspaces/${WS}/invitations`)))
  })

  it('nadie salvo el owner modifica una invitación (rol, expiración)', async () => {
    await assertFails(updateDoc(doc(db('out'), `workspaces/${WS}/invitations/tok-out`), { role: 'supervisor' }))
    await assertFails(updateDoc(doc(db('ag'), `workspaces/${WS}/invitations/tok-out`), { status: 'pending' }))
  })

  it('el invitado acepta: invitación + member + user en un batch', async () => {
    await assertSucceeds(acceptBatch(db('out'), 'out', 'tok-out'))
  })

  it('NO se acepta con un rol distinto al de la invitación', async () => {
    await assertFails(acceptBatch(db('out'), 'out', 'tok-out', { role: 'owner' }))
    await assertFails(acceptBatch(db('out'), 'out', 'tok-out', { subteam_id: 'B' }))
  })

  it('NO se acepta con otro email, expirada o ya usada', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'users/intruso'), { uid: 'intruso', workspace_id: null }),
    )
    const intruso = env.authenticatedContext('intruso', { email: 'intruso@test.com' }).firestore() as unknown as Firestore
    await assertFails(acceptBatch(intruso, 'intruso', 'tok-out'))
    await assertFails(acceptBatch(db('out'), 'out', 'tok-expired'))
    await assertFails(acceptBatch(db('out'), 'out', 'tok-used'))
  })

  it('no se puede crear el member sin aceptar la invitación en el mismo batch', async () => {
    await assertFails(
      setDoc(doc(db('out'), `workspaces/${WS}/members/out`), { uid: 'out', role: 'agent', subteam_id: 'A', invitation_id: 'tok-out' }),
    )
  })
})

describe('users', () => {
  it('no se puede apuntar workspace_id a un workspace donde no se es miembro', async () => {
    await assertFails(updateDoc(doc(db('out'), 'users/out'), { workspace_id: WS }))
  })

  it('el owner desvincula a un miembro que quita (removeMember)', async () => {
    const fs = db('own')
    const batch = writeBatch(fs)
    batch.delete(doc(fs, `workspaces/${WS}/members/ag2`))
    batch.update(doc(fs, 'users/ag2'), { workspace_id: null })
    await assertSucceeds(batch.commit())
  })

  it('un agente no toca el perfil de otro', async () => {
    await assertFails(updateDoc(doc(db('ag'), 'users/ag2'), { workspace_id: null }))
  })
})

describe('states', () => {
  it('un owner de workspace NO edita estados; un admin global sí', async () => {
    await assertFails(updateDoc(doc(db('own'), 'states/FL'), { state_fee: '$1' }))
    await assertSucceeds(updateDoc(doc(db('adm'), 'states/FL'), { state_fee: '$130' }))
  })
})

describe('clients', () => {
  const client = (fs: Firestore, id: string) => doc(fs, `workspaces/${WS}/clients/${id}`)
  const clients = (fs: Firestore) => collection(fs, `workspaces/${WS}/clients`)

  it('agente: lee lo suyo, no lo de otro agente', async () => {
    await assertSucceeds(getDoc(client(db('ag'), 'cAg')))
    await assertFails(getDoc(client(db('ag'), 'cAg2')))
  })

  it('supervisor: lee su subequipo, no otro', async () => {
    await assertSucceeds(getDoc(client(db('sup'), 'cAg')))
    await assertFails(getDoc(client(db('sup'), 'cAg2')))
  })

  it('supervisor sin subequipo NO ve clientes sin subequipo de otros', async () => {
    await assertFails(getDoc(client(db('supNo'), 'cNoSub')))
  })

  it('queries: agente con filtro owner_uid sí; sin filtro no', async () => {
    await assertSucceeds(getDocs(query(clients(db('ag')), where('owner_uid', '==', 'ag'))))
    await assertFails(getDocs(clients(db('ag'))))
    await assertSucceeds(getDocs(query(clients(db('sup')), where('subteam_id', '==', 'A'))))
    await assertSucceeds(getDocs(clients(db('own'))))
  })

  it('agente NO crea clientes a nombre de otro ni en otro subequipo', async () => {
    await assertFails(setDoc(client(db('ag'), 'n1'), { owner_uid: 'ag2', subteam_id: 'B' }))
    await assertFails(setDoc(client(db('ag'), 'n2'), { owner_uid: 'ag', subteam_id: 'B' }))
    await assertSucceeds(setDoc(client(db('ag'), 'n3'), { owner_uid: 'ag', subteam_id: 'A' }))
  })

  it('agente NO reasigna su cliente, pero sí lo edita (incluso si es de un subequipo viejo)', async () => {
    await assertFails(updateDoc(client(db('ag'), 'cAg'), { owner_uid: 'ag2', subteam_id: 'B' }))
    await assertSucceeds(updateDoc(client(db('ag'), 'cAg'), { notes: 'hola' }))
    await assertSucceeds(updateDoc(client(db('ag'), 'cAgLegacy'), { notes: 'hola' }))
  })

  it('supervisor reasigna dentro de su subequipo, no fuera', async () => {
    await assertSucceeds(updateDoc(client(db('sup'), 'cAg'), { owner_uid: 'sup', subteam_id: 'A' }))
    await assertFails(updateDoc(client(db('sup'), 'cAg'), { owner_uid: 'ag2', subteam_id: 'B' }))
    await assertFails(updateDoc(client(db('sup'), 'cAg'), { owner_uid: 'ag2', subteam_id: 'A' }))
  })

  it('owner reasigna a cualquiera', async () => {
    await assertSucceeds(updateDoc(client(db('own'), 'cAg'), { owner_uid: 'ag2', subteam_id: 'B' }))
  })
})

describe('calls', () => {
  it('agente no lee llamadas de otro agente; owner sí', async () => {
    await assertFails(getDoc(doc(db('ag'), `workspaces/${WS}/calls/callAg2`)))
    await assertSucceeds(getDoc(doc(db('ag'), `workspaces/${WS}/calls/callAg`)))
    await assertSucceeds(getDoc(doc(db('own'), `workspaces/${WS}/calls/callAg2`)))
  })

  it('agente no lista llamadas sin filtro ni reasigna', async () => {
    await assertFails(getDocs(collection(db('ag'), `workspaces/${WS}/calls`)))
    await assertSucceeds(getDocs(query(collection(db('ag'), `workspaces/${WS}/calls`), where('owner_uid', '==', 'ag'))))
    await assertFails(updateDoc(doc(db('ag'), `workspaces/${WS}/calls/callAg`), { owner_uid: 'ag2' }))
  })
})

describe('documents del cliente', () => {
  const docs = (fs: Firestore, clientId: string) => collection(fs, `workspaces/${WS}/clients/${clientId}/documents`)

  it('agente no lista documentos de clientes ajenos', async () => {
    await assertFails(getDocs(docs(db('ag'), 'cAg2')))
    await assertSucceeds(getDocs(docs(db('ag'), 'cAg')))
  })

  it('agente sube documentos solo a sus clientes y a su nombre', async () => {
    await assertSucceeds(setDoc(doc(docs(db('ag'), 'cAg'), 'n'), { name: 'a.pdf', uploaded_by_uid: 'ag' }))
    await assertFails(setDoc(doc(docs(db('ag'), 'cAg'), 'm'), { name: 'a.pdf', uploaded_by_uid: 'ag2' }))
    await assertFails(setDoc(doc(docs(db('ag'), 'cAg2'), 'o'), { name: 'a.pdf', uploaded_by_uid: 'ag' }))
  })
})
