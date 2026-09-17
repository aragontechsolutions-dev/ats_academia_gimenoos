# Plan de desarrollo por etapas

## Etapa 0 — Fundaciones ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Monorepo pnpm con 4 apps + paquete compartido | ✅ |
| Esquema Prisma completo del dominio | ✅ |
| Migración con `EXCLUDE` constraints anti-doble-reserva | ✅ probada contra PostgreSQL 16 |
| Verificaciones de integridad (`CHECK`) | ✅ |
| Autenticación Supabase (JWKS/ES256) + roles | ✅ |
| Guard global cerrado por defecto | ✅ |
| Protecciones HTTP (helmet, CORS, throttling, validación) | ✅ |
| Traducción de errores de base a HTTP | ✅ |
| Landing con estructura SEO y contenido centralizado | ✅ |
| Panel con login y consulta de catálogo | ✅ |
| PWA instalable con service worker propio | ✅ |
| SQL de buckets y RLS de Storage | ✅ escrito, pendiente de aplicar |
| Pruebas automáticas de las constraints de agenda | ✅ 11 casos |
| CI con verificaciones obligatorias antes de mergear | ✅ |
| Documentación | ✅ |

### Verificado en esta etapa

- API arranca, `/health` responde 200 contra Postgres real.
- Endpoints públicos responden sin token; los protegidos devuelven 401 sin token
  y 401 con token inválido.
- Los tres frontends compilan para producción.
- Las constraints de agenda rechazan solapamientos y permiten clases
  consecutivas. Los 6 casos manuales quedaron convertidos en 11 pruebas
  automáticas que corren en cada pull request.

### Pendiente de datos reales

El sistema funciona, pero tiene placeholders marcados con `TODO(datos-reales)`:

| Qué falta | Dónde |
|---|---|
| Teléfono, WhatsApp, dirección, horarios, correo | `apps/landing/src/contenido.ts` |
| Precios reales de cada servicio | seed o panel (`apps/api/prisma/seed.ts`) |
| Instructores reales | `contenido.ts` + base |
| Vehículos reales (patente, cilindrada, SOA) | base |
| Testimonios reales **con autorización del alumno** | `contenido.ts` |
| Logo, colores de marca, íconos de la PWA | `index.css`, `vite.config.ts` |
| Dominio definitivo | `index.html`, `robots.txt` |

---

## Etapa 1 — Agenda y catálogo

Se divide en tres entregas para que cada una sea revisable por separado.

### Etapa 1.A — Backend de agenda ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Motor de cálculo de horarios disponibles | ✅ |
| Reservas: agendar, listar, reprogramar, cancelar, cambiar estado | ✅ |
| Permisos por rol, con verificación de pertenencia | ✅ |
| ABM de instructores, con plantilla semanal y excepciones | ✅ |
| ABM de vehículos | ✅ |
| ABM de servicios y precios | ✅ |
| Servicio de auditoría conectado a las acciones sensibles | ✅ |
| Consumo de clases de un pack al completar | ✅ |
| Pruebas, incluida la de concurrencia | ✅ 44 en total |

Detalle en [`10-motor-agenda.md`](10-motor-agenda.md).

### Etapa 1.B — Panel ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Calendario día / semana / mes con filtros | ✅ |
| Alta de clase eligiendo entre los horarios disponibles | ✅ |
| Detalle de clase: confirmar, dictada, ausente, cancelar | ✅ |
| ABM de alumnos y ficha con historial | ✅ |
| ABM de instructores con plantilla semanal y excepciones | ✅ |
| ABM de vehículos | ✅ |
| ABM de servicios y precios | ✅ |
| El alumno deja de necesitar cuenta para existir | ✅ migración |
| Vinculación automática de ficha al crear la cuenta | ✅ |
| Pruebas | ✅ 51 + recorrido en navegador real |

Detalle en [`11-panel.md`](11-panel.md).

### Etapa 1.C — PWA del alumno ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Ver próximas clases e historial | ✅ |
| Reservar eligiendo entre los horarios libres | ✅ |
| Cancelar según la política configurada | ✅ |
| Ficha propia: datos y saldo de packs | ✅ |
| Endpoints propios del alumno en la API | ✅ |
| Pruebas | ✅ 54 + recorrido en navegador |

Detalle en [`12-pwa-alumno.md`](12-pwa-alumno.md).

**Riesgo principal:** las zonas horarias. Todo se persiste en UTC y se convierte
a `America/Montevideo` solo al mostrar.

### Etapa 1.D — Sitio público profesional ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Identidad visual propia (rojo/amarillo/negro), contraste verificado | ✅ |
| Hero, barra de confianza, propuesta de valor, clases, proceso | ✅ |
| Planes con precios en vivo desde la API | ✅ |
| Trámite de la libreta, ubicación, preguntas frecuentes, CTA final | ✅ |
| Formulario de contacto que abre WhatsApp y **no almacena datos** | ✅ |
| Navbar fija, menú móvil, microinteracciones al hacer scroll | ✅ |
| SEO local: metadatos, Open Graph y `schema.org/DrivingSchool` | ✅ |
| Secciones sin datos reales que directamente no se renderizan | ✅ |
| Pruebas | ✅ recorrido en navegador a 1280×900 y 390×844 |

Detalle en [`13-landing.md`](13-landing.md).

### Etapa 1.E — Navegación y acceso ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Indicador de sección activa en la barra del sitio | ✅ |
| Acceso al panel desde el logo con Ctrl + Shift + clic, sin enlace visible | ✅ |

### Etapa 1.F — Contenido editable desde el panel ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Datos de contacto editables sin desplegar | ✅ |
| Textos, visibilidad y orden de las 16 secciones | ✅ |
| Listas editables (preguntas, beneficios, tarjetas, pasos, requisitos) | ✅ |
| El sitio sigue completo si la API no responde | ✅ |
| Panel con la identidad visual del sitio | ✅ |
| Pruebas | ✅ 77 + recorrido en navegador de punta a punta |

Detalle en [`14-contenido-editable.md`](14-contenido-editable.md).

### Etapa 1.G — Diploma de egresado y galería de graduados ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Diploma imprimible, sin datos sensibles | ✅ |
| Código de verificación y página pública para comprobarlo | ✅ |
| Sin autorización firmada no se publica (garantizado por la base) | ✅ |
| Autorización de tutor para menores de 18 | ✅ |
| Retiro de permiso y borrado (derecho de supresión) | ✅ |
| Galería en la portada y página histórica con filtro por año | ✅ |
| Paginado de 10 por defecto, con 20, 50 y 100 | ✅ |
| Formulario de autorización para imprimir | ✅ |
| Pruebas | ✅ 103 + recorrido en navegador de punta a punta |

Detalle en [`15-graduados-y-diploma.md`](15-graduados-y-diploma.md) y el
formulario en [`16-autorizacion-imagen.md`](16-autorizacion-imagen.md).

### Etapa 1.H — Fotos de los egresados ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Subida desde el panel, con reemplazo y borrado | ✅ |
| Reducción a 1000 px en el navegador | ✅ |
| Eliminación de metadatos, incluida la ubicación GPS | ✅ verificado en navegador |
| Orientación del EXIF aplicada (las fotos verticales salen verticales) | ✅ |
| Bucket público para leer, solo administrador para escribir | ✅ |
| La base guarda una ruta validada, nunca una dirección externa | ✅ |
| Pruebas | ✅ 107 + recorrido en navegador |

**No verificado:** una subida exitosa contra el Storage real. El entorno de
desarrollo no alcanza `supabase.co`. Ver la advertencia en
[`15-graduados-y-diploma.md`](15-graduados-y-diploma.md).

### Etapa 1.I — Validaciones finas del panel ✅ COMPLETADA

Un repaso sobre lo ya construido, para que los datos entren bien desde el
principio en vez de tener que limpiarlos después.

| Entregable | Estado |
|---|---|
| Teléfonos guardados con el código de país (`+598 98663201`) en alumnos e instructores | ✅ |
| Migración que normaliza los teléfonos ya cargados | ✅ verificado antes/después |
| Cédula sin puntos, guiones ni letras | ✅ |
| Pasaporte con país de emisión y letras pasadas a mayúscula solas | ✅ 257 países |
| Correo del alumno validado | ✅ |
| Paginado en alumnos, instructores, vehículos y egresados (10 por defecto; 20, 50, 100) | ✅ |
| Validación de fotos: extensión, tipo, peso y medidas | ✅ verificado en navegador |
| Foto de cada vehículo, con su propio endpoint | ✅ |
| Documentación | ✅ [`17-fotos.md`](17-fotos.md) y los documentos tocados |
| Pruebas | ✅ 148 + recorrido en navegador |

**No verificado:** lo mismo que en 1.H — una subida exitosa contra el Storage
real. Ver [`17-fotos.md`](17-fotos.md#5-qué-se-verificó).

**Con esto cierra la Etapa 1 completa.**

### Etapa 2.A — La app del alumno con la identidad del sitio ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Misma paleta y mismo logotipo que el sitio y el panel | ✅ |
| Barra de marca arriba, navegación abajo, zonas seguras respetadas | ✅ |
| `CONFIRMADA` deja de chocar con `AUSENTE` | ✅ |
| `theme-color` y favicon | ✅ |
| Contraste verificado, criterio AA | ✅ |
| Pruebas | ✅ recorrido en navegador a 390×844 |

### Etapa 2.B — Cuentas por invitación ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Nadie entra sin invitación, comprobado en la API y no solo en el navegador | ✅ |
| El vínculo cuenta↔ficha deja de adivinarse por correo | ✅ |
| Invitar, reenviar y dar de baja desde la ficha del alumno | ✅ |
| Reglas en la base, no solo en el código (5 constraints) | ✅ |
| Puerta de arranque para el primer administrador | ✅ |
| Documentación | ✅ [`18-cuentas-e-invitaciones.md`](18-cuentas-e-invitaciones.md) |
| Pruebas | ✅ 158 + recorridos HTTP y en navegador |

**No verificado:** el envío real del correo de invitación. El entorno de
desarrollo no alcanza `supabase.co`.

### Etapa 2.C — Pantalla de cuentas en el panel ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| Listado de cuentas con rol, estado y ficha vinculada, paginado y filtrable | ✅ |
| Invitaciones sin usar a la vista, con reenviar y dar de baja | ✅ |
| Invitar instructores y administradores desde el panel | ✅ |
| Cambiar rol y dar de baja sin borrar el historial | ✅ |
| Tres bloqueos contra quedarse sin acceso, en el servidor | ✅ |
| Todo auditado | ✅ |
| Pruebas | ✅ 169 + recorridos HTTP y en navegador |

### Etapa 2.E — Cerrar el ciclo desde el sitio ✅ COMPLETADA

| Entregable | Estado |
|---|---|
| «Dar acceso» visible en el listado de alumnos, no solo dentro de la ficha | ✅ |
| Enviar el enlace por WhatsApp, sin API de empresa ni costo | ✅ |
| Enviar por correo, como estaba | ✅ |
| El enlace no se guarda ni se registra en ningún lado | ✅ con pruebas |
| Confirmación con el número antes de abrir WhatsApp | ✅ |
| Documentación | ✅ [`18-cuentas-e-invitaciones.md`](18-cuentas-e-invitaciones.md) |
| Pruebas | ✅ 171 + recorridos HTTP y en navegador |

**No verificado:** la generación real del enlace contra Supabase, por la misma
razón de siempre.

### Etapa 2.F — Correos propios y enlaces que llegan a destino ✅ COMPLETADA

Tres problemas que aparecieron al probar el envío real.

| Entregable | Estado |
|---|---|
| Arreglo: el enlace por WhatsApp fallaba siempre (`action_link` mal leído) | ✅ |
| Plantillas de correo en español y con la identidad del sistema | ✅ verificadas en navegador |
| En producción, un destino `localhost` corta el envío en vez de fallar callado | ✅ con pruebas |
| Documentación de la configuración de Supabase que faltaba | ✅ |
| Pruebas | ✅ 174 |

### Etapa 2.G — El correo de fábrica no sirve para producción ✅ COMPLETADA

Al probar el envío real apareció que el remitente incluido de Supabase solo le
entrega a las cuentas del equipo del proyecto: al dueño le llegaba, a un alumno
no le llegaría nunca.

| Entregable | Estado |
|---|---|
| Arreglo: un 422 ya no se traduce siempre a «ya tiene cuenta» | ✅ |
| Mensajes que nombran la causa real y qué hacer | ✅ |
| Documentado que el SMTP propio es obligatorio, con el paso a paso | ✅ |

**Queda del lado de la academia:** configurar el servidor de correo. Hasta
entonces, el envío por WhatsApp funciona igual —no usa correo—, pero el ingreso
desde la app no.

### Etapa 2.H — Que el enlace llegue vivo ✅ COMPLETADA

La primera prueba real por WhatsApp falló con «el enlace es inválido o expiró»
sin que nadie lo hubiera usado. Causa: la dirección de verificación de Supabase
se consume con una sola visita, y **WhatsApp visita los enlaces** para armar la
vista previa del mensaje. Lo mismo hacen los antivirus de correo.

| Entregable | Estado |
|---|---|
| El enlace apunta a una pantalla propia que canjea el código desde JavaScript | ✅ |
| La pantalla existe en la app del alumno y en el panel | ✅ |
| Las plantillas de correo usan el mismo camino (`{{ .TokenHash }}`) | ✅ |
| Mensajes en español cuando el código ya no sirve | ✅ |
| Pruebas | ✅ 183, más una que carga la página **sin JavaScript** y comprueba que no se consuma el código |

### Etapa 2.D — PWA del instructor ✅ COMPLETADA

App propia para los instructores, y cerrar el acceso del rol `INSTRUCTOR` al
panel de administración. Ver [21-pwa-instructor.md](21-pwa-instructor.md).

| Qué | Estado |
|---|---|
| La app existe: `apps/instructor`, PWA, puerto 5176 | ✅ |
| Ingreso con enlace por correo, y canje del código en `/entrar` | ✅ |
| El control de acceso comprueba el **rol**, y a quien no corresponde le dice a dónde ir | ✅ |
| Su agenda: un día por vez, con el alumno, el vehículo y el punto de encuentro | ✅ |
| Llamar al alumno o escribirle por WhatsApp desde la clase | ✅ |
| La invitación de un instructor lleva a **su** app y ya no al panel | ✅ |
| Cerrar la clase desde la app (dictada / ausente) | ✅ |
| Observaciones de la clase, escritas por el instructor | ✅ |
| Cerrarle el panel al rol `INSTRUCTOR`, en el panel **y** en la API | ✅ |

El orden no es casual: **el panel se le cierra al final**. Hasta que la app no
cubra lo que hoy hace en el panel, sacárselo lo dejaría sin herramienta.

### Etapa 2.I — La app del instructor con su propia forma de trabajar ✅ COMPLETADA

La 2.D dejó la app en pie, pero con la forma de la app del alumno: una pantalla,
un día por vez. Esta etapa le da la forma de su trabajo.
Ver [21-pwa-instructor.md](21-pwa-instructor.md).

| Qué | Estado |
|---|---|
| Tres vistas de la agenda: **día, semana y mes**, con selector segmentado | ✅ |
| La semana como lista agrupada por día, no como grilla de siete columnas | ✅ |
| El mes como grilla de calendario, con la cantidad de clases por día | ✅ |
| Tocar un día en semana o mes abre ese día; las acciones viven solo ahí | ✅ |
| Llamar y WhatsApp como **botones grandes**, no enlaces al pie de una lista | ✅ |
| **Cancelar la clase** desde la app, con motivo obligatorio | ✅ |
| Resumen del período en el encabezado («4 clases · 1 en pie») | ✅ |
| Una clase pertenece al día en que **empieza**: la de las 23:30 no se cuela en el día siguiente | ✅ |
| Tope de 62 días al rango de `GET /agenda/reservas`, en la API | ✅ |
| Textos de acceso: la invitación hace falta una sola vez, y cómo instalar la app | ✅ |
| Limpieza: se sacó de la app lo copiado del panel que no usaba | ✅ |

Dos cosas que salieron de la verificación y no del plan:

- **Un error real, encontrado en el navegador:** la API filtra por solapamiento,
  así que una clase de 23:30 a 00:15 volvía en los dos días y aparecía *primera*
  bajo «Mañana». La prueba canceló la clase equivocada por eso, que es el mismo
  error que podría cometer un instructor. Corregido y con prueba de regresión.
- **El acceso no era un problema de arquitectura sino de texto.** La invitación
  se exige solo en el primer ingreso; después la sesión se mantiene sola y el
  instructor puede pedirse el enlace él mismo. No se agregó ningún mecanismo
  nuevo: se hizo visible el que ya existía.

### Etapa 2.J — Cada rol, en su lugar ✅ COMPLETADA

Salió de dos capturas: un instructor había entrado a la app del alumno con su
enlace de invitación, y la app del alumno mostraba un error rojo en vez de las
clases.

| Qué | Estado |
|---|---|
| **Corregida la regresión del tope de rango**, que rompió «Mis clases» del alumno | ✅ |
| El tope pasa a ser **por rol**: 730 días el alumno, 62 el instructor y administración | ✅ |
| Las **tres apps** comprueban el rol, no solo que haya sesión | ✅ |
| Quien se equivoca de app recibe el enlace de la suya, en las tres | ✅ |
| `POST /agenda/reservas` cerrado al instructor: no agenda para otros | ✅ |
| `PATCH …/reprogramar` solo administración: mover una clase toca la agenda de otros | ✅ |
| `GET /agenda/disponibilidad` cerrado al instructor | ✅ |
| No se puede dar rol de instructor a quien tiene ficha de alumno, ni al revés | ✅ |
| La matriz de agenda fijada por pruebas, con una que falla si aparece un endpoint sin rol decidido | ✅ |

Lo que se aprendió, que vale más que la lista:

- **Un tope único para todos no existe.** Lo que cambia entre roles no es la
  confianza sino cuánto trabajo puede costar la consulta. El alumno pide un año
  de historial sobre *sus* filas; administración pide un mes sobre *todas*.
- **Un endpoint sin `@Roles` está abierto a los tres roles**, y eso tiene que ser
  una decisión escrita, no un olvido. Tres endpoints de agenda lo eran.
- **`verificarAcceso` comprueba de quién es la fila, no quién puede hacer qué con
  ella.** Por eso un alumno podía reprogramar su propia clase eligiendo
  instructor y vehículo.
- **Tener sesión no dice en cuál de las tres apps se está**, porque las tres usan
  las mismas cuentas de Supabase.

### Etapa 2.K — El sistema dice qué pasó ✅ COMPLETADA

Salió de dos cosas que reportó la academia: una fecha que se adelantaba un día, y
avisos que no decían nada. Ver [`22-avisos.md`](22-avisos.md).

| Qué | Estado |
|---|---|
| La fecha de «hoy» deja de adelantarse de noche (se calculaba en UTC) | ✅ |
| Los errores de validación de la API se leen en español, traducidos en **un solo lugar** | ✅ |
| Los mensajes propios de cada DTO se respetan | ✅ |
| Avisos flotantes en las tres aplicaciones, con lo que de verdad pasó | ✅ |
| El motivo real del error llega a la pantalla, con una línea por campo mal | ✅ |
| Lo que el alumno escribe en su perfil deja de perderse si la ficha tarda | ✅ |
| Pruebas | ✅ 279 + 20 comprobaciones en navegador |

La regla que quedó: **aviso flotante para lo que la persona acaba de hacer,
cartel fijo para el estado de la pantalla.**

### Etapa 2.L — Avisos por Telegram y clic de WhatsApp ✅ COMPLETADA

Ver [`23-avisos-telegram.md`](23-avisos-telegram.md).

| Qué | Estado |
|---|---|
| Avisos al teléfono: clase agendada, cerrada, cancelada | ✅ |
| El token del bot vive en el servidor y **nunca** en la base ni en el panel | ✅ |
| Descubrimiento de conversaciones desde el panel, **por nombre** | ✅ |
| Botón de prueba, un interruptor por aviso, último envío y último fallo | ✅ |
| Los doce botones de WhatsApp del sitio avisan **desde qué sección** salieron | ✅ |
| El endpoint público, acotado por límite propio, lista cerrada e interruptor | ✅ |
| Pruebas | ✅ 315 + 26 comprobaciones en navegador |

**Queda del lado de la academia:** crear el bot con @BotFather y cargar
`TELEGRAM_BOT_TOKEN` en Render. Sin eso la API arranca igual y no manda avisos.

---

## Etapa 3 — Recordatorios de clase

### Etapa 3.A — El motor y el aviso a la academia ✅ COMPLETADA

Ver [`24-recordatorios.md`](24-recordatorios.md).

| Qué | Estado |
|---|---|
| Recordatorio 24 horas y 2 horas antes de cada clase | ✅ |
| Disparo **desde afuera** (GitHub Actions cada 15 min), no un temporizador interno | ✅ |
| Que nunca salga dos veces, garantizado por una clave única de la base | ✅ probado con dos pasadas en paralelo |
| Endpoint con secreto compartido y comparación en tiempo constante | ✅ probado sobre HTTP real |
| Primer canal: aviso a la academia por Telegram, con el teléfono del alumno | ✅ |
| Interruptor propio en el panel | ✅ |
| Pruebas | ✅ 342 |

**Por qué el disparo va por fuera:** en el plan gratuito de Render el servicio se
suspende por inactividad, y un temporizador suspendido no dispara nada —sin un
solo error en ningún registro—. Una llamada externa despierta al servicio **y**
hace el trabajo.

### Etapa 3.B — Aviso al alumno en su teléfono ✅ COMPLETADA

Ver [`25-avisos-en-el-telefono.md`](25-avisos-en-el-telefono.md).

| Qué | Estado |
|---|---|
| Claves VAPID y suscripciones guardadas por alumno | ✅ |
| Permiso pedido desde un clic, nunca al entrar | ✅ |
| Listeners `push` y `notificationclick` en `apps/cliente/src/sw.ts` | ✅ |
| El segundo aviso reemplaza al primero en vez de apilarse | ✅ |
| Tocar la notificación trae al frente la app abierta, sin duplicar pestañas | ✅ |
| Se ofrece en «Mis clases» y se controla desde el perfil | ✅ |
| Las suscripciones muertas se borran solas (404/410) | ✅ |
| Pruebas | ✅ 357 + 18 comprobaciones en navegador |

**Queda del lado de la academia:** cargar las tres variables VAPID en Render.
Sin ellas la app dice que los avisos no están disponibles, en vez de fallar.

**Limitación conocida:** en iPhone sólo funciona con la app agregada a la
pantalla de inicio. Es de Safari, no del sistema.

### Etapa 3.C — Recordatorio por correo ⏳ BLOQUEADA

Espera el servidor SMTP propio de la academia (ver la Etapa 2.G).

---

## Etapa 4 — Pagos

**Objetivo:** cobrar por los tres canales y conciliar.

### Checkout online (Mercado Pago)
- Creación de preferencia desde el backend, con el monto calculado allí.
- Webhook con validación de firma `x-signature` (HMAC-SHA256).
- Confirmación consultando la API de Mercado Pago tras el webhook.
- Idempotencia por `external_reference`.
- Probar en sandbox antes de producción.

### Comprobante de transferencia
- Subida a bucket privado con presigned upload URL.
- Bandeja de verificación en el panel, con signed URL temporal para ver el archivo.
- Aprobación/rechazo auditado.

### Cobro presencial (Mercado Pago Point)
> **Confirmar primero con Mercado Pago Uruguay** si la API de Point está
> disponible en producción para cuentas en pesos uruguayos. Si no lo está, Point
> queda como registro manual de cobro presencial (canal `MP_POINT` con carga a
> mano) y se automatiza cuando se habilite. **No comprometer esta parte del
> alcance con la academia hasta tener esa confirmación por escrito.**

---

## Etapa 5 — Expedientes y cumplimiento

### Expedientes de libreta
> **Antes de escribir código**, confirmar en la fuente oficial (gub.uy y portal
> de la Intendencia de Maldonado) los requisitos, categorías, domicilios y pasos
> vigentes del trámite. Cambian y varían por departamento. El modelo de datos ya
> contempla los estados, pero el contenido debe verificarse.

- Checklist de documentación por categoría.
- Subida de documentos a bucket privado.
- Seguimiento de estados y fechas de examen.

### PWA
- Vista completa de clases, pagos y expediente del alumno.
- Funcionamiento sin conexión del shell de la aplicación.

> Los recordatorios de clase se movieron a la **Etapa 3**, que ya tiene el motor
> construido. Lo que queda acá es el expediente de la libreta y el cumplimiento.

### Cumplimiento
- Inscripción de las bases de datos ante la URCDP.
- Publicación de política de privacidad y términos.
- Casilla de consentimiento informado en el alta.

Ver `docs/05-proteccion-datos.md`.

---

## Fuera de alcance inicial

- Categorías profesionales de licencia (B a F).
- Clases teóricas grupales con aforo (requieren un modelo de datos distinto al de
  `Reserva`, ver `docs/01-modelo-datos.md`).
- Aplicación nativa (la PWA cubre la necesidad).
- Facturación electrónica ante DGI.
