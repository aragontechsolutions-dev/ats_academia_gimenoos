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

### El alumno llega a la academia

1. Se lo da de alta en **Alumnos**, con su correo.
2. En su ficha, **Acceso a la app → Invitar a la app**.
3. Le llega un correo con un enlace. Al tocarlo entra ya vinculado a su ficha.

Desde la misma sección se puede **reenviar** o **dar de baja** la invitación
mientras no se haya usado.

### El alumno llega por el sitio

El sitio no ofrece registro: consulta por WhatsApp, la academia lo registra y lo
invita. Es el mismo camino que arriba.

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
| Un alumno listando o modificando cuentas | `403` |
| Un administrador tocando su propia cuenta | `400`, y sigue activo y ADMIN |
| Sacar al último administrador activo (por rol o por baja) | `409` |
| Ascender a ADMIN a alguien con ficha | `409` |
| El cambio de rol y las bajas quedan auditados | OK |
| Los parámetros que el panel manda de verdad al listado | `200` en todos |

**Lo que no se pudo verificar:** el envío real del correo. El entorno de
desarrollo no alcanza `supabase.co`, así que la invitación se guarda y la API
informa que no pudo enviarla —que es exactamente el comportamiento previsto para
ese caso, pero no prueba que el correo llegue—. Hay que probarlo en el sistema
desplegado, invitando a una dirección propia.
