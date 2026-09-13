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
| `INSTRUCTOR` | Su agenda, sus clases, fichas de sus alumnos |
| `CLIENTE` | Sus clases, sus pagos, su expediente |

Los guards del frontend (`RutaProtegida`) son **comodidad de interfaz, no
seguridad**. Quien fuerce la ruta en el navegador igual recibe 401/403.

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
