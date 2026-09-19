# Segunda auditoría de seguridad y QA

> La primera ([`27-auditoria-de-seguridad.md`](27-auditoria-de-seguridad.md))
> cerró la base y fijó los permisos. Desde entonces entraron **pagos, el
> tablero, los comprobantes en Storage, el buscador de alumnos, la galería
> pública agrupada y los avisos de pago**. Esta segunda pasada revisa todo eso,
> y vuelve a correr lo anterior para comprobar que no se aflojó.

Fecha: 19/09/2026. Todo lo que dice «comprobado» se ejecutó contra la API y la
base en marcha, no se leyó del código.

---

## 1. Resultado en una línea

| Qué | Cuánto | Resultado |
|---|---|---|
| Barrido contra la API en marcha (`qa-seguridad.mjs`) | 103 comprobaciones | todas pasan |
| Pruebas automáticas (`jest`) | 507 en 25 suites | todas pasan |
| XSS en las pantallas nuevas (navegador real) | 14 comprobaciones | todas pasan |
| Dependencias con vulnerabilidad conocida | 4 → **0** | corregido |
| Hallazgos corregidos en esta pasada | 3 | ver §2 |

---

## 2. Lo que estaba mal

### 2.1 · El motivo de un correo fallido arrastraba la dirección del destinatario

**Dónde:** `CorreoService.enviar()`.

El código tenía este comentario:

> *El destinatario NO va al registro: es un dato personal y los registros los lee
> más gente que la base.*

Y no lo escribía, en efecto. **Pero el servidor SMTP sí.** Un rechazo típico
llega así:

```
550 5.1.1 <ana@ejemplo.com>: Recipient address rejected
```

Ese texto iba a dos lugares: el registro del servidor **y** la columna `error`
de `recordatorios_enviados`, donde quedaba guardado indefinidamente. Una
dirección de correo es un dato personal (Ley 18.331), y esa tabla no está
pensada para contenerlos.

El comentario describía una intención que el código no garantizaba, que es la
peor clase de comentario: el que hace que nadie vuelva a mirar.

**Corregido:** `sinDirecciones()` tacha cualquier dirección del motivo, en el
único punto por el que pasan todos los fallos de correo. Deja legible el resto
(`550 5.1.1 … Recipient address rejected`), que es para lo que sirve. Seis
pruebas nuevas, con los formatos reales de rechazo.

### 2.2 · Cuatro vulnerabilidades conocidas en las dependencias

`pnpm audit` devolvía **3 altas y 1 baja**, todas en `multer`, que entra
arrastrado por `@nestjs/platform-express`.

**No eran explotables acá:** ninguna ruta de la API recibe archivos —se comprobó
que no hay un solo `FileInterceptor` ni `@UploadedFile`—, porque los
comprobantes van del navegador directo a Storage. Pero una dependencia
vulnerable que hoy no se usa es una que mañana alguien usa sin mirar.

**Corregido:** un `pnpm.overrides` de `multer` a `>=2.3.0`. Resuelve a 2.4.0 y
`pnpm audit` queda en cero. Actualizar `@nestjs/platform-express` **no**
alcanzaba: el rango de la versión 11 sigue admitiendo la vulnerable.

### 2.3 · El guion de datos de QA ya no se podía volver a correr

`scripts/qa-seguridad.sql` dice de sí mismo *«se puede volver a ejecutar cuantas
veces haga falta»*. Hacía tiempo que no era cierto:

- borraba las reservas **por identificador**, así que cualquier otra que el
  propio barrido hubiera creado por la API bloqueaba el borrado del alumno;
- no limpiaba `pagos`, `compras_servicio` ni `graduados`, que no existían cuando
  se escribió.

El archivo terminaba en `ROLLBACK` y el barrido no podía correrse. **Un guion de
seguridad que no se puede volver a correr es un guion que se deja de correr**, y
esa es exactamente la forma en que una auditoría deja de existir.

**Corregido:** la limpieza va por dueño y no por fila, en orden de hijo a padre,
cubriendo las tablas nuevas. Comprobado corriéndolo dos veces seguidas.

---

## 3. Lo que se comprobó y está bien

### 3.1 · Pagos: lo de uno no es de otro

Doce comprobaciones contra la API en marcha, con dos alumnas distintas —sin dos
no se puede probar que una no llega a lo de la otra—, un instructor y
administración:

- Bruno no puede colgarle un comprobante al pago de Ana.
- Ana no puede abrir el detalle de administración **de su propio pago**.
- Ana no puede pedir la dirección firmada del comprobante. Esa dirección abre un
  documento bancario **sin pedir sesión**: quien la consigue, ve el archivo.
- Ni Ana ni el instructor pueden aprobar, rechazar, listar ni registrar cobros.
- `GET /pagos/mios` de una persona no trae nada de la otra.
- El alumno no recibe `nota`, `comprobantePath` ni `verificadoPor`.

### 3.2 · No se puede salir de la carpeta propia

La API compone la ruta del bucket con el id de la sesión y el del pago, y del
cuerpo toma **sólo el nombre**. Se probaron once nombres:

| Intento | Resultado |
|---|---|
| `../../otro/comprobante.pdf` | 400 |
| `..%2F..%2Fotro.pdf` | 400 |
| `/etc/passwd` | 400 |
| `carpeta/archivo.pdf` | 400 |
| `comprobante.pdf\0.png` | 400 |
| `comprobante.svg` (puede traer scripts) | 400 |
| `comprobante.html` / `.php` | 400 |
| sin extensión | 400 |
| `COMPROBANTE.PDF` (el bucket espera minúsculas) | 400 |
| 200 caracteres de nombre | 400 |
| `comprobante-1.pdf` | **200**, como debe ser |

### 3.3 · Las políticas del bucket, probadas sin Supabase

Es lo único que separa el documento bancario de un alumno del de otro, y desde
acá no se alcanza Supabase. Se probaron las **tres cosas de las que depende**
(`test/politicas-storage.spec.ts`, 10 pruebas):

1. **Que la regla escrita sea la que creemos.** Se lee `01-storage.sql` y se
   comprueba que el bucket es privado, que acepta sólo PDF/JPEG/PNG (nada que el
   navegador ejecute), que leer exige que la primera carpeta sea la de quien
   pide, que **no hay política de borrado para el alumno**, y que la
   administración llega por una función `SECURITY DEFINER` y no por un permiso
   suelto.
2. **Que esa regla haga lo que se espera.** El predicado se ejecuta en Postgres:
   el dueño ve lo suyo, no ve lo del otro, un nombre con `..` no lo convierte en
   dueño, y un archivo en la raíz no es de nadie.
3. **Que la carpeta que usa la API sea la que pide la regla.** Este es el
   invariante silencioso: la política exige `auth.uid()` y la API compone la ruta
   con el id de la fila `usuarios`. Funciona porque **son el mismo valor**
   (`resolverDesdeToken` devuelve el `sub` del token). El día que dejen de serlo,
   nada fallaría a la vista: las subidas seguirían andando y los comprobantes
   quedarían inalcanzables.

**Estas pruebas tienen dientes.** Se comprobó aflojando la política de lectura y
agregando `image/svg+xml` a los tipos aceptados: las dos mutaciones las hicieron
fallar.

### 3.4 · Importes y campos de más

- El alumno manda `servicioId`, no el monto; mandarlo da 400.
- No se aprueba con monto negativo, cero, con centavos ni absurdo.
- No se rechaza sin escribir un motivo.
- No se puede colar `estado: APROBADO`, `clienteId` de otro, `comprobantePath`,
  `verificadoPor` ni `canal` en el cuerpo.
- Nadie se cambia el campo `activo` desde su perfil.

### 3.5 · El tablero

Devuelve la facturación de la academia y el rendimiento de cada instructor. Sólo
administración (403 para alumno e instructor, 401 sin sesión), rechaza fechas en
palabras, comillas, rangos invertidos, rangos de treinta años y parámetros que no
existen — y no arrastra ni un documento, ni un teléfono, ni un correo.

### 3.6 · La galería pública

Ruta nueva y **sin sesión**: lo que salga de ahí lo ve internet.

- Publica exactamente seis campos y ninguno más.
- Ningún año pasa las 24 fotos; no devuelve más de 12 años.
- Cae bajo el límite global de peticiones: se comprobó pidiéndola hasta que
  contestó 429.
- La ruta vieja `/graduados/anios` ya no sirve la lista a nadie.

### 3.7 · Enumerar identificadores

«No existe» y «no es tuyo» contestan **lo mismo**, con el mismo mensaje. Si se
distinguieran, probar identificadores diría cuáles existen.

### 3.8 · XSS en las pantallas nuevas

Se metieron cargas maliciosas **directamente en la base**, saltando la
validación, para probar el renderizado con datos ya sucios:

```
<img src=x onerror="window.__xss=1">
"><script>window.__xss2=1</script>
```

en el nombre de un alumno, de un instructor, de un servicio y de un egresado.
Después se recorrieron en un navegador real el buscador del panel, el listado de
pagos, el tablero, los globos del navbar y la galería pública con sus carruseles.
**Nada se ejecutó**, todo salió como texto, ningún `alert` se disparó, y un
nombre larguísimo no rompió el ancho de la página.

Se comprobó además que no hay un solo `dangerouslySetInnerHTML` ni asignación a
`innerHTML` en las cuatro aplicaciones, y que todos los `target="_blank"` llevan
`rel="noopener noreferrer"`.

### 3.9 · Los bundles del navegador

Ninguno de los cuatro contiene `service_role`, claves privadas VAPID,
credenciales SMTP, el token de Telegram, el de recordatorios, el secreto JWT ni
la cadena de conexión. Las ocho variables `VITE_*` que llegan al navegador son
las que tienen que estar; ninguna se llama como un secreto.

### 3.10 · Lo de la primera auditoría sigue en pie

Las 40 comprobaciones originales vuelven a pasar: acceso cruzado, escalada de
rol, reservar en nombre de otro, sesiones falsas (token con basura, firmado con
otra clave, vencido, de otro proyecto, con `alg:none`), fuga de datos, errores
que hablan de más, cabeceras, CORS, límite de peticiones, cuenta dada de baja y
cuerpos abusivos. La base sigue cerrada: ninguna tabla del esquema público es
legible ni escribible desde el navegador.

---

## 4. Lo que NO se pudo comprobar desde acá

Se dice para que nadie lo dé por hecho:

| Qué | Por qué | Cómo comprobarlo |
|---|---|---|
| Que Supabase aplique las políticas del bucket | Este entorno no alcanza `supabase.co` | Con dos sesiones de alumno distintas, pedir el archivo del otro contra `/storage/v1/object/comprobantes/…` y esperar 400/403 |
| Que la base en producción esté cerrada | Ídem | El `curl` de [`26-cierre-de-la-base.md`](26-cierre-de-la-base.md) |
| Que el aviso llegue a Telegram y al teléfono | No se alcanzan `api.telegram.org` ni los servicios de push, y faltan las credenciales en Render | Prender el interruptor y subir un comprobante de prueba |

---

## 5. Cómo volver a correr todo esto

```bash
# 1. Las pruebas automáticas (incluye las políticas de Storage)
pnpm --filter @gimenoos/api test

# 2. El barrido contra la API en marcha
pnpm --filter @gimenoos/api start:dev
psql "$DATABASE_URL" -f apps/api/scripts/qa-seguridad.sql
#   generar los cuatro tokens (ver el encabezado del .sql)
node apps/api/scripts/qa-seguridad.mjs

# 3. Las dependencias
pnpm audit --audit-level low
```

Las tres conviene pasarlas **antes de cada despliegue grande y cada vez que se
toca un permiso, una ruta pública o una política de Storage**.

---

> **Tercera pasada, tras los manuales.** El barrido pasó de 103 a **107**
> comprobaciones: los manuales no agregaron ninguna ruta a la API, su texto no
> viaja en el HTML servido, y cada aplicación lleva al navegador **solo el
> suyo**. Ver [`33-manuales.md`](33-manuales.md) §5.

