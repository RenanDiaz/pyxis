// Secretos del Worker (Cloudflare → Variables & Secrets; en local `.dev.vars`).
// No están en wrangler.jsonc, así que `npm run cf-typegen` no los tipa.

export interface Secrets {
  /** Proyecto de Firebase (el mismo `VITE_FIREBASE_PROJECT_ID` de la app). */
  FIREBASE_PROJECT_ID?: string
  /** Service account del Worker con rol Cloud Datastore User (spec 21 fase 2 y 18). */
  FIREBASE_SA_CLIENT_EMAIL?: string
  /** Clave PEM de esa service account; acepta los `\n` escapados. */
  FIREBASE_SA_PRIVATE_KEY?: string
  /** Claves VAPID de Web Push (`npx tsx scripts/generate-vapid-keys.ts`). */
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
}

export type WorkerEnv = Env & Secrets

/** Contacto para los servicios de push (VAPID `sub`). */
export const VAPID_SUBJECT = 'mailto:soporte@mipyxis.com'
