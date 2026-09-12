# Protección de datos personales

> **Esto no es asesoramiento legal.** Es el checklist técnico que guía el
> desarrollo. Antes de salir a producción, la academia debería validar el
> cumplimiento con un asesor y confirmar los requisitos vigentes ante la
> **URCDP** (Unidad Reguladora y de Control de Datos Personales).

## Por qué aplica a este sistema

El sistema trata datos personales de alumnos:

| Dato | Dónde | Sensibilidad |
|---|---|---|
| Nombre, correo, teléfono | `usuarios` | Normal |
| Cédula de identidad | `clientes.cedula`, documentos | Identificatorio |
| Fecha de nacimiento, domicilio | `clientes` | Normal |
| **Certificado de aptitud médica** | `documentos_expediente` | **Datos de salud** |
| Comprobantes de pago | Storage | Financiero |

Los datos de salud tienen protección reforzada en la normativa uruguaya
(Ley 18.331). El certificado médico del trámite entra en esa categoría.

## Obligaciones a cubrir

| Obligación | Cómo se cubre | Estado |
|---|---|---|
| Consentimiento informado | Casilla en el alta + `usuarios.consentimiento_datos_at` | 🟡 Campo listo, formulario en Etapa 3 |
| Finalidad declarada | Política de privacidad publicada | ⬜ Pendiente |
| Principio de seguridad | Ver `docs/02-seguridad.md` | ✅ En curso |
| Inscripción de bases ante la URCDP | Trámite administrativo de la academia | ⬜ Pendiente |
| Notificación de vulneraciones | Procedimiento escrito (plazo breve, del orden de 72 h — **confirmar el plazo vigente**) | ⬜ Pendiente |
| Derechos de acceso, rectificación y supresión | Endpoints de exportación y borrado | ⬜ Etapa 3 |

## Principios aplicados en el diseño

### Minimización
No se pide lo que no se necesita. La cédula se guarda porque el trámite la exige;
no se guardan datos que no tengan un uso concreto en el sistema.

### Control de acceso por rol
- El alumno ve **solo** sus datos.
- El instructor ve los datos de contacto y agenda de **sus** alumnos, no sus
  documentos ni sus pagos.
- El administrador ve todo, y **cada acceso a un documento queda auditado**.

### Archivos nunca públicos
Documentos y comprobantes van a buckets privados con RLS, y se leen con signed
URL de 60–300 segundos. Ver `docs/02-seguridad.md`.

### Trazabilidad
`registros_auditoria` responde "¿quién accedió a este documento y cuándo?". Es lo
que permite investigar un incidente.

### Cifrado
- **En tránsito**: HTTPS en todo el sistema.
- **En reposo**: lo provee la infraestructura de Supabase.
- Cifrado adicional a nivel de campo para cédula: **a evaluar** en Etapa 3, según
  lo que recomiende el asesoramiento legal.

## Procedimiento ante una vulneración

Debe existir por escrito **antes** de que haga falta:

1. Contener (revocar claves, cerrar el acceso).
2. Determinar qué datos y qué personas se vieron afectadas.
3. Notificar a la URCDP dentro del plazo legal vigente.
4. Notificar a los titulares afectados.
5. Documentar el incidente y las medidas adoptadas.

## Textos a redactar antes de publicar

- [ ] Política de privacidad (qué datos se recogen, para qué, cuánto se
      conservan, cómo ejercer los derechos)
- [ ] Términos y condiciones del servicio
- [ ] Política de cancelación de clases
- [ ] Texto de consentimiento del formulario de alta
- [ ] Autorización expresa para publicar testimonios con nombre

Los enlaces ya están previstos en el pie de la landing
(`apps/landing/src/contenido.ts`, objeto `legal`).
