# 21 — Avisos de llamadas (5 minutos antes y a la hora)

**Prioridad:** 🟠 Alta (pedido de producción) · **Estado:** fase 1 y fase 2 implementadas (fase 2 requiere setup, ver runbook) · **Tamaño:** M · **Relacionado:** [08](08-agenda.md), [19](19-leads-agenda.md), [20](20-notificaciones-vencidas.md), [17](17-migracion-cloudflare.md)/[18](18-links-de-pago-stripe.md) (fase 2)

## Problema
Isabel pide que Pyxis le **avise 5 minutos antes** de cada llamada agendada y
**a la hora**. Hoy no hay ningún aviso activo: la campana y "Tu próxima
llamada" de Inicio solo informan si alguien las mira.

## Decisiones (2026-10-09)
- **Fase 1 (esta):** avisos con Pyxis abierto en el navegador, aunque esté en
  otra pestaña o minimizado. Isabel trabaja la jornada con Pyxis abierto en la
  computadora, así que esto cubre el pedido.
- **Solo las llamadas propias** (`owner_uid == uid`), también para owner y
  supervisor: ellos ven las de su equipo, pero el aviso es de quien llama.
- **Con sonido**, con un interruptor para apagarlo.
- **Fase 2 (2026-10-10):** Isabel quiere los avisos con el navegador cerrado
  (usa Chrome). Web Push enviado por el Worker. Ver "Fase 2".

## Implementación fase 1 (2026-10-10)
- **Lógica pura:** `src/lib/callReminders.ts` (`dueReminders`, `reminderKey`,
  `reminderWindow`), con tests. Pasada la hora de la llamada, el aviso de 5
  minutos ya no sale aunque el de la hora se haya mostrado en otra pestaña o
  antes de recargar (bug encontrado en la prueba en navegador).
- **Datos:** `getReminderCalls`: llamadas propias pendientes en
  `[ahora − 10 min, ahora + 60 min]`, refrescadas cada minuto y al volver a la
  pestaña.
- **Hook:** `useCallReminders`, montado con `<CallReminders />` en
  `AppLayout`. Revisa cada 15 s y cada vez que llegan datos nuevos.
  - **Toast** abajo a la derecha (arriba tapaba la campana), con ✕, "Llamar" y
    "Ver". "Es la hora" queda hasta cerrarlo; "en 5 minutos" se va solo al
    minuto.
  - **Notificación del sistema** solo con la pestaña oculta y el permiso dado.
  - **Sonido** de dos tonos con WebAudio.
- **Preferencias y avisos ya mostrados:** `src/lib/reminderPrefs.ts`, en
  `localStorage` por usuario. Sincroniza entre pestañas con
  `useSyncExternalStore` y el evento `storage`.
- **Campana:**
  - Switches "Avisarme 5 min antes y a la hora" y "Con sonido".
  - Botón "Permitir avisos con Pyxis en segundo plano" mientras el permiso no
    se decidió.
  - Si el navegador lo bloqueó, una explicación de cómo habilitarlo.
- **Verificado en navegador:**
  - Salieron los 2 avisos con su notificación del sistema; la llamada de otro
    agente no avisó.
  - Tras recargar no se repitieron.
  - Apagar los avisos deshabilita el switch del sonido.

## Requisitos — fase 1
1. **Cuándo:** para cada llamada `pendiente` propia (a cliente o a lead) hay
   dos avisos:
   - **"En 5 minutos"**, a `scheduled_at − 5 min`;
   - **"Es la hora"**, a `scheduled_at`.
   - No aplica a intentos de contacto (`kind: 'contact_attempt'`).
2. **Qué muestra:**
   - **Toast** dentro de Pyxis con el nombre (cliente o lead), la hora local
     del cliente y las acciones "Llamar" (`tel:`) y "Ver". Dura hasta que se
     cierra.
   - **Notificación del sistema** (Notification API) si hay permiso y la
     pestaña no está visible. Al hacer clic enfoca Pyxis y abre el cliente, o
     la Agenda si es un lead.
   - **Sonido corto** (WebAudio, sin archivo), si el sonido está activado.
3. **Activación:**
   - En la campana hay una sección "Avisos de llamadas" con un switch
     "Avisarme 5 min antes y a la hora" y otro switch "Con sonido".
   - Activar avisos pide el permiso del navegador en ese momento, nunca al
     abrir la app.
   - Si el permiso se niega, los avisos siguen como toast y sonido, y se
     explica cómo habilitar las notificaciones del sistema.
   - Las preferencias se guardan por usuario y navegador (`localStorage`).
   - Por defecto: avisos **activados** (toast y sonido) y notificación del
     sistema según el permiso.
4. **Robustez:**
   - **Varias pestañas:** un aviso sale una sola vez. Se reclama con una clave
     `callId:tipo:scheduledAt` en `localStorage`.
   - **Reagendar o resolver:** si la llamada cambia de hora o deja de estar
     pendiente antes del aviso, no sale. La clave incluye `scheduled_at`, así
     que un reagendado avisa a su nueva hora.
   - **Equipo dormido o pestaña congelada:** un aviso atrasado sale solo si no
     pasaron más de **10 minutos** desde su hora; si pasaron más, se descarta.
   - **Datos:** query propia de las llamadas pendientes del usuario entre
     `ahora − 10 min` y `ahora + 60 min`, refrescada cada minuto. Usa el
     índice `outcome + owner_uid + scheduled_at` que ya existe. Un timer local
     evalúa cada 15 s, así que el aviso sale con hasta ~15 s de atraso.

## Fuera de alcance (fase 1)
- Avisos con Pyxis cerrado o en el celular (fase 2, abajo).
- Configurar la antelación (siempre 5 minutos) y avisar de llamadas de otros.

## Fase 2 — Web Push con Pyxis cerrado (implementada 2026-10-10)

### Qué significa "cerrado" en Chrome
El aviso llega con la pestaña de Pyxis cerrada **siempre que Chrome siga
corriendo**:
- **macOS:** cerrar las ventanas deja Chrome corriendo; Cmd+Q lo cierra del
  todo.
- **Windows:** hay que tener activado Configuración → Sistema → "Seguir
  ejecutando aplicaciones en segundo plano al cerrar Google Chrome".
- **Android:** llega con Chrome cerrado.
- **iPhone:** solo con Pyxis instalado como app (iOS 16.4+, "Agregar a
  inicio"). No se probó.

Si Chrome está cerrado del todo, el aviso se descarta: "en 5 minutos" vive 5
minutos en el servicio de push y "es la hora", 10. Así no llegan avisos viejos
al abrir Chrome.

### Cómo funciona
1. **Suscripción:**
   - En la campana, el switch "También con Pyxis cerrado" (por navegador).
   - Registra `public/sw.js`, suscribe el navegador con la clave VAPID que da
     `GET /api/push/config` y guarda la suscripción en
     `users/{uid}/push_subscriptions/{hash del endpoint}`, con la zona horaria
     del navegador.
   - Lo hace `src/lib/pushSubscription.ts`, con el hook `usePushReminders`.
   - Apagar los avisos también apaga este switch. **Cerrar sesión borra la
     suscripción de ese navegador**, como los borradores.
   - Sin los secretos configurados en el Worker, el switch no aparece.
2. **Cron del Worker:** cada minuto, solo en producción. Staging lee el mismo
   Firebase y duplicaría los avisos. Corre `worker/pushReminders.ts`:
   - Consulta `calls` como collection group: `pendiente` con `scheduled_at` en
     `[ahora − 10 min, ahora + 6 min]`. Usa un índice de collection group.
   - Decide con la misma `dueReminders` de la fase 1 (5 minutos antes y a la
     hora, 10 minutos de gracia, sin intentos de contacto).
   - Envía a cada navegador del **dueño de la llamada** y anota la clave en
     `call.push_sent`.
     - Un reagendado tiene otra clave y avisa de nuevo.
     - Si falla de forma pasajera (red, 429 o 5xx), no lo anota: lo reintenta
       el minuto siguiente.
     - Si el servicio responde 404 o 410, borra la suscripción.
3. **Notificación:**
   - Usa la misma `tag` que la fase 1 (`callId:tipo:hora`): con Pyxis abierto
     y en segundo plano, el navegador reemplaza en vez de duplicar.
   - "Es la hora" queda hasta cerrarla.
   - Al hacer clic se abre el cliente, o la Agenda si es un lead. Si Pyxis ya
     está abierto, navega con el router sin recargar.
4. **Piezas del Worker, sin dependencias nuevas:**
   - `firestore.ts`: cliente REST.
   - `googleAuth.ts`: service account, JWT RS256 con WebCrypto.
   - `webPush.ts`: RFC 8291 + VAPID RFC 8292.

   Los reutiliza la spec 18. El Worker solo envía a hosts de servicios de push
   conocidos.

### Tests
- **Unit:**
  - El cifrado lo descifra un navegador simulado. Además se verificó contra
    `http_ece` (la librería de `web-push`).
  - Firma VAPID, allowlist de endpoints y headers.
  - Tipos REST y JWT de la service account.
  - Índice de collection group.
- **Emulador:** el cron completo con el cliente REST:
  - antes y a la hora, una sola vez cada uno;
  - reagendado;
  - resueltas, intentos y colección vieja de nivel raíz;
  - lead;
  - 410 borra la suscripción;
  - un 503 se reintenta;
  - un endpoint ajeno se ignora.
- **Reglas:** cada usuario gestiona solo sus suscripciones; solo `https` y sin
  campos extra.
- **Navegador (Chromium):**
  - Push entregado al service worker por DevTools: 3 pushes con 2 `tag`
    distintas dan 2 notificaciones.
  - El clic con Pyxis abierto navega.
  - El switch aparece, se deshabilita con los avisos apagados y se oculta sin
    configuración.
- **No probado:** un push real de FCM a Chrome. Se ve en producción tras el
  setup.

### Runbook de setup (una vez)
1. **Service account del Worker** (Google Cloud Console → IAM → Service
   accounts, en el proyecto de Firebase):
   - Crear `pyxis-worker` con el rol **Cloud Datastore User**.
   - Keys → Add key → JSON.
   - Es la misma que pide la spec 18.
2. **Claves VAPID:** `npx tsx scripts/generate-vapid-keys.ts`, una sola vez.
   Si se cambian, cada navegador tiene que volver a activar el switch.
3. **Secretos del Worker de producción** (`pyxis`, en Cloudflare → Workers →
   pyxis → Settings → Variables & Secrets, todos como *Secret*):
   - `FIREBASE_PROJECT_ID`: el de `VITE_FIREBASE_PROJECT_ID`.
   - `FIREBASE_SA_CLIENT_EMAIL`: `client_email` del JSON.
   - `FIREBASE_SA_PRIVATE_KEY`: `private_key` del JSON, tal cual, con los
     `\n`.
   - `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`.

   **No configurarlos en staging:** sin cron, sus suscripciones recibirían los
   pushes de producción con otra clave.
4. **Reglas e índices:** `firebase deploy --only firestore:rules,firestore:indexes`.
   El índice tarda unos minutos en construirse; mientras tanto el cron falla y
   lo deja en los logs.
5. **Mergear a `main`:** el deploy registra el cron (Cloudflare → pyxis →
   Settings → Triggers → Cron Triggers).
6. **En Chrome de Isabel:** campana → "También con Pyxis cerrado" → permitir.
   En Windows, revisar el ajuste de segundo plano de arriba.
7. **Verificar:**
   - Agendar una llamada propia a 7 minutos y cerrar la pestaña.
   - Deben llegar los 2 avisos.
   - En Cloudflare → pyxis → Logs sale `avisos de llamadas {"due":…,"sent":…}`.

**Costo:**
- Lecturas: cada llamada se lee unas 16 veces en su ventana, más las
  suscripciones de su dueño cuando toca avisar.
- Escrituras: 2 por llamada.
- El cron usa poca CPU. El JWT de Google se firma una vez por hora por isolate.

## Criterios de aceptación — fase 1
- [x] Una llamada propia a las 10:00 avisa a las 9:55 ("En 5 minutos") y a las 10:00 ("Es la hora"), con toast y sonido.
- [x] Con la pestaña oculta y el permiso dado, sale la notificación del sistema y al hacer clic abre el cliente.
- [x] Con dos pestañas abiertas, cada aviso sale una sola vez.
- [x] Si la llamada se marca completada o se reagenda antes, el aviso viejo no sale; la reagendada avisa a su nueva hora.
- [x] Una llamada de otro agente no avisa, aunque el owner la vea en la Agenda.
- [x] Con los avisos apagados no sale nada; con el sonido apagado, sale sin sonido.

## Criterios de aceptación — fase 2
- [x] Con el switch activo y la pestaña cerrada (Chrome corriendo), llegan "En 5 minutos" y "Es la hora" (emulador + navegador; push real: ver runbook paso 7).
- [x] Cada aviso llega una sola vez, también con Pyxis abierto (misma `tag`).
- [x] Solo al dueño de la llamada; un reagendado avisa a su nueva hora.
- [x] Una suscripción vencida se borra sola; cerrar sesión deja de avisar a ese navegador.
- [x] Sin secretos configurados, ni el cron ni la UI hacen nada.
