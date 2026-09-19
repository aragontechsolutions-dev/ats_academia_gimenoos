import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/** Un correo, tal como sale del sistema. */
export interface CorreoASalir {
  para: string;
  asunto: string;
  html: string;
  /**
   * La misma información, en texto plano.
   *
   * No es un extra: hay clientes de correo que solo muestran esto, y los
   * filtros de spam desconfían de un correo que solo trae HTML.
   */
  texto: string;
  /** Cabeceras de más. Se usa para la baja de suscripción. */
  cabeceras?: Record<string, string>;
}

/** Cómo terminó el envío. Es el mismo trato que usan Telegram y el push. */
export type ResultadoDeCorreo =
  | { estado: 'enviado' }
  /** No hay servidor de correo configurado. */
  | { estado: 'omitido' }
  | { estado: 'fallo'; motivo: string };

/**
 * El correo que manda la API por su cuenta.
 *
 * **No es el mismo camino que los correos de invitación y de ingreso.** Esos los
 * manda Supabase Auth, que solo sabe mandar los suyos: una invitación, un enlace
 * de acceso, un cambio de contraseña. Un recordatorio de clase no es ninguno de
 * esos, así que sale de acá, hablando SMTP directamente con el mismo servidor
 * —Brevo— que ya tiene configurado la academia.
 *
 * Que sea el mismo servidor importa: el dominio ya está autenticado ahí, así que
 * estos correos heredan la reputación de los que ya llegan bien.
 */
/**
 * Tacha las direcciones de correo del motivo de un fallo.
 *
 * No alcanza con «no escribir el destinatario en el mensaje»: los servidores
 * SMTP lo meten ellos. Un rechazo típico llega como
 * `550 5.1.1 <ana@ejemplo.com>: Recipient address rejected`, y ese motivo va a
 * dos lados que no son la base de personas: el registro del servidor y la
 * columna `error` de `recordatorios_enviados`, donde quedaría guardado para
 * siempre. Una dirección de correo es un dato personal (Ley 18.331).
 *
 * Se tacha acá, en el único lugar por donde pasan todos los fallos de correo,
 * y no en cada sitio que los consume: así no hay forma de olvidarse en uno.
 */
export function sinDirecciones(mensaje: string): string {
  return mensaje.replace(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g, '«dirección»');
}

@Injectable()
export class CorreoService {
  private readonly log = new Logger(CorreoService.name);
  private transporte: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Si hay servidor de correo configurado. */
  get configurado(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST') && this.config.get<string>('SMTP_USER'));
  }

  /**
   * El transporte, creado una sola vez.
   *
   * `pool: true` reusa la conexión entre correos. Una pasada de recordatorios
   * puede mandar varios seguidos, y abrir una conexión SMTP nueva para cada uno
   * es lento y además hace que el servidor lo tome por un envío masivo.
   */
  private obtenerTransporte(): Transporter {
    if (this.transporte) return this.transporte;

    const puerto = this.config.get<number>('SMTP_PUERTO') ?? 587;
    this.transporte = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: puerto,
      // 465 es SMTPS (cifrado desde el principio). 587 empieza en claro y sube a
      // TLS con STARTTLS, que es lo que hace `secure: false` con `requireTLS`.
      secure: puerto === 465,
      requireTLS: puerto !== 465,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
      pool: true,
      maxConnections: 2,
      // Cortes generosos: mandar un correo pasa por un servidor de afuera. Pero
      // acotados, porque esto corre dentro de una pasada de recordatorios.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return this.transporte;
  }

  /**
   * Manda un correo. No lanza nunca.
   *
   * Devuelve cómo terminó, igual que el aviso por Telegram y el push, para que
   * quien manda recordatorios pueda distinguir «no correspondía» de «falló».
   */
  async enviar(correo: CorreoASalir): Promise<ResultadoDeCorreo> {
    if (!this.configurado) return { estado: 'omitido' };

    try {
      await this.obtenerTransporte().sendMail({
        from: this.config.getOrThrow<string>('SMTP_DESDE'),
        to: correo.para,
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
        headers: correo.cabeceras,
      });
      return { estado: 'enviado' };
    } catch (problema) {
      const motivo = sinDirecciones(problema instanceof Error ? problema.message : String(problema));
      this.log.warn(`No se pudo mandar un correo: ${motivo}`);
      return { estado: 'fallo', motivo };
    }
  }
}
