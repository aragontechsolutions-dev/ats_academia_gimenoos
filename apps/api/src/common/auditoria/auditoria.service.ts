import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Acciones auditadas. Se declara como union para que no se inventen nombres sueltos. */
export type AccionAuditada =
  | 'RESERVA_CREADA'
  | 'RESERVA_CANCELADA'
  | 'RESERVA_REPROGRAMADA'
  | 'RESERVA_ESTADO_CAMBIADO'
  | 'RESERVA_NOTA_GUARDADA'
  | 'INSTRUCTOR_CREADO'
  | 'INSTRUCTOR_ACTUALIZADO'
  | 'VEHICULO_CREADO'
  | 'VEHICULO_ACTUALIZADO'
  | 'VEHICULO_FOTO_CARGADA'
  | 'VEHICULO_FOTO_QUITADA'
  | 'SERVICIO_CREADO'
  | 'SERVICIO_ACTUALIZADO'
  | 'CLIENTE_CREADO'
  | 'CLIENTE_ACTUALIZADO'
  | 'LANDING_SECCION_ACTUALIZADA'
  | 'LANDING_NEGOCIO_ACTUALIZADO'
  | 'GRADUADO_CREADO'
  | 'GRADUADO_ACTUALIZADO'
  | 'GRADUADO_AUTORIZACION_RETIRADA'
  | 'GRADUADO_ELIMINADO'
  | 'INVITACION_ENVIADA'
  | 'INVITACION_REVOCADA'
  | 'INVITACION_ACEPTADA'
  | 'ADMIN_INICIAL_CREADO'
  | 'USUARIO_ROL_CAMBIADO'
  | 'USUARIO_DESACTIVADO'
  | 'USUARIO_REACTIVADO';

export interface EventoAuditoria {
  usuarioId: string | null;
  accion: AccionAuditada;
  entidad: string;
  entidadId?: string;
  /** Qué pasó. NUNCA datos sensibles ni secretos: ni cédulas, ni claves, ni rutas de documentos. */
  detalle?: Prisma.InputJsonValue;
}

/**
 * Registro de acciones sensibles.
 *
 * Responde "¿quién hizo esto y cuándo?", que es lo que permite investigar un
 * incidente. Es parte del principio de seguridad de la Ley 18.331.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento.
   *
   * Un fallo al auditar NUNCA debe tumbar la operación de negocio: si la reserva
   * se creó bien, no tiene sentido devolver un error porque no se pudo escribir
   * la bitácora. Se registra en el log del servidor para no perder el rastro.
   */
  async registrar(evento: EventoAuditoria, tx?: Prisma.TransactionClient): Promise<void> {
    const cliente = tx ?? this.prisma;
    try {
      await cliente.registroAuditoria.create({
        data: {
          usuarioId: evento.usuarioId,
          accion: evento.accion,
          entidad: evento.entidad,
          entidadId: evento.entidadId ?? null,
          detalle: evento.detalle,
        },
      });
    } catch (problema) {
      this.logger.error(
        `No se pudo auditar ${evento.accion} sobre ${evento.entidad}/${evento.entidadId ?? '-'}`,
        (problema as Error).stack,
      );
    }
  }
}
