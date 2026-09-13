# Fotos: validación, almacenamiento y foto de vehículo

Dos módulos del panel manejan fotos: **egresados** (la foto con el diploma, que
se publica en el sitio) y **vehículos** (la foto de cada auto o moto de la
flota). Los dos usan exactamente el mismo camino, y este documento es ese camino.

Lo específico de la galería de egresados —el diploma, la autorización firmada,
qué se publica— está en [15-graduados-y-diploma.md](15-graduados-y-diploma.md).

---

## 1. Qué se valida, y dónde

La validación está repartida en cuatro lugares a propósito. Ninguno alcanza solo.

| Dónde | Qué controla | Por qué no alcanza solo |
|---|---|---|
| `accept` del input | Filtra el diálogo de archivos | Es una sugerencia: en el diálogo se puede elegir «todos los archivos» |
| `lib/imagen.ts`, en el navegador | Extensión, tipo, peso, medidas, y que el archivo **decodifique** como imagen | Es código del navegador: alguien puede llamar al Storage sin pasar por la página |
| Bucket de Supabase | `file_size_limit` y `allowed_mime_types` | No mira el contenido ni quién es el dueño de la carpeta |
| DTO de la API | La forma exacta de la ruta que se guarda | Nunca ve el archivo, solo dónde quedó |

### En el navegador (`apps/admin/src/lib/imagen.ts`)

Antes de tocar el archivo:

| Regla | Valor | Mensaje |
|---|---|---|
| Extensión | `jpg`, `jpeg`, `png`, `webp`, `heic`, `heif` | «El archivo tiene que ser una foto JPG, JPEG, PNG, WEBP, HEIC, HEIF. "documento.pdf" no lo es.» |
| Tipo MIME | Si el navegador lo dedujo, tiene que empezar con `image/` | «"informe.pdf.jpg" no es una imagen (el navegador lo reconoce como application/pdf).» |
| Archivo vacío | 0 bytes se rechaza | «El archivo está vacío.» |
| Peso de entrada | 12 MB | «La imagen pesa 14,2 MB y el máximo son 12,0 MB.» |

Después de decodificarla:

| Regla | Valor | Mensaje |
|---|---|---|
| Lado más corto | 200 px | «La imagen es muy chica (60x60). El lado más corto tiene que tener al menos 200 px.» |
| Peso de salida | 3 MB, que es el límite del bucket | «Aun reducida, la imagen pesa … Probá con otra foto.» |

**Por qué extensión Y tipo MIME, y ninguno como única prueba:** el tipo MIME lo
deduce el navegador de la extensión, así que renombrar `virus.exe` a `foto.jpg`
lo hace llegar como `image/jpeg` igual. Y con HEIC varios navegadores no ponen
ningún tipo, así que exigir solo el MIME rechazaría fotos de iPhone válidas.

**La prueba que no se puede engañar con un renombre** es la siguiente: el archivo
tiene que **decodificarse como imagen** para poder dibujarse en el canvas. Un PDF
con nombre `foto.jpg` pasa las dos primeras validaciones y falla acá, con «El
archivo no es una imagen válida.». Esto también es lo que garantiza que lo que se
sube es un JPEG de verdad: no se sube el archivo elegido, se sube lo que el
navegador dibujó.

### Los metadatos se borran en el mismo paso

Redibujar la foto en un canvas y volver a codificarla **descarta los EXIF**,
incluida la ubicación GPS de la cámara. Está verificado en un navegador real con
un JPEG hecho a propósito con coordenadas: la tabla del resultado está en
[15-graduados-y-diploma.md](15-graduados-y-diploma.md#3b-las-fotos).

Esto importa tanto para la foto de un vehículo como para la de un egresado: una
foto del auto de la academia sacada en la puerta lleva adentro las coordenadas de
la puerta.

---

## 2. Los buckets

| Bucket | Público | Límite | Tipos |
|---|---|---|---|
| `graduados` | Sí, para leer | 3 MB | `image/jpeg`, `image/webp` |
| `vehiculos` | Sí, para leer | 3 MB | `image/jpeg`, `image/webp` |
| `comprobantes`, `expedientes` | **No** | 5 MB | + `application/pdf` |

Escribir en los dos buckets de fotos —subir, reemplazar, borrar— **requiere rol
de administrador**, verificado contra la tabla `usuarios` en cada operación, no
contra el token. Las políticas están en `infra/supabase/01-storage.sql`.

**Por qué los de fotos son públicos.** Las de egresados están hechas para verse
en el sitio sin sesión; pedir una URL firmada por cada foto de cada página
protegería algo que por definición no es secreto. Las de vehículos muestran un
auto de la academia con su matrícula, que es lo que cualquiera ve en la calle, y
las rutas llevan el UUID del vehículo, así que no se pueden adivinar. El riesgo
real de una foto no es quién la ve sino lo que trae adentro, y eso se resuelve
antes de subirla.

---

## 3. La base guarda una ruta, nunca una dirección

En `fotoRuta` va únicamente `<uuid del dueño>/<archivo>.<jpg|jpeg|webp>`. La
dirección pública se arma a partir de eso. La forma se valida en el borde de la
API (`apps/api/src/common/formato/foto.ts`), con la misma expresión para los dos
módulos.

Si se aceptara texto libre, quien tenga acceso al panel podría guardar:

| Lo que se guardaría | Qué pasaría |
|---|---|
| `https://otro-servidor.com/foto.jpg` | Una imagen ajena, o un rastreador, servida como si fuera del sitio |
| `javascript:…` | Según dónde se pegue esa «ruta», código ejecutándose en la página |
| `../expedientes/<id>/cedula.jpg` | Un archivo de un bucket **privado**, publicado sin querer |
| `foto.svg` / `foto.html` | Un SVG puede traer scripts adentro, servido desde el dominio del proyecto |

Los cuatro están **rechazados y verificados**: hay pruebas automáticas
(`apps/api/test/foto.spec.ts`) y una verificación contra la API andando.

---

## 4. La foto del vehículo

### Cómo se usa

En **Panel → Vehículos**, cada fila tiene su miniatura y un botón *Subir* /
*Cambiar*, con *Quitar* cuando ya hay una. Es el mismo componente que usa
Egresados (`apps/admin/src/componentes/CeldaFoto.tsx`).

### Tiene su propio endpoint, y no es un detalle

`PATCH /vehiculos/:id/foto` — solo administrador. Mandar `""` quita la foto.

`PATCH /vehiculos/:id` reemplaza la **ficha entera**: los campos que no vienen se
guardan en null. Si la foto viajara por ahí, subirla desde el listado —donde no
está abierto el formulario— borraría la marca, el modelo y el vencimiento del SOA
del vehículo. Con un endpoint aparte eso no puede pasar, y está verificado en las
dos direcciones: editar la ficha no borra la foto, y cambiar la foto no borra la
ficha.

### El orden de las operaciones

Es el mismo que en egresados, y está elegido para que un fallo a mitad de camino
deje el estado menos malo posible:

- **Al subir:** primero sube la nueva, después guarda la ruta, y recién entonces
  borra la vieja. Si se corta la conexión en el medio, la fila se queda con la
  foto que tenía, no sin ninguna.
- **Al quitar:** primero borra la ruta de la base, después el archivo. Si falla
  el borrado del archivo, ya nadie lo referencia: queda un archivo huérfano, que
  es mucho menos grave que una fila apuntando a un archivo que no está.

---

## 5. Qué se verificó

| Qué | Resultado |
|---|---|
| Pruebas automáticas de la forma de la ruta (9 casos) | OK |
| Suite completa de la API | OK (148) |
| Rutas maliciosas contra la API andando (6 formas) | 400 en todas |
| Editar la ficha no borra la foto | OK |
| Cambiar la foto no borra marca, modelo ni SOA | OK |
| Quitar la foto deja `fotoRuta` en null | OK |
| Extensión no permitida, en el navegador | Mensaje claro, no se sube |
| Imagen de 60×60 | Rechazada por medidas |
| Archivo que no es imagen con nombre `.jpg` | Rechazado al decodificar |
| Foto válida de 1200×900 | Pasa la validación y llega a la subida |
| La columna Foto en Vehículos y Egresados | Un control por fila, sin errores de consola |

**Lo que no se pudo verificar desde acá:** la subida real a Supabase Storage. El
entorno de desarrollo no alcanza `supabase.co`, así que la foto válida llega
hasta el intento de subida y falla con el mensaje de conexión. Eso prueba que la
validación pasó, no que el archivo quede guardado. Esa comprobación hay que
hacerla en el panel desplegado, después de correr `infra/supabase/01-storage.sql`
—que ahora también crea el bucket `vehiculos`—.
