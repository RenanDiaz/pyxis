import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { updateIfUnchanged } from '../../scripts/lib/updateIfUnchanged'

// Helper de los scripts de migración (spec 12): no pisa un documento que
// alguien editó entre la lectura y la escritura del script.

let app: App
let db: Firestore

before(() => {
  app = initializeApp({ projectId: 'demo-pyxis' }, 'update-if-unchanged')
  db = getFirestore(app)
})
after(async () => {
  await deleteApp(app)
})

describe('updateIfUnchanged', () => {
  it('escribe si el documento no cambió', async () => {
    const ref = db.doc('migrations/a')
    await ref.set({ v: 1 })
    const snap = await ref.get()
    assert.equal(await updateIfUnchanged(snap, { migrated: true }), true)
    assert.deepEqual((await ref.get()).data(), { v: 1, migrated: true })
  })

  it('no pisa una edición hecha después de leer', async () => {
    const ref = db.doc('migrations/b')
    await ref.set({ v: 1 })
    const snap = await ref.get()
    await ref.update({ v: 2 }) // un agente edita mientras corre el script
    assert.equal(await updateIfUnchanged(snap, { v: 99 }), false)
    assert.deepEqual((await ref.get()).data(), { v: 2 })
  })
})
