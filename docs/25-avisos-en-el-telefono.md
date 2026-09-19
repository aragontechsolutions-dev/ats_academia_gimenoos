# Avisos en el teléfono del alumno

El alumno recibe una notificación en su teléfono el día antes y dos horas antes
de cada clase, aunque no tenga la app abierta.

Es la **Etapa 3.B**. Usa el mismo motor de recordatorios de la
[3.A](24-recordatorios.md): sólo se le agregó un canal.

---

## 1. Qué hace falta para que ande

**No hace falta ninguna cuenta ni ningún servicio de pago.** El navegador se
suscribe contra el servicio de su propio fabricante —Google, Mozilla, Apple— y
la API le manda el aviso firmado con un par de claves propias.

Lo único que hay que cargar son **tres variables en Render**:

```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT      mailto:contacto@academiagimenoos.com.uy
```

Se generan una vez con:

```
node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"
```

> ⚠️ **No se cambian nunca.** Rotarlas invalida **todas** las suscripciones y
> cada alumno tendría que volver a dar permiso desde su teléfono. No hay forma
> de migrarlas.

Sin las claves cargadas, la API arranca igual y la app le dice al alumno que los
avisos no están disponibles, en vez de fallar.

---

## 2. Cómo lo ve el alumno

**Nunca se le pide permiso al entrar.** Los navegadores rechazan el pedido que no
viene de un clic, y Chrome además penaliza al sitio que pregunta apenas carga.
Siempre hay un botón de por medio.

| Dónde | Cuándo aparece |
|---|---|
| **Mis clases** | Una sola vez, si todavía no se le preguntó **y** tiene una clase por delante. Ofrecerle recordatorios a quien no tiene nada agendado es ofrecerle algo que no le sirve |
| **Mi perfil** | Siempre, para prenderlo o apagarlo cuando quiera |

El aviso que recibe es corto a propósito:

> **Tenés clase mañana**
> Clase de auto mañana a las 14:00 con Marta Gómez.

Si llegan los dos —el de 24 horas y el de 2 horas—, **el segundo reemplaza al
primero** en vez de apilarse. Dos avisos de la misma clase en la pantalla es
ruido.

### En iPhone hay una condición

Safari admite estos avisos desde **iOS 16.4**, pero **sólo si la persona agregó
la app a la pantalla de inicio**. Abierta en el navegador, `PushManager` ni
siquiera existe.

Por eso el código pregunta «¿este navegador puede?» y no «¿qué navegador es?», y
cuando no puede lo dice con la salida concreta: agregar la app a la pantalla de
inicio y volver a entrar desde ahí.

---

## 3. Qué se manda, y qué no

| Aviso | Qué lleva |
|---|---|
| A la **academia**, por Telegram | Alumno, horario, instructor y **el teléfono del alumno** |
| Al **alumno**, a su teléfono | El tipo de clase, cuándo es y con quién |

Son deliberadamente distintos. El de la academia contesta «¿a quién llamo?»; el
del alumno contesta «¿cuándo tengo que estar?».

**El del alumno no lleva su teléfono ni ningún otro dato personal**, y hay una
prueba que lo verifica. El motivo es concreto: una notificación se ve en la
**pantalla bloqueada**, donde la puede leer cualquiera que tenga el teléfono en
la mano.

El contenido igual viaja **cifrado de punta a punta**: el servicio del fabricante
reenvía el paquete sin poder leerlo, porque sólo el navegador que se suscribió
tiene la clave.

---

## 4. Seguridad

**La dirección de suscripción es una credencial.** Es una URL del servicio del
navegador que apunta a *ese* teléfono; quien la tenga, junto con las claves VAPID
de la academia, puede mandarle notificaciones a esa persona. Por eso:

- No se devuelve en ningún endpoint ni se muestra en el panel.
- En los registros va **sólo el dominio** del servicio, nunca la dirección
  entera. Hay una prueba que lo verifica.

**El dueño de una suscripción sale de la sesión, nunca del cuerpo del pedido.**
Si viniera en el cuerpo, cualquiera con cuenta podría registrar un navegador a
nombre de otra persona y recibir sus avisos.

**Para darse de baja también se comprueba el dueño**: con la dirección de otra
persona no se puede dejar sin avisos a nadie.

**Una suscripción muerta se borra sola.** Cuando el servicio contesta 404 o 410
—la persona desinstaló la app, borró los datos del navegador o revocó el
permiso—, la fila se elimina. Si no, la tabla se llena de direcciones muertas y
cada recordatorio se convierte en una ronda de errores inútiles. Un error
pasajero (un 500, un corte de red) **no** borra nada.

**El endpoint de suscripción no lleva `@Roles`**, y es una decisión escrita:
cualquiera con cuenta puede registrar *su propio* navegador. No da acceso a
datos de nadie.

---

## 5. Decisiones que parecen detalles

**Le llega a todos sus dispositivos, no a uno.** No hay forma de saber cuál está
mirando. Quien tiene la app en el teléfono y en la computadora recibe en los dos.
Cuenta como enviado si llegó **al menos a uno**: que una de tres suscripciones
esté vencida no es un fallo del aviso.

**El aviso vence a las 4 horas.** Es lo que el servicio del navegador lo guarda
si el teléfono está apagado. Más allá de eso el recordatorio ya no sirve, y es
peor que aparezca tarde.

**La clave pública se sirve desde la API** (`GET /push/clave-publica`) en vez de
copiarse a una variable del frontend. Con dos copias, el día que se rote una
queda la otra vieja y las suscripciones dejan de funcionar sin que nadie entienda
por qué.

**Un aviso ilegible igual muestra algo.** Si llega algo con otra forma, el
service worker muestra un texto genérico propio. Sin eso, varios navegadores
muestran el suyo —«Este sitio se actualizó en segundo plano»—, que es peor.

**`navigator.serviceWorker.ready` no se rechaza nunca.** Si no hay ninguno
registrado se queda esperando para siempre, y una pantalla que depende de saber
el estado se queda en blanco sin decir nada. Hay un tope de 3 segundos, después
del cual se trata como «este navegador no puede». Pasa de verdad: en desarrollo
no hay service worker.

---

## 6. Qué se verificó

| | |
|---|---|
| El listener `push` del service worker | ✅ 8 comprobaciones, entregando mensajes reales por CDP contra el build de producción |
| Que el segundo aviso reemplace al primero | ✅ queda una sola notificación, no dos |
| Que un aviso ilegible o a medias igual muestre algo | ✅ |
| El flujo de suscripción en el navegador | ✅ 10 comprobaciones: que no se pida permiso al entrar, que se pida `userVisibleOnly`, que la clave llegue convertida a 65 bytes, y que el cuerpo enviado no lleve el id de nadie |
| El servicio de envío | ✅ 11 pruebas: sin claves, sin suscripciones, a varios dispositivos, y el borrado de las muertas |
| Que el alumno reciba además de la academia, con otro texto | ✅ en las pruebas del motor, contra la base real |

**No verificado:** una notificación entregada de punta a punta por el servicio
real de Google. Chromium en este entorno no puede crear una suscripción real
(«Registration failed - permission denied») porque no tiene conexión con FCM. Lo
que sí está probado es todo el camino de los dos lados: la app pide y registra
bien la suscripción, y el service worker muestra bien el aviso que le llega.

---

## 7. Un defecto que encontró probar esto

`llamarApi`, en las **tres** aplicaciones, llamaba siempre a `response.json()`.
Los endpoints que no tienen nada que devolver contestan **204 sin cuerpo**, y
`json()` sobre un cuerpo vacío lanza «Unexpected end of JSON input».

El efecto era exactamente el que no puede pasar: el alumno activaba los avisos,
**la suscripción se guardaba bien**, y la pantalla le decía que había fallado.
Corregido en las tres.

---

## 8. Dónde tocar

| Para… | Archivo |
|---|---|
| Cambiar el texto del aviso al alumno | `recordatorioParaElAlumno` en `modules/recordatorios/mensajes.ts` |
| Cambiar cómo se ve la notificación | `apps/cliente/src/sw.ts` |
| Cambiar dónde se ofrece o el texto de la oferta | `apps/cliente/src/componentes/AvisosDelTelefono.tsx` |
| Tocar el permiso o la suscripción | `apps/cliente/src/lib/avisosDelTelefono.ts` |
| Agregar los iconos de la notificación | `sw.ts`, marcado con `TODO(datos-reales)` |

---

> **Mientras `VAPID_PUBLIC_KEY` no esté cargada en Render**, la app no ofrece
> nada: no muestra la tarjeta de «¿Te avisamos antes de cada clase?» y no le pide
> permiso al navegador. Se comprueba abriendo
> `/api/v1/push/clave-publica`; si contesta `{"clave":null}`, falta cargarlas.
> Ver [`31-arreglos-pago-y-avisos.md`](31-arreglos-pago-y-avisos.md).
