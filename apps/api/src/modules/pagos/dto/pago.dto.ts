import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';
import { EstadoPago } from '@prisma/client';

import { ConsultaPaginadaDto } from '../../../common/paginacion/paginacion';

/** El alumno declara qué servicio está pagando. El monto lo pone el servidor. */
export class CrearPagoPropioDto {
  @ApiProperty()
  @IsUUID('4', { message: 'El servicio elegido no es válido' })
  servicioId!: string;
}

/**
 * El nombre del archivo que el alumno subió al bucket.
 *
 * **Es el nombre, no la ruta.** La ruta la compone la API con el id de la sesión
 * y el del pago: si aceptara una ruta del navegador, alguien podría hacerla
 * apuntar al comprobante de otra persona y después pedir que se la muestren.
 *
 * Las extensiones son EXACTAMENTE las que acepta el bucket (`allowed_mime_types`
 * en `infra/supabase/01-storage.sql`): PDF, JPEG y PNG. Aceptar acá una que el
 * bucket rechaza solo produce un error confuso después de subir el archivo.
 *
 * SVG queda afuera a propósito: puede traer scripts adentro.
 */
export class ComprobanteSubidoDto {
  @ApiProperty({ example: 'comprobante-1758230000.pdf' })
  @IsString()
  @MaxLength(80, { message: 'El nombre del archivo es demasiado largo' })
  @Matches(/^[a-z0-9._-]{1,80}\.(pdf|jpg|jpeg|png)$/, {
    message: 'El comprobante tiene que ser un PDF o una imagen (jpg o png)',
  })
  archivo!: string;
}

/** Un pago en efectivo, cobrado en el mostrador. */
export class CrearPagoEnEfectivoDto {
  @ApiProperty()
  @IsUUID('4', { message: 'El alumno indicado no es válido' })
  clienteId!: string;

  @ApiProperty()
  @IsUUID('4', { message: 'El servicio elegido no es válido' })
  servicioId!: string;

  /**
   * Lo que se cobró de verdad, en pesos enteros.
   *
   * Es opcional: sin esto se usa el precio del catálogo. Se acepta porque en el
   * mostrador se cobra lo que se acuerda, y quien lo registra es de la academia.
   *
   * Entero y no decimal: los precios de la academia son en pesos uruguayos
   * redondos, y aceptar centavos solo abre la puerta a un `0.1 + 0.2`.
   */
  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El monto tiene que ser un número entero de pesos' })
  @IsPositive({ message: 'El monto tiene que ser mayor que cero' })
  @Max(99_999_999, { message: 'El monto es demasiado grande' })
  monto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

/** Al aprobar, se puede corregir el monto por el que figura en el banco. */
export class AprobarPagoDto {
  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El monto tiene que ser un número entero de pesos' })
  @IsPositive({ message: 'El monto tiene que ser mayor que cero' })
  @Max(99_999_999, { message: 'El monto es demasiado grande' })
  monto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class RechazarPagoDto {
  /**
   * Por qué se rechaza. Obligatorio: el alumno lo ve, y un rechazo sin motivo
   * lo obliga a preguntar por WhatsApp qué pasó.
   */
  @ApiProperty()
  @IsString()
  @MaxLength(300, { message: 'El motivo es demasiado largo' })
  @Matches(/\S/, { message: 'Escribí por qué se rechaza' })
  motivo!: string;
}

/** Filtros del listado del panel. */
export class ListarPagosDto extends ConsultaPaginadaDto {
  @IsOptional()
  @IsEnum(EstadoPago, { message: 'Ese estado de pago no existe' })
  estado?: EstadoPago;

  /** Busca por nombre, apellido, cédula o pasaporte del alumno. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}
