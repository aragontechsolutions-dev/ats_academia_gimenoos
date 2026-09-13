# Panel de administración

Aplicación: `apps/admin` · Roles que entran: `ADMIN` e `INSTRUCTOR`

---

## Pantallas

| Sección | Quién la ve | Para qué |
|---|---|---|
| **Agenda** | admin e instructor | La operación diaria: ver, agendar, mover y cerrar clases |
| **Alumnos** | admin e instructor | Buscar alumnos y consultar su ficha e historial |
| **Instructores** | solo admin | Alta, horarios semanales y licencias |
| **Vehículos** | solo admin | Alta, estado y vencimiento del SOA |
| **Precios** | solo admin | Catálogo de servicios y sus dos precios |

El instructor ve la agenda y los alumnos porque los necesita para dar clase. La
configuración de la academia es del administrador.

---

## Agenda

Tres vistas sobre los mismos datos:

- **Día** — una columna por instructor. Es como se lee la jornada en el mostrador:
  de un vistazo se ve quién tiene hueco.
- **Semana** — una columna por día. La vista por defecto, para planificar.
- **Mes** — carga general; al tocar un día se salta a la vista de día.

Las clases se ubican por su horario real y el color indica el estado: pendiente,
confirmada, dictada, cancelada o ausente.

### Agendar una clase

**El horario no se escribe: se elige.** El formulario consulta el motor de
disponibilidad y ofrece solo los horarios en los que hay instructor y vehículo
libres. Escribirlo a mano permitiría pedir un horario ocupado, que la base
rechazaría recién al guardar, después de completar todo el formulario.

Si no aparece ningún horario, el aviso nombra las tres causas posibles: la
plantilla del instructor, los vehículos disponibles o la antelación mínima.

### Cerrar una clase

Desde el detalle: confirmar, marcar dictada, marcar ausente o cancelar. Cancelar
pide un motivo opcional y libera el horario en el acto.

---

## Alumnos

El alumno **existe con independencia de que tenga cuenta**: la mayoría se anota
en el local y nunca inicia sesión. Se registra desde el panel con sus datos de
contacto.

Si más adelante esa persona se crea una cuenta, el sistema **vincula la ficha por
correo**, y solo si hay exactamente una candidata. Ante dos coincidencias no
adivina: crea una ficha nueva y deja un aviso en el log para que un
administrador las unifique. Vincular mal le entregaría a alguien el historial de
otra persona.

### Qué ve cada rol

La cédula, el domicilio y las notas internas **solo viajan al administrador**.
No es que el instructor los tenga ocultos en pantalla: no se le envían. La
cédula es un dato identificatorio protegido por la Ley 18.331 y no hace falta
para dictar una clase.

Por lo mismo, la búsqueda por cédula funciona para el administrador y no para el
instructor.

---

## Horarios de un instructor

**Plantilla semanal:** los horarios habituales, por día. Se guarda entera de una
vez, porque se define como un todo ("estos son mis horarios") y así no puede
quedar a medias.

**Excepciones:** un bloqueo quita horarios (licencia, feriado); una
disponibilidad extra agrega turnos fuera de la plantilla.

Sobre esa base el motor calcula los horarios que se ofrecen. Ver
[`10-motor-agenda.md`](10-motor-agenda.md).

---

## Detalles de implementación que conviene conocer

**Las fechas se convierten al mostrar.** La API entrega y recibe UTC siempre; el
panel convierte a `America/Montevideo` con `luxon`, y fija la zona por defecto
para que no dependa de la configuración de la computadora que lo abre.

**Los guards del frontend son comodidad, no seguridad.** Quien fuerce una ruta
igual recibe 401 o 403 en cada petición: la autorización la aplica la API.

**Las bajas son por estado, no por borrado.** Un instructor, vehículo o alumno
dado de baja sale de la agenda pero conserva su historial de clases.

---

## Verificación

Además del typecheck y el build, el panel se probó **en un navegador real**
contra la API y la base, recorriendo las once pantallas y ejecutando el flujo
completo de alta:

buscar un alumno → elegirlo → pedir disponibilidad → elegir un horario de los
ofrecidos → agendar → verlo aparecer en el calendario → abrir su detalle →
cancelarlo.

Sin errores de consola ni peticiones fallidas. La conversión horaria quedó
confirmada de punta a punta: una clase agendada a las 09:00 de Montevideo se
guarda como 12:00 UTC.
