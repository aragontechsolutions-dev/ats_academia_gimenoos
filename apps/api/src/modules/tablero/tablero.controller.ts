import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { TableroService } from './tablero.service';
import { ConsultarTableroDto } from './dto/tablero.dto';
import { Roles } from '../../common/auth/roles.decorator';

/**
 * El tablero es de la administración y de nadie más.
 *
 * Devuelve la facturación de la academia y el rendimiento de cada instructor:
 * datos que un instructor no tiene por qué ver de sus compañeros, y que un
 * alumno no tiene por qué ver en absoluto. De ahí el `@Roles(ADMIN)`, que acá
 * es una decisión y no una copia: sin él, el guard global dejaría entrar a los
 * tres roles.
 */
@ApiTags('tablero')
@Controller('tablero')
@Roles(RolUsuario.ADMIN)
export class TableroController {
  constructor(private readonly tablero: TableroService) {}

  @Get()
  @ApiOperation({ summary: 'Resumen de la actividad de la academia en un período' })
  resumen(@Query() consulta: ConsultarTableroDto) {
    return this.tablero.resumen(consulta);
  }
}
