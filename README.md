# Pyxis

> *Pyxis* — la brújula (del latín) que guía cada llamada de ventas.

Pyxis es una web app en español para agentes de ventas telefónicas de empresas que ayudan a migrantes en EE.UU. a registrar su propia LLC. Centraliza la información de referencia necesaria durante cada llamada y funciona como CRM liviano para gestionar prospectos.

---

## Funcionalidades principales

- **Consulta de estados** — Precio, fees, tiempos de procesamiento, huso horario en tiempo real y verificación de disponibilidad de nombre para los 50 estados.
- **Glosario de oficios** — Traducción inglés/español de 25 oficios con descripción, filtrable por categoría.
- **CRM de clientes** — Alta, edición y seguimiento de prospectos con estados semafóricos (nuevo, contactado, en proceso, cerrado, perdido).
- **Agenda de llamadas** — Programación, seguimiento y registro de resultado de llamadas.
- **Dashboard** — Resumen rápido de clientes, llamadas del día y próximas citas.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Backend / DB | Firebase (Auth, Firestore, Storage) |
| Routing | React Router v7 |
| Data fetching | TanStack Query (React Query) |
| Fechas / TZ | date-fns + date-fns-tz |
| Deploy | Vercel |

---

## Requisitos previos

- Node.js >= 18
- Un proyecto en [Firebase Console](https://console.firebase.google.com) con:
  - **Authentication** habilitado (Google + Email/Password)
  - **Firestore Database** en modo producción

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd pyxis

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con las credenciales de tu proyecto Firebase

# 4. (Primera vez) Poblar Firestore con datos estáticos
npx tsx scripts/seed.ts

# 5. Iniciar servidor de desarrollo
npm run dev
```

---

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto (ver `.env.example`):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## Scripts disponibles

| Comando | Descripción |
|---------|------------|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Compila TypeScript y genera el build de producción |
| `npm run preview` | Previsualiza el build de producción localmente |
| `npm run lint` | Ejecuta ESLint |

---

## Estructura del proyecto

```
src/
  components/
    ui/           ← Componentes shadcn/ui
    layout/       ← Sidebar, Header, PrivateRoute
    states/       ← Módulo de estados
    trades/       ← Módulo de oficios
    clients/      ← Módulo de clientes
    calls/        ← Módulo de agenda
  pages/          ← Páginas principales (Login, Home, States, etc.)
  hooks/          ← Hooks personalizados (useStates, useClients, etc.)
  lib/            ← Firebase config, mapeo de zonas horarias
  data/           ← JSON estáticos (states, trades, client_form)
  scripts/        ← Seed de Firestore
```

---

## Licencia

Proyecto privado. Todos los derechos reservados.
