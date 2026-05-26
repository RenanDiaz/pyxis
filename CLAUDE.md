# Pyxis — Web App para Agente de Ventas

## Descripción
Pyxis es una web app en español para agentes de ventas telefónicas de empresas
que ayudan a migrantes en EE.UU. a registrar su propia LLC. La app centraliza
la información de referencia necesaria durante cada llamada y sirve como CRM liviano
para gestionar prospectos.

---

## Stack
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Firebase (Auth, Firestore, Storage)
- React Router v6
- React Query (TanStack Query) para data fetching
- date-fns para manejo de fechas y zonas horarias
- Deploy: Vercel

---

## Configuración Firebase
Requiere archivo `.env.local` con las variables `VITE_FIREBASE_*`.
Ver las instrucciones completas en el README o en el historial de commits iniciales.

### Seed de datos
El script `scripts/seed.ts` lee los archivos JSON de `src/data/` y los sube a Firestore.
Los JSON también sirven como fallback local si Firestore no responde.

---

## Arquitectura de Firestore

### Colecciones estáticas (globales)
- **`states`** — 50 docs (doc ID = abbreviation). Precio, fees, días de proceso, annual report, disolución, amendments, business purpose, link de name check.
- **`trades`** — 25 docs (oficios). Categoría, nombre EN/ES, descripción.
- **`glossary`** — Términos de negocio/legales/fiscales. Término, nombre completo, traducción, definición, categoría.

### Colecciones de negocio (bajo workspace)
- **`workspaces/{wId}/clients`** — Prospectos/clientes con datos de LLC, contacto, status y notas.
- **`workspaces/{wId}/calls`** — Historial y agenda de llamadas vinculadas a clientes.
- **`workspaces/{wId}/goals`** — Metas de ventas diarias/mensuales.
- **`workspaces/{wId}/members`** — Miembros del workspace con rol y subequipo.
- **`workspaces/{wId}/subteams`** — Subequipos del workspace.
- **`workspaces/{wId}/invitations`** — Invitaciones por token.

Ver los esquemas completos en los archivos `src/data/*.json` y los types en el código.

---

## Módulos

| Ruta | Módulo | Descripción |
|------|--------|-------------|
| `/` | Inicio | Dashboard con totales, próximas llamadas y últimos clientes |
| `/estados` | Estados | Referencia rápida por estado (la más importante). Lista + detalle con precios, fees, timezone en tiempo real |
| `/oficios` | Oficios | Glosario de oficios con traducción EN/ES, filtro por categoría, diseño flashcard |
| `/glosario` | Glosario | Términos de negocio, legales y fiscales con traducción y definición. Filtro por categoría, diseño flashcard |
| `/clientes` | Clientes | CRM liviano: lista, detalle, formulario nuevo/editar, historial de llamadas, exportar registro como .docx |
| `/agenda` | Agenda | Gestión de llamadas programadas con filtros y modal de creación |
| `/workspace` | Workspace | Configuración del workspace (owner only) |
| `/workspace/miembros` | Miembros | Gestión de miembros e invitaciones (owner only) |
| `/workspace/subteams` | Subequipos | Gestión de subequipos (owner only) |
| `/onboarding` | Onboarding | Crear workspace o unirse con invitación |
| `/join` | Unirse | Acepta invitación por token desde URL |

### Autenticación
- Login con Google OAuth y email/password
- Todas las rutas protegidas con PrivateRoute

### Layout
- Sidebar fijo con navegación: Inicio, Estados, Oficios, Glosario, Clientes, Agenda
- Header con nombre del usuario y logout

---

## Notas de diseño
- Interfaz 100% en español
- Tipografía limpia, espaciado generoso — la UX debe ser obvia para usuarios no técnicos
- Colores semafóricos para status de clientes: nuevo (azul), contactado (amarillo), en_proceso (naranja), cerrado (verde), perdido (rojo/gris)
- La info de estados debe ser fácil de escanear durante una llamada
- Mobile-friendly
- Layout y scroll: usar scroll nativo del documento. No aplicar overflow: hidden/auto ni height: 100% en html/body/#root. Sidebar fixed, header sticky, contenido en flujo normal. Usar unidades dvh en vez de vh para compatibilidad con iOS Safari.

# Feature completado — Workspaces
Toda la data de negocio vive bajo `/workspaces/{workspaceId}/`.
Cada usuario pertenece a un solo workspace (`users/{uid}.workspace_id`).

### Colecciones
- **`users/{uid}`** — Perfil global: `display_name`, `email`, `workspace_id`, `created_at`.
- **`workspaces/{workspaceId}`** — Workspace: `name`, `owner_uid`, `created_at`.
- **`workspaces/{wId}/members/{uid}`** — Miembros: `role` (`owner` | `supervisor` | `agent`), `subteam_id`.
- **`workspaces/{wId}/subteams/{id}`** — Subequipos.
- **`workspaces/{wId}/clients/{id}`** — Clientes con `owner_uid` y `subteam_id`.
- **`workspaces/{wId}/calls/{id}`** — Llamadas con `owner_uid` y `subteam_id`.
- **`workspaces/{wId}/goals/{id}`** — Metas de ventas.
- **`workspaces/{wId}/invitations/{id}`** — Invitaciones por token con expiración de 7 días.

### Queries por rol
- `owner`: ve todos los datos del workspace
- `supervisor`: ve datos de su subequipo (`subteam_id == member.subteam_id`)
- `agent`: solo ve sus propios datos (`owner_uid == uid`)

### Contexto global
- `WorkspaceContext` lee `users/{uid}.workspace_id` y carga workspace + member.
- `useUserProfile()` expone `{ role, workspaceId, wsCtx }`.
- `useClients()` / `useCalls()` usan `wsCtx` para queries filtradas por rol.

### Onboarding
Al hacer login por primera vez se crea `users/{uid}` con `workspace_id: null`.
Si no tiene workspace, se redirige a `/onboarding` donde puede crear uno o
unirse via link de invitación (`/join?token=...&workspace=...`).

### Rutas de workspace (owner only)
- `/workspace` — Configuración general
- `/workspace/miembros` — Gestión de miembros e invitaciones
- `/workspace/subteams` — Gestión de subequipos

# Feature - Procesos a contratar (múltiples por cliente)
Un cliente puede tener **varios procesos** contratados. Cada proceso es un
servicio con su propio precio, sus propios pagos y recibos, y su propia etapa
de seguimiento, independiente del resto.

## 1. Modelo de datos (`src/types/index.ts`)
```ts
type ProcessType =
  | 'registration' | 'annual_report' | 'dissolution' | 'amendment'
  | 'newspaper_research' | 'newspaper_publication'

type ProcessStage = 'pendiente' | 'en_proceso' | 'completado' | 'cancelado'

interface ClientProcess {
  id: string                 // uuid local
  type: ProcessType
  state?: string             // estado asociado (para info/precio derivado)
  total?: number             // precio acordado de ESTE proceso
  payments: Payment[]        // pagos de ESTE proceso → sus recibos
  stage: ProcessStage        // seguimiento independiente del status del cliente
  notes?: string
  created_at: Timestamp
}
```
`Client` tiene `processes?: ClientProcess[]`. Los campos `process`,
`payment_total` y `payments` quedan como **legacy** (`@deprecated`): solo los
lee el script de migración, ya no se escriben.

## 2. Definición de procesos (`src/data/processes.ts`)
Cada `ProcessDef` tiene un **modelo de precio** (`pricing`):
- `{ mode: 'state', key }` → precio derivado del documento del estado
  (registration, annual_report, dissolution, amendment).
- `{ mode: 'fixed', amount }` → precio fijo. **Investigación de periódicos** ($50,
  requisito de publicación de LLC en NY: ubicar el diario y el semanal).
- `{ mode: 'manual' }` → precio variable que captura el agente.
  **Publicaciones en periódicos** (depende de lo que cobren los periódicos).

Los `fields` (solo para procesos `state`) definen qué datos del estado se
muestran en el card informativo. Helpers en `src/lib/processUtils.ts`:
`getFieldValue` (dot notation), `getSuggestedPrice`, `getProcessLabel`,
`getProcessPaid`, `getClientPayments`, `getClientPaymentSummary` (agregados con
fallback a legacy).

## 3. Formulario de cliente (`ClientForm.tsx`)
Sección "Procesos contratados" donde se agregan/quitan procesos
(`AddProcessDialog`: tipo + estado). Por cada proceso con estado y fields
derivados se muestra un card informativo flotante (derecha en desktop, abajo en
mobile). Los pagos NO se gestionan en el formulario, sino en el detalle.

## 4. Detalle del cliente (`ClientDetail.tsx`)
Lista de `ProcessCard`, uno por proceso, cada uno con: etiqueta + estado,
selector de etapa, info derivada del estado, y su propio bloque de pagos
(`PaymentSection`, ahora por proceso) con generación de recibo por pago. Botón
"Agregar proceso" y quitar proceso. El status del cliente se mantiene como antes:
un pago dispara `partial_payment`/`full_payment` (este último solo cuando el
saldo agregado de todos los procesos llega a 0).

## 5. Recibos (`receiptUtils.ts`)
`generatePaymentReceipt` recibe el `ClientProcess`: el servicio, total y saldo
del recibo salen del proceso, no del cliente.

## 6. Firestore y migración
`processes` se guarda como array dentro del documento del cliente (sin cambios
de estructura de colecciones). Migrar datos legacy con:
`npx tsx scripts/migrate-to-multi-process.ts [--dry-run]` — crea un proceso a
partir de `process`+`payment_total`+`payments`, sin borrar los campos viejos.