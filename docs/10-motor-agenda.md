# Motor de agenda

Cómo se decide qué horarios se ofrecen y quién puede tocar cada clase.

Código: `apps/api/src/modules/agenda/`
Pruebas: `apps/api/test/disponibilidad.spec.ts` y `apps/api/test/reservas.spec.ts`

---

## Qué calcula

Una clase necesita **dos recursos libres a la vez**: el instructor y el vehículo.
Ofrecer un horario mirando solo la agenda del instructor lleva a prometer clases
que después no se pueden dar porque el auto está ocupado.

```
       plantilla semanal del instructor
     + excepciones de disponibilidad extra
     − bloqueos (licencias, feriados)
     − reservas que ocupan agenda
     ∩ vehículos del tipo pedido que estén libres en ese mismo rango
     ∩ políticas de la academia (antelación mínima, ventana de reserva)
     ─────────────────────────────────────────────────────────────────
     = horarios que se pueden ofrecer
```

`GET /api/v1/agenda/disponibilidad?tipo=AUTO&desde=…&hasta=…&duracionMin=45`

**El motor no reserva nada: solo informa.** Entre consultar un horario y
reservarlo siempre hay una ventana en la que otro puede tomarlo. La garantía de
que eso no termine en doble reserva vive en las `EXCLUDE` constraints de
Postgres, no acá. Ver [`01-modelo-datos.md`](01-modelo-datos.md).

---

## Decisiones que conviene conocer antes de tocar el código

### El buffer se aplica una sola vez

El buffer es el descanso mínimo entre dos clases. Se ensancha **el intervalo de
la clase candidata**, no el de las reservas ya existentes.

Aplicarlo a ambos lados parece más seguro, pero exige el **doble** de separación
que la configurada: con un buffer de 15 minutos, una clase que termina 9:45 y
otra que empieza 10:00 quedarían marcadas como incompatibles, cuando cumplen
exactamente la política. Es un error silencioso: no falla nada, simplemente se
ofrecen menos horarios de los que la academia puede dar.

Lo detectó la prueba *"no ofrece un vehículo que otro instructor ya tiene
tomado"*, que esperaba ver disponible el horario siguiente al ocupado.

### Los horarios van de hora en hora, no cada 15 minutos

El paso entre inicios de clase es `duración + buffer`. Con clases de 45' y buffer
de 15', una franja de 9 a 13 produce 9:00, 10:00, 11:00 y 12:00.

La alternativa —ofrecer un inicio cada 15 minutos— da más opciones pero satura
la pantalla del alumno con horarios casi idénticos y desordena la jornada del
instructor. Si la academia prefiere lo contrario, se cambia el `paso` en
`disponibilidad.service.ts`.

### La plantilla es una regla, no un instante

`DisponibilidadPlantilla` guarda **minutos desde medianoche en hora local**:
"los martes de 9 a 13" no es un momento, es una regla que hay que posar sobre
cada día concreto.

La conversión se hace con `luxon` sobre la zona `America/Montevideo`. Uruguay no
aplica horario de verano desde 2015, pero **el offset no está escrito en ningún
lado**: hacerlo a mano es la causa clásica de agendas corridas una hora.

Hay una prueba dedicada a esto: la plantilla "9 de la mañana local" tiene que
producir un horario a las 12:00 UTC.

### Un bloqueo puede partir una franja en dos

Una licencia de 10 a 12 sobre una franja de 9 a 13 deja **dos** tramos
disponibles, no uno. Por eso la resta usa `Interval.difference()`, que devuelve
una lista.

---

## Reservas

| Operación | Endpoint |
|---|---|
| Agendar | `POST /agenda/reservas` |
| Listar por rango | `GET /agenda/reservas?desde=&hasta=` |
| Ver una | `GET /agenda/reservas/:id` |
| Mover de horario | `PATCH /agenda/reservas/:id/reprogramar` |
| Cancelar | `PATCH /agenda/reservas/:id/cancelar` |
| Confirmar / dictada / ausente | `PATCH /agenda/reservas/:id/estado` |

### Reprogramar actualiza la fila, no crea otra

La reserva conserva su identificador —los enlaces que ya tiene el alumno siguen
sirviendo— y la `EXCLUDE` constraint protege igual, porque no compara una fila
consigo misma. El movimiento queda en la auditoría.

### Quién puede hacer qué

| | ADMIN | INSTRUCTOR | CLIENTE |
|---|:---:|:---:|:---:|
| Ver clases | todas | las de su agenda | las suyas |
| Agendar | para cualquier alumno | para cualquier alumno | solo para sí mismo |
| Cancelar | cualquiera, sin límite de tiempo | las de su agenda | las suyas, con la antelación mínima |
| Confirmar / dictada / ausente | sí | las de su agenda | no |

Tres reglas que sostienen esto:

1. **El `clienteId` del cuerpo del request se ignora si lo manda un alumno.**
   Se usa su propia ficha. Sin esto, cualquiera podría llenarle la agenda a otro.
2. **El filtro por rol se aplica en la consulta**, no en el frontend. Un alumno
   que pida las reservas de otro recibe las suyas.
3. **Cada operación sobre una reserva concreta verifica la pertenencia.** Es la
   defensa contra el fallo más común de estas APIs: cambiar el id de la URL.

### La antelación rige para el alumno, no para la academia

Un alumno no puede reservar ni cancelar sobre la hora. La academia sí: si el
instructor se enferma, la clase no se puede dar igual, y el sistema no debería
obligar a dejarla agendada.

### Completar una clase descuenta del pack

Al pasar una reserva a `COMPLETADA`, si estaba asociada a una compra se
incrementa `clasesUsadas`, **en la misma transacción** que el cambio de estado.
El `CHECK compra_clases_usadas_valido` impide pasarse del total: si el pack ya
está agotado, la escritura falla y la clase no se marca como dictada.

---

## Qué está probado

44 pruebas contra PostgreSQL real, en cada pull request.

**Motor de disponibilidad (13):** el troceado de la franja, la interpretación en
hora local, las reservas que ocupan y liberan, los bloqueos que parten franjas,
la disponibilidad extra, el vehículo como recurso escaso, los instructores no
habilitados y las dos políticas de la academia.

**Reservas (20):** que un alumno no pueda ver, cancelar ni listar clases ajenas;
el alcance del instructor y del administrador; el rechazo de horarios
superpuestos; **dos pedidos simultáneos sobre el mismo hueco, de los que solo uno
queda agendado**; las políticas de antelación y cancelación; la reprogramación; y
los packs, incluido el intento de gastar el de otro alumno.

**Constraints de agenda (11):** ver [`01-modelo-datos.md`](01-modelo-datos.md).

---

## Lo que todavía no está

- **Clases teóricas grupales.** Necesitan un modelo distinto: una `EXCLUDE`
  constraint impide por diseño más de una ocupación simultánea. Van en una
  entidad aparte con aforo.
- **Recordatorios automáticos.** Etapa 3.
- **Panel y PWA.** Sub-etapas 1.B y 1.C.
