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

# Nuevo feature - Procesos a contratar
Agrega el concepto de "proceso" a los clientes. Un proceso representa
el servicio que el cliente quiere contratar.

## 1. Modelo de datos

Agregar el campo `process` al tipo `Client`:

process: "registration" | "annual_report" | "dissolution" | "amendment" | null

Actualizar `client_form.json` agregando el campo:
{
  "id": "process",
  "label": "Proceso",
  "type": "select",
  "required": false
}

## 2. Definición de procesos
Crear el archivo `src/data/processes.ts`:

export const PROCESSES = [
  {
    id: "registration",
    label: "Registro de LLC",
    fields: [
      { key: "sale_price",        label: "Precio de venta" },
      { key: "state_fee",         label: "Fee del estado" },
      { key: "processing_days",   label: "Días de proceso" }
    ]
  },
  {
    id: "annual_report",
    label: "Annual Report",
    fields: [
      { key: "annual_report.fee",      label: "Fee" },
      { key: "annual_report.due_date", label: "Fecha de vencimiento" }
    ]
  },
  {
    id: "dissolution",
    label: "Dissolution",
    fields: [
      { key: "dissolution.fee",             label: "Fee" },
      { key: "dissolution.processing_days", label: "Días de proceso" }
    ]
  },
  {
    id: "amendment",
    label: "Amendment",
    fields: [
      { key: "amendments.fee",       label: "Fee" },
      { key: "amendments.available", label: "Disponible" }
    ]
  }
]

Los `fields` definen qué datos del estado se muestran para cada proceso,
mapeando directamente a las keys del objeto de estado en Firestore.
Los fields con notación de punto (ej. `annual_report.fee`) acceden a
campos anidados. Crear un helper `getFieldValue(state, key)` en
`src/lib/processUtils.ts` que resuelva tanto keys simples como anidadas
con dot notation.

## 3. Formulario de cliente (nuevo y editar)

Agregar un dropdown "Proceso" después del campo "Estado" con estas
opciones en orden:
- (vacío) Sin proceso asignado
- Registro de LLC
- Annual Report
- Dissolution
- Amendment

### Panel informativo flotante
Cuando el usuario tenga seleccionado tanto un Estado como un Proceso,
mostrar un card a la derecha del formulario (o debajo en mobile) con
la información relevante del proceso para ese estado.

Comportamiento:
- Si no hay estado o proceso seleccionado: no mostrar el card
- Si hay ambos: mostrar el card con los fields definidos en PROCESSES
- El card se actualiza en tiempo real al cambiar estado o proceso
- Los datos se leen desde Firestore (colección `states`) usando el
  estado seleccionado

Diseño del card:
- Título: nombre del proceso + nombre del estado
- Cada field en una fila: label a la izquierda, valor destacado a la derecha
- Borde o acento visual que lo diferencie del formulario
- En desktop: posicionado a la derecha del formulario (layout de 2 columnas)
- En mobile: debajo del formulario

## 4. Vista de detalle del cliente

Agregar una sección "Proceso contratado" visible solo si el cliente
tiene `process` y `state` asignados. Debe mostrar:
- Nombre del proceso y nombre del estado
- Los fields del proceso con el mismo diseño que el card del formulario

Ubicación: después de la información principal del cliente, antes
del historial de llamadas.

## 5. Firestore
No se requieren cambios en la estructura de Firestore. El campo
`process` se guarda como string en el documento del cliente.