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

---

## 5. Lo que todavía no hace

- **Las fotos.** El modelo tiene el campo y la galería lo dibuja, pero la carga de
  imágenes a Storage no está hecha. Mientras tanto, las tarjetas muestran el
  nombre, la categoría y el año, que ya es prueba social.
- **Las fotos viejas con la libreta no se publican.** Los egresados anteriores
  pueden recibir su diploma retroactivamente y fotografiarse con él. Aprovechar
  las fotos existentes exigiría difuminar cada libreta y conseguir la
  autorización de cada persona.
- **El histórico no se indexa bien todavía.** `/graduados` se arma en el
  navegador; el título de la pestaña se ajusta, pero no hay renderizado en el
  servidor.
