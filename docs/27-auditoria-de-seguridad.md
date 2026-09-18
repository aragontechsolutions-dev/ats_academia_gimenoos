# Auditoría de seguridad de punta a punta

Revisión completa del sistema: qué se miró, qué se encontró, qué se corrigió y
con qué se comprueba de acá en adelante.

---

## 1. Resumen

| Área | Resultado |
|---|---|
| **Acceso directo a la base** | 🔴 **Agujero grave, corregido.** Ver [`26-cierre-de-la-base.md`](26-cierre-de-la-base.md) |
| Cabeceras HTTP | 🟠 Faltaba `Content-Security-Policy`. Agregada |
| Permisos por endpoint | ✅ Las 60 rutas revisadas y clasificadas |
| Acceso cruzado entre alumnos | ✅ Ningún camino encontrado |
| Escalada de privilegios | ✅ Ninguno |
| Validación de sesiones | ✅ Seis formas de token falso, todas rechazadas |
| Datos que salen de más | ✅ Ninguno |
| Errores que hablan de más | ✅ Ninguno |
| CORS, límite de peticiones, cuerpos abusivos | ✅ |

**40 comprobaciones sobre la API en marcha, 62 pruebas automáticas nuevas.**

---

## 2. Lo que se encontró

### 🔴 Las tablas se podían leer desde el navegador

El hallazgo importante. Está contado entero en
[`26-cierre-de-la-base.md`](26-cierre-de-la-base.md): Supabase publica cada
tabla del esquema `public`, la clave anónima está en el código de las tres
aplicaciones, y las tablas estaban sin RLS y con permisos.

Se reprodujo, se corrigió con una migración de tres capas, y quedó una prueba
que falla si vuelve a pasar.

### 🟠 Faltaba la Content-Security-Policy

Estaba desactivada a propósito, con el razonamiento de que una API no sirve
HTML. Es cierto hoy, pero no protege de mañana: alcanza con que un endpoint
devuelva HTML alguna vez —una página de error, una redirección— para que la
falta se note.

Ahora declara la política más restrictiva que existe:

```
default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

En una API que solo devuelve JSON no cuesta nada, porque no hay nada que
permitir. La documentación interactiva queda exenta —es HTML y carga sus propios
scripts—, y solo existe fuera de producción.

---

## 3. Lo que se revisó y estaba bien

Vale escribirlo: son decisiones que alguien tomó bien en su momento y conviene
no deshacerlas sin querer.

**El guard está cerrado por omisión.** Sin `@Publico`, todo pide sesión.

**Las rutas «de uno mismo» no aceptan campos de más.** `PATCH /usuarios/me` solo
escribe nombre, apellido y teléfono, con la lista de campos explícita en el
código; mandar `rol: 'ADMIN'` devuelve 400 por el `forbidNonWhitelisted` global
y, aunque pasara, el `update` no lo escribiría. Lo mismo la ficha del alumno, que
no acepta `activo` ni `usuarioId` ni las notas internas.

**Un alumno no puede reservar para otro.** `resolverClienteDestino` le ignora el
`clienteId` que mande y usa el suyo. Comprobado sobre HTTP: la clase quedó a
nombre de quien la pidió, no de quien decía el cuerpo.

**Una cuenta dada de baja deja de entrar en el acto**, con su mismo token: el rol
y el estado se leen de la base en cada pedido, no del token.

**La documentación interactiva no se publica en producción.**

**Storage está bien pensado**: los buckets con datos personales son privados y se
leen con URLs firmadas; los de fotos son públicos para leer y solo
administración escribe; y la comprobación de rol consulta la tabla `usuarios`, no
el token, así que quitar un rol tiene efecto inmediato también ahí.

---

## 4. Las 60 rutas, clasificadas

`apps/api/test/inventario-de-rutas.spec.ts` obliga a que **cada ruta esté en una
de tres listas**, con su motivo escrito. Una ruta nueva sin clasificar hace
fallar el pull request.

La regla que lo hace necesario: el guard está cerrado por omisión, pero una ruta
sin `@Roles` **no** queda cerrada — queda abierta a los tres roles. A veces es
correcto y a veces es un descuido, y desde el código no se distinguen.

### Las 10 rutas sin sesión

Es la lista más delicada: lo que está ahí lo puede llamar cualquiera en internet.

| Ruta | Por qué |
|---|---|
| `health` | Estado del servicio. No devuelve datos ni versiones |
| `configuracion/publica` | Datos de contacto y políticas que muestra el sitio |
| `catalogo/servicios` | Precios publicados. Están para verse |
| `landing/contenido` | Los textos del sitio |
| `landing/contacto-whatsapp` | Sección de lista cerrada y límite propio de 6/min |
| `graduados/publicos`, `/anios` | Galería: solo los que autorizaron |
| `graduados/verificar/:codigo` | Comprobar un diploma. Es para lo que existe |
| `push/clave-publica` | La clave VAPID pública. Viaja en cada suscripción |
| `recordatorios/procesar` | Lo llama una máquina: secreto compartido, no sesión |

### Las 7 abiertas a los tres roles, a propósito

No son «rutas sin permisos»: son rutas donde el rol no decide *si se puede* sino
*qué se devuelve*, y eso lo resuelve el servicio mirando de quién es cada fila.
Son las de perfil propio, las de agenda propia y las de suscripción al aviso.

---

## 5. El barrido de seguridad

`apps/api/scripts/qa-seguridad.mjs` — 40 comprobaciones contra la API en marcha,
con cuatro sesiones reales: administración, **dos alumnas distintas** y un
instructor. Los dos alumnos son el punto: sin dos, no se puede comprobar que uno
no llega a lo del otro.

```
pnpm --filter @gimenoos/api qa:seguridad
```

Qué comprueba, en once bloques:

1. **Acceso cruzado** — Ana no puede ver ni cancelar la clase de Bruno, ni leer
   su ficha, ni listar alumnos. El instructor no puede listar cuentas ni leer la
   ficha de un alumno.
2. **Escalada de privilegios** — mandar `rol` en el perfil propio, usar el
   endpoint de administración sobre uno mismo, colar campos de más.
3. **Reservar en nombre de otro.**
4. **Sesiones falsas** — sin token, con basura, firmado con otra clave, vencido,
   de otro proyecto de Supabase, y con `alg: none`.
5. **Datos que no deberían salir** — las notas internas, la nota que el
   instructor escribe sobre el alumno, y que la configuración pública no traiga
   nada de Telegram ni claves.
6. **Errores que hablan de más** — ni rastros de Prisma, ni de Postgres, ni
   rutas del servidor.
7. **Cabeceras** — CSP, HSTS, `nosniff`, referrer, anti-iframe, y que no se
   anuncie la tecnología del servidor.
8. **CORS** — un origen desconocido no recibe permiso; uno conocido sí.
9. **Límite de peticiones.**
10. **Cuenta dada de baja** — su mismo token deja de servir.
11. **Cuerpos abusivos** — 200 KB en un nombre, un objeto donde va un texto, y
    pedir una página ilimitada.

Se corre a mano y no en CI porque necesita una base con datos y cuatro sesiones
firmadas. Conviene pasarlo antes de cada despliegue grande y cada vez que se
toca un permiso.

> Los archivos `t-qa-*.txt` son sesiones válidas. Están en `.gitignore` y no van
> al repositorio.

---

## 6. Lo que NO se pudo verificar

Dicho claro, porque la diferencia importa.

**El estado real del proyecto de Supabase en producción.** Este entorno de
desarrollo no alcanza `supabase.co`. Todo lo de la base se comprobó contra un
PostgreSQL local con la misma migración aplicada, y la reproducción del agujero
se hizo con un rol que imita a `anon`. **La comprobación contra el proyecto real
queda del lado de la academia**, y está explicada paso a paso en
[`26-cierre-de-la-base.md`](26-cierre-de-la-base.md#4-cómo-comprobarlo-en-el-proyecto-real).
Son dos minutos y vale la pena hacerla.

**Las políticas de Storage en vivo.** El razonamiento de por qué no se rompen
está verificado leyendo el SQL (`es_administrador()` es `SECURITY DEFINER`), pero
no se ejecutó contra el Storage real.

**Lo que no se auditó en esta pasada:** el código de los tres frontends más allá
de cómo llaman a la API, las dependencias de terceros (no se corrió un análisis
de vulnerabilidades de paquetes), y la configuración de Vercel y Render.

---

## 7. Lo que queda del lado de la academia

- [ ] **Comprobar el cierre contra el proyecto real**, con el `curl` de
      [`26-cierre-de-la-base.md`](26-cierre-de-la-base.md).
- [ ] **Proteger la rama `main`** en GitHub para que las verificaciones
      automáticas bloqueen el merge. Ver [`08-ci-cd.md`](08-ci-cd.md).
- [ ] **Vaciar `ADMIN_INICIAL_EMAIL`** en Render si ya hay un administrador
      creado. Mientras esté puesta, quien controle esa casilla puede crearse uno.
- [ ] Lo de protección de datos que sigue pendiente: inscripción ante la URCDP,
      política de privacidad publicada y consentimiento en el alta. Ver
      [`05-proteccion-datos.md`](05-proteccion-datos.md).
