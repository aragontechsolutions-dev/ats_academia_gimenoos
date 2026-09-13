# 14 — El sitio se edita desde el panel

Hasta acá, cambiar un teléfono en el sitio público significaba tocar código y
volver a desplegar. Eso se terminó: el contenido del sitio vive en la base y se
edita desde **Panel → Sitio web**.

---

## 1. Qué se puede cambiar

| Qué | Dónde |
|---|---|
| WhatsApp, teléfono, correo, dirección, ciudad, horarios, mapa, redes | Datos de contacto |
| Título, bajada, sobretítulo y texto del botón de **cada** sección | Secciones |
| Mostrar u ocultar cualquier sección | Secciones · casilla *Visible* |
| Orden de las secciones en la página | Secciones · campo *Orden* |
| Listas: preguntas frecuentes, beneficios, tarjetas, pasos, requisitos | Secciones · *Ítems* |

Los **precios** siguen en su propia pantalla (Panel → Precios), porque son parte
del catálogo y los usa también la agenda.

Las fotos —vehículos, instructores, testimonios, galería— todavía no se cargan
desde acá. De esas secciones se puede editar el encabezado y la visibilidad.

---

## 2. La regla de siempre, ahora también acá

Lo que se deja vacío **no se inventa**:

- Un **texto** vacío vuelve al texto por defecto que trae el sitio. La sección no
  queda con un encabezado en blanco.
- Un **dato de contacto** vacío simplemente no se muestra. Sin WhatsApp no hay
  botón flotante ni formulario de contacto, y el panel lo avisa arriba del
  formulario porque es el dato que más importa.
- Una sección **sin contenido real** (las de fotos) no aparece aunque esté
  marcada como visible.

---

## 3. Cómo está armado

### Una sola forma para todas las secciones

```prisma
model SeccionLanding {
  clave    String  @id      // 'hero', 'porQue', 'preguntas', ...
  visible  Boolean @default(true)
  orden    Int     @default(0)
  titulo   String?
  bajada   String?
  etiqueta String?          // el texto chico sobre el título
  accion   String?          // el texto del botón
  items    Json   @default("[]")   // lista de { titulo, detalle }
}
```

Una tabla por sección habría multiplicado migraciones y formularios para guardar
siempre lo mismo: un encabezado y una lista. Con una sola forma, el panel reusa
el mismo formulario para las 16 secciones y agregar una sección nueva es agregar
una línea a una lista.

Los `items` cubren tarjetas, pasos, beneficios, requisitos **y** preguntas
frecuentes: en esa sección el título del ítem es la pregunta y el detalle la
respuesta.

### Los datos de contacto no se duplicaron

Van en `ConfiguracionAcademia`, que ya existía con nombre, dirección, teléfono,
WhatsApp y correo. Se le agregaron ciudad, departamento, horarios, mapa,
Instagram y Facebook. Crear una segunda tabla de contacto habría dejado dos
teléfonos distintos en el sistema esperando a desincronizarse.

### El sitio sigue en pie si la API se cae

`apps/landing/src/contenido.ts` **no se borró**: pasó a ser el respaldo. El sitio
pide el contenido a la API y, si no responde, muestra sus textos por defecto. La
landing es la cara pública del negocio; que el backend esté caído no puede
dejarla en blanco.

### Una sola fuente de verdad para el orden

`GET /landing/contenido` devuelve **todas** las secciones, incluidas las que
nadie configuró, con su posición.

Esto se aprendió corrigiendo un error: en la primera versión la API devolvía solo
las secciones guardadas y el sitio inventaba una posición para el resto. Las dos
numeraciones no coincidían, y con unas pocas secciones configuradas el orden de
la página salía mezclado — el formulario de contacto aparecía antes que las
preguntas. Ahora la API manda el orden completo y el sitio solo obedece.

---

## 4. Seguridad

La verificación se hizo contra la API corriendo, no leyendo el código.

### Quién puede tocar qué

| Petición | Sin token | Alumno | Admin |
|---|---|---|---|
| `GET /landing/contenido` | 200 | 200 | 200 |
| `GET /landing/secciones` | 401 | 403 | 200 |
| `GET /landing/negocio` | 401 | 403 | 200 |
| `PATCH /landing/negocio` | 401 | 403 | 200 |
| `PUT /landing/secciones/:clave` | 401 | 403 | 200 |

El rol se resuelve **contra la base** en cada petición, no contra el token: si a
alguien se le quita el rol de administrador, deja de poder editar el sitio en la
petición siguiente, sin esperar a que expire su sesión.

### Enlaces: solo http y https

Los campos de mapa, Instagram y Facebook terminan en un atributo `href` de la
página pública. Aceptar cualquier esquema sería abrir un XSS **desde el propio
panel**: un `href` que empieza con `javascript:` ejecuta código en el navegador
de quien visita el sitio.

Rechazado y verificado: `javascript:`, `data:`, `vbscript:`, `file:`.

### Todo el contenido es texto plano

El sitio lo renderiza como texto, nunca como HTML. React escapa por defecto y en
ningún componente se usa `dangerouslySetInnerHTML`. Si alguna vez hiciera falta
dar formato, hay que resolverlo con un subconjunto controlado; habilitar HTML
convertiría el panel en una vía de inyección hacia la página pública.

### Límites que no son decorativos

Título 200 caracteres, bajada 600, detalle de un ítem 1000, máximo 20 ítems por
sección, orden entre 0 y 99. Sin ellos, un texto de 50.000 caracteres rompe el
diseño de la página y engorda cada respuesta de la API. El WhatsApp acepta solo
dígitos con código de país: con espacios o con `+`, el enlace de wa.me queda roto.

Campos no declarados se rechazan (`forbidNonWhitelisted`): un intento de mandar
`bufferMinutos` por este endpoint devuelve 400.

### Qué NO llega al sitio público

Verificado con una prueba que falla si alguien agrega un campo de más: la
respuesta pública no incluye la configuración interna de la agenda
(`bufferMinutos`, `antelacionMinimaHoras`, `cancelacionMinimaHoras`,
`ventanaReservaDias`) ni quién editó cada sección.

### Auditoría

Cada cambio queda registrado con quién y cuándo (`LANDING_SECCION_ACTUALIZADA`,
`LANDING_NEGOCIO_ACTUALIZADO`). Del negocio se registran **qué campos** se
tocaron, nunca sus valores.

---

## 5. El panel ahora se ve como el sitio

Misma paleta, mismos tokens (`marca-*`, `acento-*`, `carbon-*`), mismo logotipo y
mismo subrayado amarillo en la sección activa. Quien atiende la academia pasa de
una pantalla a la otra todo el día; dos paletas distintas hacen que parezcan dos
sistemas.

Dos cosas que salieron de hacer el cambio:

- **El rojo quedó reservado para los problemas.** Al pasar el panel de azul a
  rojo, una clase *confirmada* y un alumno *ausente* quedaban del mismo color, y
  son los dos desenlaces más opuestos que puede tener una clase. Confirmada pasó
  a celeste; el rojo es solo de AUSENTE.
- **El texto de ayuda de los campos salió de adentro del `<label>`.** Estando
  adentro, el nombre accesible del campo pasaba a ser "WhatsApp Solo números, con
  código de país y sin espacios…", y un lector de pantalla leía la ayuda entera
  cada vez que el foco entraba al campo. Ahora se enlaza con `aria-describedby`,
  que es para lo que existe. Afecta a todos los formularios del panel.

---

## 6. Qué se verificó

| Qué | Resultado |
|---|---|
| 23 pruebas automáticas del módulo | OK |
| Suite completa de la API (77 pruebas) | OK |
| Matriz de permisos sobre la API corriendo | OK |
| Enlaces `javascript:`, `data:`, `vbscript:`, `file:` rechazados | OK |
| WhatsApp con espacios, campo no declarado, 21 ítems, sección inventada → 400 | OK |
| Editar en el panel y ver el cambio en el sitio | OK |
| Guardar un campo no pisa los demás ni borra los ítems | OK |
| Ocultar una sección la saca del HTML | OK |
| El orden de la página coincide con el que manda la API | OK |
| Datos de contacto configurados llegan a los 15 enlaces de WhatsApp, al mapa y a Instagram | OK |
| Con la API caída el sitio sigue completo con sus textos por defecto | OK |
| Panel sin desborde horizontal ni errores en consola, a 1280 y a 390 | OK |

---

## 7. Lo que todavía no hace

- **Fotos.** Vehículos, instructores, testimonios y galería siguen esperando la
  carga de imágenes.
- **Previsualizar antes de publicar.** Lo que se guarda se ve enseguida en el
  sitio. Para un sitio de esta escala es lo razonable; si algún día hace falta
  revisar antes de publicar, el modelo ya tiene dónde guardar un borrador.
- **Deshacer.** No hay historial de versiones. La auditoría dice quién cambió qué
  sección y cuándo, pero no guarda el texto anterior.
