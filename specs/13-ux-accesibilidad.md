# 13 — UX, accesibilidad y limpieza

**Prioridad:** 🟢 Baja · **Estado:** implementado (PR 1 y PR 2); pendiente: flashcards (P2) y validaciones de `ClientForm` · Se puede repartir en PRs chicos.

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

## PR 2 — implementado (2026-10-09)
- **Cursor:** Tailwind v4 dejó los botones con cursor por defecto. Regla en
  `@layer base` (`index.css`) para botones, tabs, radios, switches y combobox
  habilitados (las utilidades como `cursor-not-allowed` siguen ganando); las
  opciones de `select`/`dropdown-menu` pasaron de `cursor-default` a
  `cursor-pointer`.
- **Paleta de status** (`StatusBadge`): ícono por status (`StatusLabel`,
  reutilizado en `StatusSelect`); `deuda_pendiente` pasa de ámbar a **violeta**
  (la tarjeta de deudas de Inicio también); amarillo y naranja con más
  contraste entre sí. Revisado en claro y oscuro.
- **Zonas horarias:** `getClientTimezone(state, phone)` usa el código de área
  cuando cae entero en una zona de **ese mismo estado** (915 TX → Mountain;
  615/629/731/901/931 TN → Central, 423/865 TN → Eastern; 270/364 KY → Central;
  219 IN → Central). Si no, la del estado con `certain: false`: la Agenda
  avisa "confirma la hora con el cliente" y la ficha del estado avisa que
  tiene varias zonas. Se usa en Agenda (captura y lista) e Inicio.
  `isGoodCallTime` devuelve `null` ante zona inválida ("Hora desconocida").
- **`areaCodeMap`:** acepta la lista de estados de Firestore (los códigos se
  editan en `StateEditDialog`); `states.json` queda de respaldo.
- **Asignables:** supervisor sin subequipo solo se ve a sí mismo (igual que
  `canHold` en las reglas); quitado el `|| true`.
- **Accesibilidad:**
  - `aria-label` en hamburguesa, tema, campana (con conteo), papelera de
    miembros y vistas de Estados (`aria-pressed`).
  - `htmlFor`/`id` en Onboarding, WorkspaceMembers, WorkspaceSettings,
    GoalModal y ExportReportDialog; el radiogroup de la Agenda con
    `aria-labelledby`.
  - `Clients.tsx`: "stretched link" (el nombre es el link y cubre la tarjeta;
    las acciones van encima con `z-10` y `aria-label`). Ya no hay `<a>`
    dentro de `<a>`.
  - Mapa: cada estado es enfocable (`role="link"`) y abre con Enter/Espacio.
  - ✅ `Sheet` móvil con `SheetTitle`/`SheetDescription` ocultos.

### Decisiones
- Códigos de área que mezclan zonas (850 FL, 812 IN, 906 MI, 208 ID, 308 NE,
  541 OR, 605 SD, 701 ND, KS) no se adivinan: se avisa que hay que confirmar.

## UX
- ✅ `toUpperCase()` en inputs controlados (`ClientForm`, notas en `ClientDetail`) hace saltar el cursor al final al editar en medio. **Req:** mostrar en mayúsculas con CSS (`uppercase`) y normalizar al guardar. En notas: ¿realmente deben ir en mayúsculas? (P1 → no).
- ✅ `email` se guarda en MAYÚSCULAS (`clientUtils`): feo en .docx y recibo. **Req:** excluir email de los campos en mayúsculas; normalizar a minúsculas.
- Validaciones de `ClientForm`: email, SSN/ITIN (formato), % de socios suma 100 (advertencia). Además `handleSubmit` muta un objeto del estado (`primaryPhone.is_primary = true`).
- ✅ `AddProcessDialog`: "Cancelar" no resetea; `defaultState` solo se aplica al montar.
- ✅ `OutcomeBadge`: "No contesto" → "No contestó"; outcome desconocido lanza `TypeError` (falta fallback).
- ✅ Colores semafóricos (CLAUDE.md): `deuda_pendiente` (ámbar) casi idéntico a contactado (amarillo) y en_proceso (naranja). **Req:** paleta distinguible + ícono, verificada en claro/oscuro.
- Oficios y Glosario: la especificación pide **flashcards**; hoy son tarjetas estáticas. **Req:** volteo (término ↔ traducción/definición) y modo práctica aleatorio (P2).
- ✅ `DocumentGrid`: los Word/Excel del cliente (pueden tener SSN) se abren pasando la URL firmada al visor de Google Docs (tercero). **Req:** descargar en vez de previsualizar con terceros. *(Privacidad: subir prioridad si hay documentos sensibles en .docx/.xlsx.)*
- ✅ `DocumentGrid`: infiere status aunque todas las subidas fallen; llama `updateClient` sin invalidar React Query; subidas con error nunca se quitan de la lista.
- ✅ Zonas horarias: estados con varias zonas (TX, FL, TN, KY, IN, MI, ND, SD, NE, KS, OR, ID) usan una sola ⇒ "buena hora para llamar" puede errar por 1 h. `callTime` devuelve "buena hora" ante error. **Req:** zona por código de área cuando exista; ante error, "desconocida".
- ✅ `areaCodeMap` usa `states.json` local, no los estados editados en Firestore.
- ✅ Logos WebP en recibos: se aceptan pero `jsPDF.addImage` los trata como JPEG y fallan en silencio. **Req:** convertir a PNG al subir o rechazar WebP.
- ✅ `getRecentClients` (dashboard) no excluye archivados.
- ✅ `useAssignableMembers`: supervisor sin subequipo ve como asignables a todos los miembros sin subequipo; código muerto `|| true` en el filtro de owner.

## Accesibilidad
- ✅ `aria-label` faltantes: hamburguesa (`Header`), campana (`NotificationCenter`), papelera de miembros, botones de vista en `States` (solo `title`).
- ✅ `<Label>` sin `htmlFor` en Schedule, Onboarding, WorkspaceMembers, WorkspaceSettings, GoalModal, ExportReportDialog.
- ✅ `Clients.tsx`: `<a>` anidados dentro de `<Link>` (HTML inválido; acciones no enfocables).
- ✅ `StatesMap`: estados solo responden a clic, no a teclado.
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
