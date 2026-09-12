import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CatalogoService } from './catalogo.service';
import { Publico } from '../../common/auth/publico.decorator';
import { Roles } from '../../common/auth/roles.decorator';

@ApiTags('catalogo')
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('servicios')
  @Publico()
  @ApiOperation({ summary: 'Servicios y precios publicados en la landing' })
  listarPublicos() {
    return this.catalogo.listarPublicos();
  }

  @Get('servicios/todos')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Catalogo completo para el panel de administracion' })
  listarTodos() {
    return this.catalogo.listarTodos();
  }
}
