# 06 — Administración del workspace

**Prioridad:** 🟠 Alta · **Estado:** propuesto · **Depende de:** [01](01-seguridad-reglas.md)

## Problema
| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 1 | `removeMember` hace `batch.update(users/{otroUid})`; las reglas solo permiten escribir el propio perfil | **Quitar miembros nunca funciona** (falla todo el batch). |
| ✔ 2 | Transferir propiedad (`WorkspaceSettings.tsx`) solo cambia `workspace.owner_uid`; los permisos salen de `members/{uid}.role` | El nuevo owner sigue siendo agente y el anterior sigue siendo owner. Además no invalida caché. |
| ✔ 3 | `deleteWorkspace` borra solo el doc raíz | Subcolecciones (clients con SSN, calls, members) y archivos de Storage quedan huérfanos; `users.workspace_id` apunta a un workspace inexistente y el usuario queda en un workspace fantasma. La UI dice "borrará todos los datos": falso. |
| ✔ 4 | `deleteClient` no borra `calls`, `documents` ni archivos | Llamadas huérfanas en Agenda/notificaciones; datos personales que no se borran. |
| 5 | Al quitar un miembro, sus clientes/llamadas quedan con `owner_uid` huérfano | Nadie (salvo owner) los ve; no se ofrece reasignar. |
| 6 | `WorkspaceContext`: si `users.workspace_id` apunta a un workspace del que ya no es miembro, queda `wsCtx = null` sin error ni redirección | UI vacía sin explicación. |

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
- [ ] Owner quita a un agente con 10 clientes ⇒ se reasignan al elegido; el agente entra a `/onboarding`.
- [ ] Transferir propiedad ⇒ el nuevo owner ve `/workspace`; el anterior ya no.
- [ ] Eliminar workspace ⇒ no queda ningún doc bajo `workspaces/{id}` ni archivos en Storage; los ex-miembros van a onboarding.
- [ ] Eliminar cliente ⇒ sus llamadas no aparecen en Agenda ni notificaciones.

## Preguntas abiertas
- **P1:** ¿El owner anterior queda como supervisor, agente, o se elige?
- **P2:** ¿Cloud Function para borrado recursivo (recomendado: `firebase-tools` `recursiveDelete`), o borrado cliente-side? Un workspace grande puede tardar minutos desde el navegador.
- **P3:** ¿Borrar cliente debería ser solo "archivar" para agentes y borrado real solo owner? Hay implicaciones de retención de datos (SSN).
