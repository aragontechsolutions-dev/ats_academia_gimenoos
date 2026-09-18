import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { GraduadosService } from './graduados.service';
import {
  ActualizarGraduadoDto,
  ConsultaGaleriaDto,
  CrearGraduadoDto,
  ListarGraduadosDto,
} from './dto/graduado.dto';
import { Publico } from '../../common/auth/publico.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('graduados')
@Controller('graduados')
export class GraduadosController {
  constructor(private readonly graduados: GraduadosService) {}

  // --- Público -------------------------------------------------------------

  @Get('publicos')
  @Publico()
  @ApiOperation({ summary: 'Galería de egresados publicados, paginada' })
  galeria(@Query() consulta: ConsultaGaleriaDto) {
    return this.graduados.galeria(consulta);
  }

  @Get('galeria')
  @Publico()
  @ApiOperation({ summary: 'Egresados publicados agrupados por año, para los carruseles' })
  galeriaPorAnio() {
    return this.graduados.galeriaPorAnio();
  }

  @Get('verificar/:codigo')
  @Publico()
  @ApiOperation({ summary: 'Comprueba que un diploma sea auténtico por su código' })
  verificar(@Param('codigo') codigo: string) {
    return this.graduados.verificar(codigo);
  }

  // --- Panel ---------------------------------------------------------------

  @Get()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Todos los egresados, para el panel' })
  listar(@Query() consulta: ListarGraduadosDto) {
    return this.graduados.listar(
      { anio: consulta.anio, soloSinAutorizacion: consulta.sinAutorizacion ?? false },
      consulta,
    );
  }

  @Get('resumen')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Años con egresados y cuántos esperan autorización' })
  resumen() {
    return this.graduados.resumen();
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Datos de un egresado, incluido su diploma' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.graduados.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Registra un egresado y le emite su diploma' })
  crear(@Body() dto: CrearGraduadoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.graduados.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza un egresado' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarGraduadoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.graduados.actualizar(id, dto, usuario.id);
  }

  @Post(':id/retirar-autorizacion')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Retira la autorización y saca al egresado de la galería' })
  retirarAutorizacion(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.graduados.retirarAutorizacion(id, usuario.id);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Borra al egresado (derecho de supresión, Ley 18.331)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.graduados.eliminar(id, usuario.id);
  }
}
