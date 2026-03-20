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

## Configuración inicial requerida

### 1. Crear proyecto Firebase
Instrucciones para el desarrollador antes de correr la app:
1. Ir a https://console.firebase.google.com
2. Crear nuevo proyecto llamado "pyxis-app"
3. Activar Authentication → habilitar Google provider y Email/Password
4. Crear Firestore Database en modo producción
5. Crear archivo `.env.local` en la raíz con las variables:

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

### 2. Poblar datos estáticos
Al inicializar la app por primera vez, correr el script `scripts/seed.ts` que debe
leer los archivos `src/data/states.json`, `src/data/trades.json` y
`src/data/client_form.json` y subirlos a Firestore en las colecciones
`states`, `trades` y `config/clientForm` respectivamente.

---

## Arquitectura de Firestore

### Colecciones

**`states`** — 50 documentos, uno por estado (usar abbreviation como doc ID)
Cada documento:
{
  abbreviation: string         // "FL"
  name: string                 // "Florida"
  sale_price: string           // "$579"
  state_fee: string            // "$125"
  processing_days: string      // "7"
  annual_report: {
    fee: string
    due_date: string
  }
  dissolution: {
    fee: string
    processing_days: string
  }
  amendments: {
    available: string          // "YES" | "NO"
    fee: string
  }
  business_purpose: {
    specific: string           // "SI" | "NO"
    general: string            // "SI" | "NO"
  }
  name_check_link: string
}

**`trades`** — 25 documentos (oficios)
{
  id: number
  category: string             // "construction" | "home_services" | "exterior" | "technical"
  category_es: string
  en: string                   // nombre en inglés
  es: string                   // traducción al español
  description_es: string
}

**`clients`** — prospectos/clientes
{
  id: string (auto)
  llc_name: string
  state: string                // abbreviation
  first_name: string
  middle_name?: string
  last_name: string
  ssn_itin: string
  phone: string
  email: string
  business_address: string
  business_purpose: string
  status: "nuevo" | "contactado" | "en_proceso" | "cerrado" | "perdido"
  notes: string
  created_at: Timestamp
  updated_at: Timestamp
}

**`calls`** — historial y agenda de llamadas
{
  id: string (auto)
  client_id: string
  scheduled_at: Timestamp
  duration_minutes?: number
  notes: string
  outcome: "pendiente" | "completada" | "no_contesto" | "reagendada"
  created_at: Timestamp
}

---

## Módulos y páginas

### Autenticación
- Pantalla de login con opción Google OAuth y email/password
- Proteger todas las rutas con PrivateRoute
- Solo usuarios autenticados pueden acceder

### Layout general
- Sidebar fijo a la izquierda con navegación
- Logo "Pyxis" en la parte superior del sidebar
- Navegación: Inicio, Estados, Oficios, Clientes, Agenda
- Header con nombre del usuario y botón de logout

---

### 1. Página de Inicio (`/`)
Dashboard con:
- Tarjeta: total de clientes
- Tarjeta: llamadas de hoy
- Tarjeta: prospectos en proceso
- Lista de las próximas 5 llamadas agendadas
- Lista de los últimos 5 clientes agregados

---

### 2. Módulo de Estados (`/estados`)
Página de referencia rápida por estado. Es la más importante de la app.

**Vista de lista:**
- Buscador por nombre o abreviatura del estado
- Tabla o lista de cards con: nombre del estado, precio de venta, fee, días de proceso
- Click en un estado abre el detalle

**Vista de detalle (`/estados/:abbreviation`):**
Panel completo con toda la información del estado:
- Nombre y abreviatura
- Precio de venta (destacado visualmente)
- Fee del estado
- Días de procesamiento
- Huso horario actual del estado con la hora en tiempo real
  (usar date-fns-tz, mapear cada estado a su timezone)
- Annual Report: fee y fecha de vencimiento
- Disolución: fee y días
- Amendments: disponibilidad y fee
- Business Purpose: si acepta específico o general
- Botón "Verificar disponibilidad de nombre" que abre el name_check_link en nueva pestaña

Zonas horarias por estado (mapeo completo de los 50 estados):
America/New_York: CT, DE, DC, FL, GA, IN, KY, ME, MD, MA, MI, NH, NJ, NY, NC, OH, PA, RI, SC, TN, VT, VA, WV
America/Chicago: AL, AR, IL, IA, KS, LA, MN, MS, MO, NE, ND, OK, SD, TX, WI
America/Denver: CO, ID, MT, NM, UT, WY
America/Phoenix: AZ (sin DST)
America/Los_Angeles: CA, NV, OR, WA
America/Anchorage: AK
Pacific/Honolulu: HI

---

### 3. Módulo de Oficios (`/oficios`)
Glosario de oficios con traducción.

- Tabs o filtro por categoría: Construcción, Servicios para Casas, Exterior, Técnicos
- Buscador por nombre en inglés o español
- Cards con: nombre EN (grande), traducción ES, descripción
- Diseño limpio tipo flashcard, fácil de consultar durante una llamada

---

### 4. Módulo de Clientes (`/clientes`)
CRM liviano.

**Lista de clientes (`/clientes`):**
- Buscador por nombre, LLC o estado
- Filtro por status
- Tabla con: nombre completo, LLC, estado, status, última actualización
- Botón "Nuevo cliente"
- Click en fila abre el detalle

**Detalle de cliente (`/clientes/:id`):**
- Toda la información del cliente
- Botón editar
- Selector de status con colores por estado
- Sección de notas (textarea editable y guardable)
- Historial de llamadas del cliente
- Botón "Agendar llamada"

**Formulario nuevo/editar cliente (`/clientes/nuevo`, `/clientes/:id/editar`):**
Campos basados en client_form.json:
- Nombre de la LLC
- Estado (select con los 50 estados)
- Primer nombre, Segundo nombre, Apellidos
- SSN o ITIN
- Teléfono, Email
- Dirección comercial
- Propósito de la empresa (textarea)
- Status inicial

---

### 5. Módulo de Agenda (`/agenda`)
Gestión de llamadas programadas.

- Vista de lista de llamadas ordenadas por fecha
- Filtro: todas, pendientes, hoy, esta semana
- Cada llamada muestra: nombre del cliente, fecha/hora, estado del cliente, outcome
- Botón "Nueva llamada"
- Modal para crear/editar llamada:
  - Seleccionar cliente (buscador)
  - Fecha y hora
  - Notas
  - Outcome (pendiente por defecto)
- Al marcar una llamada como completada, pedir notas del resultado

---

## Notas de diseño
- Interfaz 100% en español
- Tipografía limpia, espaciado generoso — tu esposa no es técnica, la UX debe ser obvia
- Usar colores semafóricos para los status de clientes:
  - nuevo: azul
  - contactado: amarillo
  - en_proceso: naranja
  - cerrado: verde
  - perdido: rojo/gris
- La información de los estados debe ser fácil de escanear visualmente durante una llamada
- Mobile-friendly (puede necesitarla desde el celular)

---

## Archivos de datos estáticos
Incluir en `src/data/`:
- `states.json` — adjunto
- `trades.json` — adjunto
- `client_form.json` — adjunto

Estos archivos deben usarse para el seed inicial de Firestore y también como
fallback local si Firestore no responde.

---

## Estructura de carpetas sugerida
src/
  components/
    ui/           ← shadcn components
    layout/       ← Sidebar, Header, PrivateRoute
    states/       ← componentes del módulo estados
    trades/       ← componentes del módulo oficios
    clients/      ← componentes del módulo clientes
    calls/        ← componentes del módulo agenda
  pages/
    Login.tsx
    Home.tsx
    States.tsx, StateDetail.tsx
    Trades.tsx
    Clients.tsx, ClientDetail.tsx, ClientForm.tsx
    Schedule.tsx
  hooks/
    useStates.ts
    useTrades.ts
    useClients.ts
    useCalls.ts
    useAuth.ts
  lib/
    firebase.ts   ← configuración Firebase
    timezones.ts  ← mapeo estados → timezone
  data/
    states.json
    trades.json
    client_form.json
  scripts/
    seed.ts