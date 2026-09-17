# Los avisos: qué se le dice al usuario cuando algo pasa

Cada vez que alguien guarda, cancela, cierra o borra algo, el sistema **le dice
qué pasó**. Y cuando algo sale mal, le dice **por qué**, con el motivo real y en
español.

Esta página explica cómo está armado, dónde se toca y qué regla decide entre un
aviso flotante y un cartel fijo.

---

## 1. El problema que resuelve

Antes de esto convivían tres formas de avisar, ninguna completa:

- Un cartel `<Aviso>` incrustado en cada pantalla, que había que ir a buscar con
  la vista y que en un modal largo quedaba fuera de lo que se veía.
- Pantallas donde la acción salía bien y **no se avisaba nada**: el alumno
  reservaba una clase, la pantalla cambiaba y no quedaba ninguna confirmación.
- Errores contados con un texto propio de cada pantalla —«No se pudo guardar»—
  que tapaba el motivo verdadero que la API sí había explicado.

El caso que lo dejó a la vista: un alumno con el nombre de una sola letra
producía un «Error al guardar». El servidor había contestado
`nombre must be longer than or equal to 2 characters`; ni el motivo ni el idioma
llegaban a la pantalla.

---

## 2. Cómo funciona, de punta a punta

### 2.1 La API contesta en español

`apps/api/src/common/validacion/mensajes-de-validacion.ts` traduce los mensajes
de `class-validator` en **un solo lugar**, en vez de escribir un `message:` en
cada uno de los 300 y pico de decoradores.

```
nombre must be longer than or equal to 2 characters
→ nombre tiene que tener al menos 2 caracteres

tipo must be one of the following values: MOTO, AUTO
→ tipo tiene que ser uno de: MOTO, AUTO
```

Se engancha en `main.ts`, en el `exceptionFactory` del `ValidationPipe` global.

**Los mensajes propios de cada DTO se respetan.** La traducción sólo actúa sobre
los mensajes de fábrica, y los distingue por una regla simple: los de fábrica
empiezan con el nombre de la propiedad. Por eso «La patente debe tener entre 6 y
10 caracteres alfanuméricos, sin espacios», que está escrito a mano en su DTO,
llega intacto.

Está cubierto por `apps/api/test/mensajes-de-validacion.spec.ts`, que además
comprueba que no quede nada en inglés.

### 2.2 El navegador lee bien la respuesta

NestJS contesta de dos formas distintas según el tipo de problema:

| Tipo de error | `message` |
|---|---|
| De negocio (el horario está ocupado) | un texto |
| De validación (los datos están mal) | una **lista** de textos |

`leerProblema()`, en `src/lib/api.ts` de las tres aplicaciones, contempla las
dos y arma un `ErrorApi` con `mensaje` y `detalles`:

- lista de uno → ese texto es el mensaje;
- lista de varios → «Hay N datos para corregir» y la lista va en `detalles`;
- texto → ese texto;
- nada usable → un texto según el código HTTP (401, 403, 404, 429, 5xx).

### 2.3 La pantalla lo muestra

`src/lib/avisos.tsx` (uno por aplicación) expone `useAvisos()`:

```ts
const avisos = useAvisos();

avisos.exito('Alumno creado');   // qué pasó, en concreto
avisos.error(problema);          // el problema tal cual vino
```

`avisos.error()` recibe **el error entero**, no un texto ya digerido: de ahí saca
el mensaje y los detalles. Es lo que permite mostrar los dos renglones de un
formulario con dos campos mal.

`ProveedorAvisos` envuelve la aplicación **por fuera de las rutas**, y `<Avisos />`
se dibuja una sola vez al final. Por eso un aviso disparado al guardar sobrevive
al cambio de pantalla: el alumno reserva, la app lo lleva a «Mis clases» y la
confirmación viaja con él.

---

## 3. La regla: aviso flotante o cartel fijo

> **Flotante (toast)** para lo que **acaba de hacer** el usuario.
> **Cartel `<Aviso>` fijo** para el **estado de la pantalla**.

| Situación | Qué se usa |
|---|---|
| Guardó, creó, canceló, cerró una clase, subió una foto | Flotante |
| Falló esa acción | Flotante de error |
| No se pudo cargar la lista / la ficha | Cartel fijo, arriba |
| Falta un dato de configuración («sin WhatsApp no hay botón») | Cartel fijo |
| La búsqueda de horarios no devolvió nada | Texto en la propia sección |

La diferencia no es estética: un aviso flotante se retira, y lo que describe el
estado de la pantalla tiene que seguir ahí mientras ese estado siga siendo cierto.

---

## 4. Decisiones que parecen detalles y no lo son

**El error no se va solo.** Un «listo» se ve de reojo; un error hay que leerlo y
a veces copiarlo. `DURACION_MS` deja el éxito 4 segundos y el error en 0, que
significa «hasta que lo cierren».

**Los avisos van abajo a la izquierda en el panel.** Contra la costumbre, y por
un motivo concreto: todos los modales del panel llevan Cancelar y Guardar abajo
a la derecha. El aviso de «ese dato está mal» aparecía justo encima del botón
que hay que volver a apretar después de corregirlo.

**En la app del alumno suben por encima de la barra de secciones.** La barra está
fija al pie; con la separación de siempre, el aviso le quedaba encima y tapaba
los botones para seguir navegando.

**Cada aviso dice qué objeto tocó, no sólo qué acción.** El instructor cierra una
clase y lee «Clase marcada como dictada · Lautaro Alumno». La tarjeta cambia de
lugar apenas se recarga la agenda; sin el nombre no queda forma de verificar que
se tocó la clase que se quería tocar.

**Las fotos avisan desde el componente y no desde la pantalla.** `CeldaFoto` sabe
si subió, cambió o quitó; quien la usa sólo recibe un `onCambio` y no podría
distinguirlas. Por eso el `onError` que antes recibía como prop ya no existe.

**El identificador de cada aviso es un contador, no `Date.now()`.** Dos avisos
disparados en el mismo milisegundo compartirían clave y React reusaría el nodo
del anterior.

**Sin proveedor, `useAvisos()` tira error.** Un aviso que no se dibuja es peor
que ninguno: la información existió y no llegó. Que falle al montar es preferible
a que falle en silencio el día que alguien crea una aplicación nueva.

---

## 5. Seguridad

**Lo que se muestra es lo que la API decidió mostrar.** El navegador no inventa
texto ni interpreta el cuerpo del error más allá de `message`. Todo lo que ve el
usuario salió de un `HttpException` escrito a propósito o de la traducción de un
mensaje de validación.

**Ningún aviso agrega datos que la respuesta no traiga.** No se compone con el
correo de otra persona, ni con identificadores internos, ni con el cuerpo crudo
de la respuesta. Los nombres que aparecen —«· Lautaro Alumno»— son de la ficha
que esa persona ya tenía en pantalla.

**No se renderiza HTML.** Los textos van como contenido de texto de React, que
escapa por defecto. Un mensaje de error con `<script>` se ve como texto.

**El aviso no decide quién entra.** Quién puede ver cada pantalla lo resuelve
`RutaProtegida` con el perfil que devuelve la API, y quién puede hacer cada cosa
lo resuelve la API. Un 401 o un 403 en medio de una acción se muestra como aviso
—«Tu sesión venció. Volvé a entrar.»— pero eso es contarle a la persona lo que
pasó, no abrirle ni cerrarle nada: la puerta ya la cerró el servidor.

---

## 6. Dónde tocar

| Para… | Archivo |
|---|---|
| Cambiar cuánto dura un aviso | `src/lib/avisos.tsx` → `DURACION_MS` |
| Cambiar cómo se ve o dónde aparece | `src/componentes/ui/Avisos.tsx` |
| Agregar un texto de éxito | En la pantalla, junto a la acción |
| Traducir un mensaje nuevo de `class-validator` | `apps/api/src/common/validacion/mensajes-de-validacion.ts` |
| Cambiar qué se dice ante un 5xx | `segunElCodigo()` en `src/lib/api.ts` |

Al agregar una pantalla con acciones: pedir `useAvisos()`, avisar el éxito con
**lo que pasó** —«Vehículo creado», no «Listo»— y pasarle a `avisos.error()` el
error **entero**, sin convertirlo antes a texto.
