# 21 — Avisos de llamadas (5 minutos antes y a la hora)

**Prioridad:** 🟠 Alta (pedido de producción) · **Estado:** fase 1 en implementación · **Tamaño:** M · **Relacionado:** [08](08-agenda.md), [19](19-leads-agenda.md), [20](20-notificaciones-vencidas.md), [17](17-migracion-cloudflare.md)/[18](18-links-de-pago-stripe.md) (fase 2)

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
- **Fase 2 (después, si hace falta):** Web Push con Pyxis cerrado o en el
  celular. Ver "Fase 2".

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
- Avisos con Pyxis cerrado o en el celular (fase 2).
- Configurar la antelación (siempre 5 minutos) y avisar de llamadas de otros.

## Fase 2 — Web Push (propuesta, sin implementar)
- **Service worker** en la app y suscripción Push por dispositivo en
  `users/{uid}/push_subscriptions/{id}`.
- **Worker de Cloudflare** con un *Cron Trigger* cada minuto:
  - lee las llamadas pendientes que vencen en 5 minutos o ya, con el cliente
    REST de Firestore con service account de la spec 18;
  - envía Web Push con VAPID;
  - marca `reminders_sent` en la llamada para no repetir.
- **iPhone:** solo funciona con Pyxis instalado como app (iOS 16.4+, "Agregar
  a inicio"). En Android y en computadora funciona directo.
- Depende de que la spec 18 haya construido `worker/firestore.ts` y
  `worker/auth.ts`.

## Criterios de aceptación — fase 1
- [ ] Una llamada propia a las 10:00 avisa a las 9:55 ("En 5 minutos") y a las 10:00 ("Es la hora"), con toast y sonido.
- [ ] Con la pestaña oculta y el permiso dado, sale la notificación del sistema y al hacer clic abre el cliente.
- [ ] Con dos pestañas abiertas, cada aviso sale una sola vez.
- [ ] Si la llamada se marca completada o se reagenda antes, el aviso viejo no sale; la reagendada avisa a su nueva hora.
- [ ] Una llamada de otro agente no avisa, aunque el owner la vea en la Agenda.
- [ ] Con los avisos apagados no sale nada; con el sonido apagado, sale sin sonido.
