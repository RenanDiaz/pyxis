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

### Colecciones
- **`states`** — 50 docs (doc ID = abbreviation). Precio, fees, días de proceso, annual report, disolución, amendments, business purpose, link de name check.
- **`trades`** — 25 docs (oficios). Categoría, nombre EN/ES, descripción.
- **`glossary`** — Términos de negocio/legales/fiscales. Término, nombre completo, traducción, definición, categoría.
- **`users/{uid}/clients`** — Prospectos/clientes con datos de LLC, contacto, status y notas. Aislados por usuario.
- **`users/{uid}/calls`** — Historial y agenda de llamadas vinculadas a clientes. Aislados por usuario.
- **`config/clientForm`** — Configuración del formulario de clientes.

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

# Feature completado — Roles, equipos y colecciones raíz
Clientes y llamadas ahora usan colecciones raíz (`/clients`, `/calls`)
con campos `owner_uid` y `team_id` para ownership.

### Colecciones
- **`users/{uid}`** — Perfil de usuario con `role` (`agent` | `supervisor` | `admin`) y `team_id`.
- **`teams/{teamId}`** — Equipos con `supervisor_uid`.
- **`clients/{clientId}`** — Clientes con `owner_uid` y `team_id`.
- **`calls/{callId}`** — Llamadas con `owner_uid` y `team_id`.

### Queries por rol
- `agent`: solo ve sus propios documentos (`owner_uid == uid`)
- `supervisor`: ve documentos de su equipo (`team_id == team_id`)
- `admin`: ve todos los documentos

### Hooks clave
- `useUserProfile()` — lee `users/{uid}` y expone `{ role, team_id, roleCtx }`.
- `useClients()` / `useCalls()` — usan `roleCtx` para queries filtradas por rol.

### Inicialización de perfil
Al hacer login por primera vez, se crea automáticamente el documento
`users/{uid}` con `role: "agent"` y `team_id: null`.

### Migración
El script `scripts/migrate.ts` copia datos de las antiguas subcolecciones
(`/users/{uid}/clients`, `/users/{uid}/calls`) a las colecciones raíz,
agregando `owner_uid` y `team_id: null`. No elimina los originales.

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
`process` se guarda como string en `users/{uid}/clients/{clientId}`.