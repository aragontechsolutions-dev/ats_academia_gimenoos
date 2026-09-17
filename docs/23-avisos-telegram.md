# Avisos por Telegram

La academia se entera al instante de lo que pasa —una clase agendada, una
cancelada, alguien que va a escribir por WhatsApp— sin tener que entrar al panel
a mirar.

---

## 1. Cómo ponerlo a andar

Son cuatro pasos. **Tres son inevitables**: no es una limitación de este sistema
sino de cómo funciona Telegram.

### Paso 1 — Crear el bot (en Telegram, no acá)

Abrí Telegram, buscá **@BotFather** y mandale `/newbot`. Te va a pedir un nombre
y un usuario. Al final te entrega un **token**, así:

```
1234567890:AAEabcdefghijklmnopqrstuvwxyz0123456
```

> No existe forma de crear un bot desde el panel. BotFather es un chat con una
> cuenta humana de Telegram y no hay API para eso.

### Paso 2 — Cargar el token en el servidor

En **Render → el servicio de la API → Environment**, agregá:

```
TELEGRAM_BOT_TOKEN = 1234567890:AAE...
```

y volvé a desplegar.

**Por qué acá y no en el panel.** El token es una credencial: quien lo tenga
puede escribir como el bot y leer lo que el bot recibe. En la variable de
entorno no entra a la base de datos, así que no viaja en los respaldos ni queda
al alcance de un volcado. El panel **nunca** ve el token: sólo sabe si hay uno.

### Paso 3 — Hablarle al bot una vez

Quien vaya a recibir los avisos tiene que abrir el chat del bot en Telegram y
mandarle **`/start`**. Si querés que lleguen a un grupo, agregá el bot al grupo y
escribí cualquier cosa ahí.

> Este paso tampoco se puede saltear. Telegram **prohíbe que un bot le escriba
> primero** a alguien que nunca lo contactó. Esa conversación inicial es lo que
> lo habilita.

### Paso 4 — Elegir el destino, en el panel

Panel → **Avisos** → **Buscar conversaciones**. Aparecen por nombre —«Henry
Gimeno», «Avisos Academia»— y elegís una. Después, **Mandar un mensaje de
prueba** para confirmar.

Ese botón existe porque el identificador de un chat es un número que no se ve en
ningún lado de la aplicación de Telegram. Sin esto hay que ir a buscarlo con otro
bot o leyendo la respuesta cruda de la API, que es justo donde la gente
abandona.

---

## 2. Qué se avisa

Cada uno se prende y se apaga por separado desde el panel. Apagar corta el aviso
**en el momento**, sin tocar nada del servidor.

| Aviso | Cuándo |
|---|---|
| **Clase agendada** | Un alumno reserva desde su app, o se agenda desde el panel. Distingue cuál de los dos: la del alumno queda pendiente de confirmar |
| **Clase cerrada** | El instructor la marca como dictada, o marca que el alumno no vino |
| **Clase cancelada** | La cancele quien la cancele, con el motivo si lo hay |
| **Alguien va a escribir por WhatsApp** | Alguien toca un botón de WhatsApp en el sitio. Dice **desde qué sección** |

Confirmar una clase **no** avisa: es movimiento interno y quien recibiría el
aviso es justamente quien acaba de confirmarla.

### Las ocho secciones del sitio

El aviso de WhatsApp dice de dónde salió, porque eso contesta qué parte de la
página trae consultas:

`Portada` · `Menú de arriba` · `Modalidades` · `Planes y precios` ·
`Cierre de la página` · `Pie de página` · `Botón flotante` ·
`Formulario de contacto`

La sección es una **lista cerrada** en la API. Un botón nuevo que no esté
declarado no puede avisar, y eso se comprueba en las pruebas del navegador: se
tocan todos los botones de WhatsApp de la página y tienen que cubrir las ocho.

---

## 3. Qué sale del sistema, exactamente

Esto importa: Telegram es un servicio de afuera, y lo que se le manda sale de la
academia.

| Aviso | Qué lleva |
|---|---|
| Clase agendada / cerrada / cancelada | Nombre y apellido del alumno y del instructor, fecha y hora, y el motivo si se canceló |
| Clic de WhatsApp | La sección, la hora, si fue de celular o computadora, y el **dominio** de la página de la que venía |

**Lo que NO sale, en ningún caso:** cédula, teléfono, correo, dirección,
identificadores internos, ni nada de quien visita el sitio.

Hay una prueba automática que lo verifica sobre los tres avisos de agenda
(`avisos-telegram.spec.ts`). Si alguien agrega un dato personal a un aviso, esa
prueba falla primero.

**El formulario de contacto es un caso aparte.** El sitio promete, en letra
grande, que no guarda los datos de quien escribe. El aviso respeta esa promesa:
avisa que alguien va a escribir, y **no manda el nombre, el motivo ni el
mensaje**.

---

## 4. Decisiones de diseño

**Un aviso nunca puede romper la operación que lo disparó.** Si Telegram está
caído, la clase igual se agenda. `avisar()` no devuelve error ni lo propaga: lo
registra y sigue. Se llama sin `await` desde donde ocurre el hecho.

**El botón «probar» sí falla.** Es la excepción, y por el motivo opuesto: quien
lo apretó está esperando la respuesta y necesita el motivo exacto («chat not
found», «bot was blocked by the user»).

**Cinco segundos de espera y se corta.** Al revés que el envío de correo, que
tiene sesenta. Lo que no puede pasar es que reservar una clase tarde diez
segundos porque Telegram está lento.

**Los avisos van en HTML y todo lo variable se escapa.** Un apellido con `<`
rompería el mensaje y Telegram lo rechazaría con un 400; algo armado a propósito
podría meter un enlace. `escaparHtml` se aplica a cada dato que viene de la base.

**El identificador del chat se guarda como texto.** El de un grupo es negativo y
puede pasar de 2^53; como número, JavaScript lo redondearía en silencio y los
avisos irían a ninguna parte.

**La tabla vive aparte de `ConfiguracionAcademia`.** Esa tabla la lee el endpoint
**público** de la landing. Con el destino de los avisos adentro, cualquier campo
nuevo que alguien agregara al select público se filtraría sin que nadie lo note.

---

## 5. Seguridad

**El endpoint del clic de WhatsApp es público**, como todo lo que consume el
sitio. Eso trae un riesgo real y conocido: **cualquiera que lo descubra puede
hacer sonar el teléfono de la academia.** Se acota por tres lados:

1. **Un límite propio de 6 por minuto y por IP**, mucho más estrecho que el
   general de la API. Nadie toca el botón de WhatsApp diez veces por minuto.
2. **La sección es una lista cerrada** y el resto del mensaje lo arma el
   servidor. Nadie puede elegir qué dice el aviso.
3. **El interruptor del panel lo apaga en el momento**, sin desplegar nada.

Lo que esto **no** frena: alguien decidido, con muchas direcciones IP, puede
igual generar avisos. La defensa ahí es el interruptor. Si algún día pasa, se
apaga ese aviso y los otros tres siguen andando.

**El referrer se recorta al dominio.** Llega entero desde el navegador —o sea,
lo elige quien visita— y podría traer cualquier cosa en la ruta o en la consulta.
La API se queda sólo con el dominio: acorta el aviso y descarta lo que venga
colgado.

**El dispositivo lo decide el servidor**, mirando el `User-Agent` que ya viaja en
la petición, y no un campo que el navegador podría inventar.

**Todo lo del panel es de ADMIN.** No hay un solo endpoint público en
`/avisos/telegram`: quién recibe los avisos de la academia no es un dato del
sitio. Cambiar el destino queda en auditoría (`AVISOS_TELEGRAM_ACTUALIZADOS`),
porque cambia a dónde sale información.

---

## 6. Si deja de andar

El panel, en **Avisos → Si está andando**, muestra la fecha del último aviso que
salió bien y el último fallo con el motivo que dio Telegram. Sin eso, un bot
bloqueado o un grupo borrado se ven igual que «hoy no pasó nada».

| Lo que dice Telegram | Qué pasó |
|---|---|
| `chat not found` | Se borró el chat, o el bot salió del grupo |
| `bot was blocked by the user` | Quien recibía los avisos bloqueó al bot |
| `Forbidden: bot is not a member` | Lo sacaron del grupo |
| `no contestó en 5 segundos` | Telegram lento o sin red. Se reintenta solo en el próximo aviso |

Si «Buscar conversaciones» no trae nada: Telegram sólo devuelve lo de las
**últimas 24 horas**. Mandale `/start` al bot de nuevo y volvé a buscar.

---

## 7. Dónde tocar

| Para… | Archivo |
|---|---|
| Agregar un aviso nuevo | `common/telegram/telegram.service.ts` (`ClaseDeAviso` e `INTERRUPTOR`), una columna en `AvisosTelegram`, y un renglón en `INTERRUPTORES` del panel |
| Cambiar el texto de un aviso de agenda | `modules/agenda/avisos-de-agenda.ts` |
| Cambiar el texto del aviso de WhatsApp | `modules/landing/contacto.ts` |
| Agregar una sección del sitio | `SeccionDeContacto` y `NOMBRE_DE_SECCION` en `dto/contacto-whatsapp.dto.ts`, más el tipo en `apps/landing/src/lib/api.ts` |
| Cambiar el límite de peticiones | El `@Throttle` de `contactoWhatsApp` en `landing.controller.ts` |

Al conectar un botón de WhatsApp nuevo en el sitio: usar `useContactoWhatsApp(seccion)`
o `useDestinoPrincipal(seccion)` y **pasar el `onClick` que devuelven** al enlace.
Sin eso el botón funciona pero no avisa, que es exactamente el error que las
pruebas del navegador encontraron la primera vez.
