# Pagos y tablero

> **Qué resuelve:** que un alumno pueda pagar sin ir a la academia, que la
> administración apruebe esos pagos con el comprobante a la vista, que los
> cobros en efectivo del mostrador queden registrados en el mismo lugar, y que
> al abrir el panel se vea de un vistazo qué pasó en la academia.

Etapa 4 completa: 4.A la API, 4.B la pantalla del alumno, 4.C el módulo del
panel, 4.D el tablero.

---

## 1. Cómo paga un alumno

En la app del alumno hay una pestaña **Pagar**. La pantalla dice de entrada, sin
que haya que buscarla, la limitación de hoy:

> Por ahora solo por transferencia bancaria.

Son tres pasos, en este orden:

1. **Hacé la transferencia.** La pantalla no muestra el número de cuenta: le
   dice al alumno que se lo pida a la academia por WhatsApp, con el número que
   sale de la configuración del sitio. Es a propósito —ver §6.
2. **Elegí qué pagaste.** Una lista de los servicios del catálogo con su precio.
3. **Subí el comprobante.** El PDF o la captura que da el banco. Hasta 5 MB.

Debajo queda el historial: los últimos cinco pagos con su estado, y un botón
para ver los anteriores. El historial es lo que contesta «¿ya me lo revisaron?»
sin tener que escribirle a nadie.

### Por qué son dos pedidos y no uno

Subir el comprobante son **dos llamadas** a la API, en este orden:

```
POST  /pagos/mios                    → crea el pago, devuelve su id
(el navegador sube el archivo a Storage, a la carpeta de ese id)
PATCH /pagos/mios/:id/comprobante    → avisa cuál es el archivo
```

No se puede al revés: la carpeta donde vive el archivo lleva el id del pago, así
que el pago tiene que existir antes. La consecuencia buena de este orden es que
si la subida falla, el pago queda en **«Falta el comprobante»**, visible en el
historial, y el alumno puede reintentar sin empezar de cero.

### El archivo no pasa por la API

El navegador sube el archivo **directo al bucket** de Supabase. Son varios
megabytes que no tienen por qué atravesar el servidor, que en el plan gratuito
de Render tiene poca memoria. Lo que sí pasa por la API es **el permiso** para
verlo (§4).

El comprobante **no se recomprime**. Un comprobante es un documento: bajarle la
calidad puede dejar ilegible un número de transacción, que es justo el dato por
el que existe. Por eso el tope es de tamaño (5 MB) y no de resolución.

---

## 2. Cómo se gestiona desde el panel

Menú **Pagos**. Entra filtrado por **«Para revisar»**, que es a lo que se entra.

- **Buscador en tiempo real** por nombre, apellido, cédula o pasaporte, con 300 ms
  de espera para no disparar una consulta por tecla.
- **Ver** abre el detalle: el comprobante, el monto, y los botones de aprobar y
  rechazar.
- **Registrar pago en efectivo**: busca al alumno, elige el servicio, y opcionalmente
  corrige el monto y deja una nota interna.

### Aprobar acredita las clases

Aprobar un pago hace dos cosas **en una sola transacción**: marca el pago como
aprobado y crea la compra que le acredita las clases al alumno. O pasan las dos o
no pasa ninguna. Si fallara a la mitad quedaría un alumno que pagó y no tiene
clases, o clases regaladas sin pago; hay una prueba que fuerza el error adentro de
la transacción para comprobar que no queda nada a medias.

Un pago **no se puede aprobar dos veces**: solo se puede aprobar o rechazar desde
`PENDIENTE` o `PENDIENTE_VERIFICACION`.

### El monto lo pone el servidor

El alumno manda **qué servicio** está pagando, no cuánto. El monto sale del
catálogo, en el servidor. Si mandara el monto, mandaría uno.

Al aprobar, la administración **sí** puede corregirlo por lo que figura en el
banco, y esa corrección queda en la auditoría como `montoCorregido: {de, a}`. La
compra se crea por el monto corregido, no por el esperado.

En efectivo pasa lo mismo al revés: el monto es opcional y por omisión es el del
catálogo, pero quien cobra en el mostrador puede escribir lo que se acordó. Ahí
quien lo registra es de la academia, no un desconocido.

Los montos son **enteros de pesos**. Los precios de la academia son en pesos
uruguayos redondos, y aceptar centavos solo abre la puerta a un `0.1 + 0.2`.

### El rechazo lleva motivo obligatorio

El alumno lo ve en su pantalla. Un rechazo sin motivo lo obliga a preguntar por
WhatsApp qué pasó, que es exactamente lo que esta funcionalidad viene a evitar.

El motivo **no** va al detalle de la auditoría: la auditoría la lee más gente que
la base, y el motivo puede decir algo del banco del alumno.

---

## 3. El tablero

El panel **aterriza en el resumen**. La agenda pasó a `/agenda` y sigue en el menú.

Cuatro cifras arriba, que son las preguntas con las que se abre el panel a la
mañana:

| Cifra | Qué contesta |
|---|---|
| **Cobrado** | Cuánta plata entró en el período, y en cuántos pagos |
| **Para revisar** | Cuántos comprobantes esperan decisión, y desde cuándo el más viejo |
| **Clases dictadas** | Cuántas se dieron, y cuántas hay agendadas por delante |
| **Alumnos nuevos** | Altas del período, y cuántas clases compradas quedan sin dar |

Debajo: el gráfico día a día, el desglose por forma de pago, por servicio y por
instructor, y cuatro cifras secundarias (canceladas, ausentes, pagos rechazados
y plata pendiente de cobro).

Las tarjetas que llevan a algún lado son **enlaces de verdad**, no `div` con
`onClick`: se abren en otra pestaña con el botón del medio y el teclado las
alcanza.

### Períodos

**Hoy**, **Semana** (de lunes a hoy), **Mes** (del 1 a hoy) y **Otro período**
con dos fechas. El máximo es de **400 días** por consulta: alcanza para «todo el
año pasado» y corta de raíz un `desde=1900-01-01` que recorra la tabla entera.

### Dos criterios de fecha que hay que tener claros

Están escritos en la propia pantalla, porque si no, los números no cierran contra
la caja y nadie sabe por qué:

1. **Un pago cuenta en el día en que se hizo**, no en el día en que se aprobó. Es
   la fecha en que la plata se movió. Si se contara por la aprobación, una
   transferencia del viernes revisada el lunes aparecería como ingreso del lunes.
2. **Los pendientes no se filtran por período.** Son una cola de trabajo, no un
   hecho del pasado. Un comprobante de hace tres semanas sin revisar tiene que
   seguir molestando aunque se esté mirando «hoy».

Las clases, en cambio, cuentan por su **hora de inicio**: una clase es del día en
que se dio.

### La hora de San Carlos, no la de Greenwich

El corte diario se hace en `America/Montevideo`, **en la base**, con
`AT TIME ZONE`. Uruguay está en UTC−3: agrupando por día UTC, un cobro de las
23:30 caería en el día siguiente y el corte diario no cerraría contra la caja.

Eso obliga a dos consultas en SQL crudo (`serieDePagos` y `serieDeClases`), porque
Prisma no sabe agrupar por «día de Montevideo». Van parametrizadas con
`Prisma.sql`, no concatenadas.

Los días vacíos se rellenan en el servidor: sin eso, un gráfico con dos días
cargados y cinco sin nada dibujaría dos barras pegadas y mentiría sobre el ritmo
de la semana.

---

## 4. El comprobante es privado

El bucket `comprobantes` es **privado**. No existe una dirección fija que lo
sirva. Para mostrar uno, la API le pide a Supabase una dirección firmada que
**dura cinco minutos**, con la clave de servicio, que vive solo en el backend.

Se pide **cada vez** que se abre, y no se guarda en ningún lado: es una dirección
que abre el documento bancario de una persona **sin pedir sesión**, así que cuanto
menos viva, mejor.

**Queda en la auditoría** como `COMPROBANTE_CONSULTADO`. Mirar el comprobante
bancario de alguien es un acceso a un dato personal y la Ley 18.331 pide poder
responder quién vio qué. La **ruta del archivo no va en el detalle**: junto con la
clave de servicio permitiría llegar al archivo.

---

## 5. Seguridad

Lo que se comprobó, y contra qué ataque:

| Riesgo | Cómo está cerrado |
|---|---|
| El alumno se pone el monto que quiere | Manda el `servicioId`; el monto sale del catálogo en el servidor |
| El alumno apunta el comprobante al de otro | Manda **solo el nombre** del archivo; la ruta la compone la API con el id de su sesión |
| Se sube un archivo con script adentro | Regla de extensión (`pdf`, `jpg`, `jpeg`, `png`) igual a la del bucket. SVG afuera a propósito |
| Un alumno ve el pago de otro | `listarMios` filtra por la ficha de su sesión; `registrarComprobante` comprueba pertenencia |
| Un alumno o instructor abre el tablero | `@Roles(ADMIN)` en el controlador. Devuelve facturación y rendimiento por instructor |
| Inyección por el buscador o las fechas | Prisma parametriza; las fechas del tablero pasan por un `Matches(/^\d{4}-\d{2}-\d{2}$/)` |
| Parámetros de más | `ValidationPipe` con `whitelist` + `forbidNonWhitelisted`: `?otro=1` da 400 |
| Consulta que recorre toda la tabla | Tope de 400 días |
| El alumno ve notas internas | `CAMPOS_DEL_ALUMNO` no incluye `nota`, `comprobantePath` ni `verificadoPor` |

Comprobado contra la API corriendo:

```
INSTRUCTOR   → 403
CLIENTE      → 403
sin sesión   → 401
?desde=ayer                          → 400 "formato AAAA-MM-DD"
?desde=2026-09-10&hasta=2026-09-01   → 400 "tiene que ser igual o posterior"
?desde=1990-01-01&hasta=2026-01-01   → 400 "no puede pasar de 400 días"
?otro=1                              → 400 "no es un dato que este formulario pueda mandar"
```

---

## 6. Lo que NO hace, y por qué

- **No muestra el número de cuenta en la app.** Poner los datos bancarios de la
  academia en una pantalla que sirve el navegador es publicarlos. Hoy se piden por
  WhatsApp. Si se quiere automatizar, el lugar correcto es la configuración de la
  academia con la pantalla pidiendo sesión, no el bundle del frontend.
- **No cobra con tarjeta ni con Mercado Pago.** El modelo ya tiene los canales
  `MP_ONLINE` y `MP_POINT` previstos, pero Point sigue bloqueado a la espera de la
  confirmación escrita de Mercado Pago Uruguay sobre disponibilidad de la API para
  UYU.
- **No avisa por Telegram cuando entra un comprobante.** Se puede sumar al
  interruptor de avisos existente; no está hecho.
- **No exporta a planilla.** El tablero se mira, no se descarga.

---

## 7. Dónde está cada cosa

```
apps/api/src/modules/pagos/
  pagos.controller.ts        rutas; las de `mios` van ANTES que las de `:id`
  pagos.service.ts           el monto, la aprobación transaccional, el buscador
  comprobantes.service.ts    la dirección firmada de cinco minutos
  dto/pago.dto.ts            el nombre de archivo, los montos enteros, los filtros

apps/api/src/modules/tablero/
  tablero.controller.ts      una sola ruta, con @Roles(ADMIN) en la clase
  tablero.service.ts         los agregados y las dos consultas con AT TIME ZONE
  dto/tablero.dto.ts         desde/hasta como día de calendario

apps/cliente/src/paginas/Pagar.tsx        los tres pasos y el historial
apps/cliente/src/lib/comprobantes.ts      la subida directa al bucket

apps/admin/src/paginas/Pagos.tsx          listado, buscador, detalle, efectivo
apps/admin/src/paginas/Tablero.tsx        el resumen; el gráfico es SVG a mano

apps/api/test/pagos.spec.ts               29 pruebas
apps/api/test/tablero.spec.ts             22 pruebas
```

### Por qué el gráfico no usa una librería

Son dos series y un eje. Sumarle al panel una dependencia de gráficos por esto
cuesta más de lo que resuelve, en peso del bundle y en una cosa más que actualizar.

Un detalle que costó encontrar: las barras llevan **altura explícita** en su
contenedor (`h-32`). Un porcentaje solo se resuelve contra un alto definido, y con
`flex-1` las barras quedaban en cero y el gráfico salía en blanco **sin que fallara
ninguna prueba**, porque la prueba contaba columnas y no píxeles pintados. Ahora
mide el alto real.
