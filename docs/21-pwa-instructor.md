# La app del instructor

Una aplicación aparte, `apps/instructor`, para que el instructor haga su trabajo
desde el teléfono **sin entrar al panel**.

---

## 1. Por qué una app y no una pantalla más del panel

El panel es una herramienta de escritorio: tablas anchas, formularios largos,
la agenda de todos. El instructor no necesita nada de eso. Necesita saber, parado
al lado del auto y con una mano, **quién viene ahora y a qué hora**.

Y hay una segunda razón, que es la que decide: el panel da acceso a la gestión
de la academia. Aunque hoy cada endpoint acota lo que devuelve según el rol,
dejar a un instructor dentro del panel significa que cualquier pantalla nueva
que se agregue ahí queda, por omisión, a un paso suyo. Con dos aplicaciones
distintas, lo que no está en la suya no se le muestra nunca.

---

## 2. Qué hace hoy

| Pantalla | Para qué |
|---|---|
| **Ingreso** | Enlace por correo, sin contraseña. Igual que la app del alumno |
| **Mi agenda** | Las clases de un día: hora, alumno, vehículo, dónde es el encuentro |
| **Cerrar la clase** | Marcarla como dictada, o al alumno como ausente |
| **Anotar cómo fue** | Una observación por clase, que el alumno **no** ve |

De cada clase se puede **llamar al alumno o escribirle por WhatsApp** con un
toque: es lo que hace falta cuando alguien no aparece en el punto de encuentro.

### Cerrar la clase

Dos botones en cada clase: **Dictada** y **Faltó**.

Aparecen **solo cuando la clase ya empezó**. Antes de la hora no hay nada que
informar —no se sabe si se dio ni si el alumno vino— y un botón de más en la
pantalla es un error caro: marcarla como dictada **descuenta una clase del pack
del alumno**, y deshacerlo requiere a alguien de administración.

Por lo mismo, **pide confirmación**. Desde el teléfono un botón se toca sin
querer, y la pregunta es distinta según el caso: «¿La clase se dio?» y «¿El
alumno no vino?». Lo que se responde no es lo mismo.

Marcar **ausente no descuenta** nada: solo se consume una clase cuando de verdad
se dio. Descontarla igual sería cobrarle al alumno una clase que no tuvo.

Si la API rechaza el cambio —por ejemplo, porque el pack ya no tiene clases—, el
motivo se muestra en la misma tarjeta y se puede reintentar.

### Anotar cómo fue la clase

Una observación por clase: qué practicaron, qué le cuesta, qué conviene ver la
próxima. Se puede escribir desde que la clase empezó, **también en las ya
cerradas**: lo más común es anotar justo después de terminar, y a veces al día
siguiente.

**El alumno no la ve, y eso no lo decide la pantalla.** La API elige los campos
según el rol de quien consulta, y `notaInstructor` no entra en los que recibe un
`CLIENTE`: el dato no sale de la base para él. Hay una prueba que lo comprueba en
el listado y en el detalle, y que además verifica que el instructor **sí** la
recibe —si no, la prueba pasaría sin probar nada—.

El formulario lo dice igual, porque quien escribe tiene que saber para quién está
escribiendo: *«Esto lo ve la academia, no el alumno»*.

Vaciar el texto borra la observación. La academia la lee desde el panel, en el
detalle de la clase.

#### Dos observaciones distintas, con nombre

En la misma tarjeta pueden convivir dos textos, y sin decir de quién es cada uno
se confunden:

| Campo | Quién la escribe | ¿La ve el alumno? |
|---|---|---|
| `observaciones` — «De la academia» | Administración, al agendar | **Sí** |
| `notaInstructor` — «Cómo fue» | El instructor que dio la clase | **No** |

Por eso son dos columnas y no una, y por eso las dos llevan etiqueta en pantalla.

**Un día por vez, no una semana.** La semana completa es una vista de escritorio
y vive en el panel. Acá se navega con dos flechas y un atajo de «volver a hoy».

Las clases **canceladas y ya cerradas no se esconden**: van al final, bajo su
propio título. Si un alumno aparece igual, el instructor tiene que poder ver que
esa clase se dio de baja.

---

## 3. Cómo entra un instructor

El circuito es el mismo que el del alumno, con una diferencia que importa:

```
Panel → Cuentas → Invitar instructor
   → correo o WhatsApp con el enlace
   → https://<app del instructor>/entrar?token_hash=…
   → la app canjea el código y queda adentro
```

**Antes, esa invitación llevaba al panel.** Era el único lugar donde el
instructor podía trabajar. Ahora cada rol tiene su destino:

| Rol | Variable del servidor | A dónde cae |
|---|---|---|
| `CLIENTE` | `APP_ALUMNO_URL` | La app del alumno |
| `INSTRUCTOR` | `APP_INSTRUCTOR_URL` | **Esta app** |
| `ADMIN` | `APP_PANEL_URL` | El panel |

Las tres variables tienen que estar cargadas en Render **y** las tres
direcciones tienen que figurar en las *Redirect URLs* de Supabase. Si una queda
sin cargar, la API corta el envío en vez de mandar a alguien a su propia
computadora; eso ya estaba y sigue igual.

---

## 4. Quién puede entrar

La app comprueba el **rol**, no solo que haya sesión. Es distinto de lo que hace
la app del alumno, que solo pide sesión, y hace falta por un motivo concreto: las
tres aplicaciones usan las mismas cuentas de Supabase. Un alumno que llegue a
esta dirección tiene sesión válida y pasaría el control, para encontrarse con una
agenda vacía y sin ninguna explicación.

En su lugar se le dice **qué cuenta tiene y a dónde tiene que ir**, con un botón
para salir. Sin callejones sin salida.

Como siempre: **el rol se le pregunta a la API**, que lo lee de la base. Nunca se
confía en lo que diga el token del navegador. Y esto es comodidad de interfaz,
no control de seguridad: la autorización real la aplica la API, que acota cada
consulta al rol de quien la hace.

---

## 5. Lo que la API le muestra a un instructor

No hizo falta tocar nada: ya estaba acotado.

| Consulta | Qué devuelve |
|---|---|
| `GET /agenda/reservas` | **Solo su propia agenda.** Un `instructorId` ajeno en la consulta se ignora |
| `GET /agenda/reservas/:id` | Solo si la clase es suya; si no, 403 |
| Ficha de un alumno | Nombre, apellido, teléfono, correo y ciudad. **No** el documento, ni la fecha de nacimiento, ni la dirección, ni las notas internas |
| `PATCH /agenda/reservas/:id/estado` | Solo sobre una clase suya. Descuenta del pack dentro de la misma transacción, y deja rastro en la auditoría |
| `PATCH /agenda/reservas/:id/nota` | Solo sobre una clase suya. La auditoría registra quién anotó, **sin copiar el texto**: es una observación sobre una persona, y auditar no es guardar una segunda copia |

**Un detalle que conviene conocer:** lo único que impide que un ALUMNO marque su
propia clase como dictada —y se descuente una del pack— es el `@Roles` de ese
endpoint. `verificarAcceso` lo dejaría pasar, porque la clase es suya. Hay una
prueba que lo comprueba sobre el decorador, justamente porque el servicio no lo
frenaría.

Por eso la app **no manda ningún identificador de instructor** en sus consultas:
no elige qué agenda ver, y mandarlo daría la impresión contraria.

---

## 6. El panel ya no es suyo

Con la app cubriendo su trabajo, el rol `INSTRUCTOR` dejó de entrar al panel. Es
el objetivo de la etapa, y se hizo **al final** a propósito: sacárselo antes lo
habría dejado sin herramienta.

### Qué se cerró, y por qué en dos lugares

| Dónde | Qué cambió |
|---|---|
| El panel | `RutaProtegida` deja pasar solo a `ADMIN`. A un instructor le dice **dónde está ahora su trabajo**, con un enlace a su app, en vez de «no tenés permisos» |
| La API | Se le quitó `INSTRUCTOR` a los seis endpoints que solo el panel usaba |

Los seis: `GET /clientes` y `GET /clientes/:id` —buscar en el padrón de alumnos y
abrir una ficha con su historial—, `GET /instructores` y `GET /instructores/:id`,
y `GET /vehiculos` y `GET /vehiculos/:id`.

**Cerrar solo el panel no habría alcanzado.** El panel es una comodidad de
interfaz; quien conozca la dirección de la API la llama igual con su token. Lo
que de verdad cierra la puerta es el `@Roles` de cada endpoint.

### Qué pierde un instructor

Concretamente: **buscar a cualquier alumno del padrón y ver su ficha con el
historial completo**. De los alumnos a los que sí les da clase recibe lo que
necesita —nombre, teléfono y correo— dentro de cada reserva.

Es una pérdida real y es la intención: el instructor necesita a los alumnos que
tiene hoy, no el padrón. Si alguna vez hiciera falta, se agrega a su app y
acotado a sus propios alumnos, no reabriendo el panel.

### Lo que NO se tocó

Reprogramar y cancelar una clase siguen sin pedir rol, y el servicio las acota a
las clases propias. El instructor ya no tiene pantalla para hacerlo, pero
quitarle el permiso sería un cambio de comportamiento sin nadie que lo pida, y
no expone ningún dato: solo puede tocar lo suyo.

### Una prueba que fija la matriz

`apps/api/test/permisos.spec.ts` lee los decoradores y afirma tres cosas: qué
puede todavía un instructor, qué dejó de poder, y **que ningún método de esos
tres controladores admita `INSTRUCTOR`** —más fuerte que la lista, porque atrapa
también al endpoint que se agregue mañana—. Comprobado revirtiendo un decorador:
la prueba se pone en rojo.

También fija que el cambio no se llevó puesto lo ajeno: `/clientes/me` sigue
siendo del alumno, porque el guard usa `getAllAndOverride` y el `@Roles` del
método manda sobre el de la clase.

### Sobre las notas internas del alumno

Hoy el instructor **no ve** las `notasInternas` de la ficha, y hay una prueba que
lo afirma. Son observaciones que escribe administración.

La decisión tomada para seguir adelante, a falta de otra indicación, es la más
conservadora: **no se tocan**. Las notas internas siguen siendo de
administración, y el instructor va a tener un campo propio para las
observaciones de clase, que escribe y lee él.

El motivo es que son dos cosas distintas con dos audiencias distintas, y porque
este camino no toca ninguna garantía que ya esté dada: si más adelante se decide
que el instructor lea las notas de administración, es un cambio de una línea en
`clientes.service.ts`. Al revés —abrirlas ahora y cerrarlas después— no se puede
deshacer lo que ya se leyó.

---

## 7. Puertos y comandos

| App | Puerto | Comando |
|---|---|---|
| landing | 5173 | `pnpm landing:dev` |
| admin | 5174 | `pnpm admin:dev` |
| cliente | 5175 | `pnpm cliente:dev` |
| **instructor** | **5176** | **`pnpm instructor:dev`** |

---

## 8. Cómo se comprobó

En un navegador real, a 390 px de ancho, que es el tamaño en el que se va a usar:

| Qué | Resultado |
|---|---|
| Las clases del día, ordenadas, con las cerradas al final | OK |
| Hora, alumno, vehículo y punto de encuentro de cada clase | OK |
| Llamar al alumno, y escribirle por WhatsApp con el código de país | OK |
| Un teléfono sin código de país **no** dibuja el enlace de WhatsApp | OK |
| Las etiquetas de estado dicen «Faltó», no «No asististe» | OK |
| Moverse de día, día vacío, y el atajo de «volver a hoy» | OK |
| Cada día es una consulta acotada, **sin** mandar ningún `instructorId` | OK |
| Sin desborde horizontal | OK |
| La pantalla de ingreso, y su aviso para el alumno que se equivocó de app | OK |
| Cerrar la clase: solo si ya empezó, con confirmación y con la opción de arrepentirse | OK |
| Un instructor en el panel ve a dónde ir, con enlace a su app | OK |
| Un alumno en el panel ve el mensaje de siempre, sin ese enlace | OK |
| Administración entra y ve las ocho secciones | OK |
| Anotar, editar y borrar la observación; cancelar sin mandar nada | OK |
| Las dos observaciones se distinguen en pantalla | OK |
| El PATCH manda el estado correcto, a la clase correcta, una sola vez | OK |
| Un rechazo de la API se lee en la tarjeta y se puede reintentar | OK |

Más 235 pruebas de la API: 4 sobre el destino de cada rol —incluida la que
comprueba que un instructor **no** caiga en el panel—, 5 sobre el cierre de la
clase, 6 sobre la observación —entre ellas **que el alumno no la reciba**— y 8
sobre la matriz de permisos. `typecheck` 6/6 y `build` 6/6.

**Lo que no se pudo comprobar desde el entorno de desarrollo:** el ingreso real
con Supabase, porque el proxy de ese entorno lo bloquea. Las pantallas que
dependen de una sesión se probaron con la sesión simulada.
