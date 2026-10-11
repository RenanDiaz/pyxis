// En los dominios que sirve el Worker, Firebase Auth usa el mismo dominio de la
// página: el Worker hace proxy de /__/auth/* (worker/authProxy.ts). Así un solo
// build sirve producción y staging (Workers Builds tiene un único juego de
// variables de build) y el popup de Google muestra el dominio de Pyxis.
// Cada host necesita `https://<host>/__/auth/handler` en los redirect URIs del
// OAuth client (Google Cloud → Credentials).
const PROXIED_HOSTS = new Set(['mipyxis.com', 'www.mipyxis.com', 'staging.mipyxis.com'])

/** `hostname` de la página si el Worker la sirve; si no (localhost, workers.dev), el de la config. */
export function resolveAuthDomain(hostname: string, configured: string | undefined): string | undefined {
  return PROXIED_HOSTS.has(hostname) ? hostname : configured
}
