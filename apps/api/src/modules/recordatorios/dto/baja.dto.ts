import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BajaDeAvisosDto {
  /**
   * El token que viaja en el enlace del correo.
   *
   * Se valida que sea un UUID: así, lo que no tenga esa forma se rechaza antes
   * de tocar la base, y no se puede usar este endpoint para probar textos
   * arbitrarios contra una columna indexada.
   */
  @ApiProperty()
  @IsUUID('4', { message: 'El enlace de baja no es válido' })
  token!: string;
}
