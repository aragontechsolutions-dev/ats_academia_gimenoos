import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Lo que entrega `PushManager.subscribe()` en el navegador.
 *
 * Los nombres son los que usa la API del navegador y no se traducen: quien lea
 * esto al lado del código del navegador tiene que reconocerlos.
 */
export class CrearSuscripcionDto {
  /**
   * Dirección del servicio de notificaciones que apunta a este navegador.
   *
   * Se valida que sea una dirección https de verdad. Sin eso, cualquiera podría
   * guardar texto arbitrario que después la API intentaría usar como URL.
   */
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'La dirección de la suscripción no es válida' },
  )
  @MaxLength(1000, { message: 'La dirección de la suscripción es demasiado larga' })
  endpoint!: string;

  @ApiProperty()
  @IsString()
  @MinLength(16, { message: 'La clave del navegador no es válida' })
  @MaxLength(255, { message: 'La clave del navegador es demasiado larga' })
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'El secreto del navegador no es válido' })
  @MaxLength(255, { message: 'El secreto del navegador es demasiado largo' })
  auth!: string;

  /** Para poder distinguir un dispositivo de otro en la lista. */
  @ApiPropertyOptional({ example: 'Chrome en Android' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dispositivo?: string;
}

/** Para darse de baja hace falta decir cuál navegador. */
export class BorrarSuscripcionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}
