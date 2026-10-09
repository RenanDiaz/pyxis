# 06 — Administración del workspace

**Prioridad:** 🟠 Alta · **Estado:** implementado · **Depende de:** [01](01-seguridad-reglas.md)

## Problema
| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 1 | `removeMember` hace `batch.update(users/{otroUid})`; las reglas solo permiten escribir el propio perfil | **Quitar miembros nunca funciona** (falla todo el batch). |
| ✔ 2 | Transferir propiedad (`WorkspaceSettings.tsx`) solo cambia `workspace.owner_uid`; los permisos salen de `members/{uid}.role` | El nuevo owner sigue siendo agente y el anterior sigue siendo owner. Además no invalida caché. |
| ✔ 3 | `deleteWorkspace` borra solo el doc raíz | Subcolecciones (clients con SSN, calls, members) y archivos de Storage quedan huérfanos; `users.workspace_id` apunta a un workspace inexistente y el usuario queda en un workspace fantasma. La UI dice "borrará todos los datos": falso. |
| ✔ 4 | `deleteClient` no borra `calls`, `documents` ni archivos | Llamadas huérfanas en Agenda/notificaciones; datos personales que no se borran. |
| 5 | Al quitar un miembro, sus clientes/llamadas quedan con `owner_uid` huérfano | Nadie (salvo owner) los ve; no se ofrece reasignar. |
| 6 | `WorkspaceContext`: si `users.workspace_id` apunta a un workspace del que ya no es miembro, queda `wsCtx = null` sin error ni redirección | UI vacía sin explicación. |

## Implementación (2026-10-09)
Todo corre en el navegador, como el owner, en el orden que exigen las reglas.
Lógica en `src/lib/workspaceAdmin.ts`: recibe `Firestore`, así que se prueba
contra el emulador en `tests/emulator/workspace-admin.test.ts`.
- **Quitar miembro:**
  - `RemoveMemberDialog` muestra cuántos clientes y llamadas tiene el miembro y
    obliga a elegir a quién pasan. Por defecto, al owner.
  - `removeMemberWithReassign` reasigna clientes y llamadas en lotes de 400,
    con el `subteam_id` del destino. Después borra el member y deja
    `users.workspace_id = null` en el mismo batch.
  - Si el perfil del usuario no existe o apunta a otro lado, se borra solo el
    member. Al entrar, lo resuelve el caso de workspace inválido.
  - (El hallazgo 1 ya lo había resuelto el spec 01; faltaba la reasignación.)
- **Transferir propiedad:**
  - `transferOwnership` hace un solo batch con `owner_uid`, el nuevo con rol
    `owner` y el anterior con rol `supervisor` (**P1**).
  - Reglas:
    - El owner solo se baja de rol con `handsOverOwnership`, es decir, cuando el
      workspace queda con otro `owner_uid` y ese miembro queda como owner.
    - `owner_uid` solo cambia si el nuevo owner queda promovido en el mismo
      batch.
- **Borrar workspace (P2 → navegador):** `DeleteWorkspaceDialog` lista qué se
  borra, pide escribir ELIMINAR y muestra el progreso por etapa.
  - Orden de `deleteWorkspaceCascade`:
    1. Archivos y documentos de cada cliente, y después el cliente.
    2. Llamadas, metas, invitaciones y subequipos.
    3. El logo.
    4. Los demás miembros, desvinculando su perfil.
    5. El workspace.
    6. El member del owner y su perfil.
  - Es reintentable: si se corta, el botón pasa a "Reintentar" y continúa
    donde quedó.
  - Al terminar se vacía la caché y se va a `/onboarding`.
- **Borrar cliente (P3 → solo owner):**
  - Regla `clients.delete: isOwner`. El resto de los roles archiva, y el
    botón "Eliminar" solo lo ve el owner.
  - `deleteClientCascade` borra archivos, documentos, llamadas y el cliente.
    La confirmación dice cuántas llamadas y documentos se van.
- **Storage** se importa recién al borrar (`adminStorage.ts`), para no meterlo
  en el bundle de las pantallas (spec 10).
- **Workspace inválido:**
  - `WorkspaceContext` lee el member antes que el workspace.
  - Si el member no existe, limpia `users.workspace_id`, avisa "Ya no
    perteneces a ese workspace" y manda a onboarding.
  - El workspace solo se pide siendo miembro, así que no hay errores de permisos
    en bucle.
- Se borraron `removeMember`, `deleteWorkspace` y `deleteClient` de
  `firestore.ts`.

### Tests
- **Reglas:**
  - El traspaso en batch funciona.
  - El owner no se baja de rol sin entregar la propiedad.
  - `owner_uid` no cambia sin promover al nuevo owner.
  - El owner anterior no puede quedar como agente.
  - Un supervisor no puede transferir.
  - Agente y supervisor no borran clientes.
  - La reasignación con desvinculación funciona.
- **Emulador:** las 4 operaciones de punta a punta con las reglas reales.
  Incluye que borrar el workspace no deja ningún doc y desvincula a los 5
  miembros.

### Decisiones
- **P1:** el owner anterior queda como supervisor.
- **P2:** borrado desde el navegador. Con el volumen actual tarda segundos.
  Mover esto al Worker (spec 17) requeriría el cliente REST con service
  account de la spec 18; si algún día hace falta, se reutiliza esa pieza.
- **P3:** solo el owner borra; el resto archiva.
- **Llamadas al reasignar:** se reasignan **todas** las del miembro, también las
  completadas. Así el nuevo responsable ve el historial completo del cliente.

## Requisitos
1. **Quitar miembro:** diálogo que obliga a elegir a quién reasignar sus
   clientes y llamadas pendientes (o "dejar sin asignar" visible solo para el
   owner). Operación: reasignación en batches + borrar member + `users.workspace_id = null`
   (permitido por 01-R3). El usuario quitado, al entrar, va a `/onboarding`.
2. **Transferir propiedad:** un batch: `owner_uid = nuevo`, `members/nuevo.role = owner`,
   `members/anterior.role = supervisor` (ver P1). Usar mutación con invalidación.
3. **Eliminar workspace:** ver P2. Mínimo aceptable sin Functions: borrado
   cliente-side por páginas (clients + subcolección documents + archivos de
   Storage, calls, goals, invitations, subteams, members) con progreso, y
   `users.workspace_id = null` de cada miembro (requiere 01-R3). Texto de UI exacto sobre lo que se borra.
4. **Eliminar cliente:** borra sus calls, documents y archivos; confirmación
   que dice cuántas llamadas/documentos se borran. Ver P3 (archivar vs borrar).
5. **Workspace inválido:** si member no existe o workspace no existe ⇒ limpiar
   `users.workspace_id` y redirigir a `/onboarding` con mensaje "Ya no perteneces a ese workspace".

## Criterios de aceptación
- [x] Owner quita a un agente con 10 clientes ⇒ se reasignan al elegido; el agente entra a `/onboarding`.
- [x] Transferir propiedad ⇒ el nuevo owner ve `/workspace`; el anterior ya no.
- [x] Eliminar workspace ⇒ no queda ningún doc bajo `workspaces/{id}` ni archivos en Storage; los ex-miembros van a onboarding.
- [x] Eliminar cliente ⇒ sus llamadas no aparecen en Agenda ni notificaciones.

## Preguntas abiertas
- **P1:** ¿El owner anterior queda como supervisor, agente, o se elige?
- **P2:** ¿Cloud Function para borrado recursivo (recomendado: `firebase-tools` `recursiveDelete`), o borrado cliente-side? Un workspace grande puede tardar minutos desde el navegador.
- **P3:** ¿Borrar cliente debería ser solo "archivar" para agentes y borrado real solo owner? Hay implicaciones de retención de datos (SSN).
