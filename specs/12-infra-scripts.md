# 12 — Infra: índices, scripts y migraciones

**Prioridad:** 🟡 Media · **Estado:** implementado; falta desplegar índices (ver abajo)

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

## Implementación (2026-10-09)
- **Índices:** se agregaron los 7 que faltaban, deducidos de las queries de
  `src/lib/firestore.ts` (no se exportaron de la consola: no hay acceso al
  proyecto desde aquí):
  - `clients`: `status + created_at↓`, `archived + created_at↓`,
    `archived + status + created_at↓` (owner).
  - `calls`: `client_id + scheduled_at`, `client_id + subteam_id + scheduled_at`
    (historial del cliente para owner/supervisor), `outcome + owner_uid +
    scheduled_at↓` y `outcome + subteam_id + scheduled_at↓` (`getOverdueCalls`).
  - `tests/unit/firestoreIndexes.test.ts` enumera las formas de cada query
    (por rol y filtros) y falla si alguna no tiene índice. El emulador no exige
    índices, así que esta es la única red antes de prod.
- **`migrate-payment-dates.ts`:** comentario corregido; ya parsea y corre.
- **`seed.ts`:** `fileURLToPath(import.meta.url)`; `states` solo crea los que
  faltan (flag `--overwrite-states` para reemplazar); `--dry-run`; se quitó
  `config/clientForm` (la app usa `client_form.json` local). Verificado en el
  emulador: un precio editado sobrevive al seed.
- **Migraciones** (`migrate-to-multi-process`, `backfill-registration-company`,
  `migrate-payment-dates`): escriben con `updateIfUnchanged`
  (`scripts/lib/`), una escritura por documento con precondición
  `lastUpdateTime`. Si alguien editó el cliente mientras corría, no se pisa y
  se lista para volver a correr. Test de emulador en
  `tests/emulator/update-if-unchanged.test.ts`.
- **Documentos:** si `addDoc` falla tras subir, se borra el archivo. Al borrar,
  primero el doc y luego el archivo (best-effort con `console.warn`). También se
  corrigió que un error de `getDownloadURL` dejaba la subida colgada.
- **Lint en verde** (0 errores, 0 warnings) y en CI con `--max-warnings 0`:
  - Tipos reales en `react-simple-maps.d.ts`/`d3-geo.d.ts` (sin `any`).
  - `set-state-in-effect`: `useClientDocuments` deriva el estado por cliente;
    en `ClientForm` el agente por defecto es derivado y la detección de estado
    por código de área corre al editar teléfonos (verificado en navegador).
  - Hooks `useAuth`/`useWorkspaceContext` y `components/ui` (shadcn) excluidos
    de `only-export-components` con justificación.
  - Borrado el código muerto `AgentFilter`, `CallsList`, `ClientsTable`
    (adelanta parte de spec 13).

### Decisiones
- **Precondición en vez de `runTransaction`:** mismo efecto (no pisar cambios
  concurrentes) con menos cambios en cada script; los scripts ya eran
  idempotentes, así que reintentar es volver a correrlos.
- **Borrado doc → archivo:** un archivo huérfano no lo ve nadie; un documento
  con link roto sí. Caso conocido: archivos legacy sin `uploaded_by` solo los
  puede borrar el owner en Storage; si los borra quien los subió, el registro
  desaparece y el archivo queda huérfano.
- **Al restaurar un borrador** del formulario ya no se re-detecta el estado por
  teléfono (antes lo hacía el effect); se detecta en cuanto se edita el teléfono.

### Pendiente (usuario)
Comparar con la consola y desplegar:
```bash
firebase firestore:indexes                  # ver los existentes
firebase deploy --only firestore:indexes
```
(Usa el proyecto `default` de `.firebaserc`, `pyxis-crm`.)
Si en la consola hay índices que no están en el archivo, el deploy pregunta si
borrarlos: responder **No**.

## Requisitos
1. Exportar índices reales (`firebase firestore:indexes > firestore.indexes.json`) y agregar los faltantes; desplegar con `firebase deploy --only firestore:indexes`.
2. Arreglar el comentario de `migrate-payment-dates.ts` (usar `workspaces/{id}/clients`).
3. `seed.ts`: `fileURLToPath(import.meta.url)`; `states` con `set(..., { merge: true })` **solo** si no existe el doc, o flag `--overwrite-states`; quitar `config/clientForm` si no se usa.
4. Scripts de migración con `runTransaction` por documento y modo `--dry-run` consistente.
5. Subida de documentos: si `addDoc` falla, borrar el archivo. Borrado: primero doc, luego archivo (un archivo huérfano es menos visible que un link roto) o al revés con reintento — decidir y documentar.
6. Lint en verde: corregir o justificar con `eslint-disable` puntual; agregar `npm run lint` + `tsc -b` a CI (GitHub Actions) para PRs.

## Criterios de aceptación
- [x] Owner filtra clientes por status y por archivados sin error de índice. *(tras desplegar índices)*
- [x] `npx tsx scripts/migrate-payment-dates.ts --dry-run` corre.
- [x] Correr `seed.ts` no cambia precios editados.
- [x] CI falla un PR con errores de lint o tipos.
