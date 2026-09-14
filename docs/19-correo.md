# El correo: Brevo + Supabase, paso a paso

Cómo queda configurado el envío de correos del sistema, por qué cada pieza está
donde está, y qué cambia el día que la academia tenga dominio propio.

> **Ninguna credencial de este documento se pega en un chat ni se versiona.**
> La clave SMTP va del panel de Brevo al panel de Supabase, y de ningún otro
> lado. Si alguna vez se filtra, se regenera desde Brevo y se actualiza en
> Supabase: no hay nada más que tocar.

---

## 1. Por qué hace falta todo esto

El remitente que trae Supabase de fábrica **solo le escribe a las cuentas del
equipo del proyecto**, permite 2 correos por hora, y en el plan gratuito no deja
editar las plantillas. A un alumno no le llega nada. El detalle está en
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md).

La solución es un servidor de correo propio. Se eligió **Brevo** porque su plan
gratuito da 300 correos por día, que es mucho más de lo que una academia manda
—un puñado de invitaciones diarias—, y no exige dominio propio para arrancar.

---

## 2. El límite que hay que tener presente

**Hoy el sistema manda desde una dirección de Gmail, y eso tiene consecuencias
concretas.** No es un detalle estético:

| Qué pasa | Por qué |
|---|---|
| **El correo no sale desde la dirección de la academia** | Brevo no puede autenticar dominios gratuitos (gmail, yahoo…) y **reemplaza la dirección del remitente**. Al alumno le llega desde una dirección de Brevo |
| **A Hotmail, Outlook y Live probablemente no llegue** | Sin un dominio propio con DMARC, esos servicios marcan como spam o rechazan directamente. En Uruguay hay mucho Hotmail |
| El pie dice «Powered by Brevo» | Es el plan gratuito. Se saca pagando |

Los tres desaparecen con **un dominio propio autenticado**. Es el paso pendiente
más importante de esta parte del sistema, y está en el roadmap.

Mientras tanto, el camino por **WhatsApp no depende de nada de esto**: genera el
enlace sin mandar correo. Para un alumno con Hotmail, hoy es el camino confiable.

### Una cosa más que hubo que resolver para que el enlace llegue vivo

Los enlaces de acceso se consumen con **una sola visita**, y ni WhatsApp ni los
antivirus de correo esperan a que la persona los toque: los visitan ellos, para
armar la vista previa o para revisarlos. El enlace llegaba quemado.

Por eso el enlace apunta a una **pantalla propia del sistema**, que canjea el
código desde JavaScript —que esos rastreadores no ejecutan—. Está explicado en
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md); acá alcanza con
saber que **las plantillas de correo dependen de eso** y por eso no usan
`{{ .ConfirmationURL }}`.

---

## 3. Brevo

### 3.1. Verificar el remitente

**Senders, Domains & Dedicated IPs → Senders → Add a sender**, con la dirección
desde la que se manda. Brevo manda un correo de confirmación a esa casilla; hay
que abrirlo y confirmar. Sin eso rechaza los envíos.

### 3.2. Generar la clave SMTP

**Transactional → Email → Settings**, o el enlace *Open SMTP key settings* de la
pantalla de configuración. Generar una clave nueva y copiarla.

**Se muestra una sola vez.** Va directo al panel de Supabase.

### 3.3. Los datos que hacen falta

Están en **Transactional → Email → Real time → SMTP settings**:

| Dato | De dónde sale |
|---|---|
| Servidor | `smtp-relay.brevo.com` |
| Puerto | `587` |
| Usuario | El que muestra esa pantalla, con forma `xxxxxxxxx@smtp-brevo.com` |
| Clave | La clave SMTP del paso anterior |

El puerto 587 usa STARTTLS, que es lo que espera Supabase.

---

## 4. Supabase

### 4.1. El servidor de correo

**Authentication → Emails → Set up SMTP**, y activar *Enable Custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | La dirección verificada en Brevo |
| Sender name | `Academia Gimenoos` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | El usuario de Brevo (`…@smtp-brevo.com`) |
| Password | La clave SMTP |

### 4.2. El tope de envíos

**Authentication → Rate Limits.** Con servidor propio el tope pasa a ser
configurable; el de fábrica ronda los 30 por hora, que alcanza de sobra.

El límite que manda en la práctica es el de Brevo: **300 por día**, compartidos
entre correos transaccionales y campañas. La academia solo usa los primeros.

### 4.3. Las plantillas

Recién ahora se pueden editar. **Authentication → Emails**, y pegar:

| Archivo del repositorio | Plantilla | Asunto |
|---|---|---|
| `infra/supabase/plantillas-correo/invitacion.html` | **Invite user** | `Tu acceso a la app de Academia Gimenoos` |
| `infra/supabase/plantillas-correo/ingreso.html` | **Magic Link** | `Tu enlace para entrar · Academia Gimenoos` |

Supabase no lee esos archivos: hay que pegarlos a mano.

### 4.4. A dónde lleva el enlace

**Authentication → URL Configuration.** Sin esto el enlace cae en
`localhost:3000`, que es el valor de fábrica del *Site URL*:

- **Site URL**: la dirección de la app del alumno.
- **Redirect URLs**: la app del alumno **y** el panel.

### 4.5. Cuánto dura el enlace

En la configuración del proveedor de correo, la expiración del enlace u OTP:
**24 horas**.

---

## 5. Render

Las variables que arman el destino del enlace y la puerta de arranque:

```
ADMIN_INICIAL_EMAIL   el correo del administrador (vaciar tras el primer ingreso)
APP_ALUMNO_URL        la dirección de la app del alumno
APP_INSTRUCTOR_URL    la dirección de la app del instructor
APP_PANEL_URL         la dirección del panel
```

`APP_ALUMNO_URL` y `APP_PANEL_URL` tienen que coincidir con lo cargado en las
*Redirect URLs* de Supabase. Si no coinciden, Supabase descarta el destino y
manda al *Site URL* sin avisar.

---

## 6. Cómo se comprueba que quedó bien

El error más caro de esta parte es probar con la propia casilla: **al dueño del
proyecto siempre le llegó, incluso antes de configurar nada.** La prueba que vale
es a otra dirección.

1. Crear un alumno de prueba con **una dirección que no sea la del equipo del
   proyecto** —la de un familiar, otra casilla propia—.
2. Invitarlo **por correo** desde su ficha.
3. Comprobar cuatro cosas:
   - Que llegue.
   - Que esté **en español** y con los colores del sistema.
   - Que el botón lleve a la app, **no a `localhost`**.
   - Que al tocarlo se entre de una.
4. Repetir **por WhatsApp**, que no usa correo y debería seguir funcionando.
5. Si la dirección de prueba es de Hotmail u Outlook y no llega, **es lo
   esperado** mientras no haya dominio propio. Revisar la carpeta de spam.

Si algo falla, la tabla de errores de
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md) dice qué significa
cada mensaje.

---

## 7. Cuando el envío no se completa (504)

Este es el error que apareció en la primera prueba con SMTP propio, y conviene
saber leerlo porque los dos números que se ven **no son dos problemas**:

| Dónde se ve | Qué dice | Qué es |
|---|---|---|
| Consola del navegador | `POST .../reenviar 503` | El **nuestro**. La API contesta 503 cuando no puede completar algo que depende de un servicio de afuera |
| Registro del servidor | `Supabase respondió 504 al invitar: upstream request timeout` | El **de Supabase**. Su portón de entrada se cansó de esperar a que Auth le contestara |

Un **504** no es un rechazo: el pedido estaba bien, lo que pasó es que del otro
lado no se completó a tiempo. Por eso el mensaje ya no dice «Supabase rechazó la
invitación» —decía eso antes, y mandaba a revisar el pedido, que era justamente
lo que no estaba fallando—.

### Por dónde empezar

Al mandar la invitación, **lo único que depende de un servicio de afuera es el
servidor SMTP**: Supabase Auth se queda esperando el envío del correo y, si esa
conversación no avanza, el portón corta con 504. Ahí es donde hay que mirar:

1. **El registro de Auth en Supabase** (*Logs → Auth*). Es el único lugar que
   dice el error exacto del SMTP: credenciales rechazadas, remitente no
   verificado, puerto que no contesta. Todo lo demás es adivinar.
2. **Authentication → Emails**, la configuración de SMTP: que el servidor sea
   `smtp-relay.brevo.com`, el puerto `587`, el usuario el login de Brevo
   (`xxxxx@smtp-brevo.com`, **no** el correo propio) y la contraseña **la clave
   SMTP** de Brevo, que no es la clave de la API ni la de la cuenta.
3. **En Brevo, que el remitente esté verificado.** Si no lo está, Brevo rechaza
   el envío.
4. **Que la cuenta de Brevo esté habilitada para transaccional.** Las cuentas
   nuevas pueden quedar en revisión, y mientras tanto el envío no sale.

Si el registro de Auth no muestra nada de SMTP, entonces era un problema
puntual del lado de Supabase y alcanza con reintentar.

### Dos cosas que conviene tener presentes

**La cuenta puede haber quedado creada igual.** Un corte a mitad de camino no
dice si Supabase alcanzó a crear el usuario antes de trabarse con el correo. Por
eso, al reintentar, el mensaje puede pasar a ser *«esa dirección ya tiene
cuenta»*: no es un problema nuevo, es el rastro del intento anterior. Desde ahí,
el enlace por WhatsApp sirve igual.

**El enlace por WhatsApp no pasa por el correo.** Usa otro camino de Supabase,
que solo devuelve el código y no manda nada. Así que mientras el SMTP esté
trabado, ese botón sigue siendo la forma de dar acceso.

---

## 8. El día que haya dominio propio

Es el cambio que mejora todo lo de la sección 2, y no toca nada del código.

1. Comprar el dominio (`academiagimenoos.com.uy`, por ejemplo) y tener acceso a
   sus DNS.
2. En Brevo, **Senders, Domains & Dedicated IPs → Domains → Authenticate**.
   Brevo entrega tres registros para cargar en el DNS: el suyo propio, DKIM y
   DMARC. Se copian y pegan; no afectan al sitio web.
3. Esperar a que Brevo los dé por válidos.
4. Crear un remitente del estilo `no-responder@academiagimenoos.com.uy`.
5. En Supabase, cambiar el **Sender email** por esa dirección. Nada más.

Desde ahí el correo sale a nombre de la academia y llega a Hotmail y Outlook como
corresponde.
