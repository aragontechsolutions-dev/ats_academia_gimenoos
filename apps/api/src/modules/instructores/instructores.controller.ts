import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { InstructoresService } from './instructores.service';
import {
  ActualizarInstructorDto, CrearExcepcionDto, CrearInstructorDto, ListarInstructoresDto,
  ReemplazarDisponibilidadDto,
} from './dto/instructor.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('instructores')
@Controller('instructores')
export class InstructoresController {
  constructor(private readonly instructores: InstructoresService) {}

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.INSTRUCTOR)
  @ApiOperation({ summary: 'Instructores de la academia' })
  listar(@Query() consulta: ListarInstructoresDto) {
    return this.instructores.listar(consulta.incluirInactivos ?? false, consulta);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.INSTRUCTOR)
  @ApiOperation({ summary: 'Instructor con su plantilla de horarios y excepciones' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.instructores.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Da de alta un instructor' })
  crear(@Body() dto: CrearInstructorDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.instructores.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza un instructor (usar activo:false para darlo de baja)' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarInstructorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.instructores.actualizar(id, dto, usuario.id);
  }

  @Put(':id/disponibilidad')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Reemplaza la plantilla semanal de horarios' })
  reemplazarDisponibilidad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarDisponibilidadDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.instructores.reemplazarDisponibilidad(id, dto, usuario.id);
  }

  @Post(':id/excepciones')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Agrega una licencia, un feriado o un turno extra' })
  crearExcepcion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearExcepcionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.instructores.crearExcepcion(id, dto, usuario.id);
  }

  @Delete(':id/excepciones/:excepcionId')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita una excepción de disponibilidad' })
  eliminarExcepcion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('excepcionId', ParseUUIDPipe) excepcionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.instructores.eliminarExcepcion(id, excepcionId, usuario.id);
  }
}
