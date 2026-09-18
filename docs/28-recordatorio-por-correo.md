# El recordatorio por correo

El tercer y último canal de los recordatorios de clase. Con esto, la **Etapa 3
queda cerrada**: la academia se entera por Telegram, el alumno recibe una
notificación en su teléfono, y también un correo.

---

## 1. Por qué no sale por el mismo camino que la invitación

Los correos de **invitación** y de **ingreso** los manda Supabase Auth, y Auth
solo sabe mandar los suyos: una invitación, un enlace de acceso, un cambio de
contraseña. Un recordatorio de clase no es ninguno de esos.

Así que sale desde la API, hablando SMTP directamente **contra el mismo servidor
que ya tiene configurado la academia** (Brevo). Que sea el mismo no es
casualidad: el dominio ya está autenticado ahí, así que estos correos heredan la
reputación de los que ya llegan bien.

### Lo que hay que cargar

Las mismas credenciales de Brevo que ya están en Supabase, ahora también en
Render:

```
SMTP_HOST       smtp-relay.brevo.com
SMTP_PUERTO     587
SMTP_USER       (el que da Brevo)
SMTP_PASSWORD   (la clave SMTP de Brevo)
SMTP_DESDE      Academia Gimenoos <no-responder@tudominio.com>
```

Sin esto, la API arranca igual y simplemente no manda correos.

> **El plan gratuito de Brevo da 300 correos por día.** Cada clase genera hasta
> dos recordatorios por correo, así que con 20 clases diarias son 40 correos —
> muy lejos del tope. Vale tenerlo en cuenta si algún día crece mucho.

---

## 2. La baja de suscripción no es opcional

Es la parte más importante de esta etapa, y la que no se podía dejar para
después.

**Un correo llega sin que nadie lo haya pedido.** El push se activa dando
permiso y se apaga quitándolo; el correo, no. Y quien no encuentra cómo dejar de
recibirlo **lo marca como spam** — lo que ensucia la reputación del dominio para
*todos* los correos de la academia, invitaciones incluidas.

Por eso hay tres formas de darse de baja:

| Dónde | Cómo |
|---|---|
| **El botón del cliente de correo** | La cabecera `List-Unsubscribe` hace que Gmail y Outlook muestren su propio botón arriba del mensaje |
| **El pie del correo** | «Dejar de recibir estos avisos» |
| **Su perfil, en la app** | Una casilla que se guarda sola |

### Por qué el enlace lleva a una pantalla con un botón

Y no da de baja directamente.

Los antivirus de correo **visitan los enlaces antes que la persona** —Safe Links
de Outlook es el caso típico—. Con una baja por simple visita, darían de baja a
medio padrón sin que nadie tocara nada. Es el mismo problema que ya quemó los
enlaces de invitación (ver [`19-correo.md`](19-correo.md)).

Entonces: el enlace abre una pantalla de la app del alumno, y ahí hay un botón
que hace el `POST`. Hace falta un clic de verdad.

Esa pantalla **funciona sin haber iniciado sesión**, a propósito: quien abre un
correo no necesariamente tiene la app abierta, y obligarlo a entrar para dejar de
recibir correos es la forma más rápida de que lo marque como spam.

### Por qué NO se declara `List-Unsubscribe-Post`

Esa cabecera le promete al cliente de correo que puede dar de baja con un `POST`
a esa misma dirección. La nuestra es una pantalla de la app, no un endpoint: el
`POST` no haría nada y **la persona se quedaría creyendo que se dio de baja**.

Sin esa cabecera, el botón del cliente de correo abre la pantalla en el
navegador. Es un paso más, pero funciona de verdad. Hay una prueba que comprueba
que la cabecera no esté.

### El token

Cada alumno tiene el suyo, un UUID que genera Postgres. Viaja en el enlace de
cada correo.

- **Solo sirve para esto.** No da acceso a ningún dato ni a ninguna otra acción.
- **Se puede invalidar de a uno**: cambiarlo corta los enlaces viejos de esa
  persona sin tocar los de nadie más.
- **No va en la ficha que devuelve la API.** Solo tiene sentido dentro del enlace
  de un correo, y un dato que no se usa en pantalla es un dato que se puede
  filtrar.

Un token que no existe devuelve **204, no 404**: un 404 le confirmaría a quien
probara tokens al azar cuáles son válidos, y además le mostraría un error a
alguien que simplemente tocó dos veces el mismo enlace.

---

## 3. Cómo está escrito el correo

Con las mismas reglas que las plantillas de Supabase
(`infra/supabase/plantillas-correo/`), y por los mismos motivos: los clientes de
correo descartan las hojas de estilo y no entienden flexbox ni grid, así que
**todo el estilo va en línea y la estructura en `<table>`**, con 600 px de ancho
máximo.

**Va en HTML y en texto plano.** No es un extra: hay clientes que solo muestran
el texto, y los filtros de spam desconfían de un correo que solo trae HTML. Hay
una prueba que comprueba que los dos digan lo mismo.

**La frase de la fecha la arma `mensajes.ts`, no el correo.** Los tres canales
tienen que decir exactamente lo mismo; si el correo armara su propia frase, tarde
o temprano una diría «mañana» y la otra «el mié 18», sobre la misma clase.

---

## 4. Cuándo NO se manda

Además de las [reglas generales](24-recordatorios.md#3-cuándo-sale-un-recordatorio):

| Situación | Qué pasa |
|---|---|
| El alumno se dio de baja | No se manda, y **no queda anotado** |
| No tiene correo cargado | Ídem |
| No hay SMTP configurado | Ídem |

Que no quede anotado importa: si mañana carga su correo, o la academia configura
el SMTP, el recordatorio de las clases que siguen pendientes sale igual. Solo se
anota lo que **se intentó**.

---

## 5. Qué se verificó

| | |
|---|---|
| El canal de correo, contra la base real | ✅ 8 pruebas: que salga con su texto, el enlace de baja en HTML y en texto, que no se mande a quien se dio de baja ni a quien no tiene correo, que no llegue dos veces, y que cada alumno reciba **su** enlace y no el de otro |
| La cabecera `List-Unsubscribe-Post` ausente | ✅ con prueba propia |
| La baja, sobre HTTP real | ✅ token real → se da de baja; dos veces → 204 sin error; token inventado → 204 sin revelar si existe; texto que no es UUID → 400; **los otros 11 alumnos intactos** |
| Cómo se ve el correo | ✅ revisado a 700 px y a 390 px |

**No verificado:** un correo entregado de verdad. Este entorno no alcanza el
servidor de Brevo. Lo que sí está probado es todo el camino hasta la entrega al
SMTP, y el correo renderizado.

Para comprobarlo de punta a punta: cargar las variables en Render, agendar una
clase para mañana desde el panel y esperar a que corra el disparador — o
ejecutarlo a mano desde la pestaña **Actions** de GitHub.

---

## 6. Dónde tocar

| Para… | Archivo |
|---|---|
| Cambiar el texto o el diseño del correo | `modules/recordatorios/correo-recordatorio.ts` |
| Cambiar cómo se conecta al servidor SMTP | `common/correo/correo.service.ts` |
| Cambiar la pantalla de baja | `apps/cliente/src/paginas/Avisos.tsx` |
| Mandar otro correo desde la API | Inyectar `CorreoService` y llamar a `enviar()` |
