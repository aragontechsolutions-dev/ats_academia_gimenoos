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
| **Mi agenda** | Las clases del **día**, la **semana** o el **mes** |
| **Contactar al alumno** | Llamarlo o escribirle por WhatsApp, con un toque |
| **Cerrar la clase** | Dictada, o el alumno faltó |
| **Cancelar la clase** | Cuando no va a pasar, con motivo obligatorio |
| **Anotar cómo fue** | Una observación por clase, que el alumno **no** ve |

### Las tres vistas de la agenda

Abre siempre en **día**, que es la vista de trabajo: esta app se usa parado al
lado del auto, con una mano, para saber quién viene ahora. La semana y el mes
son para ubicarse.

| Vista | Qué muestra | Para qué |
|---|---|---|
| **Día** | Las clases completas, con todas las acciones | Trabajar |
| **Semana** | Lista agrupada por día: hora, alumno y estado | Cómo viene la semana |
| **Mes** | Grilla de calendario con la cantidad de clases por día | Dónde tengo lugar |

Tres decisiones que conviene no revertir sin pensarlas:

- **La semana es una lista, no una grilla de siete columnas.** Siete columnas es
  la vista del panel y funciona en una pantalla ancha; en un teléfono cada
  columna queda de cuarenta píxeles y no entra ni el nombre del alumno.
- **Las acciones viven solo en la vista de día.** La semana y el mes llevan al
  día al tocarlos. Repetir «Dictada» en una lista apretada es la forma más fácil
  de cerrar la clase equivocada.
- **El selector es un control segmentado arriba, no una barra de navegación
  abajo.** Las tres no son secciones distintas sino tres recortes de la misma
  agenda; una barra inferior prometería lugares a los que ir.

### Una clase pertenece al día en que empieza

La API filtra por **solapamiento** (`inicio < hasta && fin > desde`), así que una
clase de 23:30 a 00:15 vuelve en los dos días que ocupa. Para la grilla del panel
eso está bien: hay que dibujarla en ambos.

Acá no, y el error que provoca no es estético. Esta app **lista** clases
ordenadas por hora de inicio: sin filtrar, la clase de anoche aparece **primera**
bajo el título «Mañana», arriba de las de mañana. La primera tarjeta es la que se
toca, y tocarla cierra o cancela la clase equivocada.

Por eso `queEmpiezanEn()` (`src/lib/agenda.ts`) se queda solo con las que
**empiezan** dentro del período. No es una hipótesis: la prueba de navegador
canceló la clase equivocada por este motivo antes de que el filtro existiera, y
ahora hay una comprobación que falla si vuelve a colarse.

### Llamar y escribir al alumno

Dos botones grandes en cada clase, no dos enlaces subrayados dentro de la lista
de datos: se tocan parado al lado del auto, sin apuntar. Miden 44px de alto, que
es el mínimo cómodo para el pulgar, y hay una comprobación de navegador que lo
mide.

Las dos cosas hacen falta y no una: **llamar** sirve cuando el alumno está por
llegar, y el **mensaje** queda escrito cuando no atiende.

Si el alumno no tiene teléfono cargado, **no se dibuja ningún botón**. Un botón
que no llama a nadie es peor que ningún botón. El número se convierte con las
mismas reglas que usa la API y el sitio público (`digitosParaWhatsApp`, en
`@gimenoos/shared`), y si no se puede convertir con seguridad tampoco aparece:
antes que abrir un chat con quien no es, no hay enlace.

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

### Cancelar la clase

Es la tercera acción, y **no es un cierre**: la clase no se dio ni el alumno
faltó, directamente no va a pasar. El instructor se enfermó, el auto quedó en el
taller.

Por eso se comporta distinto de las otras dos:

| | Dictada / Faltó | Cancelar |
|---|---|---|
| Cuándo aparece | Solo si la clase ya empezó | Siempre que siga en pie |
| Peso en pantalla | Botones grandes | Acción secundaria, subrayada |
| El pack del alumno | «Dictada» descuenta una clase | **No descuenta nada** |
| El horario | Queda ocupado | **Queda libre** para otro |
| Motivo | No se pide | **Obligatorio** |

El motivo es obligatorio en la app aunque la API lo acepte vacío: quien lea eso
en el panel mañana necesita saber qué pasó, y el instructor es el único que lo
sabe en ese momento.

La **antelación mínima no lo frena**, y es a propósito: esa política rige para el
alumno. Si el instructor se enferma, la clase no se da igual, y obligarlo a
respetar la antelación lo dejaría sin forma de avisar.

El endpoint es otro (`PATCH /agenda/reservas/:id/cancelar`, no `/estado`) y ya
existía sin `@Roles`: lo acota el servicio a las clases propias del instructor.
Esa etapa no cambió ese permiso, solo lo expuso en la app — y agregó las pruebas
que faltaban, incluida la que comprueba que **no puede cancelar la clase de otro
instructor**.

### Lo que un instructor NO puede hacer con la agenda

Cancelar sí, pero **agendar y reprogramar no**, y eso se cerró en la Etapa 2.J al
revisar la matriz completa:

| | Puede | Por qué |
|---|---|---|
| Ver su agenda | Sí | Es su trabajo |
| Cerrar la clase (dictada / faltó) | Sí | Es quien sabe qué pasó |
| Cancelar su clase | Sí | Si se enferma, la clase no se da igual |
| Anotar cómo fue | Sí | Para la academia, no para el alumno |
| **Agendar una clase** | **No** | Podía crear una para cualquier alumno, confirmada, salteándose la antelación mínima y escribiéndole una observación que el alumno sí ve |
| **Reprogramar** | **No** | Mover una clase cambia instructor y vehículo: toca la agenda de otros |
| **Consultar disponibilidad** | **No** | Sirve para agendar, y ya no agenda |

Los tres últimos no llevaban `@Roles` y por eso estaban abiertos a los tres roles.
No era una decisión: era de cuando el instructor trabajaba en el panel.

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

### La invitación hace falta UNA sola vez

Esto ya era así desde siempre, pero no estaba escrito en ningún lado y generó la
duda en la práctica: como el primer acceso llega con una invitación que **vence a
las 24 horas y se usa una sola vez**, es natural suponer que hay que pedir una
nueva cada vez que se quiere entrar. No es así.

Lo que pasa de verdad:

1. **El primer ingreso** exige invitación vigente. El guard busca la fila del
   usuario en la base y, si no existe, entra a `aprovisionar()`
   (`apps/api/src/modules/usuarios/usuarios.service.ts`), que es el único lugar
   donde se consulta la tabla `invitaciones`.
2. **Desde el segundo en adelante** esa fila ya existe, así que el guard solo
   comprueba que la cuenta esté **activa**. La invitación deja de participar.
3. **La sesión se mantiene sola.** El cliente de Supabase está configurado con
   `persistSession` y `autoRefreshToken`, así que el token se renueva sin pedirle
   nada al instructor. No tiene que volver a ingresar cada día.
4. **Si igual la pierde** —teléfono nuevo, datos del navegador borrados—, se
   manda el enlace él mismo desde `/ingresar`, con `shouldCreateUser: false` para
   que ese formulario no pueda dar de alta a nadie. No depende de que alguien de
   la academia esté disponible.

Por eso, cuando un enlace vence, la pantalla ahora ofrece **«Mandarme un enlace
nuevo» como botón principal** y recién después menciona a la academia. Antes se
leía primero «escribile a la academia», y era justo eso lo que instalaba la idea
de depender de ella.

**Conviene instalar la app en el teléfono**, y no es un adorno: en el navegador
—sobre todo en iPhone— los datos del sitio pueden borrarse tras un tiempo sin
usarlo, y ahí sí habría que volver a ingresar. Instalada en la pantalla de inicio
eso no pasa. El componente `ComoNoVolverAEntrar` lo explica en la pantalla de
ingreso.

**Lo que NO se hizo, y por qué.** Se evaluó agregarle contraseña al instructor
para que pueda entrar sin depender del correo. Se descartó por ahora: no resuelve
ningún problema real —la sesión ya persiste— y suma superficie de ataque
(contraseñas débiles o reutilizadas, fuerza bruta, un formulario más que
proteger). Si algún día hace falta de verdad, el cambio es acotado, pero tiene
que venir con mínimo de largo, límite de intentos y la opción de Supabase que
rechaza contraseñas filtradas.

---

## 4. Quién puede entrar

La app comprueba el **rol**, no solo que haya sesión: las tres aplicaciones usan
las mismas cuentas de Supabase, así que tener sesión válida no dice **en cuál de
las tres** se está. Un alumno que llegue a esta dirección pasaría un control que
solo mirara la sesión, para encontrarse con una agenda vacía y sin ninguna
explicación.

**Desde la Etapa 2.J las tres lo comprueban.** Esta app y el panel ya lo hacían;
la del alumno no, y se notó: un instructor entró ahí con su enlace de invitación
y la app lo saludó por su nombre y le mostró «Tus clases de manejo». Ver
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md).

A quien se equivoca de puerta se le dice **qué cuenta tiene, cuál es su app y se
le da el enlace**, más un botón para salir. Sin callejones sin salida. Los
enlaces salen de variables opcionales (`VITE_APP_ALUMNO_URL`,
`VITE_APP_PANEL_URL` y sus equivalentes en las otras dos): si falta alguna, el
texto explica igual dónde está el trabajo, solo que sin botón.

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

A eso se sumaron, al agregar las tres vistas y cancelar, **41 comprobaciones de
navegador** en una sola corrida:

| Qué | Resultado |
|---|---|
| El selector ofrece Día, Semana y Mes, y abre en Día | OK |
| El resumen del período cuenta bien («4 clases · 1 en pie») | OK |
| Los botones de llamar y WhatsApp arman `tel:` y `wa.me` correctos | OK |
| El botón de llamar mide al menos 44 px de alto | OK |
| WhatsApp abre en pestaña nueva con `rel="noopener noreferrer"` | OK |
| Un alumno sin teléfono no dibuja ningún botón de contacto | OK |
| Una clase que no empezó **no** ofrece Dictada ni Faltó, pero sí cancelar | OK |
| Cancelar no deja confirmar sin motivo, y con motivo sí | OK |
| La clase queda cancelada y con su motivo a la vista | OK |
| **La clase de anoche no se cuela en el día siguiente** | OK |
| La semana agrupa por día, marca «Hoy» y **no** repite los botones de cerrar | OK |
| Tocar un renglón de la semana o un día del mes abre ese día | OK |
| La grilla del mes son semanas completas, con contador por día | OK |
| Ningún rango pedido supera el tope de 62 días de la API | OK |
| Sin errores de consola ni peticiones fallidas | OK |

Más 261 pruebas de la API: 4 sobre el destino de cada rol —incluida la que
comprueba que un instructor **no** caiga en el panel—, 5 sobre el cierre de la
clase, 4 sobre cancelar —entre ellas que no puede cancelar la clase de otro
instructor—, **7 sobre el tope del rango**, 6 sobre la observación —entre ellas
**que el alumno no la reciba**—, **19 sobre la matriz de permisos** y 4 sobre la
coherencia entre rol y ficha. `typecheck` 6/6 y `build` 6/6.

En la Etapa 2.J se sumaron dos verificaciones más, contra la API y la base
reales:

- **12 comprobaciones sobre HTTP** con un token firmado por cada rol: que un
  instructor no pueda agendar, reprogramar ni consultar disponibilidad; que un
  alumno no pueda reprogramar; y que cada uno conserve lo suyo.
- **16 comprobaciones de navegador** cubriendo las nueve combinaciones de rol y
  aplicación: cada rol entra en la suya, los otros dos reciben el cartel y el
  enlace correcto.

**Lo que no se pudo comprobar desde el entorno de desarrollo:** el ingreso real
con Supabase, porque el proxy de ese entorno lo bloquea. Las pantallas que
dependen de una sesión se probaron con la sesión simulada.
