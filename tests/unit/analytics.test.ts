import { afterEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { analyticsEnabled, identifyUser, resetAnalytics, scrubEventUrls, track } from '@/lib/analytics'
import { routePattern, sanitizeUrl } from '@/lib/routePattern'
import { isAnalyticsPath, proxyAnalytics } from '../../worker/analyticsProxy'

// Analítica de uso (spec 24): sin PII, solo producción, todo a través del Worker.

describe('routePattern', () => {
  it('oculta los ids de cliente y estado', () => {
    assert.equal(routePattern('/clientes/abc123'), '/clientes/:id')
    assert.equal(routePattern('/clientes/abc123/editar'), '/clientes/:id/editar')
    assert.equal(routePattern('/estados/FL'), '/estados/:abbreviation')
  })

  it('deja iguales las rutas fijas, con o sin "/" final', () => {
    assert.equal(routePattern('/clientes/nuevo'), '/clientes/nuevo')
    assert.equal(routePattern('/agenda'), '/agenda')
    assert.equal(routePattern('/workspace/miembros/'), '/workspace/miembros')
    assert.equal(routePattern('/'), '/')
  })

  it('sanitizeUrl quita ids, query y hash', () => {
    assert.equal(sanitizeUrl('https://mipyxis.com/clientes/abc123?q=maria#x'), 'https://mipyxis.com/clientes/:id')
    assert.equal(sanitizeUrl('no es una url'), 'no es una url')
  })
})

describe('analyticsEnabled', () => {
  const prod = { enabled: 'true', key: 'phc_x', hostname: 'mipyxis.com', doNotTrack: null }

  it('activo solo en producción con la variable y la clave', () => {
    assert.equal(analyticsEnabled(prod), true)
    assert.equal(analyticsEnabled({ ...prod, hostname: 'www.mipyxis.com' }), true)
  })

  it('apagado en staging, local, workers.dev, sin variable o sin clave', () => {
    for (const hostname of ['staging.mipyxis.com', 'localhost', 'pyxis.algo.workers.dev']) {
      assert.equal(analyticsEnabled({ ...prod, hostname }), false, hostname)
    }
    assert.equal(analyticsEnabled({ ...prod, enabled: undefined }), false)
    assert.equal(analyticsEnabled({ ...prod, enabled: 'false' }), false)
    assert.equal(analyticsEnabled({ ...prod, key: '' }), false)
  })

  it('respeta Do Not Track', () => {
    assert.equal(analyticsEnabled({ ...prod, doNotTrack: '1' }), false)
    assert.equal(analyticsEnabled({ ...prod, doNotTrack: 'yes' }), false)
    assert.equal(analyticsEnabled({ ...prod, doNotTrack: '0' }), true)
  })
})

describe('scrubEventUrls', () => {
  it('reemplaza las URLs automáticas del SDK por el patrón de la ruta', () => {
    const event = scrubEventUrls({
      event: 'client_created',
      properties: {
        $current_url: 'https://mipyxis.com/clientes/abc123?tab=pagos',
        $pathname: '/clientes/abc123/editar',
        $referrer: 'https://mipyxis.com/clientes/zzz999',
        $browser: 'Chrome',
      },
    })
    assert.deepEqual(event.properties, {
      $current_url: 'https://mipyxis.com/clientes/:id',
      $pathname: '/clientes/:id/editar',
      $referrer: 'https://mipyxis.com/clientes/:id',
      $browser: 'Chrome',
    })
  })

  it('tolera eventos sin propiedades o nulos', () => {
    assert.equal(scrubEventUrls(null), null)
    assert.deepEqual(scrubEventUrls({}), {})
  })
})

describe('track sin inicializar', () => {
  it('es no-op: no lanza ni espera red', () => {
    assert.doesNotThrow(() => {
      track('client_created', { source: 'form' })
      track('report_exported')
      identifyUser('uid', { role: 'agent', workspace_id: 'w', subteam_id: null })
      resetAnalytics()
    })
  })
})

describe('proxy de la analítica', () => {
  afterEach(() => mock.restoreAll())

  it('solo captura /ingest', () => {
    assert.equal(isAnalyticsPath('/ingest'), true)
    assert.equal(isAnalyticsPath('/ingest/e/'), true)
    assert.equal(isAnalyticsPath('/ingestar'), false)
    assert.equal(isAnalyticsPath('/clientes/ingest/x'), false)
  })

  it('reenvía a PostHog sin cookies ni IP y sin seguir redirecciones', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }))
    await proxyAnalytics(
      new Request('https://mipyxis.com/ingest/e/?ip=0&v=4', {
        method: 'POST',
        body: '{"event":"x"}',
        headers: {
          cookie: 'sesion=secreta',
          'cf-connecting-ip': '203.0.113.9',
          'x-forwarded-for': '203.0.113.9',
          'content-type': 'application/json',
        },
      }),
    )
    const sent = fetchMock.mock.calls[0].arguments[0] as Request
    assert.equal(sent.url, 'https://us.i.posthog.com/e/?ip=0&v=4')
    assert.equal(sent.method, 'POST')
    assert.equal(sent.redirect, 'manual')
    assert.equal(sent.headers.get('cookie'), null)
    assert.equal(sent.headers.get('cf-connecting-ip'), null)
    assert.equal(sent.headers.get('x-forwarded-for'), null)
    assert.equal(sent.headers.get('content-type'), 'application/json')
    assert.equal(await sent.text(), '{"event":"x"}')
  })

  it('los estáticos van al host de assets', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('', { status: 200 }))
    await proxyAnalytics(new Request('https://mipyxis.com/ingest/static/array.js'))
    assert.equal((fetchMock.mock.calls[0].arguments[0] as Request).url, 'https://us-assets.i.posthog.com/static/array.js')
  })
})
