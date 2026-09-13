# Plantillas de correo

Los correos que manda Supabase vienen en inglés y sin ninguna identidad. Acá
están reescritos en español y con los colores del sistema.

| Archivo | Dónde se pega | Cuándo lo recibe alguien |
|---|---|---|
| `invitacion.html` | **Invite user** | La academia le habilitó el acceso |
| `ingreso.html` | **Magic Link** | Ya tiene cuenta y pidió entrar desde la app |

## Cómo se cargan

Supabase **no** lee estos archivos: hay que pegarlos a mano, una vez.

1. Panel de Supabase → **Authentication** → **Emails**.
2. Elegir la plantilla (*Invite user* o *Magic Link*).
3. Cambiar el **asunto** por el de abajo y pegar el contenido del archivo en el
   cuerpo, reemplazando lo que haya.
4. Guardar.

| Plantilla | Asunto sugerido |
|---|---|
| Invite user | `Tu acceso a la app de Academia Gimenoos` |
| Magic Link | `Tu enlace para entrar · Academia Gimenoos` |

Las demás plantillas (*Confirm signup*, *Reset password*, *Change email*) **no se
usan**: nadie se registra solo ni entra con contraseña. Si alguna vez se usaran,
conviene traducirlas con el mismo formato.

## Por qué están escritas con tablas y estilos en línea

No son páginas web. Los clientes de correo —Gmail, Outlook, el de iPhone—
descartan las hojas de estilo y no entienden flexbox ni grid. Lo que en el sitio
es un `div` con clases, acá es una `<table>` con atributos y `style=` en cada
elemento.

Tres decisiones que parecen rarezas y no lo son:

- **El botón es una tabla con fondo**, no un enlace con relleno: Outlook ignora
  el `padding` de los enlaces y el botón quedaría como texto suelto.
- **Debajo del botón va la dirección completa en texto.** Varios clientes no
  dejan tocar botones hasta que la persona marca al remitente como seguro, y sin
  esa línea el correo no sirve para nada.
- **El ancho máximo es 600 px**, que es lo que entra en las vistas previas sin
  recortarse.

## Variables

Lo que Supabase reemplaza al enviar: `{{ .ConfirmationURL }}` (el enlace),
`{{ .Email }}`, `{{ .SiteURL }}`, `{{ .Token }}`, `{{ .TokenHash }}` y
`{{ .RedirectTo }}`.

**No se pudo probar el envío desde el entorno de desarrollo**, que no alcanza
`supabase.co`. Después de pegarlas, conviene mandarse una invitación a uno mismo
y mirarla en el teléfono y en la computadora.
