import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Traduce errores de Prisma/Postgres a respuestas HTTP con mensaje util.
 *
 * El caso mas importante es el codigo 23P01 (exclusion_violation): lo lanza
 * Postgres cuando dos reservas se solapan sobre el mismo instructor o el mismo
 * vehiculo. Esa carrera se resuelve en la base, no en el codigo, y aca se
 * convierte en un 409 entendible para el usuario.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(excepcion: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpException = this.traducir(excepcion);
    const status = httpException.getStatus();

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.url}`, excepcion.stack);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(httpException.getResponse() as object),
    });
  }

  private traducir(excepcion: Error): HttpException {
    const mensajeCrudo = excepcion.message ?? '';

    // Violacion de EXCLUDE constraint: el horario ya estaba ocupado.
    if (mensajeCrudo.includes('23P01') || mensajeCrudo.includes('exclusion constraint')) {
      if (mensajeCrudo.includes('reservas_sin_solape_vehiculo')) {
        return new ConflictException('Ese vehiculo ya esta reservado en el horario seleccionado');
      }
      if (mensajeCrudo.includes('reservas_sin_solape_instructor')) {
        return new ConflictException('Ese instructor ya tiene una clase en el horario seleccionado');
      }
      return new ConflictException('El horario seleccionado ya fue tomado');
    }

    if (excepcion instanceof Prisma.PrismaClientKnownRequestError) {
      switch (excepcion.code) {
        case 'P2002': {
          const campos = (excepcion.meta?.target as string[] | undefined)?.join(', ');
          return new ConflictException(
            campos ? `Ya existe un registro con ese valor en: ${campos}` : 'Registro duplicado',
          );
        }
        case 'P2025':
          return new NotFoundException('El registro solicitado no existe');
        case 'P2003':
          return new ConflictException(
            'La operacion viola una referencia con otro registro existente',
          );
        default:
          break;
      }
    }

    if (excepcion instanceof Prisma.PrismaClientValidationError) {
      return new HttpException(
        { message: 'Datos invalidos para la operacion solicitada' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return new HttpException(
      { message: 'Error interno al procesar la solicitud' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
