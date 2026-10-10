# 22 — Cerrar la creación de workspaces

**Prioridad:** 🟠 Alta · **Estado:** propuesto · **Tamaño:** S · **Relacionado:** 18 (R0 cubre Stripe; este spec cierra la puerta de entrada)

## Problema
- **Cualquiera puede crear un workspace.** Basta una cuenta de Google:
  - El primer login crea `users/{uid}` y lleva a `/onboarding`.
  - Ahí, "Crear workspace" funciona para cualquier usuario autenticado, y quien lo crea queda como **owner**.
  - Las reglas lo permiten: `workspaces/{id}` → `allow create: if signedIn() && owner_uid == request.auth.uid`, y `members` acepta al fundador vía `foundsWorkspace`.
- **Consecuencias:**
  - Desconocidos usan Pyxis (y Firestore, con su cuota gratuita) sin que nadie lo sepa.
  - Con el spec 18, cada owner es un candidato a cuenta conectada bajo la plataforma de Stripe. R0 lo bloquea, pero el riesgo sigue apareciendo cada vez que alguien entra.
  - Si Pyxis se usa solo con clientes conocidos, la autoalta no aporta nada.
- **Email/password:** la app no tiene registro. Pero si en Firebase Auth está activo *"Enable create (sign-up)"*, se pueden crear cuentas llamando a la API con la API key pública. Esas cuentas también llegarían a `/onboarding`.

## Decisión
- **Solo un admin global crea workspaces**, con un script.
- Todos los demás entran **únicamente por invitación** al workspace que ya existe. El flujo de invitaciones no cambia.
- **Sin UI de admin en v1:** hay pocos workspaces. El script deja la decisión en quien tiene la service account, igual que `set-admin.ts`.

## Requisitos

### R1 — Script `scripts/create-workspace.ts`
```
npx tsx scripts/create-workspace.ts --name "Avanza Hispano" --owner owner@empresa.com
npx tsx scripts/create-workspace.ts --list
```
1. **El owner tiene que haber iniciado sesión al menos una vez** en `mipyxis.com`, para que exista en Firebase Auth y en `users/{uid}`.
   - Si no, el script falla con: "Pídele a <email> que inicie sesión una vez en https://mipyxis.com y vuelve a correr el script."
2. **Si el owner ya pertenece a un workspace** (`users/{uid}.workspace_id != null`), el script falla sin tocar nada. Cada usuario pertenece a un solo workspace.
3. **En un batch:**
   - Crea `workspaces/{id}` con `{ name, owner_uid, created_at }`.
   - Crea `workspaces/{id}/members/{uid}` con `role: 'owner'`, `subteam_id: null`, `display_name` y `email`.
   - Actualiza `users/{uid}.workspace_id`.
   - Es el mismo esquema que hoy escribe `createWorkspace` (`src/lib/firestore.ts`).
4. **`--list`:** imprime todos los workspaces con su ID, nombre, email del owner, número de miembros y fecha de creación. Sirve para detectar los creados por desconocidos antes de este cambio.
5. **`--dry-run`:** muestra lo que haría sin escribir.

### R2 — Reglas
1. **`workspaces/{id}` → `allow create: if false`.** El script usa el Admin SDK, que ignora las reglas.
2. **Se elimina `foundsWorkspace`** de la regla de `members`. Solo queda `joinsViaInvitation`.
3. **No cambia nada más:** lectura, update y delete del workspace, invitaciones y `users/{uid}` quedan como están.

### R3 — Onboarding sin "Crear workspace"
1. **Se quita la tarjeta "Crear workspace"** de `src/pages/Onboarding.tsx`, y `createWorkspace` sale de `src/lib/firestore.ts` si nada más lo usa.
2. **La pantalla queda con:**
   - **Título:** "Tu cuenta aún no pertenece a ningún equipo".
   - **Texto:** "Pide al dueño de tu equipo que te invite a **{email}**. Cuando recibas el enlace de invitación, ábrelo en este navegador." Se muestra el email con el que inició sesión, porque la invitación tiene que coincidir.
   - **Para empresas nuevas:** "¿Tu empresa aún no usa Pyxis? Escríbenos a soporte@mipyxis.com".
   - **Botón "Cerrar sesión"**, para entrar con otra cuenta si se equivocó de email.
3. **Se quita también la tarjeta "Unirse con invitación"**, porque hoy no funciona: el input y el botón están deshabilitados. El enlace `/join?token=…` sigue siendo la única vía.

### R4 — Firebase Auth (manual, consola)
- [ ] **Authentication → Settings → User actions:** desactivar **"Enable create (sign-up)"**.
  - Las cuentas de email/password solo se crean desde la consola.
  - Google no se ve afectado, porque crea el usuario al primer login.
  - *Verificar antes:* que ningún agente actual entre con email/password creado por su cuenta. Si alguno lo hace, ya tiene su usuario y sigue funcionando.
- [ ] Dejar **"Enable delete"** desactivado si lo está.

### R5 — Limpieza de lo existente (manual, una vez)
- [ ] Correr `create-workspace.ts --list` y revisar cada workspace con el dueño del producto.
- [ ] Los de desconocidos se borran a mano desde la consola de Firestore: el workspace, sus subcolecciones y el `workspace_id` de sus usuarios.
  - Un script de borrado queda fuera de alcance: es destructivo y se hace una sola vez.

## Fuera de alcance
- **UI de administración de workspaces:** se considera si los workspaces pasan de una decena.
- **Lista blanca de dominios de email o restricción de login con Google:** con R2 y R3, entrar sin invitación no da acceso a nada.
- **Borrado automático de usuarios sin workspace.**

## Diseño
| Archivo | Cambio |
|---|---|
| `scripts/create-workspace.ts` | Nuevo (R1). Patrón de `set-admin.ts` / `audit-members.ts`. |
| `firestore.rules` | R2. |
| `tests/rules/firestore.test.ts` | El test que funda `workspaces/nuevo` con su member owner pasa a `assertFails`. Agregar: crear un workspace sin member, siendo owner de otro, o siendo admin global, también falla desde el cliente. |
| `src/pages/Onboarding.tsx` | R3. |
| `src/lib/firestore.ts` | Quitar `createWorkspace` si queda sin uso. |
| `CLAUDE.md` | Sección "Onboarding": los workspaces los crea un admin con el script, y el resto entra por invitación. |
| `README.md` | Cómo dar de alta una empresa nueva. |

## Criterios de aceptación
- [ ] Un usuario nuevo con Google ve la pantalla de R3, sin forma de crear un workspace.
- [ ] Crear `workspaces/x` + `members/{uid}` desde el cliente falla, también para un admin global (test de reglas).
- [ ] La invitación sigue funcionando: un invitado que abre `/join?token=…` queda como miembro con el rol de la invitación (los tests existentes siguen en verde).
- [ ] `create-workspace.ts --owner <email>`:
  - Con un usuario que nunca inició sesión → falla con el mensaje de R1.1.
  - Con uno que ya tiene workspace → falla sin escribir.
  - Con uno válido → al recargar, el owner entra directo a su workspace con rol owner.
- [ ] `--list` muestra todos los workspaces con el email del owner.
- [ ] `npm run lint`, `npm run build`, `npm test` y `npm run test:emulator` pasan.

## Preguntas abiertas
Ninguna que bloquee. *Supuesto:* todas las empresas que usen Pyxis se dan de alta hablando con el dueño del producto. Si se quisiera autoalta con pago (SaaS abierto), este spec se revierte con otro diseño: autoalta + verificación + plan.
