import { after, before, beforeEach, describe, it } from 'node:test'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { as, createEnv, seed, WS } from './setup'

let env: RulesTestEnvironment
const bytes = (n: number) => new Uint8Array(n)

before(async () => {
  env = await createEnv()
})
after(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await seed(env)
  await env.clearStorage()
})

// UploadTask es thenable pero no Promise: se envuelve para los assert*.
function upload(user: Parameters<typeof as>[1], path: string, opts: { size?: number; contentType?: string; uploadedBy?: string } = {}) {
  const task = as(env, user)
    .storage()
    .ref(path)
    .put(bytes(opts.size ?? 10), {
      contentType: opts.contentType ?? 'application/pdf',
      customMetadata: { uploaded_by: opts.uploadedBy ?? user },
    })
  return Promise.resolve(task)
}

describe('archivos de clientes', () => {
  const file = (clientId: string, name = 'a.pdf') => `workspaces/${WS}/clients/${clientId}/${name}`

  it('agente sube a sus clientes, no a los de otro', async () => {
    await assertSucceeds(upload('ag', file('cAg')))
    await assertFails(upload('ag', file('cAg2')))
  })

  it('agente no lee archivos de clientes ajenos', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(file('cAg2')).put(bytes(10))
    })
    await assertFails(as(env, 'ag').storage().ref(file('cAg2')).getMetadata())
    await assertSucceeds(as(env, 'own').storage().ref(file('cAg2')).getMetadata())
  })

  it('rechaza archivos > 20 MB, SVG y uploaded_by ajeno', async () => {
    await assertFails(upload('ag', file('cAg', 'big.pdf'), { size: 20 * 1024 * 1024 + 1 }))
    await assertFails(upload('ag', file('cAg', 'x.svg'), { contentType: 'image/svg+xml' }))
    await assertFails(upload('ag', file('cAg', 'y.pdf'), { uploadedBy: 'ag2' }))
  })

  it('solo el owner o quien subió borra; nadie sobrescribe', async () => {
    await assertSucceeds(upload('sup', file('cAg', 'del.pdf')))
    await assertFails(as(env, 'ag').storage().ref(file('cAg', 'del.pdf')).delete())
    await assertFails(upload('sup', file('cAg', 'del.pdf')))
    await assertSucceeds(as(env, 'sup').storage().ref(file('cAg', 'del.pdf')).delete())
    await assertSucceeds(upload('ag', file('cAg', 'own.pdf')))
    await assertSucceeds(as(env, 'own').storage().ref(file('cAg', 'own.pdf')).delete())
  })
})
