# El cierre de la base

Ninguna tabla del sistema se puede leer ni escribir desde el navegador. Esta
página explica por qué hacía falta cerrarlo, cómo quedó y cómo comprobarlo.

---

## 1. El agujero

Supabase publica **automáticamente** cada tabla del esquema `public` a través de
PostgREST:

```
https://<proyecto>.supabase.co/rest/v1/clientes
```

Y la clave anónima está —necesariamente— dentro del código de las tres
aplicaciones, porque hace falta para el login. Mirar el código fuente de la
página alcanza para sacarla.

Al crear las tablas con Prisma quedaban dos cosas por omisión:

1. **Sin RLS.** Sin políticas de fila, no había nada que filtrara quién ve qué.
2. **Con permisos** para los roles `anon` y `authenticated`, porque Supabase
   define privilegios por defecto sobre el esquema `public`.

Las dos juntas significaban que cualquiera podía leer y escribir las tablas sin
pasar por la API: **cédulas, teléfonos, direcciones, correos, invitaciones y la
auditoría entera**.

### La demostración

Se reprodujo con un rol que imita a `anon` —puede conectarse y ver el esquema,
nada más—:

| Situación | Resultado |
|---|---|
| Como estaba: permisos concedidos, sin RLS | **10 fichas de alumnos legibles** |
| Con el cierre aplicado | `permission denied for table clientes` |
| Solo RLS, sin revocar los permisos | 0 filas |

---

## 2. Cómo quedó

La migración `20260918000000_cerrar_acceso_directo_a_la_base` aplica tres capas:

**1. RLS activado en todas las tablas, sin políticas.** Sin políticas, RLS niega
todo. Es lo correcto: nadie tiene que llegar a estas tablas desde el navegador.

**2. Permisos revocados a `anon` y `authenticated`.** Es la capa que de verdad
cierra la puerta. RLS queda como segunda línea, por si algún día alguien agrega
una política sin querer.

**3. Privilegios por defecto corregidos**, para que las tablas que se creen más
adelante no nazcan abiertas otra vez. Sin esto, la próxima migración de Prisma
crearía una tabla abierta y el arreglo quedaría desactualizado en silencio.

Va como **migración** y no como un script suelto a propósito: se aplica sola en
cada despliegue y no depende de que alguien se acuerde de correrla.

---

## 3. Por qué esto no rompe nada

**La API no pasa por PostgREST.** Se conecta por Postgres con el rol dueño de las
tablas, y el dueño ignora RLS (no se usa `FORCE ROW LEVEL SECURITY`). Las 357
pruebas siguen pasando con RLS activado, que es la comprobación.

**Las políticas de Storage siguen funcionando.** Consultan `public.usuarios` a
través de `public.es_administrador()`, que es `SECURITY DEFINER`: corre con los
permisos de su dueño y no con los de quien la llama. Por eso sigue andando
aunque `authenticated` ya no pueda leer esa tabla.

> Esto no fue suerte: se leyó `infra/supabase/01-storage.sql` **antes** de
> revocar nada, justamente para ver si algo dependía de esos permisos.

**Los frontends solo usan Supabase para autenticarse**, que vive en el esquema
`auth` y esto no lo toca.

---

## 4. Cómo comprobarlo en el proyecto real

Este entorno de desarrollo no alcanza `supabase.co`, así que **la verificación
contra el proyecto de producción queda del lado de la academia**. Son dos
minutos.

### La prueba directa

Con la clave anónima —la que está en las variables `VITE_SUPABASE_ANON_KEY` de
Vercel—, desde cualquier terminal:

```bash
curl "https://<proyecto>.supabase.co/rest/v1/clientes?select=*" \
  -H "apikey: <la-clave-anonima>"
```

| Respuesta | Qué significa |
|---|---|
| `[]` o un error de permisos | ✅ Cerrado |
| Una lista con fichas de alumnos | ❌ La migración no se aplicó |

### En el SQL Editor de Supabase

```sql
SELECT tablename,
       rowsecurity AS tiene_rls,
       has_table_privilege('anon', 'public.' || quote_ident(tablename), 'SELECT') AS anon_puede_leer
  FROM pg_tables
 WHERE schemaname = 'public'
 ORDER BY tablename;
```

Todas las filas tienen que decir `tiene_rls = true` y `anon_puede_leer = false`.

---

## 5. Que no vuelva a pasar

`apps/api/test/base-cerrada.spec.ts` comprueba en cada pull request:

- Que **ninguna** tabla del esquema quedó sin RLS. Hay una lista de excepciones
  y está vacía; si alguna vez hay que agregar una, el motivo tiene que caber en
  un renglón y convencer a quien revise.
- Que un rol sin permisos **no puede** leer ninguna de las once tablas con datos
  personales, ni escribir en ninguna del esquema. Se comprueba de verdad,
  creando el rol y preguntando por sus permisos reales, no leyendo una lista de
  configuración.
- Que la prueba no pasa por mirar una lista vacía: se exige que haya tablas.

Una tabla nueva sin RLS hace **fallar el pull request** en vez de llegar a
producción abierta.

---

## 6. Lo que sigue valiendo de antes

Este cierre **no reemplaza** nada de lo que ya había: el guard cerrado por
omisión, los roles por endpoint, la comprobación de pertenencia fila por fila.
Es la capa que faltaba **debajo** de todas esas, para el caso en que alguien no
pase por la API en absoluto.

Ver [`02-seguridad.md`](02-seguridad.md) para el conjunto completo y
[`27-auditoria-de-seguridad.md`](27-auditoria-de-seguridad.md) para la revisión
de punta a punta.
