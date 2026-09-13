# Plan de desarrollo por etapas

## Etapa 0 — Fundaciones ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Monorepo pnpm con 4 apps + paquete compartido | ✅ |
| Esquema Prisma completo del dominio | ✅ |
| Migración con `EXCLUDE` constraints anti-doble-reserva | ✅ probada contra PostgreSQL 16 |
| Verificaciones de integridad (`CHECK`) | ✅ |
| Autenticación Supabase (JWKS/ES256) + roles | ✅ |
| Guard global cerrado por defecto | ✅ |
| Protecciones HTTP (helmet, CORS, throttling, validación) | ✅ |
| Traducción de errores de base a HTTP | ✅ |
| Landing con estructura SEO y contenido centralizado | ✅ |
| Panel con login y consulta de catálogo | ✅ |
| PWA instalable con service worker propio | ✅ |
| SQL de buckets y RLS de Storage | ✅ escrito, pendiente de aplicar |
| Pruebas automáticas de las constraints de agenda | ✅ 11 casos |
| CI con verificaciones obligatorias antes de mergear | ✅ |
| Documentación | ✅ |

### Verificado en esta etapa

- API arranca, `/health` responde 200 contra Postgres real.
- Endpoints públicos responden sin token; los protegidos devuelven 401 sin token
  y 401 con token inválido.
- Los tres frontends compilan para producción.
- Las constraints de agenda rechazan solapamientos y permiten clases
  consecutivas. Los 6 casos manuales quedaron convertidos en 11 pruebas
  automáticas que corren en cada pull request.

### Pendiente de datos reales

El sistema funciona, pero tiene placeholders marcados con `TODO(datos-reales)`:

| Qué falta | Dónde |
|---|---|
| Teléfono, WhatsApp, dirección, horarios, correo | `apps/landing/src/contenido.ts` |
| Precios reales de cada servicio | seed o panel (`apps/api/prisma/seed.ts`) |
| Instructores reales | `contenido.ts` + base |
| Vehículos reales (patente, cilindrada, SOA) | base |
| Testimonios reales **con autorización del alumno** | `contenido.ts` |
| Logo, colores de marca, íconos de la PWA | `index.css`, `vite.config.ts` |
| Dominio definitivo | `index.html`, `robots.txt` |

---

## Etapa 1 — Agenda y catálogo

Se divide en tres entregas para que cada una sea revisable por separado.

### Etapa 1.A — Backend de agenda ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Motor de cálculo de horarios disponibles | ✅ |
| Reservas: agendar, listar, reprogramar, cancelar, cambiar estado | ✅ |
| Permisos por rol, con verificación de pertenencia | ✅ |
| ABM de instructores, con plantilla semanal y excepciones | ✅ |
| ABM de vehículos | ✅ |
| ABM de servicios y precios | ✅ |
| Servicio de auditoría conectado a las acciones sensibles | ✅ |
| Consumo de clases de un pack al completar | ✅ |
| Pruebas, incluida la de concurrencia | ✅ 44 en total |

Detalle en [`10-motor-agenda.md`](10-motor-agenda.md).

### Etapa 1.B — Panel

- Calendario día/semana/mes con filtros por instructor y vehículo.
- Alta rápida de clase desde el calendario.
- ABM de instructores, vehículos y precios desde la interfaz.
- Ficha del alumno con su historial.

### Etapa 1.C — PWA del alumno

- Reserva de clase eligiendo horario entre los disponibles.
- Cancelación según la política configurada.
- Vista de sus próximas clases.

**Riesgo principal:** las zonas horarias. Todo se persiste en UTC y se convierte
a `America/Montevideo` solo al mostrar.

## Etapa 2 — Pagos

**Objetivo:** cobrar por los tres canales y conciliar.

### Checkout online (Mercado Pago)
- Creación de preferencia desde el backend, con el monto calculado allí.
- Webhook con validación de firma `x-signature` (HMAC-SHA256).
- Confirmación consultando la API de Mercado Pago tras el webhook.
- Idempotencia por `external_reference`.
- Probar en sandbox antes de producción.

### Comprobante de transferencia
- Subida a bucket privado con presigned upload URL.
- Bandeja de verificación en el panel, con signed URL temporal para ver el archivo.
- Aprobación/rechazo auditado.

### Cobro presencial (Mercado Pago Point)
> **Confirmar primero con Mercado Pago Uruguay** si la API de Point está
> disponible en producción para cuentas en pesos uruguayos. Si no lo está, Point
> queda como registro manual de cobro presencial (canal `MP_POINT` con carga a
> mano) y se automatiza cuando se habilite. **No comprometer esta parte del
> alcance con la academia hasta tener esa confirmación por escrito.**

---

## Etapa 3 — Expedientes, PWA completa y notificaciones

### Expedientes de libreta
> **Antes de escribir código**, confirmar en la fuente oficial (gub.uy y portal
> de la Intendencia de Maldonado) los requisitos, categorías, domicilios y pasos
> vigentes del trámite. Cambian y varían por departamento. El modelo de datos ya
> contempla los estados, pero el contenido debe verificarse.

- Checklist de documentación por categoría.
- Subida de documentos a bucket privado.
- Seguimiento de estados y fechas de examen.

### PWA
- Vista completa de clases, pagos y expediente del alumno.
- Funcionamiento sin conexión del shell de la aplicación.

### Notificaciones
Orden sugerido por relación esfuerzo/beneficio:
1. **Correo** (recordatorio 24 h y 2 h antes).
2. **Push de la PWA** (Web Push + VAPID; los listeners van en `apps/cliente/src/sw.ts`).
3. **WhatsApp** (canal dominante en Uruguay, pero requiere WhatsApp Business API
   o un proveedor, con costo por conversación).

Un job programado recorre las reservas próximas y dispara los avisos.

### Cumplimiento
- Inscripción de las bases de datos ante la URCDP.
- Publicación de política de privacidad y términos.
- Casilla de consentimiento informado en el alta.

Ver `docs/05-proteccion-datos.md`.

---

## Fuera de alcance inicial

- Categorías profesionales de licencia (B a F).
- Clases teóricas grupales con aforo (requieren un modelo de datos distinto al de
  `Reserva`, ver `docs/01-modelo-datos.md`).
- Aplicación nativa (la PWA cubre la necesidad).
- Facturación electrónica ante DGI.
