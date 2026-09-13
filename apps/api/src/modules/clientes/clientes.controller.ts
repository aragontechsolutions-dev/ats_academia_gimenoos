import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { ClientesService } from './clientes.service';
import { ActualizarClienteDto, BuscarClientesDto, CrearClienteDto } from './dto/cliente.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('clientes')
@Controller('clientes')
// Las fichas de alumnos no son accesibles para el rol CLIENTE: cada alumno ve
// lo suyo a través de /usuarios/me y /agenda/reservas.
@Roles(RolUsuario.ADMIN, RolUsuario.INSTRUCTOR)
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Busca alumnos por nombre, apellido, correo o cédula' })
  listar(@Query() dto: BuscarClientesDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.clientes.listar(dto, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha del alumno con su historial de clases' })
  obtener(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.clientes.obtener(id, usuario);
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Registra un alumno, tenga o no cuenta en el sistema' })
  crear(@Body() dto: CrearClienteDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.clientes.crear(dto, usuario);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza la ficha del alumno' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarClienteDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.clientes.actualizar(id, dto, usuario);
  }
}
