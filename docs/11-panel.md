# Panel de administración

Aplicación: `apps/admin` · Rol que entra: **solo `ADMIN`**

---

## Pantallas

| Sección | Quién la ve | Para qué |
|---|---|---|
| **Agenda** | solo admin | La operación diaria: ver, agendar, mover y cerrar clases |
| **Alumnos** | solo admin | Buscar alumnos y consultar su ficha e historial |
| **Instructores** | solo admin | Alta, horarios semanales y licencias |
| **Vehículos** | solo admin | Alta, foto, estado y vencimiento del SOA |
| **Precios** | solo admin | Catálogo de servicios y sus dos precios |
| **Cuentas** | solo admin | Quién puede entrar, con qué permisos, e invitaciones sin usar |
| **Sitio público** | solo admin | Datos de contacto, ubicación en el mapa, y textos y orden de las secciones |

En **Sitio público** se marca además la **ubicación de la academia**, tocando el
mapa, arrastrando el marcador o con «Usar mi ubicación» estando en el local. Con
el punto marcado, el sitio muestra un mapa de verdad y el botón «Llevame hasta
allí»; sin marcar, muestra la ilustración de la zona y no inventa una dirección.
Ver [20-mapa.md](20-mapa.md).

El acceso de un **alumno** se habilita desde su ficha, o desde «Dar acceso» en el
listado, y se le puede mandar por correo o por WhatsApp. Ver
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md).

**El panel es solo de administración.** Hasta la Etapa 2.D el instructor también
entraba, porque era el único lugar donde veía su agenda; ahora tiene su propia
app y el panel volvió a ser lo que dice su nombre. Si entra igual, la pantalla le
dice dónde está su trabajo y le ofrece el enlace. Ver
[21-pwa-instructor.md](21-pwa-instructor.md).

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

Desde la Etapa 2.D el listado de alumnos y la ficha son **solo del
administrador**: al instructor ya no se le abren, ni desde acá ni desde la API.
De los alumnos a los que sí les da clase recibe lo que necesita —nombre,
teléfono y correo— dentro de cada reserva, en su propia app.

La regla de fondo sigue siendo la misma y es anterior a ese cambio: la cédula, el
domicilio y las notas internas **solo viajan al administrador**, y nunca se
trataba de ocultarlos en pantalla sino de no enviarlos. La cédula es un dato
identificatorio protegido por la Ley 18.331 y no hace falta para dictar una
clase.

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

---

## Un detalle de los formularios de alta que ya costó un error

El `ValidationPipe` de la API rechaza cualquier campo que el DTO no declare
(`forbidNonWhitelisted`). Eso está bien y es a propósito: evita que un cliente
mande campos de más y que alguno termine escribiéndose sin querer.

La consecuencia práctica es que **el formulario no puede mandar el estado entero
del componente** cuando crea algo. Los campos que solo existen al editar —el
`activo` de un instructor o un alumno, el `estado` de un vehículo— no están en
el DTO de creación, y mandarlos devuelve `400 property activo should not exist`.

El patrón correcto, que usan los tres formularios:

```ts
const cuerpo = {
  ...camposComunes,
  ...(instructor ? { activo } : {}),  // solo al editar
};
```

El formulario de instructores no lo seguía —mandaba `{ ...datos }`— y dar de
alta un instructor fallaba con ese 400. La prueba de navegador
`altas.spec.mjs` recorre los tres formularios de creación de punta a punta y
falla si la API rechaza alguno: es lo que faltaba, porque la validación vive en
el borde HTTP y ninguna prueba unitaria recorría el camino completo.

---

## Los listados están paginados

Alumnos, instructores, vehículos y egresados devuelven **10 por página** y
ofrecen un selector de **10, 20, 50 o 100**. Todos usan la misma forma de
respuesta:

```json
{ "total": 30, "pagina": 2, "porPagina": 10, "paginas": 3, "datos": [...] }
```

El tamaño está acotado a esa lista cerrada **en el DTO y otra vez en el
servicio**: un `porPagina=100000` en un listado es una forma barata de hacer que
la base devuelva una tabla entera en cada petición.

### Los desplegables NO se paginan

Los filtros de la agenda, el buscador de alumnos al agendar una clase y el
desplegable de alumnos del formulario de egresados piden el máximo, no una
página. Si se paginaran, mostrarían diez instructores y **nadie se daría
cuenta** de que faltan los demás.

### Lo que se calcula sobre el total, no sobre la página

En egresados, el filtro de años y el aviso de «faltan autorizaciones» se piden
al servidor (`GET /graduados/resumen`). Calcularlos en el navegador sobre la
lista visible daba resultados distintos según en qué página estuviera parado
quien mira.

---

## La misma trampa, otra vez: los DTO de `@Query()`

Ya la vimos con los formularios de alta, y volvió a aparecer al paginar.

**`@Query()` valida el objeto entero de parámetros de la URL contra su DTO.**
Con `forbidNonWhitelisted`, cualquier parámetro que el DTO no declare devuelve
`400`. Al agregar la paginación, los listados quedaron recibiendo un DTO que
solo declaraba `pagina` y `porPagina`, así que `?incluirInactivos=true` —que el
panel venía mandando desde siempre— empezó a devolver 400 y las tres pantallas
se veían vacías.

El síntoma es engañoso: no hay error de compilación, la pantalla simplemente no
muestra nada.

**La regla:** el DTO de `@Query()` de un endpoint tiene que declarar **todos**
los parámetros que ese endpoint acepta, no solo los que uno está agregando. Por
eso existen `ListarInstructoresDto`, `ListarVehiculosDto` y `ListarGraduadosDto`
en vez de usar `ConsultaPaginadaDto` pelado.

---

## Las fotos de los listados

Egresados y Vehículos tienen una miniatura con *Subir* / *Cambiar* / *Quitar* en
cada fila, con el mismo componente (`componentes/CeldaFoto.tsx`). Las reglas de
validación, los buckets y por qué la base guarda una ruta y no una dirección
están en [17-fotos.md](17-fotos.md).

**Una trampa parecida a las dos de arriba, evitada a tiempo:** la foto del
vehículo va por `PATCH /vehiculos/:id/foto` y no por el PATCH de la ficha.
`PATCH /vehiculos/:id` reemplaza la ficha entera —lo que no viene se guarda en
null—, así que mandar solo la foto desde el listado habría borrado la marca, el
modelo y el SOA del vehículo.


---

## Cuentas

Quién puede entrar al sistema. Está documentada en
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md), junto con el resto
del control de acceso.

Lo que conviene saber acá: **nadie entra si la academia no lo invitó**, ni
siquiera con un token válido de Supabase, y la API impide cuatro cosas que
dejarían a alguien sin forma de entrar —tocarse la propia cuenta, sacar al último
administrador activo, ascender a administrador a alguien con ficha de alumno o
instructor, y darle a alguien el rol de un lado teniendo la ficha del otro—.

**El desplegable de rol corrige un rol mal puesto; no convierte a una persona en
otra cosa.** Marcar como «Instructor» a alguien con ficha de alumno no lo hace
instructor: lo deja en una cuenta que no entra a ningún lado. Un instructor se da
de alta en **Instructores** y se le manda el acceso desde su ficha.
