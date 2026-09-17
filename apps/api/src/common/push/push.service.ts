import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';

import { PrismaService } from '../prisma/prisma.service';

/** Lo que ve la persona en la notificación. */
export interface AvisoPush {
  titulo: string;
  cuerpo: string;
  /** A dónde lleva al tocarla, dentro de la app. */
  url: string;
}

/** Cómo terminó el envío a una persona. */
export type ResultadoPush =
  | { estado: 'enviado'; dispositivos: number }
  /** No hay claves configuradas, o esa persona no tiene ningún navegador suscripto. */
  | { estado: 'omitido' }
  | { estado: 'fallo'; motivo: string };

/**
 * Notificaciones al teléfono del alumno, por Web Push.
 *
 * No hace falta ninguna cuenta ni ningún servicio de pago: el navegador se
 * suscribe contra el servicio de su fabricante (Google, Mozilla, Apple) y la
 * API le manda el aviso firmado con un par de claves VAPID propias.
 *
 * **El contenido viaja cifrado de punta a punta.** El servicio del fabricante
 * reenvía el paquete sin poder leerlo: sólo el navegador que se suscribió tiene
 * la clave. Aun así, el texto se mantiene corto y sin datos sensibles, porque
 * una notificación se ve en la pantalla bloqueada.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** La clave pública, o null si todavía no se configuró. Es pública: se le da al navegador. */
  get clavePublica(): string | null {
    const clave = this.config.get<string>('VAPID_PUBLIC_KEY');
    return clave && clave.length > 0 ? clave : null;
  }

  private get configurado(): boolean {
    const privada = this.config.get<string>('VAPID_PRIVATE_KEY');
    return Boolean(this.clavePublica && privada && privada.length > 0);
  }

  /**
   * Manda un aviso a TODOS los navegadores de una persona.
   *
   * A todos y no a uno: no hay forma de saber cuál está mirando. Quien tiene la
   * app en el teléfono y en la computadora recibe en los dos, que es lo que
   * espera.
   *
   * Cuenta como enviado si llegó **al menos a uno**. Que una de tres
   * suscripciones esté vencida no es un fallo del aviso.
   */
  async avisar(usuarioId: string, aviso: AvisoPush): Promise<ResultadoPush> {
    if (!this.configurado) return { estado: 'omitido' };

    const suscripciones = await this.prisma.suscripcionPush.findMany({ where: { usuarioId } });
    if (suscripciones.length === 0) return { estado: 'omitido' };

    webpush.setVapidDetails(
      this.config.getOrThrow<string>('VAPID_SUBJECT'),
      this.config.getOrThrow<string>('VAPID_PUBLIC_KEY'),
      this.config.getOrThrow<string>('VAPID_PRIVATE_KEY'),
    );

    const carga = JSON.stringify(aviso);
    let entregados = 0;
    const motivos: string[] = [];

    for (const suscripcion of suscripciones) {
      try {
        await webpush.sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
          },
          carga,
          // TTL: cuánto lo guarda el servicio del navegador si el teléfono está
          // apagado. Cuatro horas alcanzan para un recordatorio; más allá de eso
          // el aviso ya no sirve y es mejor que no aparezca tarde.
          { TTL: 4 * 60 * 60 },
        );
        entregados++;
      } catch (problema) {
        motivos.push(await this.manejarFallo(suscripcion.id, suscripcion.endpoint, problema));
      }
    }

    if (entregados > 0) {
      await this.prisma.suscripcionPush.updateMany({
        where: { usuarioId },
        data: { ultimoEnvioAt: new Date() },
      });
      return { estado: 'enviado', dispositivos: entregados };
    }

    return { estado: 'fallo', motivo: motivos.join('; ').slice(0, 500) };
  }

  /**
   * Qué hacer cuando un envío falla.
   *
   * 404 y 410 significan que esa suscripción ya no existe: la persona desinstaló
   * la app, borró los datos del navegador o revocó el permiso. **Se borra.** Si
   * no, la tabla se llena de direcciones muertas y cada recordatorio se
   * convierte en una ronda de errores que no llevan a ninguna parte.
   *
   * Cualquier otro error se deja pasar: puede ser el servicio del fabricante
   * caído un rato, y borrar por eso perdería una suscripción que sirve.
   */
  private async manejarFallo(id: string, endpoint: string, problema: unknown): Promise<string> {
    if (problema instanceof WebPushError && (problema.statusCode === 404 || problema.statusCode === 410)) {
      await this.prisma.suscripcionPush.delete({ where: { id } }).catch(() => undefined);
      // Se registra el dominio y no la dirección entera: la dirección completa
      // es lo que permitiría mandarle avisos a esa persona.
      this.log.log(`Suscripción vencida, borrada (${dominioDe(endpoint)})`);
      return 'suscripción vencida';
    }

    const motivo =
      problema instanceof WebPushError
        ? `${problema.statusCode} ${problema.body?.slice(0, 120) ?? ''}`.trim()
        : problema instanceof Error
          ? problema.message
          : String(problema);

    this.log.warn(`No se pudo mandar el aviso a ${dominioDe(endpoint)}: ${motivo}`);
    return motivo;
  }
}

/** El dominio del servicio de notificaciones, para poder registrar sin exponer la dirección. */
function dominioDe(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'desconocido';
  }
}
