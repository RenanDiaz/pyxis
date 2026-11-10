# 29 — Ficha del estado en panel lateral (sin salir del cliente)

**Prioridad:** 🟡 Media · **Estado:** pendiente · **Tamaño:** M · **Depende de:** [25](25-consistencia-visual.md) · **Relacionado:** [24](24-analytics-uso.md), [27](27-busqueda-global.md)

## Problema
La ficha del estado es la referencia más consultada en llamada, pero solo
existe como página (`/estados/:abbreviation`). Si el agente está en el detalle
de un cliente, o a mitad del formulario, y necesita el precio del annual report
o el link de name check, tiene que navegar fuera y volver.

## Diagnóstico (verificado en el código, 2026-11-10)
- `StateDetail.tsx` (331 líneas) mezcla página y contenido: cabecera con reloj
  y acciones, hero con tres números, y seis paneles (reporte anual, disolución,
  enmiendas, propósito, códigos de área, ZIP). `CallTimeBadge` y `LocalTime` son
  funciones internas del archivo.
- **No hay ningún enlace al estado desde un cliente:** `ClientDetail` muestra
  `client.state` como texto, y `ProcessCard` muestra `— TX` junto al proceso. El
  único `Link` a `/estados/…` de toda la app está en `States.tsx`.
- `ProcessCard` y `ClientForm` ya muestran un resumen del estado (los `fields`
  del proceso), pero solo los campos de ese proceso.
- `components/ui/sheet.tsx` ya existe (lo usa el menú móvil).

## Requisitos
1. **Extraer el contenido:** `components/states/StateSheetContent.tsx` (o
   `StateInfo`) con el hero y los seis paneles, sin dependencias de ruta.
   `StateDetail` pasa a ser: `PageHeader` + ese componente. `CallTimeBadge` y
   `LocalTime` se mueven a `components/states/`. **La página no cambia visualmente.**
2. **`StateSheet({ abbreviation, open, onOpenChange })`:** panel lateral derecho
   en desktop (ancho ~480 px) y panel inferior a pantalla casi completa en móvil.
   Contenido en una columna:
   - Cabecera: nombre, abreviatura, hora local con semáforo de buena hora,
     aviso de estado con varias zonas horarias.
   - Acciones: **Verificar nombre** (link externo), **Cotización**
     (`QuickQuoteDialog`), **Abrir página completa** (`/estados/:abbreviation`).
   - Hero de tres números y los seis paneles.
   - **No** incluye "Editar" (admins globales lo hacen desde la página) ni el
     selector "Cambiar de estado".
3. **Puntos de entrada** — la abreviatura del estado pasa a ser un botón
   (`StateChip`, con ícono y `aria-label="Ver ficha de <estado>"`):
   - `ClientDetail`: en la cabecera y en el campo "Estado" de la columna izquierda.
   - `ProcessCard`: junto a la etiqueta del proceso (`— TX`).
   - `ClientForm`: junto al selector de estado y en cada card informativo de proceso.
   - `Schedule`: en la tarjeta de una llamada con estado (cliente o lead).
   - `Home`: en el bloque "Próxima llamada".
4. El panel **no cambia la ruta** ni se pierde el estado de la pantalla de
   fondo: en `ClientForm` los datos escritos y el borrador siguen intactos al
   abrir y cerrar.
5. Dentro de `ClientForm`, `StateChip` es `type="button"` (no envía el formulario).
6. Cierre con `Esc`, clic fuera o botón; el foco vuelve al chip que lo abrió.
   Scroll interno del panel sin romper el scroll nativo del documento
   (regla de `CLAUDE.md`).
7. Si la abreviatura no existe en `useStates()`, el chip se muestra como texto
   plano (sin botón).
8. **Analítica:** `state_viewed` gana la propiedad
   `source: 'page' | 'sheet'` (la página envía `page`). Actualizar
   `AnalyticsEvents` y el spec 24. Sin ids de cliente.

## Fuera de alcance
Editar el estado desde el panel, comparar dos estados, fijar el panel abierto
al navegar, rediseñar el contenido de la ficha, abrir el panel desde la
búsqueda global (el spec 27 navega a la página; ver pregunta 2).

## Criterios de aceptación
- [ ] `/estados/TX` se ve y se comporta igual que antes del refactor (comparación visual en claro y oscuro, 375 px y 1440 px).
- [ ] En `ClientDetail`, clic en la abreviatura del estado abre el panel sin cambiar la URL.
- [ ] El panel muestra los mismos valores que la página para ese estado (precio, fee, días, annual report, disolución, enmiendas, propósito).
- [ ] "Verificar nombre" abre el link del estado en otra pestaña; "Cotización" abre `QuickQuoteDialog` con ese estado.
- [ ] En `ClientForm`, abrir y cerrar el panel no envía el formulario ni borra lo escrito; el borrador se conserva.
- [ ] Cada `ProcessCard` abre la ficha de **su** estado (cliente con procesos en estados distintos).
- [ ] En 375 px el panel es usable, con scroll interno, y el fondo no se desplaza.
- [ ] `Esc` cierra y devuelve el foco al chip; el panel tiene título accesible.
- [ ] Un proceso o cliente sin estado no muestra chip.
- [ ] `state_viewed` llega con `source: 'sheet'` desde el panel y `source: 'page'` desde la página.
- [ ] `StateDetail.tsx` no duplica el marcado del contenido (usa el componente extraído).
- [ ] `npm run build`, `npm run lint` y `npm test` pasan.

## Preguntas abiertas
1. **¿Qué se consulta más en llamada?** Si son 2–3 datos (precio, días, name
   check), conviene ponerlos arriba del panel y dejar el resto debajo. Validar
   con 2–3 agentes antes de fijar el orden.
2. **Búsqueda global (spec 27):** ¿elegir un estado desde `⌘K` estando en un
   cliente o en el formulario debería abrir este panel en vez de navegar?
   Recomiendo que sí cuando hay un formulario con cambios sin guardar; se
   decide al implementar el que llegue segundo.
3. **Oficios y Glosario:** ¿merecen el mismo trato (panel desde el formulario)?
   Recomiendo que no: el spec 27 ya los responde en el buscador.
