import { TipoRecordatorio } from '@prisma/client';

import type { ClaseParaRecordar } from './mensajes';

/**
 * El recordatorio que le llega al alumno por correo.
 *
 * Está escrito con las mismas reglas que las plantillas de Supabase
 * (`infra/supabase/plantillas-correo/`), y por los mismos motivos: los clientes
 * de correo descartan las hojas de estilo y no entienden flexbox ni grid, así
 * que **todo el estilo va en línea y la estructura en `<table>`**. 600 px de
 * ancho máximo, que es lo que muestran las vistas previas sin recortar.
 *
 * Los colores son los del sitio, escritos con su valor: #c20425 y #0b0b0d.
 */

/** Escapa lo que va dentro del HTML del correo. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface CorreoDeRecordatorio {
  asunto: string;
  html: string;
  texto: string;
}

/**
 * Arma el correo completo.
 *
 * `cuando` llega ya redactado —«mañana a las 14:00»— desde `mensajes.ts`, para
 * que los tres canales digan exactamente lo mismo y no haya tres formas de
 * escribir la misma hora.
 */
export function correoDeRecordatorio(
  clase: ClaseParaRecordar,
  tipo: TipoRecordatorio,
  cuando: string,
  enlaceDeBaja: string,
): CorreoDeRecordatorio {
  const esManiana = tipo === TipoRecordatorio.VEINTICUATRO_HORAS;
  const asunto = esManiana ? 'Tenés clase mañana' : 'Tu clase es en un rato';

  const instructor = `${clase.instructor.nombre} ${clase.instructor.apellido}`;
  const detalle = `Clase de ${clase.tipo.toLowerCase()} ${cuando} con ${instructor}.`;

  const texto = [
    `Hola ${clase.cliente.nombre},`,
    '',
    detalle,
    '',
    'Si no vas a poder ir, avisanos con tiempo así le liberamos el horario a otro alumno.',
    '',
    '—',
    'Academia de Choferes Gimenoos',
    '',
    `Para dejar de recibir estos avisos: ${enlaceDeBaja}`,
  ].join('\n');

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;margin:0;padding:24px 12px;font-family:'Segoe UI',system-ui,-apple-system,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="background-color:#0b0b0d;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">GIMENOOS</span>
            <span style="color:#c20425;font-size:18px;font-weight:700;">.</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:16px;color:#0b0b0d;">Hola ${escapar(clase.cliente.nombre)},</p>
            <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0b0b0d;line-height:1.35;">${escapar(asunto)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:10px;">
              <tr>
                <td style="padding:16px 18px;font-size:16px;color:#0b0b0d;line-height:1.5;">${escapar(detalle)}</td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.5;">
              Si no vas a poder ir, avisanos con tiempo así le liberamos el horario a otro alumno.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 26px;">
            <p style="margin:0;border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;color:#64748b;line-height:1.6;">
              Academia de Choferes Gimenoos · San Carlos, Maldonado<br />
              <a href="${escapar(enlaceDeBaja)}" style="color:#64748b;">Dejar de recibir estos avisos</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return { asunto, html, texto };
}
