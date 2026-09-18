# Buscador de alumno, galería por años y navbar con íconos

> Cuatro cambios de interfaz que comparten una idea: **dejar de hacer que la
> persona recorra listas**. Escribir dos letras en vez de bajar por un
> desplegable de trescientos, bajar la página en vez de elegir un año en un
> filtro, y reconocer un ícono en vez de leer once nombres apretados.

Etapa 6: 6.A el buscador, 6.B la API de la galería, 6.C los carruseles, 6.D el navbar.
(Se numera 6 y no 5 porque la Etapa 5 del plan es «Expedientes y cumplimiento»,
que sigue pendiente.)

---

## 1. El buscador de alumno

`apps/admin/src/componentes/BuscadorDeAlumno.tsx`

Reemplaza al `<select>` con todos los alumnos cargados de una vez, en los dos
lugares donde había que elegir a alguien: **registrar un egresado** y **registrar
un pago en efectivo**.

Busca por **nombre, apellido, cédula o pasaporte**. La búsqueda la hace la API
(`GET /clientes?q=`), que además es la única que puede hacerla: filtrar en el
navegador exigiría traerse la tabla entera de alumnos, que es justo lo que no se
quiere.

### El error que arregla

El formulario de egresado pedía `porPagina: 100`. Con más de cien alumnos, el
alumno ciento uno **no se podía elegir**, y nada lo avisaba: el desplegable se
veía normal, simplemente esa persona no estaba. El buscador no tiene ese techo
porque no lista a nadie hasta que se escribe.

### Detalles que importan

- **Dos letras mínimo.** Con una sola, media academia entra en el resultado y la
  consulta no ayuda a nadie. La pantalla lo dice en vez de quedarse muda.
- **300 ms de espera.** Sin eso, escribir «Rodríguez» dispara nueve consultas.
- **Respuestas viejas descartadas.** Una respuesta lenta de «Ro» puede llegar
  después de la de «Rodríguez». Una bandera `vigente` en el efecto la ignora.
  Esa bandera vive **fuera** del `setTimeout`: devolver una función de limpieza
  desde adentro de un temporizador no la ejecuta nadie.
- **Tres estados distinguibles**: escribiste poco / estoy buscando / no hay
  nadie con eso. Sin el tercero, un error de tipeo se ve igual que una lista
  todavía cargando.
- **Se ve el documento** al lado del nombre. Con dos «Rodríguez» en la lista es
  lo único que permite elegir bien.
- **Accesible**: `role="combobox"` con `aria-expanded` y `aria-controls`, y la
  lista como `listbox`. Al tocar «Cambiar», el foco vuelve al campo.

---

## 2. La galería pública, por años

### La API

`GET /graduados/galeria` — **pública, sin sesión**. Devuelve los egresados
publicados agrupados por año, de más nuevo a más viejo, en una sola petición.

Dos topes, que no son decorativos: **24 fotos por año** y **12 años**. Sin ellos,
dentro de cinco años esta ruta devuelve mil fotos en cada carga y se convierte en
la forma más barata de tirar abajo el sitio. Si un año tiene más, la página lo
dice (`se muestran los 24 más recientes`) en vez de recortar en silencio.

Publica **exactamente los mismos campos** que la galería paginada —nombre,
apellido, categoría, año y foto— y hay una prueba que lo fija comparando las
claves: es una ruta pública nueva, y si se le colara la cédula quedaría al
alcance de cualquiera.

### Lo que se eliminó

- El filtro por año y la paginación de la página pública: los reemplazan los
  carruseles.
- `GET /graduados/anios` y `aniosPublicados()` en la API, y
  `obtenerAniosGraduados()` y `TAMANOS_PAGINA` en el frontend del sitio. Nadie
  los usaba después del cambio. **El panel no se ve afectado**: su filtro por año
  sale de `/graduados/resumen`, que es otra ruta.

### La página

Un carrusel por año. Se baja y están todos, agrupados por promoción, que es como
los recuerda la academia.

---

## 3. El carrusel

`apps/landing/src/componentes/ui/Carrusel.tsx`

Se desliza solo de izquierda a derecha y **se devuelve al llegar al extremo**.
Tres reglas que no son estéticas:

1. **Solo se mueve si no entra.** Si las fotos caben en el ancho disponible,
   quedan quietas: mover algo que ya se ve entero es ruido. Se mide con un
   `ResizeObserver`, porque el ancho cambia al rotar el teléfono.
2. **Se frena cuando alguien lo está mirando**: al pasar el mouse, al entrar con
   el teclado o al tocar la pantalla. Una fila que se corre justo cuando vas a
   tocar una foto es una trampa, no una animación.
3. **Respeta `prefers-reduced-motion`.** Quien pidió menos movimiento en su
   sistema no lo pidió solo para algunos sitios. Queda quieto y se maneja con las
   flechas.

Velocidad: **25 px/s**. Deliberadamente lento: la idea es que se note que hay más
fotos, no que desfilen.

### Dos cosas que costaron

- **Nada de `scroll-smooth` en la pista.** Con `scroll-behavior: smooth` en CSS,
  *cada* asignación de `scrollLeft` se anima, incluidas las sesenta por segundo
  del vaivén: el resultado es un temblor. Las flechas piden el suavizado por su
  cuenta, en `scrollBy({ behavior: 'smooth' })`.
- **La posición se lleva en una variable propia**, no se lee de `scrollLeft` en
  cada cuadro: el navegador lo redondea a enteros, y a 25 px/s eso significa
  avanzar de a saltos visibles. Al reanudar después de una pausa se resincroniza
  con el nodo, así que un arrastre manual no produce un salto.
- El salto entre cuadros se limita a 50 ms: una pestaña en segundo plano deja de
  recibir cuadros y, al volver, el primero llega con varios segundos acumulados.

En el teléfono no hay flechas: se arrastra con el dedo, que es el gesto natural.

---

## 4. El navbar del panel

Once secciones no entran escritas en una sola fila. En una pantalla de portátil
los nombres se apretaban hasta partirse en dos renglones y el encabezado crecía.

- **En el escritorio**: solo el ícono, con el nombre en un globo al dejar el
  mouse medio segundo.
- **En el teléfono**, donde el menú es vertical y sobra alto: ícono **y** nombre.

Los íconos son de [`lucide-react`](https://lucide.dev), que ya usaba el sitio
público: es la misma familia en todo el proyecto y no suma una dependencia nueva
al monorepo.

### La demora vive en CSS, no en un temporizador

`group-hover:delay-500` retrasa la aparición. Como el estado de reposo no tiene
demora, el globo **se va enseguida** al sacar el mouse. Un globo que tarda tanto
en irse como en venir se siente pegajoso. Sin JavaScript, sin temporizadores que
limpiar, sin estado.

### El nombre no desaparece

Está en el marcado como `sr-only`. El nombre accesible del enlace sigue siendo
«Pagos» y no queda un enlace sin texto; el globo es decoración (`aria-hidden`) y
no se anuncia dos veces.

---

## 5. Un arreglo de accesibilidad que apareció en el camino

Las páginas propias del sitio —**egresados** y **verificación de diploma**— no
tenían ningún `h1`: su título se dibujaba con `TituloSeccion`, que emite `h2`
porque en la portada es correcto (ahí el `h1` es el del hero).

Quien navega con lector de pantalla salta de encabezado en encabezado y nunca
encontraba de qué trataba la página. `TituloSeccion` ahora acepta `nivel={1}` y
esas dos páginas lo usan. Los años de la galería quedan como `h2`, colgando del
título, que es el orden correcto.

---

## 6. Qué se probó

- **484 pruebas de API**, incluidas tres nuevas de la galería agrupada: que
  agrupe bien por año, que publique los mismos campos que la paginada, y que no
  incluya a quien no autorizó su foto.
- **25 comprobaciones en el navegador** de la galería pública: que agrupe, que el
  año con 18 fotos desborde y el de 2 no, que el que desborda **se desplace de
  verdad** (se mide `scrollLeft` después de 1,6 s) y el otro no, que se frene con
  el mouse encima, que se devuelva al llegar al extremo, que las flechas
  adelanten, que la página tenga un solo `h1`, y que no se desborde en 390 px.
- **23 comprobaciones del panel**: las once secciones con su ícono, el encabezado
  en un solo renglón, el globo invisible en reposo / ausente a los 150 ms /
  visible después de la demora / ido enseguida al salir, y el buscador completo
  (mínimo de letras, por nombre, por documento, elegir, cambiar, sin resultados).

**No verificado acá:** las fotos contra el Storage real. El entorno no alcanza
`supabase.co`; la verificación se hizo sirviendo imágenes de prueba desde el
servidor local. Lo que queda por comprobar contra Supabase es que las direcciones
públicas del bucket `graduados` respondan, que es lo mismo que ya figura en
[`15-graduados-y-diploma.md`](15-graduados-y-diploma.md).

### Una colisión menor que quedó sin arreglar

En el escritorio, el botón flotante de WhatsApp (`fixed`, esquina inferior
derecha) puede taparle la flecha «siguiente» a un carrusel mientras ese carrusel
pasa por esa zona de la pantalla. Dura lo que dura el desplazamiento y el
carrusel se sigue pudiendo arrastrar, así que no se tocó: bajarle la prioridad al
botón de WhatsApp sería peor, porque ese botón sí tiene que estar siempre
arriba.
