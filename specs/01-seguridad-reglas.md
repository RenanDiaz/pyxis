# 01 — Reglas de seguridad Firestore y Storage

**Prioridad:** 🔴 Crítica · **Estado:** propuesto · **Implementar junto con:** [02](02-invitaciones-onboarding.md)

## Problema
Las reglas no hacen cumplir el modelo de roles que la app asume
(owner ve todo · supervisor su subequipo · agent lo suyo). Hoy:

| # | Hallazgo | Impacto |
|---|----------|---------|
| ✔ 1 | `firestore.rules` `members/{uid}`: `allow write` si `request.auth.uid == uid` | Cualquier usuario autenticado se crea un member con `role: "owner"` en **cualquier** workspace (el ID viaja en los links de invitación). Un agente se sube a owner o se cambia de subequipo. **Toma total del tenant.** |
| ✔ 2 | `invitations`: `allow update: if request.auth != null` | Cualquiera reescribe cualquier invitación (rol, email, expiración). |
| ✔ 3 | `states`: escribe `isWorkspaceOwner()` de *cualquier* workspace; crear workspace es libre | Cualquier usuario registrado cambia precios/fees globales que ven todos. |
| ✔ 4 | `calls`: `read, write` para cualquier miembro | Agente lee/edita llamadas de todo el workspace. |
| ✔ 5 | `clients` create/update no validan `request.resource` | Agente crea clientes a nombre de otro; supervisor/agente mueve un cliente a otro owner/subequipo. Supervisor con `subteam_id == null` ve todos los clientes sin subequipo. |
| ✔ 6 | `clients/{id}/documents`: read/create para cualquier miembro | Agente lista documentos (SSN, IDs) de clientes ajenos y obtiene su `download_url`. |
| ✔ 7 | `storage.rules`: `allow write` incluye delete; el `allow delete` solo-owner se suma con OR | Cualquier miembro borra/sobrescribe archivos de cualquier cliente. Sin límite de tamaño ni content-type. |
| 8 | `download_url` con token | Una vez emitida, salta las reglas para siempre (se puede reenviar). |
| 9 | `memberRole()`/`getMember()` hacen 3–4 `get()` por evaluación | Costo y riesgo de pegar el límite de lecturas en batches. |

## Objetivo
Que las reglas hagan cumplir exactamente el modelo de roles de `CLAUDE.md`,
de forma que un cliente malicioso (no la UI) no pueda escalar privilegios ni
leer datos fuera de su alcance.

## Alcance
`firestore.rules`, `storage.rules`, tests de reglas con emulador. Cambios
mínimos de código cliente que las reglas nuevas exijan (campos denormalizados,
IDs de invitación). El flujo de unirse se rediseña en 02.

**Fuera de alcance:** Cloud Functions (salvo que se decida en preguntas abiertas), App Check.

## Requisitos

### R1 — Members
- `create`: solo owner del workspace, **o** el propio usuario si en el mismo
  batch acepta una invitación válida (ver 02: `getAfter` de la invitación con
  `status == 'accepted'`, `accepted_by == request.auth.uid`, rol del member ==
  rol de la invitación, no expirada).
- `update`: solo owner. Nadie cambia su propio `role` ni `subteam_id`.
- `delete`: owner (no a sí mismo si es el único owner).

### R2 — Invitations
- Doc ID = token aleatorio (≥128 bits). `get` permitido a cualquier autenticado
  (tener el token = estar invitado); `list` solo owner.
- Denormalizar `workspace_name` en la invitación para que el invitado no
  necesite leer el workspace antes de ser miembro.
- `create/delete`: owner. `update`: owner, o el invitado solo para la transición
  `pending → accepted` con `accepted_by == uid` y email coincidente con
  `request.auth.token.email` (si la invitación tiene email).

### R3 — Users
- Lectura/escritura del propio doc, pero `workspace_id` solo puede pasar a `W` si
  `getAfter(members/W/uid)` existe, o a `null`.
- El owner de `W` puede poner `workspace_id: null` en el doc de un usuario cuyo
  `workspace_id == W` (necesario para quitar miembros, ver 06).

### R4 — Clients y Calls (mismas reglas)
- `read`: owner · supervisor si `resource.data.subteam_id == miSubteam` **y**
  `miSubteam != null` · agente si `owner_uid == uid`.
- `create`: agente solo con `owner_uid == uid` y `subteam_id == miSubteam`;
  supervisor con `subteam_id == miSubteam` y `owner_uid` miembro de ese
  subequipo; owner libre.
- `update`: mismas condiciones sobre `resource` **y** sobre `request.resource`
  (no puede sacar el doc de su alcance). Cambiar `owner_uid`/`subteam_id`
  (reasignar) solo owner o supervisor dentro de su subequipo.
- `delete`: owner, o dueño del registro.

### R5 — Documents (subcolección del cliente)
Heredan el acceso del cliente padre (`get(clients/{clientId})` y aplicar R4).
`delete`: owner o quien subió.

### R6 — States (global)
Ver pregunta abierta P1. Propuesta: escritura solo para admins globales
(custom claim `admin: true` o colección `admins/{uid}` no escribible desde cliente).

### R7 — Storage
- Separar `create`/`update`/`delete`; delete solo owner (o quien subió, vía metadata `uploaded_by`).
- Lectura de archivos de cliente con el mismo criterio de R4 (requiere el `get` del cliente).
- `request.resource.size < 20 MB` y content-type en lista blanca (pdf, jpg/png/webp, doc/docx, xls/xlsx).
- Branding: igual que hoy (owner escribe, miembros leen).

### R8 — Costo de reglas
Reducir `get()`: una sola lectura de `members/{uid}` por evaluación (helper que
devuelva el doc y se reutilice). Evaluar custom claims `{ wsId, role, subteamId }`
si P2 se resuelve a favor.

## Diseño
- Reescribir `firestore.rules` por bloques con helpers `me(ws)`, `isOwner(ws)`,
  `isSupervisorOf(ws, subteamId)`, `inScope(ws, data)`.
- Tests con `@firebase/rules-unit-testing` + emulador (`firebase emulators:exec`),
  en `tests/rules/`. Script `npm run test:rules`.
- Despliegue: primero reglas + código de 02 en el mismo release; verificar con
  usuarios de prueba de cada rol en un proyecto staging.

## Criterios de aceptación (tests de reglas)
- [ ] Usuario sin membresía NO puede crear `members/{suUid}` en un workspace ajeno.
- [ ] Agente NO puede actualizar su propio `role` ni `subteam_id`.
- [ ] Usuario cualquiera NO puede modificar una invitación ajena; el invitado sí puede aceptarla (pending→accepted) una sola vez.
- [ ] Owner de un workspace NO puede escribir `states` (salvo admin, según P1).
- [ ] Agente NO lee llamadas ni clientes de otro agente; supervisor NO lee fuera de su subequipo; supervisor sin subequipo no ve nada ajeno.
- [ ] Agente NO crea un cliente con `owner_uid` de otro ni cambia `owner_uid` de uno suyo.
- [ ] Agente NO lista ni lee `documents` de un cliente ajeno.
- [ ] Miembro no-owner NO borra archivos en Storage; subir >20 MB o tipo no permitido falla.
- [ ] Todos los flujos actuales de la UI siguen funcionando con cada rol (smoke test manual en staging).

## Preguntas abiertas
- **P1 — ¿Pyxis es multi-empresa?** Si cada empresa tiene su workspace, los
  precios de `states` no pueden ser globales editables por owners: o se mueven a
  `workspaces/{wId}/states` (cada empresa con sus precios) o se edita solo por
  admin global. Si es una sola empresa, basta con restringir a admin.
  *Recomendación:* precios por workspace con fallback al global; es lo que
  realmente varía entre empresas.
- **P2 — ¿Aceptamos Cloud Functions?** Simplifican invitaciones, custom claims y
  borrados en cascada (06), pero requieren plan Blaze.
- **P3 — URLs de descarga:** ¿basta con no persistir `download_url` y pedir
  `getBlob()`/URL efímera al abrir, o se acepta el riesgo actual?
