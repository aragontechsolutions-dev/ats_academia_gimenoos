import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

/**
 * El período que se quiere mirar, en días de calendario.
 *
 * Son días (`2026-09-18`) y no instantes ISO a propósito. El tablero contesta
 * «¿cuánto entró hoy?», y «hoy» es un día del calendario de San Carlos, no una
 * ventana de 24 horas contada desde el reloj del navegador. Pasar el día suelto
 * deja que el servidor lo interprete en la zona de la academia y que la
 * respuesta sea la misma se mire desde donde se mire.
 *
 * Ambos extremos son **inclusivos**: `desde=2026-09-01&hasta=2026-09-30` cuenta
 * todo septiembre, incluido el 30 hasta las 23:59.
 */
export class ConsultarTableroDto {
  @ApiPropertyOptional({ example: '2026-09-01', description: 'Día inicial, inclusive' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde tiene que ser un día con formato AAAA-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Día final, inclusive' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hasta tiene que ser un día con formato AAAA-MM-DD' })
  hasta?: string;
}
