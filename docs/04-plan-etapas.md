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
| Documentación | ✅ |

### Verificado en esta etapa

- API arranca, `/health` responde 200 contra Postgres real.
- Endpoints públicos responden sin token; los protegidos devuelven 401 sin token
  y 401 con token inválido.
- Los tres frontends compilan para producción.
- Las constraints de agenda rechazan solapamientos y permiten clases
  consecutivas (6 casos probados, detalle en `docs/01-modelo-datos.md`).

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

**Objetivo:** que la academia pueda operar su día a día desde el panel.

### Backend
- Motor de cálculo de huecos: plantilla − reservas − bloqueos + extras − buffer,
  filtrado por instructor y vehículo habilitados para el tipo.
- Crear, cancelar y reprogramar reservas (reprogramar = cancelar + crear, en una
  transacción).
- ABM de instructores, vehículos, disponibilidades y servicios.
- Servicio de auditoría conectado a las acciones sensibles.
- Pruebas de concurrencia: dos reservas simultáneas sobre el mismo hueco.

### Panel
- Calendario día/semana/mes con filtros por instructor y vehículo.
- Alta rápida de clase desde el calendario.
- Ficha del alumno con historial.

### PWA
- Reserva de clase por parte del alumno.
- Cancelación según la política configurada.

**Riesgo principal:** las zonas horarias. Todo se persiste en UTC y se convierte
a `America/Montevideo` solo al mostrar.

---

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
