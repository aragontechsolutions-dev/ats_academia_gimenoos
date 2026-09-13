# 13 — El sitio público (landing)

Qué hay en `apps/landing`, por qué está armado así y qué hay que cargar para
publicarlo. Esta es la primera impresión del negocio: una persona que busca
"academia de choferes San Carlos" llega acá antes que a cualquier otra pantalla.

---

## 1. La regla que manda sobre todo lo demás

> **Nada que no esté confirmado se publica.**

No hay precios de ejemplo, ni teléfonos de relleno, ni testimonios inventados,
ni fotos de autos que no son los de la academia. Esto no es una recomendación
escrita en un documento: está sostenido por el código.

| Dato | Cómo se comporta si no está cargado |
|---|---|
| WhatsApp | No aparece el botón flotante, ni el formulario, ni los CTA de WhatsApp. El CTA principal cae al formulario de contacto. |
| Teléfono, correo, dirección, horarios | La fila simplemente no se dibuja. |
| Vehículos | La sección **entera** no existe en el HTML. |
| Instructores | Ídem. |
| Testimonios | Ídem. |
| Galería | Ídem. |
| Precios | Se muestra "Consultanos el precio" en lugar de un número. |

Está verificado en navegador: la prueba falla si alguna de esas secciones
aparece sin datos reales detrás.

**Por qué importa tanto.** Un precio inventado es publicidad engañosa. Una
dirección inventada hace que alguien viaje al lugar equivocado. Un testimonio
inventado con nombre y apellido es, además, un dato personal falso atribuido a
una persona real (Ley 18.331). El costo de una sección que falta es mucho menor
que el de un dato que miente.

---

## 2. Dónde se carga el contenido

**Un solo archivo: `apps/landing/src/contenido.ts`.** Ahí vive todo el texto y
todos los datos del negocio. Para cambiar el sitio no hace falta tocar ningún
componente.

Lo que falta cargar está marcado con `TODO(datos-reales)`.

```ts
// Antes
whatsapp: null as string | null,

// Después (número con código de país, sin espacios ni símbolos)
whatsapp: '59899123456' as string | null,
```

**La excepción son los precios.** No están en `contenido.ts`: se leen en vivo
desde la API (`GET /catalogo/servicios`), que es la misma fuente que usa el
panel. Así la academia cambia un precio desde el panel y el sitio lo refleja sin
tocar código ni volver a desplegar.

---

## 3. Cómo está ordenada la página

El orden no es decorativo. Primero se convence, después se informa, y el precio
aparece recién cuando ya se entendió qué se está comprando.

| # | Sección | Para qué está |
|---|---|---|
| 1 | Hero | Qué es esto y qué puedo hacer, en tres segundos |
| 2 | Barra de confianza | Cuatro razones para seguir leyendo |
| 3 | Por qué Gimenoos | La diferencia: *aprender a manejar*, no solo aprobar |
| 4 | Clases | Moto y auto, y en qué situación estás |
| 5 | Proceso | Los cuatro pasos, dibujados como una carretera |
| 6 | Vehículos | *(solo si hay vehículos cargados)* |
| 7 | Planes | Precios en vivo desde la API |
| 8 | Trámite | La libreta ante la Intendencia |
| 9 | Instructores / Testimonios / Galería | *(solo si hay datos reales)* |
| 10 | Ubicación | Dónde estamos y cómo llegar |
| 11 | Preguntas | Se responden las objeciones antes de pedir el contacto |
| 12 | Contacto | El formulario |
| 13 | CTA final | Una sola idea y dos formas de actuar |
| 14 | Pie | Contacto, secciones y legales |

---

## 4. El formulario de contacto no guarda nada

Decisión deliberada y con consecuencias legales concretas.

Al enviar, el formulario **no manda nada a ningún servidor**: arma un mensaje de
WhatsApp con lo que la persona escribió y abre la conversación. Verificado en
navegador: tras enviar no sale del sitio ninguna petición que no sea `GET`.

**Por qué.** Guardar nombre y consulta en una base sería crear un fichero de
datos personales, y eso arrastra todo lo que exige la Ley 18.331:
consentimiento informado, inscripción de la base ante la URCDP, derechos de
acceso y supresión, y responsabilidad sobre la custodia. Todo eso para una
consulta que de todos modos termina en un chat de WhatsApp. El camino corto es
también el que menos expone a la academia y a la persona que consulta.

Si en algún momento se quiere guardar las consultas, hay que hacerlo con el
aviso de privacidad y el registro correspondientes. No es un cambio de una
línea.

---

## 5. Identidad visual

Paleta automotriz: rojo protagonista, amarillo de acento, negro y grafito para
las secciones de peso. Los tokens están en `apps/landing/src/index.css`.

| Token | Color | Uso |
|---|---|---|
| `marca-500` | `#d90429` | El rojo de la marca: CTA, acentos, títulos |
| `acento-400` | `#ffc400` | Amarillo: destacados, **siempre con texto oscuro** |
| `acento-500` | `#ff7a00` | Naranja: solo decorativo |
| `carbon-950` | `#0b0b0d` | Fondo de las secciones oscuras |

### Contraste verificado (criterio AA)

| Combinación | Relación | Veredicto |
|---|---|---|
| Blanco sobre rojo `marca-500` | 5.25 | Cumple |
| Negro `carbon-950` sobre amarillo `acento-400` | 12.31 | Cumple |
| Rojo `marca-500` sobre blanco | 5.25 | Cumple |
| Amarillo `acento-400` sobre negro | 12.31 | Cumple |
| **Blanco sobre naranja `acento-500`** | **2.61** | **No cumple** |
| **Rojo `marca-500` sobre negro** | **3.75** | **Solo texto grande** |

Las dos últimas filas están reflejadas en el código, no solo acá:

- El naranja **nunca** es fondo de un texto claro. Es un resplandor decorativo.
- Sobre fondo oscuro el sobretítulo de sección va en amarillo, no en rojo:
  es texto de 14 px y en rojo se quedaba en 3.75. Lo mismo con "Consultanos el
  precio" dentro de la tarjeta destacada.
- El rojo sí se usa en el título del hero, que es texto grande (36 px o más en
  negrita): ahí el criterio AA pide 3.0 y 3.75 alcanza.

### Nada de marcas de terceros

La paleta se inspiró en la gama roja/amarilla del mundo automotor. **No hay ni
puede haber** personajes, logos ni elementos gráficos de películas o marcas
registradas. Usar un personaje con derechos de autor en el sitio de un negocio
es una infracción con consecuencias reales, no un detalle de diseño.

El hero y la sección de ubicación usan ilustraciones SVG propias —líneas de
velocidad, un velocímetro estilizado, una ruta— en lugar de fotografías. No es
una limitación temporal: mostrar la foto de un auto que no es el de la academia
sería afirmar algo que no es cierto. Cuando haya fotos reales, van en
`vehiculos` y `galeria` y las secciones aparecen solas.

---

## 5b. Indicador de sección en la navegación

La barra marca en qué sección está la persona: subrayado amarillo en escritorio,
barra lateral en el menú móvil, y `aria-current="true"` para los lectores de
pantalla.

**Cómo se calcula** (`src/lib/seccionActiva.ts`): la sección activa es la que
tiene su borde superior más cerca de la línea de la barra fija, entre las que ya
la pasaron. El cálculo se agrupa por cuadro de animación con
`requestAnimationFrame`, así el scroll no dispara trabajo de layout decenas de
veces por segundo.

Dos detalles que no son obvios:

- **No se usa un `IntersectionObserver`.** La pregunta acá no es "¿esta sección
  se ve?" sino "¿en cuál estoy?", y son cosas distintas: con dos secciones
  visibles a la vez el observador marcaría las dos, y dentro de una sección más
  alta que la pantalla no marcaría ninguna.
- **No se recorre el menú en orden.** Se comparan posiciones reales. Escrito de
  la otra forma el indicador fallaba apenas el orden del menú dejaba de coincidir
  con el de la página — que fue exactamente lo que pasó al escribirlo.

Al final de la página se marca la última sección, que de otro modo podría ser
demasiado baja como para llegar nunca a la línea.

---

## 5c. Acceso al panel desde el sitio (atajo oculto)

El sitio público **no enlaza** el panel de administración. El personal entra con
**Ctrl + Shift + clic en el logo**, que abre el ingreso al panel en una pestaña
nueva. Con teclado, la misma combinación sobre Enter con el logo enfocado. Sin
los dos modificadores el logo se comporta como siempre y lleva al inicio.

La dirección del panel se configura en `VITE_PANEL_URL`.

### Esto es discreción, no seguridad

Conviene que quede escrito, porque es fácil confundirlo:

> Esconder el enlace **no protege nada**. La dirección del panel es pública
> igual y quien la conozca puede abrirla y ver la pantalla de ingreso.

Lo que protege el panel es lo de siempre: la autenticación de Supabase, y la
verificación del rol **contra la base** en cada petición, no contra el token. Un
usuario sin rol de administrador que llegue al panel no puede hacer nada, con
atajo o sin él.

Lo que sí aporta: el sitio público queda enfocado en quien busca clases, sin un
botón de "ingresar" que confunde a los visitantes e invita a probar credenciales.

---

## 6. Accesibilidad y movimiento

- **Reducir movimiento**: quien lo pidió en su sistema operativo no recibe ni el
  scroll suave ni las animaciones de entrada. Verificado: con esa preferencia
  activa, los 42 bloques animados se muestran completos.
- **Teclado**: hay salto al contenido, el menú móvil se cierra con Escape y
  todos los controles tienen foco visible.
- **Navbar fija**: `scroll-padding-top` evita que la barra tape el título al
  saltar a una sección. Verificado: tras navegar a `#planes`, el título queda a
  más de 60 px del borde superior.
- **Lectores de pantalla**: los íconos decorativos llevan `aria-hidden`, y los
  que cargan significado (los de la lista de contacto) tienen su texto
  alternativo.

---

## 7. SEO local

En `index.html`:

- `title` y `description` con la ciudad y el departamento.
- `canonical`, `robots`, `theme-color` con el rojo de la marca.
- `geo.region` / `geo.placename`.
- Open Graph y Twitter Card para cuando el enlace se comparte por WhatsApp.
- Datos estructurados `schema.org/DrivingSchool` con el área de cobertura.

**Pendiente y no inventable:** `telephone`, `streetAddress`, `geo` y
`openingHours` en el JSON-LD, y la imagen `og:image` de 1200×630. Los campos que
falten hay que **agregarlos**, nunca inventarlos: Google penaliza los datos
estructurados que no coinciden con lo que la página muestra.

---

## 8. Qué se verificó, y cómo

Todo en un Chromium real, contra la API y la base corriendo de verdad, a
1280×900 y a 390×844.

| Qué | Resultado |
|---|---|
| Precios traídos de la API y formateados en pesos | OK |
| Servicio con precio 0 → "Consultanos el precio" | OK |
| Servicio sin duración (gestoría) no dice "0 minutos" | Corregido y OK |
| Ningún bloque queda invisible tras la animación | OK (42/42) |
| Sin scroll horizontal en móvil | OK (0 px de desborde) |
| Secciones sin datos reales no se renderizan | OK (vehículos, instructores, testimonios, galería) |
| Sin WhatsApp: no hay formulario ni botón flotante | OK |
| Con WhatsApp: el formulario arma el mensaje correcto | OK |
| El formulario no manda datos a ningún servidor | OK (0 peticiones no-GET) |
| Campo obligatorio frena el envío | OK |
| Escape cierra el menú móvil | OK |
| Reducir movimiento muestra todo el contenido | OK |
| Indicador de sección acompaña el scroll en las 6 secciones | OK |
| Nunca hay dos secciones marcadas a la vez | OK |
| El sitio no tiene ningún enlace al panel | OK |
| Clic normal, o solo Ctrl, o solo Shift: no abren el panel | OK |
| Ctrl + Shift + clic, y Ctrl + Shift + Enter: abren el ingreso | OK |
| Sin errores en consola | OK |

---

## 9. Qué falta para publicar

Por orden de importancia:

1. **El número de WhatsApp.** Es el dato más importante de la página: sin él no
   hay formulario, ni botón flotante, ni CTA de WhatsApp.
2. **Precios reales**, cargados desde el panel (no desde el código).
3. Teléfono, correo, dirección, horarios y enlace de Google Maps.
4. Fotos propias de la academia, las clases y los vehículos.
5. Instructores, con su autorización para publicar nombre y foto.
6. Testimonios, con autorización expresa del alumno.
7. Textos de política de privacidad y términos (hoy los enlaces del pie apuntan
   a rutas que todavía no existen).
8. Imagen `og:image` de 1200×630 y dominio definitivo.
