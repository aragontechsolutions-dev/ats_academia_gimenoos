# Dos arreglos: subir el comprobante y los avisos al teléfono

> Los dos salieron de usar el sistema en un teléfono de verdad, que es donde se
> ven las cosas que ninguna prueba de escritorio encuentra.

---

## 1. El comprobante en imagen no llegaba

**Lo que se reportó:** al subir una imagen, la app volvía a la pantalla de pago
con todo en blanco, como si no hubiera pasado nada. Con un PDF funcionaba.

### Lo que estaba mal

Cuatro cosas distintas, todas en el mismo camino:

**a) No había forma de reintentar.** El pago se crea *antes* de subir el
archivo, porque la carpeta donde vive el archivo lleva su identificador. Si algo
fallaba después de crearlo, el pago quedaba en «Falta el comprobante»… **y no
había ningún botón para completarlo**. El comentario del código decía que el
alumno podía reintentar sin empezar de cero; era mentira. La única salida era
empezar un pago nuevo.

**b) El teléfono puede cerrar la app mientras se busca la foto.** Abrir la
galería o la cámara deja a la app en segundo plano, y Android la cierra para
liberar memoria cuando le hace falta. Al volver, la app arranca de cero: el
servicio elegido se perdió y la pantalla está en blanco otra vez. **Esto explica
exactamente el síntoma**, y explica por qué con un PDF no pasaba: el selector de
documentos es mucho más liviano que la galería.

**c) El tipo del archivo se exigía exacto.** Se aceptaban `image/jpeg` y
`image/png` y nada más. Varios selectores de Android entregan el archivo con el
tipo **vacío**, y algunos escriben `image/jpg`, que no existe como tipo MIME. En
esos casos el comprobante se rechazaba con un mensaje que hablaba de PDF e
imágenes mientras la persona **estaba** eligiendo una imagen.

**d) Una foto de la cámara casi nunca entraba.** El tope es de 5 MB y una foto
de un teléfono actual pesa entre 3 y 8. Se rechazaba y listo.

### Lo que se hizo

| Arreglo | Qué resuelve |
|---|---|
| **Botón «Subir el comprobante»** en cada pago pendiente del historial | a, b, y cualquier otro tropiezo: nada se pierde |
| Un pago sin comprobante **siempre se ve**, aunque sea viejo | Es lo único de esa lista sobre lo que hay algo que hacer |
| El servicio elegido se **recuerda** (`sessionStorage`) | b: al volver, la app sigue donde estaba |
| El tipo se deduce del **nombre** cuando el navegador no lo declara | c |
| Alias para `image/jpg`, `image/pjpeg`, `image/x-png` | c |
| Se sube declarando el tipo explícito, nunca el del archivo | c: con el tipo vacío el bucket rechaza |
| Una imagen de más de 5 MB **se achica** en vez de rebotar | d |
| HEIC/HEIF (iPhone) da la instrucción concreta para arreglarlo | Antes daba «tiene que ser un PDF o una imagen» |
| Tras un error, el servicio elegido **no** se limpia | Reintentar no obliga a volver a elegir |
| El `<input>` se limpia siempre | Elegir dos veces el mismo archivo vuelve a disparar el evento |

### Sobre achicar la imagen

Hasta ahora este proyecto **no re-codificaba** los comprobantes, por una razón
buena: recomprimir puede dejar ilegible un número de transacción, que es el
único dato por el que el comprobante existe.

Eso sigue valiendo, con un límite: **sólo se toca lo que no entra**. Una imagen
de menos de 5 MB sube byte por byte como estaba. Una que pasa los 5 MB se lleva
a 2200 px de lado más largo con calidad 0.9 — generoso a propósito, para que el
número siga leyéndose — y la pantalla **avisa que la redujo**, por si hiciera
falta mandar el PDF.

La alternativa no era «subirla tal cual», era «no poder pagar».

Se aprovecha para aplicar la orientación EXIF al redibujar
(`createImageBitmap` con `imageOrientation: 'from-image'`): sin eso, la foto
vertical de un comprobante se sube acostada.

---

## 2. El alumno veía un error rojo al activar los avisos

**Lo que se reportó:** «La academia todavía no tiene configurados los avisos al
teléfono», en rojo, después de tocar «Sí, avisame».

### El mensaje era cierto, el momento estaba mal

La API contesta `{"clave": null}` mientras no estén cargadas las variables
`VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en Render. Eso es configuración
pendiente, no un error del sistema.

Pero el orden del código sí estaba mal:

```
1. pedirle permiso al navegador   ← se gastaba acá
2. pedir la clave a la API
3. descubrir que no hay clave y mostrar el error
```

**El permiso de notificaciones se pide una sola vez con comodidad.** Chrome
penaliza al sitio que pregunta y no lo usa, y si la persona dice que no,
recuperarlo exige que entre a los ajustes del sitio y lo cambie a mano. Se
estaba quemando ese único pedido para terminar en un error.

### Lo que se hizo

- **La clave primero, el permiso después.** Si no hay clave, no se le pide nada
  al navegador.
- Un estado nuevo, `sin-configurar`. Con él:
  - en «Mis clases» **no se ofrece nada** (antes salía la tarjeta roja);
  - en el perfil dice, sin prometer: «Los avisos en el teléfono todavía no están
    disponibles. Los estamos preparando».
- **Un fallo de red no es «no está configurado».** La clave se pide una sola vez
  y se distinguen tres respuestas: hay clave, la API dijo que no hay, y no se
  pudo preguntar. Sólo la segunda afirma que falta configurar.

### Para que funcione de verdad

Falta cargar en Render las dos variables del archivo `CLAVES_VAPID.txt` que se
entregó en su momento:

| Variable | Dónde |
|---|---|
| `VAPID_PUBLIC_KEY` | Render → el servicio de la API → *Environment* |
| `VAPID_PRIVATE_KEY` | Ídem |

Se comprueba en diez segundos abriendo
`https://gimenoos-api.onrender.com/api/v1/push/clave-publica`: mientras conteste
`{"clave":null}`, los avisos no están disponibles y la app lo dice sin ofrecer
nada. Ver [`25-avisos-en-el-telefono.md`](25-avisos-en-el-telefono.md).

---

## 3. Qué se probó

22 comprobaciones en el navegador, a 390 px, contra la API y la base reales:

- Un pago sin comprobante se ve, ofrece subirlo, y al subirlo deja de figurar
  como pendiente.
- Una imagen normal sube **tal cual**: se midió que llegan los mismos 7842 bytes
  y el mismo `image/png`.
- Una imagen de 25 MB se achica por debajo de 5 MB, se convierte a JPEG, y la
  pantalla avisa que la redujo.
- Un archivo **sin tipo declarado** y nombre `recibo.jpg` se acepta por la
  extensión y se sube declarando `image/jpeg`.
- Un `IMG_0042.HEIC` da la instrucción de iPhone, y **el servicio elegido no se
  pierde** tras ese error.
- Lo elegido sobrevive a recargar la página.
- Sin claves VAPID: no se ofrece la tarjeta, no aparece el error rojo, el perfil
  lo dice con calma, y **nunca se llama a `Notification.requestPermission()`**
  (se comprobó envolviendo la función).

**Lo simulado, y por qué:** este entorno no alcanza `supabase.co`, así que la
**subida a Storage** se interceptó en el navegador y se respondió con un 200.
Todo lo demás es real: la detección del tipo, el achicado, el nombre del
archivo, el aviso a la API y la base. Lo que queda por comprobar en el teléfono
es que el archivo efectivamente quede en el bucket.

**Lo que no se pudo reproducir:** que Android cierre la app mientras la galería
está abierta. Es la causa más probable del síntoma original y no se puede forzar
desde un navegador de escritorio. El arreglo no depende de reproducirlo: con el
botón de reintento y el servicio recordado, ese caso deja de perder nada.
