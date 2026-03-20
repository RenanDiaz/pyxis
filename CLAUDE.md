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
| `/clientes` | Clientes | CRM liviano: lista, detalle, formulario nuevo/editar, historial de llamadas |
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

# Nuevo feature - Exportar formulario de registro
Agrega la funcionalidad de exportar el formulario de registro de cliente
como archivo .docx.

## Librería
npm install docx file-saver
npm install -D @types/file-saver

## Dónde aparece
En la vista de detalle de un cliente (`/clientes/:id`), agregar un botón
"Exportar .docx" junto a los demás botones de acción.

## Estructura del documento generado
El archivo debe replicar la plantilla en `src/data/client_form.json` y
rellenarse con los datos del cliente seleccionado. Formato:

- Título: nombre de la LLC en mayúsculas
- Sección "INFORMACIÓN REGISTRADA:" con los siguientes campos:
  - NOMBRE DE LA LLC
  - ESTADO
  - PRIMER NOMBRE
  - SEGUNDO NOMBRE
  - APELLIDOS
  - SSN O ITIN
  - NÚMERO TELEFÓNICO
  - CORREO ELECTRÓNICO
  - DIRECCIÓN COMERCIAL DE LA EMPRESA
  - PROPÓSITO DE LA EMPRESA

Cada campo con formato: etiqueta en negrita seguida del valor.
Puedes encontrar la plantilla original en `resources/[NOMBRE DE LA COMPAÑIA], LLC.docx`

## Nombre del archivo generado
`[LLC NAME].docx`
Ejemplo: `GARCIA SERVICES, LLC.docx`

## Implementación
Crear el helper `src/lib/exportClientDoc.ts` con la función
`exportClientDoc(client: Client): void` que genera y descarga el archivo.
Importarlo en el componente de detalle del cliente.