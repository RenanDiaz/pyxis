# 13 — UX, accesibilidad y limpieza

**Prioridad:** 🟢 Baja · **Estado:** PR 1 implementado (bugs y privacidad); pendiente PR 2 (resto) · Se puede repartir en PRs chicos.

## PR 1 — implementado (2026-10-09)
- **Mayúsculas sin cursor que salta:** los inputs muestran mayúsculas con CSS
  (`UPPERCASE_INPUT_CLASS` en `ClientForm`, socios, compañía del proceso y
  `AddProcessDialog`) y `normalizeClientFields` (antes `uppercaseClientFields`)
  las aplica al guardar.
  - **P1 resuelta:** las **notas** se guardan tal cual se escriben (texto
    libre, no van al .docx ni al recibo).
  - **Email** en minúsculas al guardar; los guardados en mayúsculas se muestran
    en minúsculas en el detalle, el `mailto:`, el .docx y al editar.
  - `handleSubmit`/`removePhone` ya no mutan el estado de los teléfonos.
- **Documentos:** Word, Excel y otros se **descargan** (ya no pasan por el visor
  de Google Docs). Errores de subida con botón para quitarlos de la lista.
  `document_uploaded` solo si al menos una subida salió bien, e invalida la
  caché de clientes. `downloadFileWithFeedback` compartido por card, visor y grid.
- **Logos WebP:** `fetchImageAsDataUrl` convierte a PNG con canvas cualquier
  formato que no sea PNG/JPEG (sirve también para logos ya subidos).
- **Inicio:** "Últimos clientes" excluye archivados (filtro en memoria sobre
  `limit(max*4)`: los clientes viejos no tienen el campo `archived`).
- **`OutcomeBadge`:** fallback para outcomes desconocidos.
- **`AddProcessDialog`:** "Cancelar" resetea; el estado por defecto sigue al del
  cliente aunque cambie después de montar.

## UX
- ✅ `toUpperCase()` en inputs controlados (`ClientForm`, notas en `ClientDetail`) hace saltar el cursor al final al editar en medio. **Req:** mostrar en mayúsculas con CSS (`uppercase`) y normalizar al guardar. En notas: ¿realmente deben ir en mayúsculas? (P1 → no).
- ✅ `email` se guarda en MAYÚSCULAS (`clientUtils`): feo en .docx y recibo. **Req:** excluir email de los campos en mayúsculas; normalizar a minúsculas.
- Validaciones de `ClientForm`: email, SSN/ITIN (formato), % de socios suma 100 (advertencia). Además `handleSubmit` muta un objeto del estado (`primaryPhone.is_primary = true`).
- ✅ `AddProcessDialog`: "Cancelar" no resetea; `defaultState` solo se aplica al montar.
- ✅ `OutcomeBadge`: "No contesto" → "No contestó"; outcome desconocido lanza `TypeError` (falta fallback).
- Colores semafóricos (CLAUDE.md): `deuda_pendiente` (ámbar) casi idéntico a contactado (amarillo) y en_proceso (naranja). **Req:** paleta distinguible + ícono, verificada en claro/oscuro.
- Oficios y Glosario: la especificación pide **flashcards**; hoy son tarjetas estáticas. **Req:** volteo (término ↔ traducción/definición) y modo práctica aleatorio (P2).
- ✅ `DocumentGrid`: los Word/Excel del cliente (pueden tener SSN) se abren pasando la URL firmada al visor de Google Docs (tercero). **Req:** descargar en vez de previsualizar con terceros. *(Privacidad: subir prioridad si hay documentos sensibles en .docx/.xlsx.)*
- ✅ `DocumentGrid`: infiere status aunque todas las subidas fallen; llama `updateClient` sin invalidar React Query; subidas con error nunca se quitan de la lista.
- Zonas horarias: estados con varias zonas (TX, FL, TN, KY, IN, MI, ND, SD, NE, KS, OR, ID) usan una sola ⇒ "buena hora para llamar" puede errar por 1 h. `callTime` devuelve "buena hora" ante error. **Req:** zona por código de área cuando exista; ante error, "desconocida".
- `areaCodeMap` usa `states.json` local, no los estados editados en Firestore.
- ✅ Logos WebP en recibos: se aceptan pero `jsPDF.addImage` los trata como JPEG y fallan en silencio. **Req:** convertir a PNG al subir o rechazar WebP.
- ✅ `getRecentClients` (dashboard) no excluye archivados.
- `useAssignableMembers`: supervisor sin subequipo ve como asignables a todos los miembros sin subequipo; código muerto `|| true` en el filtro de owner.

## Accesibilidad
- `aria-label` faltantes: hamburguesa (`Header`), campana (`NotificationCenter`), papelera de miembros, botones de vista en `States` (solo `title`).
- `<Label>` sin `htmlFor` en Schedule, Onboarding, WorkspaceMembers, WorkspaceSettings, GoalModal, ExportReportDialog.
- `Clients.tsx`: `<a>` anidados dentro de `<Link>` (HTML inválido; acciones no enfocables).
- `StatesMap`: estados solo responden a clic, no a teclado.
- `Sheet` móvil sin `SheetTitle`.

## Limpieza
- ~~Código muerto: `components/shared/CallsList.tsx`, `ClientsTable.tsx`, `AgentFilter.tsx`~~ (borrados en spec 12); comentario huérfano en `statusUtils.ts`.

## Criterios de aceptación
- [ ] Editar una letra en medio de "JUAN PEREZ" no mueve el cursor.
- [ ] Lighthouse accesibilidad ≥ 90 en `/clientes` y `/estados`.
- [ ] Ningún documento del cliente se envía a un servicio de terceros.
- [ ] Cada status de cliente se distingue sin depender solo del color.

## Preguntas abiertas
- **P1:** ¿Por qué todo en mayúsculas? (¿requisito de los formularios estatales?) Define si las notas también. **Resuelta:** notas tal cual; el resto en mayúsculas.
- **P2:** ¿El modo práctica de flashcards se usa para entrenar agentes nuevos? Si no, basta con el volteo.
