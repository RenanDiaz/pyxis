# 12 — Infra: índices, scripts y migraciones

**Prioridad:** 🟡 Media · **Estado:** propuesto

## Problema
- **Índices compuestos faltantes** en `firestore.indexes.json` (a confirmar contra la consola, pueden existir creados a mano):
  - `calls`: `client_id + scheduled_at`, `client_id + subteam_id + scheduled_at` ⇒ historial de llamadas en `ClientDetail` para owner/supervisor.
  - `clients`: `status + created_at↓`, `archived + created_at↓`, `archived + status + created_at↓` (variante owner, sin `owner_uid`/`subteam_id`).
  - `calls`: `outcome + owner_uid/subteam_id + scheduled_at↓` (`getOverdueCalls` para agente/supervisor).
- ✔ `scripts/migrate-payment-dates.ts:13`: el comentario contiene `workspaces/*/clients`; el `*/` cierra el bloque y **el script no parsea**.
- `scripts/seed.ts`: usa `__dirname` con `"type": "module"` (probable ReferenceError); `batch.set` sobre `states` **pisa las ediciones** hechas desde `StateEditDialog`; sube `config/clientForm` que las reglas no dejan leer.
- `migrate-to-multi-process.ts` y `backfill-registration-company.ts`: leen todo y escriben en batch sin transacción ⇒ pueden pisar cambios hechos durante la migración.
- `storageUtils.ts`: si `addDoc` falla tras subir, el archivo queda huérfano; al borrar, se borra el archivo antes que el doc (si falla el doc, queda link roto).
- Lint: 32 errores preexistentes (`no-explicit-any` en `.d.ts`, `react-refresh/only-export-components`, `set-state-in-effect`, `no-empty`); `tsc` limpio.

## Requisitos
1. Exportar índices reales (`firebase firestore:indexes > firestore.indexes.json`) y agregar los faltantes; desplegar con `firebase deploy --only firestore:indexes`.
2. Arreglar el comentario de `migrate-payment-dates.ts` (usar `workspaces/{id}/clients`).
3. `seed.ts`: `fileURLToPath(import.meta.url)`; `states` con `set(..., { merge: true })` **solo** si no existe el doc, o flag `--overwrite-states`; quitar `config/clientForm` si no se usa.
4. Scripts de migración con `runTransaction` por documento y modo `--dry-run` consistente.
5. Subida de documentos: si `addDoc` falla, borrar el archivo. Borrado: primero doc, luego archivo (un archivo huérfano es menos visible que un link roto) o al revés con reintento — decidir y documentar.
6. Lint en verde: corregir o justificar con `eslint-disable` puntual; agregar `npm run lint` + `tsc -b` a CI (GitHub Actions) para PRs.

## Criterios de aceptación
- [ ] Owner filtra clientes por status y por archivados sin error de índice.
- [ ] `npx tsx scripts/migrate-payment-dates.ts --dry-run` corre.
- [ ] Correr `seed.ts` no cambia precios editados.
- [ ] CI falla un PR con errores de lint o tipos.
