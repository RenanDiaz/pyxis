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
- **`clients`** — Prospectos/clientes con datos de LLC, contacto, status y notas.
- **`calls`** — Historial y agenda de llamadas vinculadas a clientes.
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

# Nuevo feature - Separación de clientes y llamadas por usuario
Corrige el modelo de datos para que cada usuario solo vea sus propios
clientes y llamadas. Actualmente todas las colecciones son compartidas
entre usuarios, lo que es un error de seguridad y privacidad.

## Causa del problema
Las colecciones `clients` y `calls` están en la raíz de Firestore,
accesibles para cualquier usuario autenticado.

## Solución: subcolecciones por usuario
Migrar a una estructura donde cada documento raíz es el UID del usuario
y los clientes/llamadas son subcolecciones dentro de él.

### Estructura actual (incorrecta)
/clients/{clientId}
/calls/{callId}

### Estructura nueva (correcta)
/users/{uid}/clients/{clientId}
/users/{uid}/calls/{callId}

## Cambios requeridos

### 1. Hooks de datos
Actualizar `useClients.ts` y `useCalls.ts` para que todas las queries,
inserciones, actualizaciones y eliminaciones usen la ruta
`users/{uid}/clients` y `users/{uid}/calls` respectivamente.
Obtener el `uid` del usuario autenticado via `useAuth`.

### 2. Reglas de Firestore
Actualizar las reglas en Firebase Console para reflejar la nueva
estructura y garantizar que cada usuario solo pueda leer y escribir
sus propios documentos:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

### 3. Colecciones estáticas
Las colecciones `states`, `trades` y `glossary` son de solo lectura y
compartidas para todos los usuarios — no cambiar su estructura.

### 4. Datos existentes
Si hay datos de prueba en las colecciones raíz antiguas, ignorarlos.
No es necesario migrarlos.

## Resultado esperado
Cada usuario autenticado ve únicamente sus propios clientes y llamadas.
Dos usuarios distintos con sesiones abiertas al mismo tiempo no
comparten ningún dato entre sí.
