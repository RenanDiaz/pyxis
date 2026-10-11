// Proxy del handler de Firebase Auth. Con `VITE_FIREBASE_AUTH_DOMAIN` apuntando
// a mipyxis.com, el popup de Google muestra "continuar a mipyxis.com" en vez de
// `<proyecto>.firebaseapp.com`, y el login queda en el mismo origen que la app:
// Safari (iOS) bloquea el almacenamiento de terceros que necesita el popup
// cuando el authDomain es otro dominio.
// https://firebase.google.com/docs/auth/web/redirect-best-practices (opción 3)

/** Rutas que sirve Firebase Hosting para el flujo de auth. */
export function isFirebaseAuthPath(pathname: string): boolean {
  return pathname.startsWith('/__/auth/') || pathname.startsWith('/__/firebase/')
}

/** Reenvía la request tal cual a `https://<authHost>` con el mismo path y query. */
export function proxyFirebaseAuth(request: Request, authHost: string): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, `https://${authHost}`)
  // `manual`: las redirecciones del handler (hacia Google y de vuelta) las
  // sigue el navegador, no el Worker.
  return fetch(new Request(target, { method: request.method, headers: request.headers, body: request.body, redirect: 'manual' }))
}
