# 15 — Diploma de egresado y galería de graduados

La academia tiene más de cien fotos de alumnos sosteniendo su libreta de
conducir. Publicarlas sería la mejor prueba social que puede tener el sitio, y
también un problema serio. Este módulo resuelve las dos cosas.

---

## 1. Por qué un diploma y no la libreta

La libreta de conducir muestra **nombre completo, número de documento y fecha de
nacimiento**. Publicarla legible en internet tiene dos consecuencias:

1. **Riesgo concreto para el alumno.** Con esos tres datos se puede intentar
   suplantar su identidad. No es teórico.
2. **Es tratamiento de datos personales** (Ley 18.331) y necesita consentimiento
   informado, específico y por escrito.

La solución no fue tapar el documento sino sacarlo de la foto: **la academia
emite su propio diploma**, el alumno se fotografía con eso, y el problema
desaparece en vez de administrarse.

De paso, el diploma es mejor que la libreta para lo que se quiere:

- Lleva la marca de la academia, no la de la Intendencia.
- Sale siempre prolijo y del mismo tamaño.
- El alumno se lleva algo tangible justo en el momento en que quiere la foto.

### Qué lleva y qué no

| Va | No va |
|---|---|
| Nombre y apellido | Número de documento |
| Categoría (A, G1, G2) | Fecha de nacimiento |
| Fecha de egreso | Domicilio |
| Marca de la academia | Número de libreta |
| Código de verificación | |

Hay una prueba en navegador que falla si el diploma llega a mostrar cualquiera
de las palabras de la columna derecha.

### El código de verificación

Ocho caracteres impresos en el diploma. Quien lo recibe puede entrar a
`/diploma` en el sitio, tipearlo y confirmar que la academia efectivamente lo
emitió. Así el diploma es comprobable **sin tener que mostrar ningún dato
sensible**.

Tres decisiones sobre el código:

- **Alfabeto sin caracteres confundibles**: no van `0`/`O`, `1`/`I`/`L` ni
  `5`/`S`. El código se dicta por teléfono y se tipea a mano; un cero confundido
  con una O convierte un diploma válido en «no encontrado».
- **Cada carácter aparece una sola vez en el alfabeto.** Repetir uno lo haría
  salir más seguido y achicaría el espacio real de códigos sin que se note. Hay
  una prueba que verifica que la distribución sea pareja.
- **Aleatorio, no correlativo.** Con códigos secuenciales cualquiera podría
  recorrer la lista completa de egresados desde afuera, que es justo lo que este
  diseño evita.

La verificación funciona **haya o no autorización para publicar**: son cosas
distintas. La autorización habilita la galería; el diploma es válido igual, y
quien lo tiene en la mano ya ve su propio nombre impreso.

---

## 2. Sin autorización firmada no se publica. Lo impide la base.

Esta es la garantía central del módulo, y no vive en la interfaz ni en el
servicio: vive en PostgreSQL.

```sql
ALTER TABLE "graduados"
  ADD CONSTRAINT "graduados_publicado_requiere_autorizacion"
  CHECK ("publicado" = false OR "autorizacion_at" IS NOT NULL);
```

Ningún camino del código —ni un bug, ni una carga masiva, ni una consulta a
mano— puede publicar a alguien que no firmó. Publicar la foto o el nombre de una
persona sin su autorización es una infracción a la Ley 18.331, no un descuido de
interfaz, así que la regla está donde no se puede saltear.

Hay dos constraints más:

- **`graduados_tutor_requiere_firmante`**: si firmó un tercero, tiene que constar
  quién. «Autorizado por un tutor» sin nombre no permite responder después quién
  dio el consentimiento.
- **`graduados_anio_coincide_con_fecha`**: el año está desnormalizado para poder
  filtrar e indexar barato, y sin esto se puede desincronizar en silencio. El año
  además nunca se recibe del cliente: se deriva de la fecha.

Verificado contra la base con siete casos, incluido el que más importa: **retirar
la autorización de alguien publicado también falla**. El sistema obliga a
despublicar y retirar el permiso en la misma operación, que es el orden correcto.

### Menores de 18

Si el alumno es menor, la autorización la firma su padre, madre o tutor legal.
El panel lo marca y la base exige el nombre de quien firmó.

### Derecho de supresión

Si alguien pide que lo saquen, sale: el panel tiene «Retirar permiso» (lo saca de
la galería y borra el consentimiento) y «Borrar» (elimina el registro). Las dos
acciones quedan auditadas.

---

## 3. La galería pública

- **En la portada**: hasta 6 egresados recientes, con un enlace al histórico. Cien
  fotos en la portada arruinarían el tiempo de carga, que es justo lo que hace
  que alguien se vaya antes de leer nada.
- **En `/graduados`**: el histórico completo, con filtro por año y paginado de
  **10 por página** por defecto, con selector de **10, 20, 50 o 100**.

El estado vive en la URL (`?pagina=2&porPagina=50&anio=2025`), así se puede
compartir un enlace a una página concreta y recargar sin perder el lugar.

### Lo que ve el público

Nombre, apellido, categoría, año y foto. Nada más. La lista de campos es
explícita en el código y no un «todo menos estos», para que agregar un campo
sensible al modelo no lo publique sin que nadie lo decida. Hay una prueba que
falla si esa lista cambia.

### Dos barreras contra el tamaño de página

`porPagina` está acotado a `10 | 20 | 50 | 100` en el DTO —un `porPagina=100000`
en un endpoint público es una forma barata de tumbar la base— y el servicio
vuelve a validarlo, para que ninguna llamada interna pueda pedir la tabla entera.
Un valor inventado en la URL del navegador tampoco se obedece.

---

## 3b. Las fotos

> Las reglas de validación (extensiones, peso, medidas), los buckets y la forma
> de las rutas están en [17-fotos.md](17-fotos.md), porque son las mismas que usa
> la foto de los vehículos. Acá queda lo propio de los egresados.

### Se procesan en el navegador antes de salir

Cuando el administrador elige una foto, el panel la **redibuja y la vuelve a
codificar** antes de subirla. Eso hace dos cosas:

1. **La achica a 1000 px** en el lado largo. Una foto de celular pesa varios
   megas; cien de esas en una galería hacen que la página tarde una eternidad en
   un 4G. En la prueba, 68 KB pasaron a 19 KB, y una foto real de celular baja de
   varios MB a unos 150 KB.

2. **Le saca los metadatos, y esto es lo que más importa.** Los EXIF de una foto
   de celular suelen incluir la **ubicación GPS exacta** donde se sacó, además
   del modelo del teléfono y la fecha. Subir la foto tal cual sale de la cámara
   publicaría las coordenadas de la academia —o de la casa del alumno— en un
   archivo que cualquiera puede descargar y abrir.

**Verificado en un navegador real**, con un JPEG construido a propósito con GPS
(34°57'27"S, 54°56'30"W), marca, modelo y fecha:

| Dato en la foto original | ¿Sobrevive? |
|---|---|
| Coordenadas GPS | No |
| Marca del teléfono | No |
| Modelo del teléfono | No |
| Fecha y hora de la toma | No |
| Segmento EXIF completo | No |
| Perfil de color ICC | Sí, y está bien: no identifica a nadie y mantiene los colores |

También se verificó la **orientación**. Un celular guarda las fotos verticales
con los píxeles apaisados y la rotación en los metadatos — que es justo lo que
este proceso descarta. Sin cuidado, todas las fotos verticales quedarían
acostadas. El panel aplica la rotación al dibujar: una foto guardada como
1600×1200 con orientación 6 sale 750×1000, vertical.

### El bucket es público, pero solo el administrador escribe

`graduados` es el único bucket público del proyecto, y es a propósito: las fotos
están hechas para que las vea cualquiera que entre al sitio, sin sesión. Usar
signed URLs obligaría a la landing a pedirle una dirección al backend por cada
foto de cada página, para proteger algo que por definición no es secreto.

Lo que sí está restringido es **quién escribe**: subir, reemplazar y borrar
requieren rol de administrador, verificado contra la tabla `usuarios` en cada
operación.

### La base guarda una ruta, no una dirección

En `fotoRuta` va únicamente `<id del egresado>/<archivo>.jpg`, con la forma
validada en el borde de la API. La dirección pública la arma la API.

**Por qué no aceptar una URL:** si se aceptara, quien tenga acceso al panel
podría apuntar la foto de un egresado a cualquier servidor de internet —una
imagen distinta, un rastreador, o algo peor— servido desde el sitio de la
academia como si fuera propio. Rechazado y verificado: direcciones externas,
`javascript:`, rutas con `..`, otros buckets, y extensiones que no son imagen
(`.svg`, `.html`).

### Reemplazar una foto no deja al egresado sin ninguna

La foto nueva se sube primero, después se guarda la ruta, y recién entonces se
borra la anterior. Si algo falla en el medio, el egresado se queda con la foto
que tenía. Verificado forzando un fallo de subida: la miniatura anterior sigue
ahí y la interfaz no queda trabada en «Subiendo…».

---

## 4. Qué se verificó

| Qué | Resultado |
|---|---|
| 25 pruebas automáticas del módulo | OK |
| Suite completa de la API | OK (103) |
| Las 3 constraints bloquean, con 7 casos contra la base | OK |
| Publicar sin autorización, antes y después del alta | Rechazado |
| Retirar la autorización de alguien publicado | Rechazado |
| El año no se puede desincronizar de la fecha | Rechazado |
| Matriz de permisos sobre la API corriendo | OK |
| `porPagina` 100000, 37 y negativos | 400 |
| El diploma no muestra documento, nacimiento ni domicilio | OK |
| Al imprimir sale solo el diploma, sin la barra del panel | OK |
| El código impreso verifica en el sitio público | OK |
| Paginación: página 2, recarga, cambio de tamaño, filtro por año | OK |
| Un `porPagina` inventado en la URL cae al de por defecto | OK |
| Los no autorizados no aparecen en la galería | OK |
| Sin errores en consola | OK |
| **Fotos** | |
| GPS, marca, modelo y fecha no sobreviven al procesado | OK (navegador real) |
| Una foto de celular apaisada + orientación sale vertical | OK |
| Reducción a 1000 px y bajada de peso | OK |
| Archivo que no es imagen, y archivo de 13 MB | Rechazados con mensaje claro |
| Rutas externas, `javascript:`, `..`, otros buckets, `.svg`, `.html` | 400 |
| El sitio recibe la dirección armada, nunca la ruta cruda | OK |
| Un fallo de subida no borra la foto anterior ni traba la interfaz | OK |

---

## 5. Lo que todavía no hace

> ### ⚠️ La subida a Storage no está verificada de punta a punta
>
> El entorno donde se desarrolló esto **no puede alcanzar `supabase.co`**: el
> proxy lo bloquea. Todo lo demás de este módulo se probó corriendo de verdad,
> pero **una subida exitosa a Storage no**.
>
> Lo que sí se verificó: el procesado de la imagen en un navegador real, la
> validación de la ruta contra la API corriendo, el armado de la dirección
> pública, y el camino de error cuando Storage no responde.
>
> Lo que falta comprobar en el entorno real, después de ejecutar
> `infra/supabase/01-storage.sql`:
>
> 1. Subir una foto desde el panel y ver que aparece la miniatura.
> 2. Verla en el sitio, en `/graduados`.
> 3. Reemplazarla y comprobar que se ve la nueva, no la vieja en caché.
> 4. Quitarla y confirmar que desaparece del sitio **y** del Storage.
> 5. Entrar con una cuenta que no sea de administrador e intentar subir: tiene
>    que fallar.

- **Las fotos viejas con la libreta no se publican.** Los egresados anteriores
  pueden recibir su diploma retroactivamente y fotografiarse con él. Aprovechar
  las fotos existentes exigiría difuminar cada libreta y conseguir la
  autorización de cada persona.
- **El histórico no se indexa bien todavía.** `/graduados` se arma en el
  navegador; el título de la pestaña se ajusta, pero no hay renderizado en el
  servidor.
