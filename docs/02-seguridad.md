# Seguridad

Documento vivo. **Cada funcionalidad nueva se agrega a la tabla de revisión del
final antes de darse por terminada.**

## Autenticación

### Cómo funciona

1. El usuario inicia sesión contra **Supabase Auth** desde el frontend (el panel
   usa correo + contraseña; la PWA del alumno usa enlace por correo).
2. Supabase devuelve un JWT firmado.
3. El frontend lo envía en `Authorization: Bearer <token>`.
4. `SupabaseAuthGuard` (guard **global**) verifica la firma **localmente** contra
   el JWKS público del proyecto, sin llamar a Supabase en cada petición.

Archivos: `apps/api/src/common/auth/supabase-jwt.service.ts` y
`supabase-auth.guard.ts`.

### Qué se verifica en cada token

- Firma criptográfica contra el JWKS (`ES256`/`RS256`).
- `issuer` = `<SUPABASE_URL>/auth/v1`.
- `audience` = `authenticated`.
- Expiración.

`jose` cachea el JWKS y lo vuelve a pedir solo cuando aparece un `kid`
desconocido, así la rotación de claves de Supabase no rompe nada.

### Sobre el secreto heredado (HS256)

Los proyectos de Supabase anteriores a la migración a claves asimétricas firman
con un secreto compartido. Para esos casos existe `SUPABASE_JWT_LEGACY_SECRET`.
**Si está vacía, solo se aceptan tokens asimétricos**, que es lo recomendado. La
API deja un warning en el log cuando la variable está configurada.

### Decisión importante: el rol sale de la base, no del token

`UsuariosService.resolverDesdeToken()` lee el rol de la tabla `usuarios`, no del
JWT. Consecuencia: si se le quita el rol de administrador a alguien, o se
deshabilita su cuenta, **el cambio tiene efecto en la petición siguiente**, sin
esperar a que expire su token.

El rol solo se toma de `app_metadata.rol` del token **la primera vez**, al crear
el usuario local. `app_metadata` únicamente se puede escribir con la clave
`service_role`; `user_metadata`, en cambio, lo edita el propio usuario y por eso
**nunca** se usa para decisiones de autorización.

## Autorización

`RolesGuard` + decorador `@Roles(...)`. Roles: `ADMIN`, `INSTRUCTOR`, `CLIENTE`.

Todos los endpoints exigen autenticación **por defecto**; hay que marcarlos
explícitamente con `@Publico()` para abrirlos. Es al revés de lo habitual y es a
propósito: olvidarse de un decorador deja el endpoint cerrado, no abierto.

Permisos previstos:

| Rol | Alcance |
|---|---|
| `ADMIN` | Todo |
| `INSTRUCTOR` | **Solo su agenda**: ver sus clases, cerrarlas, cancelarlas y anotar cómo fueron. No entra al panel, no consulta el padrón de alumnos, los vehículos ni los instructores, y **no agenda ni reprograma**. Ver [21-pwa-instructor.md](21-pwa-instructor.md) |
| `CLIENTE` | Sus clases, sus pagos, su expediente. Reserva y cancela las suyas, pero **no** las reprograma: mover una clase cambia instructor y vehículo, o sea que toca la agenda de otros |

Los guards del frontend (`RutaProtegida`) son **comodidad de interfaz, no
seguridad**. Quien fuerce la ruta en el navegador igual recibe 401/403.

Por eso, cerrarle una aplicación a un rol se hace **en los dos lados**: la
pantalla, para que la persona sepa a dónde ir, y el `@Roles` de cada endpoint,
que es lo que de verdad cierra la puerta. Cerrar solo la pantalla deja la API
abierta a quien conozca su dirección y tenga un token válido.

`apps/api/test/permisos.spec.ts` fija quién puede llamar a qué leyendo los
decoradores. Se hace ahí y no llamando a los servicios porque varios dejan pasar
a quien la fila le pertenece —un alumno sobre SU propia clase—: en esos casos el
decorador es lo único que separa a un rol de otro.

### Un endpoint sin `@Roles` está abierto a los tres roles

Parece obvio escrito así, pero es el tipo de cosa que se escapa: los endpoints de
agenda se fueron escribiendo cuando los tres roles trabajaban en el panel, y
varios quedaron sin decorador. Al revisarlos se encontró que un **instructor**
podía agendar una clase para cualquier alumno —confirmada, salteándose la
antelación mínima y con una observación que el alumno sí ve—, y que un **alumno**
podía reprogramar su propia clase eligiendo instructor y vehículo. `verificarAcceso`
no lo impedía porque comprueba **de quién es** la fila, no **quién puede hacer qué**
con ella.

La matriz completa de agenda quedó así, y está fijada por pruebas que además
fallan si aparece un método nuevo sin decidir su rol:

| Endpoint | Quién |
|---|---|
| `GET /agenda/disponibilidad` | ADMIN, CLIENTE |
| `POST /agenda/reservas` | ADMIN, CLIENTE |
| `PATCH /agenda/reservas/:id/reprogramar` | ADMIN |
| `PATCH /agenda/reservas/:id/estado` | ADMIN, INSTRUCTOR |
| `PATCH /agenda/reservas/:id/nota` | ADMIN, INSTRUCTOR |
| `GET /agenda/reservas`, `GET /agenda/reservas/:id` | Los tres, acotado por el servicio |
| `PATCH /agenda/reservas/:id/cancelar` | Los tres, acotado por el servicio |

Los tres últimos no llevan `@Roles` **a propósito**, y eso también está escrito en
el código: los tres roles los usan legítimamente y lo que cambia es qué reciben o
sobre qué pueden operar, que lo decide el servicio.

### Tener sesión no dice en cuál de las tres apps se está

Las tres aplicaciones usan las mismas cuentas de Supabase. Una sesión válida sirve
en las tres, así que cada una tiene que comprobar el **rol**, no solo que haya
sesión.

Pasó en producción: un instructor entró a la app del alumno —su enlace de acceso
lo llevó ahí— y la app lo saludó por su nombre y le mostró «Tus clases de manejo».
No fue una fuga de datos, porque la API solo le devuelve lo suyo, pero estaba en
la app equivocada y nada se lo decía.

Las tres comprueban el rol y, a quien se equivocó de puerta, le dicen cuál es la
suya y le dan el enlace. El rol se pide a la API, que lo lee de la base: nunca se
saca del token del navegador.

### No alcanza con filtrar por fila: hay campos que dependen del rol

Acotar **qué filas** ve cada rol es lo primero, pero no siempre alcanza. Hay
campos que están en una fila a la que el rol sí tiene acceso y que igual no le
corresponden:

| Dato | Quién lo ve | Dónde se decide |
|---|---|---|
| `Cliente.notasInternas` | Solo `ADMIN` | `clientes.service.ts`, `campos(rol)` |
| `Reserva.notaInstructor` — cómo fue la clase | `ADMIN` e `INSTRUCTOR`, nunca el alumno | `reservas.service.ts`, `camposPara(rol)` |

La regla es la misma en los dos casos: **el campo no se le pide a la base** para
el rol que no debe verlo. No se trae y se oculta en la pantalla, porque ocultar
en el frontend es confiar en el cliente, y el dato viaja igual en la respuesta.

Las dos tienen pruebas que comprueban la ausencia del campo —no solo que no se
dibuje—, y que el rol que **sí** debe verlo lo recibe: sin esa segunda mitad, la
prueba pasaría aunque el campo no existiera.

### El atajo al panel desde la landing NO es un control de seguridad

El sitio público no enlaza el panel; se llega con Ctrl + Shift + clic en el logo.
**Eso es discreción, no seguridad**: la dirección del panel es pública y quien la
conozca puede abrirla igual.

Nada en el sistema puede depender de que ese atajo sea secreto. Lo que protege el
panel es la autenticación más la verificación del rol contra la base, descrita
arriba. Si en algún momento hace falta que el panel no sea alcanzable desde
internet, eso se resuelve en el despliegue (restricción por red o por dominio),
nunca escondiendo un enlace.

## Protecciones HTTP

Configuradas en `apps/api/src/main.ts`:

| Protección | Qué evita |
|---|---|
| `helmet` | Cabeceras de seguridad estándar |
| CORS con lista blanca (`CORS_ORIGINS`) | Que cualquier sitio llame a la API con las credenciales del usuario. Nunca `*` junto a credenciales |
| `ValidationPipe` con `whitelist` + `forbidNonWhitelisted` | *Mass assignment*: cualquier campo no declarado en el DTO hace fallar la petición en vez de llegar al ORM |
| `ThrottlerGuard` | Fuerza bruta y abuso. Configurable por env |
| Swagger deshabilitado en producción | Exponer el mapa completo de la API |
| Validación de entorno con Zod | Arrancar sin credenciales y fallar en runtime |

### Cuánto puede pedir una sola consulta

Dos límites, por el mismo motivo: una cuenta legítima no debería poder hacer que
la base recorra una tabla entera con una petición.

| Dónde | Límite |
|---|---|
| Listados paginados | `porPagina` acotado a 10, 20, 50 o 100, **en el DTO y otra vez en el servicio** |
| `GET /agenda/reservas` | El rango `desde`–`hasta`, con un tope **por rol** |

| Rol | Tope | Por qué ese número |
|---|---|---|
| `ADMIN` | 62 días | Es la única consulta **sin** acotar por persona, o sea la que de verdad puede recorrer la tabla entera. El panel no pide más que la grilla de un mes: 42 casilleros con los días de relleno |
| `INSTRUCTOR` | 62 días | Acotada a su agenda. Su app tampoco pide más que la grilla de un mes |
| `CLIENTE` | 730 días | Acotada a sus propias reservas por `clienteId`, así que el rango casi no influye: un alumno tiene decenas de clases, no miles. Su pantalla de «Mis clases» pide un año hacia atrás y tres meses hacia adelante |

**Por qué es por rol, y no un número único.** Empezó siendo uno solo, de 62 días,
y eso rompió la app del alumno en producción: «Mis clases» quedó mostrando un
error rojo en vez del historial. Lo que cambia entre roles no es la confianza
sino cuánto trabajo puede costar la consulta, y eso depende de si ya está
acotada a las filas de una persona.

Si alguna app necesita un período más largo, se sube el número de **ese** rol y
se ajusta la prueba que fija cuánto pide cada una. Hay siete pruebas sobre esto,
y una de ellas —la que más importa— comprueba justamente que el rango que pide la
app del alumno entra en su tope.

### Lo que escribe el panel y se muestra en el sitio público

El nombre, la dirección y los textos de las secciones los escribe quien
administra y se muestran en la página pública. Eso convierte al panel en una vía
de entrada: no hace falta un atacante externo para que termine HTML ajeno en el
sitio; alcanza con una cuenta de administración comprometida.

| Dónde | Cómo se cierra |
|---|---|
| Enlaces del panel (`mapaUrl`, `instagram`, `facebook`) | El DTO solo acepta `http://` y `https://`. Sin eso, un `javascript:` en un `href` ejecuta código en el navegador de cada visitante |
| Textos dentro de React | React escapa el contenido por su cuenta. No hay ningún `dangerouslySetInnerHTML` en el sitio |
| **El globo del marcador del mapa** | Se arma como elemento con `textContent`. `bindPopup` de Leaflet, si recibe una cadena, la inserta con `innerHTML` |

El último apareció al escribir el mapa y **estaba explotable**: con
`<img src=x onerror=…>` en el nombre de la academia, el código se ejecutaba en la
página pública al abrir el globo. Comprobado en un navegador de verdad antes y
después del arreglo.

**La regla que deja:** cualquier cosa que entregue contenido a una biblioteca de
terceros —Leaflet, un editor, un gráfico— sale de la protección de React. Ahí hay
que mirar la firma del método: si acepta una cadena y la trata como HTML, se le
pasa un elemento.

## Gestión de secretos

| Clave | Dónde vive | Nota |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo backend | Saltea RLS. Si aparece en un bundle de frontend, **rotarla de inmediato** |
| `VITE_SUPABASE_ANON_KEY` | Frontends | Está pensada para exponerse; no saltea RLS |
| `DATABASE_URL` / `DIRECT_URL` | Solo backend | Contienen la contraseña de la base |

Regla: **cualquier variable con prefijo `VITE_` termina dentro del JavaScript que
descarga el visitante.** No existe forma de ocultarla.

`.env` está en `.gitignore`. Los `.env.example` documentan cada variable sin
valores reales.

## Archivos y documentos (Supabase Storage)

Aplica a cédulas, certificados médicos y comprobantes de pago.

1. **Buckets privados.** Ninguno público. Ver `infra/supabase/01-storage.sql`.
2. **RLS en `storage.objects`**: cada usuario accede solo a su carpeta
   (`<usuarioId>/...`); el rol administrador accede a todo.
3. **Lectura por signed URL de 60–300 segundos**, generada por el backend. Nunca
   se entrega una URL permanente.
4. **Subida con presigned upload URL**, para no exponer la `service_role`.
5. **Validación de tipo y tamaño**: JPG, PNG o PDF, hasta 5 MB (el límite que
   exige la Intendencia para documentos digitales).
6. **Cada acceso a un documento queda en `RegistroAuditoria`.**

## Pagos (Etapa 2 — pendiente)

Reglas que deben cumplirse sin excepción:

1. **El monto lo calcula el backend** desde el catálogo. Nunca se toma del
   request: si no, cualquiera cambia el precio desde el navegador.
2. **Un pago solo se aprueba por webhook verificado**, nunca por el redirect del
   navegador. El redirect lo controla el usuario.
3. **Validar la firma `x-signature`** (HMAC-SHA256) de cada webhook de Mercado
   Pago y, después de recibirlo, **consultar el pago en la API** de Mercado Pago
   para confirmar el estado.
4. **Idempotencia** por `external_reference` / `X-Idempotency-Key`: los webhooks
   se reintentan y no pueden generar cobros o acreditaciones duplicadas.
5. El comprobante de transferencia **no acredita nada por sí solo**: queda en
   `PENDIENTE_VERIFICACION` hasta que un administrador lo aprueba, y esa acción
   queda auditada.

## Datos personales

Ver `docs/05-proteccion-datos.md`. En resumen: cédula y datos de salud son datos
personales con protección reforzada; se aplica minimización, control de acceso
por rol y registro de auditoría.

## Checklist obligatorio para cada funcionalidad nueva

Antes de dar por terminada cualquier funcionalidad:

- [ ] ¿Los endpoints nuevos exigen autenticación? ¿Algún `@Publico()` de más?
- [ ] ¿El rol requerido es el mínimo necesario?
- [ ] ¿Un usuario puede leer o modificar datos de **otro** usuario cambiando un id
      en la URL? (IDOR — el fallo más común)
- [ ] ¿Los DTO validan **todos** los campos de entrada?
- [ ] ¿Los importes y estados los decide el servidor?
- [ ] ¿Los archivos van a bucket privado con RLS?
- [ ] ¿La acción sensible queda registrada en auditoría?
- [ ] ¿Los mensajes de error evitan revelar si un correo o recurso existe?
- [ ] ¿Alguna restricción de integridad debería vivir en la base?
- [ ] ¿Se agregó algún secreto nuevo? ¿Está fuera del repositorio y de los `VITE_`?

## Estado actual

| Área | Estado |
|---|---|
| Autenticación JWT (JWKS/ES256) | ✅ Implementado |
| Autorización por rol | ✅ Implementado |
| Guard global cerrado por defecto | ✅ Implementado |
| Validación estricta de entrada | ✅ Implementado |
| CORS con lista blanca | ✅ Implementado |
| Rate limiting | ✅ Implementado |
| Validación de entorno | ✅ Implementado |
| Integridad en la base (EXCLUDE + CHECK) | ✅ Implementado y probado |
| Verificación de pertenencia en agenda (anti-IDOR) | ✅ Implementado y probado |
| Campos sensibles filtrados por rol (cédula, domicilio, notas) | ✅ No se envían a quien no los necesita |
| Matriz de permisos verificada a nivel HTTP | ✅ Ver `12-pwa-alumno.md` |
| RLS de Storage | 📄 SQL escrito, pendiente de aplicar en Supabase |
| Registro de auditoría | ✅ Conectado a reservas, instructores, vehículos y precios |
| Seguridad de pagos | ⬜ Etapa 2 |
| Cifrado de campos sensibles en reposo | ⬜ A evaluar en Etapa 3 |
