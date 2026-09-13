# El mapa de la academia

Dónde queda el local, en el sitio público: un mapa de verdad y un botón que
traza la ruta desde donde esté la persona.

---

## 1. Por qué Leaflet y OpenStreetMap

| Alternativa | Por qué no |
|---|---|
| Google Maps incrustado | Pide clave de API, tarjeta de crédito y facturación por uso |
| Mapbox | Lo mismo: clave y cuenta |
| **Leaflet + OpenStreetMap** | **Sin clave, sin cuenta, sin costo** |

Leaflet es la biblioteca que dibuja el mapa; OpenStreetMap, de dónde salen las
imágenes de las calles. Son dos cosas distintas y ninguna pide registrarse.

**Lo que sí exige OpenStreetMap es la atribución.** Por eso el texto «©
colaboradores de OpenStreetMap» viaja pegado a la dirección de las imágenes, en
`packages/shared/src/mapa.ts`: usar una obliga a mostrar la otra, y así nadie se
la puede olvidar al copiar el código a otro lado.

**Lo que hay que saber en materia de datos:** el navegador de quien visita el
sitio le pide las imágenes directamente a `openstreetmap.org`, así que su
dirección IP llega hasta ahí. Es exactamente lo mismo que hace cualquier mapa
incrustado, y no se manda ningún otro dato.

---

## 2. Cómo se marca el punto

Se hace **desde el panel**, en *Sitio público → Datos de contacto → Ubicación en
el mapa*. Hay tres formas:

1. **Tocar el mapa** donde está la academia.
2. **Arrastrar el marcador**, para corregir sin volver a empezar.
3. **«Usar mi ubicación»**, que sirve si quien configura está parado en el local.

Se guarda con el mismo botón que el resto de los datos de contacto.

**No se pueden escribir las coordenadas a mano, y es a propósito.** Nadie sabe de
memoria su latitud, y un número mal tecleado manda a los alumnos a otra ciudad
sin que nada lo delate.

### Lo que pasa si no hay punto marcado

El sitio **no inventa uno**. Muestra la ilustración de la zona de cobertura —la
misma de siempre— y no ofrece el botón de ruta. Una dirección aproximada es peor
que ninguna: manda gente a la puerta equivocada.

---

## 3. El botón «Llevame hasta allí»

Abre Google Maps con la ruta ya trazada y la navegación arrancada:

```
https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>
  &travelmode=driving&dir_action=navigate
```

Es el esquema de direcciones URL documentado de Google Maps. **No necesita clave
de API.**

**El origen no lo pone el sitio.** Lo resuelve Google con la ubicación de quien
toca el enlace, que es justo lo que se quiere —la ruta sale de donde está la
persona— y además evita que la página pública tenga que pedirle su posición a
nadie. Por eso el sitio público **mantiene bloqueada** la geolocalización en su
`Permissions-Policy`.

Con el punto marcado, este botón **reemplaza** al viejo de «Cómo llegar». Los dos
abren Google Maps, y tener dos botones casi iguales solo obliga a elegir. El
campo «Enlace de Google Maps» del panel sigue existiendo como respaldo: se usa
únicamente cuando no hay punto marcado.

---

## 4. El permiso de ubicación en el panel

El panel **sí** necesita pedir la ubicación, para el botón «Usar mi ubicación».
Eso obligó a cambiar una cabecera en `apps/admin/vercel.json`:

```diff
- geolocation=()
+ geolocation=(self)
```

`(self)` habilita solo al propio panel. Cualquier cosa incrustada dentro sigue
sin poder pedirla. **El sitio público no se tocó**: ahí sigue en `geolocation=()`.

### Dos cosas que la especificación no dice de forma evidente

Las dos se encontraron probando en un navegador de verdad, no leyendo:

1. **Con el permiso bloqueado, Chrome no llama a ninguna de las dos funciones**
   —ni a la de éxito ni a la de error—. Simplemente no contesta. Por eso el
   permiso se consulta *antes*, con `navigator.permissions.query`, y si está
   bloqueado se dice de una en vez de esperar.

2. **El `timeout` de `getCurrentPosition` no corre mientras el permiso está sin
   responder.** Arranca recién después de que se concede. Así que si la persona
   ignora el aviso del navegador, ese tope no vence nunca. Por eso el componente
   tiene **su propio reloj** de 12 segundos: sin él, el botón se quedaba en
   «Buscando…» para siempre.

Cada motivo tiene su mensaje, porque cada uno se arregla distinto: uno es un
permiso, otro es el aparato que no consigue señal, otro es esperar y reintentar.

---

## 5. Dónde está cada cosa

| Archivo | Qué hace |
|---|---|
| `packages/shared/src/mapa.ts` | Lo común: el enlace de ruta, las teselas con su atribución, el marcador y el redondeo |
| `apps/landing/src/componentes/MapaDeLaAcademia.tsx` | El mapa del sitio. Se carga aparte, con `lazy` |
| `apps/landing/src/componentes/Ubicacion.tsx` | La sección «Dónde estamos» |
| `apps/admin/src/componentes/SelectorDeUbicacion.tsx` | El selector del panel |
| `apps/api/prisma/migrations/20260914090000_coordenadas_de_la_academia/` | Las dos columnas y sus reglas |

Los dos mapas usan **Leaflet directo, sin envoltorio de React**. Son treinta
líneas de ciclo de vida y así no hay una dependencia más que seguir actualizando.

El marcador es un SVG propio y no el de fábrica de Leaflet, también a propósito:
el de fábrica son dos PNG que Leaflet busca por una ruta relativa a su hoja de
estilos, y con un empaquetador esa ruta no existe. El síntoma es un mapa sin
marcador y sin ningún error en la consola.

El del sitio se descarga **solo cuando hay un punto que mostrar**: Leaflet pesa, y
quien nunca baja hasta «Dónde estamos» no descarga nada.

---

## 6. Las reglas que hace cumplir la base

```sql
CHECK (("latitud" IS NULL) = ("longitud" IS NULL))
CHECK (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180)
```

Van las dos coordenadas o ninguna: con media no se dibuja nada, y cada pantalla
tendría que decidir por su cuenta qué hacer con eso. La API lo comprueba antes
para poder dar un mensaje entendible —el error de la base llega en inglés y con
el nombre de la restricción adentro—, pero la regla de verdad está en la base.

Guardar cualquier otro dato de contacto **no** exige tener el punto marcado: la
comprobación solo corre si el pedido toca alguna de las dos coordenadas.

---

## 6-bis. El mapa le pasaba por encima a la barra de navegación

Leaflet apila sus capas internas hasta **z-index 1000** —los controles de zoom y
la atribución—, y la barra fija del sitio está en **50**. Al bajar la página, el
mapa se dibujaba encima del menú.

El arreglo es una sola clase, `z-0`, sobre el contenedor del mapa. Con un
z-index propio, el contenedor pasa a ser un **contexto de apilado**: todo lo que
Leaflet numera adentro queda contenido ahí, y esa caja compite con el resto de la
página como un solo bloque, en 0.

### Por qué no se veía siempre

El bloque entra con la animación `aparece`, que arranca con `opacity: 0` y un
`transform`. **Cualquiera de las dos cosas ya crea un contexto de apilado**, así
que mientras la animación corre el mapa está contenido y todo se ve bien. Al
terminar —`opacity: 1`, `transform: none`— ese contexto desaparece y recién ahí
el mapa se escapa.

Esto hizo que la primera prueba en navegador **diera en verde sin el arreglo**:
medía antes de que la animación terminara. La prueba definitiva espera a que el
bloque quede en `opacity: 1` y sin `transform`, y recién entonces mira quién
manda. Sin el arreglo falla; con el arreglo pasa.

La misma clase está en el selector del panel, por lo mismo: sus diálogos también
están en z-index 50.

---

## 7. Un agujero que apareció escribiendo esto

El globo que se abre al tocar el marcador muestra el nombre y la dirección de la
academia. Escrito de la forma obvia:

```ts
marcador.bindPopup(etiqueta); // ← etiqueta es una cadena
```

**`bindPopup`, si recibe una cadena, la inserta con `innerHTML`.** Y esa etiqueta
sale del nombre y la dirección que se editan **desde el panel**. Con
`<img src=x onerror=…>` en el nombre de la academia, ese código se ejecutaba en
la página pública de cada visitante que abriera el globo.

Se arregló pasando un elemento:

```ts
const globo = document.createElement('p');
globo.textContent = etiqueta;   // texto, no HTML
marcador.bindPopup(globo);
```

Comprobado en un navegador de verdad **en los dos sentidos**: con el código
anterior el HTML se ejecuta; con el nuevo, el texto se muestra literal y no se
crea ningún elemento.

Por lo mismo, `svgDelMarcador()` no acepta parámetros: ese texto también termina
en un `innerHTML` —así arma Leaflet los iconos— y un hueco donde meter un valor
de afuera es un hueco por donde entra HTML ajeno.

---

## 8. Cómo se comprobó

En un navegador de verdad, sobre las dos aplicaciones:

| Qué | Resultado |
|---|---|
| Con punto: mapa, marcador propio, atribución y enlace de ruta exacto | OK |
| Sin punto: ni mapa ni botón de ruta; vuelve la ilustración | OK |
| El enlace abre en otra pestaña, con `noopener` | OK |
| En teléfono (390px): sin desborde horizontal, mapa con altura real | OK |
| Panel: marcar tocando, arrastrar, mover y quitar | OK |
| Panel: «Usar mi ubicación» con permiso dado | OK |
| Panel: sin permiso, sale de «Buscando…» en 12,4 s y explica por qué | OK |
| HTML inyectado desde el panel no se ejecuta en el globo del marcador | OK, comprobado antes y después del arreglo |
| El mapa NO se dibuja encima de la barra de navegación | OK, comprobado antes y después del arreglo |
| El WhatsApp del pie arma el enlace con código de país | OK |
| Un número sin código de país no dibuja ningún botón | OK |

**Lo que no se pudo comprobar desde el entorno de desarrollo:** las imágenes del
mapa, porque el proxy de ese entorno bloquea `openstreetmap.org`, y la apertura
real de Google Maps, porque bloquea `google.com`. Se verificó que el mapa monta,
que el marcador queda en su lugar y que el enlace armado es exactamente el que
corresponde; que las imágenes carguen hay que mirarlo en la vista previa de
Vercel.
