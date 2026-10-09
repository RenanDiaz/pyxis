# 02 — Invitaciones y onboarding

**Prioridad:** 🔴 Crítica · **Estado:** parcial (con el hotfix de 01) · **Depende de:** [01](01-seguridad-reglas.md) (se despliegan juntos)

## Problema
Sumar agentes es el flujo principal de crecimiento y hoy está roto o depende de un hueco de seguridad.

- ✔ El invitado aún no es miembro, así que las reglas no le dejan leer la
  invitación ni el workspace (`getInvitationByToken`, `getWorkspace` en
  `JoinWorkspace.tsx`). Solo funciona por el hueco de members de 01.
- `acceptInvitation` (`src/lib/firestore.ts`) no verifica que el email coincida y
  no es transaccional: dos aceptaciones simultáneas del mismo token pasan.
- ✔ `PrivateRoute` redirige a `/login` sin guardar la ruta de origen; tras el
  login el usuario va a `/` → `/onboarding` y **pierde el link de invitación**.
- ✔ `Onboarding.tsx`: "Unirse al workspace" está siempre `disabled`; el input de código no hace nada.
- `/onboarding` y `/join` no se bloquean si el usuario ya tiene workspace: puede
  crear un segundo o aceptar otra invitación y dejar huérfano su member anterior.
- `JoinWorkspace` muestra el rol crudo en inglés (`agent`).
- `WorkspaceMembers`: invitaciones pendientes sin fecha de expiración visible ni opción de copiar el link otra vez; email sin validar.

## Implementado con el hotfix de 01
- Requisitos 1 (link por token = doc ID, se mantiene `&workspace=`), 2 (volver al link después del login), 4 y 5 (aceptación en batch validada por reglas, email obligatorio).
- Pantalla de unirse: nombre del workspace denormalizado, rol en español,
  estados de expirada/usada, y email que no coincide con botón "Cerrar sesión y cambiar de cuenta".
- La aceptación concurrente quedó cubierta: las reglas exigen `pending → accepted`,
  así que la segunda aceptación del mismo token falla.

**Pendiente:** 3 (quién invitó), 6 (bloquear `/onboarding` y `/join` con workspace),
7 (unirse pegando el link en Onboarding), 8 (gestión de invitaciones pendientes) y P2.
P1 se resolvió por defecto como nominal; confirmar con negocio.

## Objetivo
Un agente invitado abre el link, inicia sesión (o se registra) y queda dentro
del workspace correcto con el rol correcto, sin pasos manuales y sin depender
de reglas permisivas.

## Requisitos
1. **Link:** `/join?token={token}` (el token es el doc ID, ver 01-R2). Se
   mantiene compatibilidad de lectura con `&workspace=` durante una versión.
2. **Login con retorno:** `PrivateRoute` pasa `state.from` (path + query) a
   `/login`; tras autenticarse se navega a `from`. Aplica a cualquier ruta.
3. **Pantalla de invitación:** muestra nombre del workspace (denormalizado),
   rol en español (Owner/Supervisor/Agente) y quién invitó. Estados: válida,
   expirada, ya usada, email no coincide, inexistente — cada uno con mensaje claro.
4. **Aceptar** = un solo batch/transacción: invitación `pending→accepted`
   (`accepted_by`, `accepted_at`), crear `members/{uid}` con rol y subequipo de
   la invitación, `users/{uid}.workspace_id = W`. Las reglas de 01 validan el conjunto.
5. **Email:** si la invitación tiene email, debe coincidir con el del usuario
   (case-insensitive). Ver P1.
6. **Usuario con workspace:** `/onboarding` redirige a `/`. En `/join` se
   muestra "Ya perteneces a {ws}. Para unirte a otro, primero sal del actual" (ver P2).
7. **Onboarding:** "Unirse" acepta pegar el link completo o el token; navega a `/join?token=…`.
8. **Gestión (owner):** lista de pendientes con fecha de expiración, botón
   "Copiar link", "Revocar"; validación de email al crear.

## Criterios de aceptación
- [ ] Usuario sin sesión abre `/join?token=X` → login → vuelve a `/join?token=X` → acepta → entra a `/` con el rol de la invitación.
- [ ] Invitación expirada / usada / revocada muestra el mensaje correspondiente y no crea member.
- [ ] Con email distinto al invitado: no se puede aceptar (según P1).
- [ ] Dos aceptaciones simultáneas del mismo token: solo una crea member.
- [ ] Usuario con workspace no puede crear otro desde `/onboarding`.
- [ ] Pegar el link en Onboarding lleva a la pantalla de invitación.
- [ ] Todo funciona con las reglas de 01 (sin permisos amplios).

## Preguntas abiertas
- **P1:** ¿Las invitaciones son siempre nominales (por email) o también hay links
  abiertos "cualquiera con el link"? *Recomendación:* nominales por defecto.
- **P2:** ¿Se permite cambiar de workspace? Si sí, hay que definir qué pasa con
  sus clientes en el workspace viejo (ver 06, reasignación).
