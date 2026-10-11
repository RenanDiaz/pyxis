import { afterEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { isFirebaseAuthPath, proxyFirebaseAuth } from '../../worker/authProxy'

// Proxy del handler de Firebase Auth en mipyxis.com.

describe('isFirebaseAuthPath', () => {
  it('reconoce las rutas del handler', () => {
    assert.equal(isFirebaseAuthPath('/__/auth/handler'), true)
    assert.equal(isFirebaseAuthPath('/__/auth/iframe.js'), true)
    assert.equal(isFirebaseAuthPath('/__/firebase/init.json'), true)
  })

  it('no captura rutas de la app', () => {
    assert.equal(isFirebaseAuthPath('/'), false)
    assert.equal(isFirebaseAuthPath('/clientes/__/auth/x'), false)
    assert.equal(isFirebaseAuthPath('/__/otra'), false)
    assert.equal(isFirebaseAuthPath('/api/health'), false)
  })
})

describe('proxyFirebaseAuth', () => {
  afterEach(() => mock.restoreAll())

  it('reenvía path, query y método al host de Firebase sin seguir redirecciones', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { Location: 'https://accounts.google.com/x' } }))
    const res = await proxyFirebaseAuth(
      new Request('https://mipyxis.com/__/auth/handler?apiKey=k&authType=signInViaPopup', { headers: { Accept: 'text/html' } }),
      'pyxis-crm.firebaseapp.com',
    )
    const sent = fetchMock.mock.calls[0].arguments[0] as Request
    assert.equal(sent.url, 'https://pyxis-crm.firebaseapp.com/__/auth/handler?apiKey=k&authType=signInViaPopup')
    assert.equal(sent.method, 'GET')
    assert.equal(sent.redirect, 'manual')
    assert.equal(sent.headers.get('Accept'), 'text/html')
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('Location'), 'https://accounts.google.com/x')
  })
})
