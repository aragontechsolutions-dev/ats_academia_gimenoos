import { BadRequestException, Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { LandingService } from './landing.service';
import { ActualizarSeccionDto } from './dto/seccion.dto';
import { ActualizarNegocioDto } from './dto/negocio.dto';
import { esClaveValida } from './claves';
import { Publico } from '../../common/auth/publico.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly landing: LandingService) {}

  @Get('contenido')
  @Publico()
  @ApiOperation({ summary: 'Contenido y datos de contacto que consume el sitio público' })
  contenido() {
    return this.landing.contenidoPublico();
  }

  @Get('secciones')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Todas las secciones configurables, para el panel' })
  listarSecciones() {
    return this.landing.listarParaPanel();
  }

  @Put('secciones/:clave')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza el contenido de una sección del sitio' })
  actualizarSeccion(
    @Param('clave') clave: string,
    @Body() dto: ActualizarSeccionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    // La clave viene de la URL, así que se valida acá contra la lista cerrada:
    // sin esto se podrían crear secciones que el sitio nunca lee.
    if (!esClaveValida(clave)) {
      throw new BadRequestException(`La sección "${clave}" no existe`);
    }
    return this.landing.actualizarSeccion(clave, dto, usuario.id);
  }

  @Get('negocio')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Datos de contacto del negocio, para el panel' })
  obtenerNegocio() {
    return this.landing.obtenerNegocio();
  }

  @Patch('negocio')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza los datos de contacto que muestra el sitio' })
  actualizarNegocio(
    @Body() dto: ActualizarNegocioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.landing.actualizarNegocio(dto, usuario.id);
  }
}
