# PWA del alumno

Aplicación: `apps/cliente` · Rol que entra: `CLIENTE`

Es una aplicación para el teléfono: el alumno la instala desde el navegador y la
usa como cualquier otra app.

---

## Qué puede hacer

| Pantalla | Para qué |
|---|---|
| **Mis clases** | Ver las próximas y el historial. Cancelar una clase |
| **Reservar** | Elegir tipo, duración, día y horario |
| **Mi perfil** | Completar sus datos y ver el saldo de sus packs |

La navegación va en una **barra inferior fija**: en el teléfono es la zona que se
alcanza con el pulgar sin cambiar el agarre.

---

## Identidad visual

La app usa **los mismos colores que el sitio y el panel**: rojo `marca-*`,
amarillo `acento-*` y los negros `carbon-*`, con los tokens nombrados igual en
las tres aplicaciones, así una clase copiada de cualquiera funciona en las otras.
El alumno entra al sitio, después a la app y después pisa la academia: si las
tres cosas no se parecen, parecen tres empresas distintas.

Tres detalles que no son decorativos:

- **El rojo de la marca NO se usa para «confirmada».** Quedó reservado para
  `AUSENTE`, que es el único estado que el alumno tiene que leer como un
  problema. Con la marca en rojo, «confirmada» y «faltó» se veían casi iguales.
  Confirmada va en celeste, igual que en el panel.
- **El `theme-color` es el negro, no el rojo.** Ese color pinta la barra de
  estado del teléfono cuando la app está instalada, y así se funde con la barra
  de arriba en vez de cortarla.
- **Contraste verificado.** El texto auxiliar sobre el negro va en `slate-400`
  (7.67) y no en `slate-500`, que da **4.13** y no llega al 4.5 que pide el
  criterio AA. El punto rojo del logotipo da 3.75, pero es decorativo
  (`aria-hidden`) y le rige el 3:1 de los elementos no textuales.

### Un detalle que no depende del código

El campo de fecha es el nativo del navegador (`<input type="date">`), y **el
formato en que se muestra lo decide el idioma del navegador del alumno**, no la
página: un teléfono en español muestra dd/mm/aaaa y uno en inglés mm/dd/yyyy.
No se pudo comprobar acá: el Chromium de pruebas no trae el paquete de idioma
español y muestra el formato inglés aunque se lo fuerce. Es igual en el panel.

---

## Reservar

El alumno elige qué quiere manejar, cuánto dura la clase y qué día. La app
consulta el motor de disponibilidad y ofrece los horarios libres.

### Un horario por hora, no uno por instructor

El motor devuelve un hueco por cada combinación de instructor y vehículo libre.
Eso es justo lo que el panel necesita —ahí se elige con quién—, pero al alumno le
mostraba **la misma hora repetida sin ninguna diferencia visible**: dos botones
"09:00" idénticos, y ambos quedaban marcados al tocar uno, porque la selección se
comparaba por horario.

Elegir entre dos botones iguales no es una decisión, es ruido. La PWA se queda
con el primer hueco de cada hora y la academia asigna el instructor.

### La clase queda pendiente

Una reserva hecha por el alumno nace en estado `PENDIENTE`, y la tarjeta lo dice:
*"La academia todavía tiene que confirmarla"*. Las que agenda la academia desde
el panel nacen confirmadas.

---

## Cancelar

Desde la tarjeta de la clase. Rige la antelación mínima configurada, y la
pantalla la muestra para que no sea una sorpresa: *"Podés cancelar hasta 24 horas
antes"*.

Pasado ese plazo el botón sigue estando, pero la API responde con el motivo. Es
deliberado: ocultarlo dejaría al alumno sin saber por qué no puede.

La academia sí puede cancelar sin límite de tiempo — si el instructor se enferma,
la clase no se da igual.

---

## Mi perfil

El alumno edita **su propia ficha**, no la cuenta de acceso: nombre, teléfono,
cédula, fecha de nacimiento y dirección.

Dos cosas que **no** puede tocar, y por eso no están en el formulario ni en la
respuesta de la API:

- **Las notas internas.** Son observaciones del instructor sobre su desempeño.
- **Darse de baja.** Es una decisión de la academia.

La ficha se resuelve **desde el token**, nunca desde un identificador recibido.
Por eso no hay forma de pedir la de otra persona: no existe el parámetro.

---

## Qué NO puede tocar un alumno

Verificado a nivel HTTP contra la API en ejecución:

| Ruta | Alumno |
|---|---|
| `GET /clientes/me`, `PATCH /clientes/me` | ✅ 200 — su propia ficha |
| `GET /agenda/disponibilidad` | ✅ 200 — lo necesita para reservar |
| `GET /agenda/reservas` | ✅ 200 — **solo las suyas** |
| `GET /clientes` | ⛔ 403 — no lista alumnos |
| `GET /instructores` | ⛔ 403 |
| `GET /vehiculos` | ⛔ 403 |
| `GET /catalogo/servicios/todos` | ⛔ 403 |

Y a la inversa: un administrador recibe **403** en `/clientes/me`. Esas rutas son
del alumno, y cada rol usa las suyas.

---

## Cómo entra el alumno

El formulario de ingreso **no habla con la API ni con el panel**. Llama a
`supabase.auth.signInWithOtp()`, que va del navegador directo a Supabase Auth.

El permiso para entrar se resuelve **después**, en el primer llamado a la API
(`UsuariosService.resolverDesdeToken`): se busca una invitación vigente para ese
correo. Si la hay, se crea la cuenta con el rol y la ficha que dice la
invitación; si no la hay, se responde `403` y no se crea nada.

**Resuelto.** El formulario manda `shouldCreateUser: false` y, sobre todo, la
API exige una **invitación vigente** para aprovisionar la cuenta: un token
válido de Supabase ya no alcanza. La cuenta la habilita la academia desde la
ficha del alumno, y el vínculo con esa ficha queda dicho en la invitación en vez
de adivinarse por correo. Todo el detalle está en
[18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md).

---

## Instalación y funcionamiento sin conexión

La PWA usa un service worker propio (`src/sw.ts`, estrategia `injectManifest`)
que precachea el armazón de la aplicación para que abra rápido.

**Las respuestas de la API nunca se cachean**: contienen datos personales del
alumno y quedarían guardadas en el dispositivo.

En la Etapa 3 ese mismo archivo suma los listeners de `push` y
`notificationclick` para los recordatorios de clase.

---

## Verificación

Recorrida completa en un navegador real, con viewport de teléfono (390×844),
contra la API y la base:

ver sus clases → reservar (elegir tipo, duración, día, horario) → confirmar →
verla aparecer como «A confirmar» → completar el perfil → cancelarla.

Sin errores de consola ni peticiones fallidas.
