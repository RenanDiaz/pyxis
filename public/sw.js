// Service worker de Pyxis (spec 21 fase 2). Solo muestra los avisos de
// llamadas que manda el Worker por Web Push: no intercepta requests ni cachea
// nada (la app se sigue actualizando como siempre, spec 14).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Mensaje ilegible: igual hay que mostrar algo (Chrome lo exige).
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pyxis: tienes una llamada', {
      body: data.body || '',
      // La misma `tag` que la fase 1: si Pyxis está abierto y ya avisó, el
      // navegador reemplaza la notificación en vez de mostrar otra.
      tag: data.tag,
      requireInteraction: Boolean(data.requireInteraction),
      data: { url: data.url || '/agenda' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.url) || '/agenda'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        // La app navega con su router, sin recargar (ver CallReminders).
        open.postMessage({ type: 'pyxis:navigate', url: path })
      } else {
        await self.clients.openWindow(path)
      }
    })(),
  )
})
