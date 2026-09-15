# Cuentas e invitaciones: quién puede entrar y cómo

Cómo llega una persona a tener acceso al sistema, qué la habilita y qué hacer
cuando algo no funciona.

---

## 1. La regla

**Nadie entra si la academia no lo invitó.** Un token válido de Supabase no
alcanza: la API exige, además, una **invitación vigente** emitida desde el panel.

### Qué pasaba antes, y por qué se cambió

El formulario de la app llamaba a `signInWithOtp()` sin apagar el alta de
usuarios. En `@supabase/auth-js` esa opción viene encendida por defecto:

```js
create_user: options?.shouldCreateUser ?? true,
```

Entonces **cualquier persona** que escribiera una dirección recibía el enlace,
entraba, y la API le creaba la cuenta con rol `CLIENTE` y **una ficha de alumno
vacía dentro del listado de la academia**. No había forma de distinguirla de un
alumno real.

Y aun para los alumnos de verdad, el vínculo entre la cuenta y la ficha se
**adivinaba por correo** después del hecho, lo que fallaba en silencio en tres
casos que pasan seguido en un mostrador:

| Situación | Qué pasaba |
|---|---|
| El alumno se cargó sin correo (el campo es opcional) | Nunca se podía vincular |
| Usa un correo distinto al que registró la academia | Ficha duplicada, sin aviso |
| Dos fichas con el mismo correo | Un `WARN` en el log del servidor y nada más |

### Cómo se cierra

Dos candados, y el que cuenta es el segundo:

1. **En la app**, `shouldCreateUser: false`. Evita que Supabase dé de alta la
   cuenta. Es código del navegador, así que por sí solo no protege nada: alguien
   puede llamar a Supabase sin pasar por la página.
2. **En la API**, `UsuariosService.resolverDesdeToken` solo aprovisiona la cuenta
   local si hay una invitación vigente para ese correo. Sin eso responde `403` y
   **no deja rastro**: ni cuenta, ni ficha.

La app sigue mostrando **el mismo mensaje** exista o no la cuenta, y también si
Supabase devuelve error. Si dijera «ese correo no está registrado», el formulario
serviría para averiguar quién es alumno de la academia probando direcciones.

---

## 2. La invitación

Una fila en `invitaciones` que dice **a quién** se invita, **con qué rol** y **a
qué ficha** queda atada.

Que la ficha esté dicha de antemano es todo el punto: el vínculo deja de
deducirse y funciona aunque haya dos fichas con el mismo correo, o aunque el
alumno no tuviera correo cargado y se lo escriban al invitarlo.

| Campo | Para qué |
|---|---|
| `email` | Siempre en minúscula. Un CHECK de la base lo obliga |
| `rol` | Con qué rol se crea la cuenta. **No se lee del token** |
| `clienteId` / `instructorId` | La ficha. Como mucho una de las dos |
| `estado` | `PENDIENTE`, `ACEPTADA` o `REVOCADA` |
| `enviadaAt` | Null = la fila existe pero **el correo no salió** |
| `aceptadaAt`, `aceptadaPor` | Quién la usó y cuándo |

### Reglas que hace cumplir la base, no solo el código

Están en la migración `20260913200000_invitaciones` porque una regla que solo
vive en el código se saltea desde una consola de SQL o desde un camino nuevo que
se olvide de llamarla:

- El correo se guarda en minúscula y no vacío.
- Una invitación pertenece **como mucho a una ficha**.
- Un alumno o instructor invitado trae su ficha; un administrador no tiene.
- **Una sola invitación pendiente por correo** (índice único parcial). Sin esto,
  invitar dos veces dejaría dos filas y el ingreso tomaría cualquiera, que es
  justo la ambigüedad que esta tabla viene a eliminar. Las aceptadas y revocadas
  se acumulan: son el historial.
- Una invitación aceptada tiene que decir cuándo y por quién.

### El rol no viaja por Supabase

Podría mandarse en `data` al invitar, pero eso aterriza en `user_metadata`, que
**el propio usuario puede editar**. El rol vive en esta base, que es la fuente de
verdad, igual que para todo lo demás.

---

## 3. Cómo se usa

### Dónde está el botón

En **Alumnos**, la columna «Cuenta» de cada fila sin acceso dice **«Dar acceso»**
y lleva directo a la sección correspondiente de la ficha. La acción también está
en la ficha, en **Acceso a la app**.

Estuvo un tiempo solo dentro de la ficha, y no la encontraba nadie: un cartel que
decía «Sin cuenta» y no llevaba a ninguna parte. Si no la encuentra quien conoce
el sistema, no la va a encontrar quien atiende el mostrador.

### Dos formas de entregar el acceso

| Botón | Qué hace | Cuándo |
|---|---|---|
| **Enviar enlace por WhatsApp** | Genera el enlace y abre WhatsApp con el mensaje escrito, al número de la ficha | La persona llegó por el sitio y estás hablando con ella por ahí |
| **Enviar por correo** | Supabase manda el correo con el enlace | Ya dejó su dirección y la mira |

**El envío por WhatsApp lo apretás vos.** `wa.me` abre la aplicación con el
mensaje listo, pero no lo manda solo. Mandarlo automáticamente requeriría la API
de WhatsApp Business —cuenta de empresa en Meta, plantillas aprobadas, un
proveedor y costo por mensaje—, que es un proyecto aparte.

### El correo hace falta igual

Supabase identifica la cuenta **por correo electrónico**. WhatsApp es por dónde
viaja el enlace, no quién es la persona. Por eso los dos botones quedan
bloqueados si la ficha no tiene correo, y la pantalla lo explica en vez de
dejarte adivinando.

Para que la identidad fuera el teléfono haría falta autenticación por SMS o por
WhatsApp Business: proveedor externo y costo por mensaje.

### El ciclo completo, desde el sitio

1. La persona navega el sitio y toca el botón de WhatsApp.
2. Escribe. En la conversación se le piden nombre y correo.
3. Se la da de alta en **Alumnos** con nombre, teléfono y correo. *Esa ficha ya
   es el registro del interesado*: no hace falta una bandeja de consultas aparte,
   un alumno sin documento cargado todavía es exactamente eso.
4. **Enviar enlace por WhatsApp**, y se aprieta enviar.
5. Entra, y su cuenta queda atada a esa ficha.

Desde la misma sección se puede **reenviar** —por el canal que sea— o **dar de
baja** el acceso mientras no se haya usado.

### El enlace va a una pantalla propia, no a la de Supabase

Esto no es estético: **es lo que hace que el enlace llegue vivo.**

La dirección de verificación que arma Supabase **se consume con una sola
visita**. Y los enlaces no los visita solo la persona:

- **WhatsApp los visita** para armar la tarjeta de vista previa del mensaje.
- **Los antivirus de correo los visitan** para revisarlos. Safe Links de Outlook
  es el caso más conocido.

Con el enlace de Supabase, esa visita gastaba el código. La persona lo tocaba
después y recibía *«el enlace es inválido o expiró»*, sin haberlo usado nunca.
Nos pasó en la primera prueba real por WhatsApp.

**La solución:** el enlace apunta a `/entrar` de la aplicación que corresponda, y
lleva el código adentro. Esa pantalla lo canjea **desde JavaScript**, con
`verifyOtp`. Los rastreadores de vista previa no ejecutan JavaScript, así que el
código les sobrevive. Es lo que recomienda la propia documentación de Supabase
para este problema.

Hay una prueba que lo comprueba de la forma que importa: **carga la página con
JavaScript apagado y verifica que no se haga ningún canje.**

La pantalla existe en las dos aplicaciones —la del alumno y el panel— porque se
invita a los dos lados. Y el correo usa el mismo camino: las plantillas arman la
dirección con `{{ .TokenHash }}` en vez de `{{ .ConfirmationURL }}`.

De yapa, el enlace se ve como de la academia y no como una dirección de Supabase.

### El enlace es una credencial

Quien lo tenga entra como esa persona. Por eso:

- **No se guarda en ningún lado.** Se genera, se devuelve una vez y se olvida. No
  está en la base, no se escribe en los registros del servidor y no viaja en el
  listado de invitaciones. Hay pruebas que lo comprueban.
- **La auditoría anota que se entregó y por dónde**, nunca el valor.
- **Vence y se usa una sola vez.** El plazo lo fija el proyecto de Supabase, no
  este código: hay que dejarlo en **24 horas** desde el panel de Supabase, en la
  configuración del proveedor de correo (la opción de expiración del enlace/OTP).
  **Este dato no se pudo verificar desde el entorno de desarrollo**, que no
  alcanza `supabase.co`: hay que mirarlo en el panel.
- **Antes de abrir WhatsApp se pide confirmación mostrando el número.** Mandarle
  el acceso de alguien a otra persona le entrega su cuenta, y el número es lo
  único que separa un caso del otro.

### El rol y la ficha tienen que ser del mismo lado

En **Cuentas** hay un desplegable de rol por fila. Sirve para **corregir un rol
mal puesto**, no para convertir a una persona en otra cosa.

Cambiarle el rol a «Instructor» a alguien que tiene **ficha de alumno** no lo
convierte en instructor: lo deja en una cuenta que no sirve para nada. Su app le
diría «tu usuario no está asociado a ningún instructor», y la del alumno lo
rechazaría por el rol. Sin salida y sin que nada avise qué pasó.

Por eso la API ahora lo rechaza, en las dos direcciones, y el mensaje dice cuál
es el camino bueno:

| Se intenta | Qué pasa |
|---|---|
| Rol `INSTRUCTOR` a quien tiene ficha de alumno | Se rechaza: «dalo de alta en Instructores y mandale el acceso desde ahí» |
| Rol `CLIENTE` a quien tiene ficha de instructor | Se rechaza: «registralo en Alumnos y mandale el acceso desde ahí» |
| Rol `ADMIN` a quien tiene cualquiera de las dos fichas | Se rechaza, y es anterior a este cambio |
| Cambiar el rol de una cuenta **sin ficha** | Se permite: es justo la que puede necesitar la corrección |

Una persona es instructor porque está dada de alta en **Instructores**, y alumno
porque está en **Alumnos**. El acceso se le manda desde su ficha.

### La invitación se exige UNA sola vez, no en cada ingreso

Vale la pena dejarlo escrito porque la duda aparece sola al ver que el enlace
vence a las 24 horas y se usa una vez: **eso rige para el primer ingreso**.

`resolverDesdeToken` (`apps/api/src/modules/usuarios/usuarios.service.ts`) busca
la fila del usuario en la base. Si **existe**, solo comprueba que esté activa y
deja pasar. La tabla `invitaciones` se consulta únicamente en `aprovisionar()`,
que corre cuando esa fila **todavía no existe**.

De ahí en más:

- La sesión se mantiene sola en las tres aplicaciones (`persistSession` y
  `autoRefreshToken` en el cliente de Supabase).
- Si igual se pierde, cada app tiene su `/ingresar`, que manda un enlace nuevo
  con `shouldCreateUser: false`: sirve para quien ya está habilitado y **no puede
  dar de alta a nadie**.

O sea que una cuenta se cierra dándola de baja o quitándole el acceso, **no**
dejando vencer su invitación: la invitación ya cumplió su función el primer día.
Ver [21-pwa-instructor.md](21-pwa-instructor.md), §3.

El teléfono se guarda como `+598 98663201` y `wa.me` quiere `59898663201`:
pasarle el guardado tal cual abre un chat con un número inexistente y sin ningún
error visible. La conversión está en `apps/admin/src/lib/whatsapp.ts`, y el botón
queda bloqueado cuando el teléfono no sirve.

### El orden de las operaciones

Primero se guarda la invitación, después se le pide a Supabase que mande el
correo. Al revés, si fallara el guardado, la persona recibiría un enlace que la
API va a rechazar y desde el panel no habría forma de darse cuenta.

Si falla el correo, la invitación **queda guardada** con `enviadaAt` en null y el
panel lo dice: *«pero el correo no salió. Probá reenviarla»*. Reintentar no
duplica nada: reenvía la misma.

---

## 3b. La pantalla de cuentas

**Panel → Cuentas.** Solo administración. Muestra quién puede entrar, con qué
permisos y desde cuándo, con la **ficha vinculada** de cada cuenta: sin eso la
lista sería una columna de correos sueltos sin forma de saber de quién es cada
uno.

Arriba, en ámbar, las **invitaciones sin usar**, con reenviar y dar de baja. Es
donde se ve de un vistazo a quién se invitó y todavía no entró, y cuáles
quedaron con el correo sin salir.

### Qué se puede hacer, y qué no

Desde la tabla se cambia el rol y se da de baja o se reactiva una cuenta. Dar de
baja **no borra nada**: la persona deja de poder entrar y su historial queda.

El botón **Invitar** es para quienes trabajan en la academia. **A los alumnos no
se los invita desde acá** sino desde su ficha, y el propio diálogo lo dice: ahí
está el dato que hace falta —a qué ficha pertenece la cuenta— y el correo ya
cargado.

### Tres cosas que la API no deja hacer

No son validaciones de formulario: las hace cumplir el servicio, así que tampoco
se saltean llamando a la API directamente.

| Bloqueo | Por qué |
|---|---|
| **Tocar la propia cuenta** | Quien quiere irse cierra sesión. Quien se equivoca acá se queda sin panel y sin forma de volver a entrar |
| **Sacar al último administrador activo**, por rol o por baja | Sin ningún administrador ya no se puede invitar a nadie, y la única salida sería entrar a la base a mano |
| **Ascender a ADMIN a alguien con ficha** de alumno o instructor | Esa cuenta vería los datos de todos los demás desde la ficha de uno |

En la pantalla, la fila propia aparece marcada con *(vos)* y sin el selector de
rol ni el botón de baja. Eso es cortesía; el que protege es el bloqueo del
servidor.

Cambiar un rol, dar de baja y reactivar quedan **en el registro de auditoría**,
con quién lo hizo y, en el caso del rol, el antes y el después.

---

## 3c. La configuración de Supabase, sin la cual nada de esto llega

El código arma el enlace y le dice a Supabase a dónde tiene que mandar a la
persona. Pero **Supabase puede descartar ese destino**, y lo hace en silencio.
Tres cosas hay que dejar bien en el panel, una sola vez.

### El destino: por qué un enlace terminaba en `localhost:3000`

Supabase solo obedece el `redirect_to` si esa dirección está en su **lista de
URLs permitidas**. Si no está, manda a la persona al **Site URL** del proyecto,
que de fábrica viene en `http://localhost:3000`. Nadie avisa: el correo sale, el
enlace parece bien, y quien lo toca aterriza en su propia computadora.

En **Authentication → URL Configuration** (buscar *Site URL* y *Redirect URLs*):

| Campo | Qué poner |
|---|---|
| **Site URL** | La dirección de la app del alumno |
| **Redirect URLs** | Las tres: la app del alumno, la del instructor y el panel |

Y en el servidor (Render), las variables que arman el `redirect_to`:

```
APP_ALUMNO_URL      la dirección de la app del alumno
APP_INSTRUCTOR_URL  la dirección de la app del instructor
APP_PANEL_URL       la dirección del panel
```

Cada rol cae en **su** aplicación: un alumno en la suya, un instructor en la
suya, y administración en el panel. Ver [21-pwa-instructor.md](21-pwa-instructor.md).

**Esto pasó de verdad, y conviene saber cómo se ve.** Un instructor recibió su
invitación y el enlace lo dejó dentro de la **app del alumno**, que lo saludó por
su nombre y le mostró «Tus clases de manejo». El correo salió bien y el enlace
funcionó: lo que falló fue que el destino de la app del instructor no estaba en
las *Redirect URLs*, así que Supabase lo descartó y usó el Site URL —la app del
alumno—. Nada en el servidor puede detectarlo: la API pidió el destino correcto y
Supabase respondió que todo salió bien.

Como no se puede detectar del lado del servidor, **se corrigió del lado del que
llega**: desde la Etapa 2.J las tres aplicaciones comprueban el rol y, a quien se
equivocó de puerta, le dicen cuál es la suya y le dan el enlace. La configuración
sigue siendo necesaria —sin ella el instructor tiene que dar un paso de más—,
pero ya no termina trabajando en la app equivocada sin enterarse.

Las dos listas tienen que coincidir. Si `APP_ALUMNO_URL` dice una cosa y la lista
de Supabase no la incluye, vuelve a pasar lo mismo.

**En producción, la API ya no deja mandar una invitación con un destino local:**
corta con un mensaje que nombra la variable que falta, en vez de generar un
enlace que no lleva a ninguna parte. En desarrollo `localhost` es lo normal y no
molesta.

### El correo: hace falta un servidor propio, y no es opcional

**Con la configuración de fábrica, a un alumno no le llega nada.** Esto no es un
detalle de terminación: es lo que separa un sistema que anda de uno que no.

Todo proyecto de Supabase trae un remitente incluido, pero está pensado para
probar, no para funcionar:

| Límite del remitente de fábrica | Qué significa acá |
|---|---|
| **Solo le escribe a las cuentas del equipo del proyecto** | La invitación a un alumno falla con *«Email address not authorized»*. Al dueño del proyecto sí le llega, y por eso el problema aparece recién cuando se invita a otra persona |
| **2 correos por hora** | Dos altas y el resto de la tarde esperando |
| **Las plantillas no se pueden editar** en proyectos nuevos del plan gratuito | Los correos quedan en inglés y sin identidad |

Las tres cosas se arreglan con lo mismo: **configurar un servidor de correo
propio (SMTP)**. Con eso, además, el correo sale desde la dirección de la
academia y no desde una de Supabase.

#### Cómo se configura

El paso a paso completo, con el proveedor que usa el proyecto (Brevo), está en
**[19-correo.md](19-correo.md)**. En resumen: se configura el servidor de correo
en **Authentication → Emails → Set up SMTP**, y recién ahí se habilitan las
plantillas. Pegar las dos:

| Archivo | Dónde se pega | Quién lo recibe |
|---|---|---|
| `invitacion.html` | **Invite user** | Alguien a quien la academia habilitó |
| `ingreso.html` | **Magic Link** | Quien ya tiene cuenta y pidió entrar |

Están en `infra/supabase/plantillas-correo/`. El detalle de por qué están
escritas con tablas y estilos en línea está en el README de esa carpeta.

#### Mientras tanto

Sin SMTP propio, el **botón de WhatsApp sigue funcionando igual**: ese camino
genera el enlace y no manda ningún correo, así que no lo tocan ninguno de los
tres límites de arriba. Es una salida razonable para arrancar, pero no reemplaza
la configuración: el ingreso desde la app —cuando alguien que ya tiene cuenta
pide su enlace— sí depende del correo.

### El plazo de validez

El enlace tiene que vencer, y el plazo lo fija el proyecto, no este código. Se
deja en **24 horas** en la configuración del proveedor de correo (la opción de
expiración del enlace u OTP).

> **Nada de esta sección se pudo verificar desde el entorno de desarrollo**, que
> no alcanza `supabase.co`. Después de dejarlo configurado, conviene mandarse una
> invitación a uno mismo y comprobar tres cosas: que el correo llegue en español,
> que el botón lleve a la app —no a `localhost`— y que se entre de una.

---

## 4. La puerta de arranque

`ADMIN_INICIAL_EMAIL` es **la única dirección que entra sin invitación**, y lo
hace como `ADMIN`. Hace falta en dos momentos, los dos en que todavía no hay
nadie que pueda invitar:

- La primera instalación.
- **Cuando se rehace el proyecto de Supabase.** Ahí cambian todos los
  identificadores de cuenta y el administrador que había queda sin poder entrar.

Se carga en el servidor (Render), nunca en un frontend. **Conviene vaciarla
después del primer ingreso:** mientras esté puesta, quien controle esa casilla de
correo puede crearse un administrador.

---

## 5. Si algo falla

| Lo que se ve | Qué es | Qué hacer |
|---|---|---|
| «Esta cuenta no está habilitada» | No hay invitación vigente para ese correo | Invitarlo desde su ficha |
| «el correo no salió» en el panel | La invitación se guardó pero Supabase no la mandó | Reenviar. Si sigue, revisar la configuración de correo del proyecto |
| «Supabase está limitando el envío» | Tope de correos del plan | Esperar unos minutos |
| «Supabase no llegó a completar el envío del correo (504)» | El envío se trabó, casi siempre en el servidor SMTP. **No es un rechazo**: el pedido estaba bien | Mirar *Logs → Auth* en Supabase, que dice el error exacto. Ver [19-correo.md](19-correo.md) |
| «Supabase no contestó en 60 segundos» | Lo mismo, pero ni siquiera llegó a contestar | Igual que el anterior |
| «Supabase no devolvió un enlace utilizable» | Ya no debería pasar: era un error de lectura de la respuesta, corregido | Si vuelve, revisar `supabase-admin.service.ts` |
| «Falta configurar APP_ALUMNO_URL…» | La variable no está cargada en el servidor | Cargarla en Render, ver más arriba |
| El enlace lleva a `localhost:3000` | El destino no está en las URLs permitidas de Supabase, y cayó en el Site URL | Ver «La configuración de Supabase» |
| El enlace lleva a la app de OTRO rol | Lo mismo: Supabase descartó el destino porque no está en sus *Redirect URLs*. Ojo con la **barra final**: la entrada tiene que ser idéntica al valor de `APP_*_URL` de Render | Ver «La configuración de Supabase» |
| La app queda en «No pudimos abrir tu cuenta» con un **404** | `VITE_API_URL` de esa app no termina en `/api/v1` | Ver [09-despliegue.md](09-despliegue.md) |
| Lo mismo pero con **403** | La cuenta no está habilitada, o el rol no corresponde a esa app | Ver «Quién puede entrar» |
| «Este enlace ya no sirve» al abrirlo | El código venció, ya se usó, o se generó otro después —cada enlace nuevo invalida el anterior— | Mandar uno nuevo desde la ficha |
| El correo llega en inglés | Las plantillas no se pueden editar sin SMTP propio | Ver «El correo: hace falta un servidor propio» |
| «Supabase no tiene permitido escribirle a esa dirección» | El remitente de fábrica solo le entrega al equipo del proyecto | Configurar SMTP propio |
| El correo le llega al dueño del proyecto pero no a un alumno | Lo mismo de arriba, visto desde el otro lado | Configurar SMTP propio |
| «Esa dirección ya tiene cuenta» | Ya existe el usuario | No hace falta invitar: entra con el enlace desde la app |
| «Ya hay una cuenta con ese correo registrada con otro identificador» | Se rehizo el proyecto de Supabase y la fila vieja apunta a una cuenta que ya no existe | Ver abajo |

### Rehacer el proyecto de Supabase

Los identificadores de cuenta (`usuarios.id`) son los de Supabase Auth. Si se
crea un proyecto nuevo, esos identificadores cambian y las filas viejas quedan
huérfanas. La API lo detecta y responde con un mensaje claro en vez de fallar con
un error de clave duplicada.

Para cada persona que tenía cuenta, en el **SQL Editor**, con el id nuevo que
figura en **Authentication → Users**:

```sql
UPDATE usuarios SET id = '<id nuevo de Supabase>' WHERE email = 'correo@ejemplo.com';
```

Las claves foráneas están en cascada, así que la ficha, la auditoría y las
invitaciones siguen apuntando a la misma persona.

Para el administrador, la alternativa más simple es cargar
`ADMIN_INICIAL_EMAIL`, entrar una vez, y borrar después la fila vieja.

---

## 6. Qué se verificó

| Qué | Resultado |
|---|---|
| 13 pruebas automáticas del ingreso por invitación | OK |
| Suite completa de la API | OK (158) |
| Un token válido sin invitación | `403`, y **no crea cuenta ni ficha** |
| Con dos fichas del mismo correo, vincula la que dice la invitación | OK |
| El rol sale de la invitación aunque el token diga `ADMIN` | OK |
| El nombre sale de la ficha, no queda vacío | OK |
| Invitación revocada, ya usada, o cuenta desactivada | Rechazadas |
| El correo se compara sin importar mayúsculas | OK |
| La puerta de arranque solo deja pasar a su dirección exacta | OK |
| Permisos: un alumno no puede invitar ni listar invitaciones | `403` |
| Invitar dos veces no duplica la invitación | OK |
| Invitar a alguien sin correo cargado | `400` con mensaje claro |
| Recorrido en el panel: invitar, reenviar, dar de baja | OK, sin errores de consola |
| La acción «Dar acceso» se ve en el listado y lleva a la sección | OK |
| Con correo y teléfono, los dos botones habilitados | OK |
| Sin teléfono: WhatsApp bloqueado, y la pantalla dice por qué | OK |
| Sin correo: los dos bloqueados, y explica que el correo identifica la cuenta | OK |
| El enlace no aparece en la base ni en el listado de invitaciones | OK |
| La base rechaza una entrega sin canal, o un canal sin entrega | OK |
| Un canal inventado | `400` |
| **Una visita sin JavaScript no consume el código** | OK — es lo que lo protege de la vista previa |
| Con el código bueno, la pantalla entra a la app | OK |
| Con el código quemado, explica en español y sin filtrar el mensaje de Supabase | OK |
| Los enlaces de las plantillas apuntan a `/entrar` y no a Supabase | OK |
| En producción, un destino `localhost` corta el envío nombrando la variable | OK |
| Con una dirección real, el envío sigue de largo | OK |
| En desarrollo, `localhost` no molesta | OK |
| Las dos plantillas de correo, a 600 px y a 390 px | Sin desbordes, sin texto en inglés, sin variables sin reemplazar |
| Un alumno listando o modificando cuentas | `403` |
| Un administrador tocando su propia cuenta | `400`, y sigue activo y ADMIN |
| Sacar al último administrador activo (por rol o por baja) | `409` |
| Ascender a ADMIN a alguien con ficha | `409` |
| El cambio de rol y las bajas quedan auditados | OK |
| Los parámetros que el panel manda de verdad al listado | `200` en todos |

**Lo que no se pudo verificar:** el envío real del correo y la generación real
del enlace. El entorno de desarrollo no alcanza `supabase.co`, así que la
invitación se guarda y la API informa que no pudo entregarla —que es exactamente
el comportamiento previsto para ese caso, pero no prueba que el correo llegue ni
que el enlace sirva—. Hay que probarlo en el sistema desplegado, mandándose una
invitación a uno mismo por los dos canales.
