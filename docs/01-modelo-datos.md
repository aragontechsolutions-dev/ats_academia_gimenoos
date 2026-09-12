# Modelo de datos

Definición completa: `apps/api/prisma/schema.prisma`.
Migraciones aplicadas: `apps/api/prisma/migrations/`.

## Mapa de entidades

```
Usuario ──1:1── Cliente ──┬── Reserva ──┬── Instructor
   │                      │             └── Vehiculo
   │                      ├── Pago
   │                      ├── CompraServicio ── Servicio
   └──1:1── Instructor    └── Expediente ── DocumentoExpediente
                │
                ├── DisponibilidadPlantilla
                └── ExcepcionDisponibilidad
```

## Identidad

`Usuario.id` **es** el UUID de `auth.users` de Supabase (el claim `sub` del JWT).
No se genera localmente. La tabla `usuarios` es un espejo que guarda lo que
Supabase Auth no maneja: rol, nombre, estado y consentimiento de datos.

Contraseñas, tokens y factores de autenticación viven **solo** en Supabase Auth.
El sistema nunca los almacena.

Un `Usuario` puede tener una ficha de `Cliente` (alumno) o de `Instructor`. Un
instructor puede existir **sin** usuario: la academia lo administra desde el
panel sin darle acceso al sistema.

## Agenda: el punto crítico

### El problema

Una clase ocupa tres cosas a la vez: el alumno, el instructor y el vehículo.
Verificar "¿está libre?" y después insertar son **dos operaciones separadas**.
Entre una y otra puede colarse otra reserva:

```
Usuario A                          Usuario B
─────────                          ─────────
consulta: 10:00 libre ✓
                                   consulta: 10:00 libre ✓
inserta reserva 10:00
                                   inserta reserva 10:00   ← doble reserva
```

Esto no se arregla con más validaciones en el servicio. Cualquier chequeo previo
a la escritura tiene esa ventana abierta.

### La solución

Dos `EXCLUDE` constraints de PostgreSQL, en
`prisma/migrations/20260912183000_agenda_exclusion_constraints/migration.sql`:

```sql
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_solape_instructor"
  EXCLUDE USING gist (
    "instructor_id" WITH =,
    tstzrange("inicio", "fin", '[)') WITH &&
  )
  WHERE ("estado" IN ('PENDIENTE', 'CONFIRMADA'));
```

Postgres rechaza la segunda inserción sin importar cuántas peticiones
concurrentes haya, ni si alguien inserta a mano por SQL. Hay tres constraints
equivalentes: por instructor, por vehículo y por cliente.

Detalles que importan:

- **`btree_gist`** es la extensión que permite mezclar igualdad sobre `uuid` (`=`)
  con solapamiento de rangos (`&&`) en el mismo índice. Sin ella, las constraints
  no se pueden crear.
- **El rango es `'[)'`**: inicio incluido, fin excluido. Así una clase que
  termina 10:00 y otra que empieza 10:00 **no** se consideran solapadas, y se
  pueden dar clases consecutivas.
- **La cláusula `WHERE`** deja fuera los estados `CANCELADA`, `COMPLETADA` y
  `AUSENTE`: al cancelar una clase el horario queda libre automáticamente.
- **`inicio` y `fin` son `timestamptz`** (`@db.Timestamptz(3)` en Prisma). Con el
  `timestamp` sin zona que Prisma usa por defecto, `tstzrange()` no se comporta
  igual. Si se agrega otra tabla con rangos horarios, este detalle se repite.
- **`vehiculo_id` admite NULL.** En GiST, NULL no es igual a NULL, así que las
  reservas sin vehículo asignado quedan fuera de la restricción. Es lo deseado.

### Cómo se traduce al usuario

Cuando la constraint dispara, Postgres devuelve el código `23P01`. El filtro
`apps/api/src/common/filters/prisma-exception.filter.ts` lo convierte en un
**409 Conflict** con un mensaje entendible ("Ese instructor ya tiene una clase en
el horario seleccionado"), distinguiendo por nombre de constraint.

### Verificación realizada

Las constraints se probaron contra PostgreSQL 16 real con estos casos:

| Caso | Resultado esperado | Resultado obtenido |
|---|---|---|
| Reserva 10:00–10:45 | inserta | ✅ inserta |
| Mismo instructor 10:30–11:15 (solapa) | rechaza | ✅ `reservas_sin_solape_instructor` |
| Mismo instructor 10:45–11:30 (consecutiva) | inserta | ✅ inserta |
| Otro instructor, mismo vehículo, solapado | rechaza | ✅ `reservas_sin_solape_vehiculo` |
| Cancelar la reserva y reinsertar en ese horario | inserta | ✅ inserta |
| `fin` anterior a `inicio` | rechaza | ✅ `reservas_intervalo_valido` |

### Capacidad mayor a 1

Las clases teóricas grupales (varios alumnos en la misma sesión) **no** se
modelan con `Reserva`: una `EXCLUDE` constraint impide por diseño más de una
ocupación. Cuando se incorporen, van en una entidad aparte con aforo y un
contador protegido por `pg_advisory_xact_lock`.

## Disponibilidad

- `DisponibilidadPlantilla`: horario recurrente del instructor (día de la semana
  + rango horario). Las horas se guardan como **minutos desde medianoche**
  (0–1440) en hora local, no como `DateTime`: una plantilla es una regla, no un
  instante.
- `ExcepcionDisponibilidad`: licencias, feriados (`BLOQUEO`) o turnos extra
  (`DISPONIBILIDAD_EXTRA`), con instantes concretos en `timestamptz`.

El cálculo de huecos disponibles (Etapa 1) es:

```
plantilla del instructor
  − reservas que ocupan agenda
  − bloqueos
  + disponibilidad extra
  − buffer entre clases
  filtrado por instructor y vehículo habilitados para el tipo (MOTO/AUTO)
```

## Catálogo y compras

`Servicio` guarda **dos precios**: `precioContado` y `precioTarjeta`. Es práctica
habitual del rubro cobrar distinto según el medio de pago, y modelarlo como un
precio único obliga a parches después.

`CompraServicio` funciona como bolsa de clases para los packs: `clasesTotales` y
`clasesUsadas`, con un `CHECK` que impide gastar más de lo comprado. El
`montoTotal` se congela al momento de la compra, así un cambio de precios no
altera las ventas ya hechas.

## Pagos

Un solo modelo `Pago` para los cuatro canales (`MP_ONLINE`, `MP_POINT`,
`TRANSFERENCIA`, `EFECTIVO`). Campos relevantes:

- `externalRef` (único): idempotencia y conciliación. Evita que un webhook
  reintentado cree dos pagos.
- `mpPaymentId` / `mpOrderId` (únicos): identificadores de Mercado Pago.
- `comprobantePath`: ruta dentro del bucket privado, **nunca** una URL pública.
- `verificadoPor` / `verificadoAt` / `motivoRechazo`: rastro de la verificación
  manual de transferencias.

## Expedientes

`Expediente` modela el trámite del Permiso Único Nacional de Conducir con estados
que siguen el avance real (documentación, médico, charla, teórico, práctico,
emisión). `DocumentoExpediente` guarda solo metadatos y la ruta en Storage: el
archivo nunca va a la base.

> Los requisitos y pasos concretos del trámite los define la Intendencia de
> Maldonado y cambian. Antes de desarrollar la Etapa 3 hay que confirmarlos en
> la fuente oficial (gub.uy / portal de la Intendencia). Ver
> `docs/04-plan-etapas.md`.

## Auditoría

`RegistroAuditoria` deja rastro de acciones sensibles: acceso a documentos,
cambios de estado de pagos, altas y bajas. Es un requisito del principio de
seguridad de la Ley 18.331 y lo que permite responder "¿quién vio esta cédula?".

**El campo `detalle` nunca debe contener datos sensibles ni secretos.** Guarda
qué pasó, no el contenido.

## Constraints adicionales en la base

Más allá de las de agenda, la migración agrega verificaciones que el ORM no puede
garantizar por sí solo:

| Constraint | Qué impide |
|---|---|
| `reservas_intervalo_valido` | `fin` anterior o igual a `inicio` |
| `excepciones_intervalo_valido` | ídem en excepciones |
| `plantilla_rango_horario_valido` | minutos fuera de 0–1440 o rango invertido |
| `plantilla_dia_semana_valido` | día de semana fuera de 0–6 |
| `compra_clases_usadas_valido` | usar más clases de las compradas |
| `pago_monto_no_negativo` | importes negativos |
| `servicio_precios_no_negativos` | precios negativos |
| `configuracion_fila_unica` | más de una fila de configuración |

La regla general: **si un dato inválido rompería el negocio, la restricción va en
la base.** La validación en el servicio es para dar buenos mensajes, no para
garantizar integridad.
