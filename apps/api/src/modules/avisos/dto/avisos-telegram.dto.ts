import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Lo que el panel puede cambiar de los avisos.
 *
 * El token NO está acá y nunca va a estar: vive en la variable de entorno del
 * servidor. Lo único que se configura desde el panel es a quién se le avisa y
 * qué se le avisa.
 */
export class ActualizarAvisosTelegramDto {
  /**
   * Identificador de la conversación destino.
   *
   * Telegram lo da como número, y para un grupo es negativo. Se acepta como
   * texto porque puede pasar de los 2^53 y un número de JavaScript lo
   * redondearía en silencio, que es la clase de error que nadie encuentra.
   */
  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d{1,20}$/, {
    message: 'chatId tiene que ser el número de una conversación de Telegram',
  })
  chatId?: string;

  /** Cómo se llama esa conversación, para poder reconocerla en el panel. */
  @ApiPropertyOptional({ example: 'Avisos Academia' })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'El nombre de la conversación es demasiado largo' })
  chatNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  avisaReservaNueva?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  avisaClaseCerrada?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  avisaClaseCancelada?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  avisaClicWhatsapp?: boolean;
}
