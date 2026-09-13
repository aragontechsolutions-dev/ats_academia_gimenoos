import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { CatalogoService } from './catalogo.service';
import { ActualizarServicioDto, CrearServicioDto } from './dto/servicio.dto';
import { Publico } from '../../common/auth/publico.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

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
  @ApiOperation({ summary: 'Catálogo completo para el panel de administración' })
  listarTodos() {
    return this.catalogo.listarTodos();
  }

  @Post('servicios')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Crea un servicio del catálogo' })
  crear(@Body() dto: CrearServicioDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.catalogo.crear(dto, usuario.id);
  }

  @Patch('servicios/:id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza un servicio y sus precios' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarServicioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.catalogo.actualizar(id, dto, usuario.id);
  }
}
