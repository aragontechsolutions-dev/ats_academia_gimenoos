import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { ClientesService } from './clientes.service';
import {
  ActualizarClienteDto, ActualizarMiFichaDto, BuscarClientesDto, CrearClienteDto,
} from './dto/cliente.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('clientes')
@Controller('clientes')
// Las fichas de alumnos no son accesibles para el rol CLIENTE: cada alumno ve
// lo suyo a través de /usuarios/me y /agenda/reservas.
/**
 * Sin `INSTRUCTOR`: desde la Etapa 2.D el instructor trabaja en su propia app, y
 * de cada alumno recibe lo que necesita dentro de la clase —nombre, teléfono y
 * correo— en la propia reserva. Buscar en el padrón de alumnos y abrir una ficha
 * con su historial es trabajo de administración.
 *
 * Los métodos con su propio `@Roles` mandan sobre este: el guard usa
 * `getAllAndOverride`, así que `/clientes/me` sigue siendo del alumno.
 */
@Roles(RolUsuario.ADMIN)
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  // Estas dos rutas son las únicas del módulo abiertas al alumno, y operan
  // siempre sobre su propia ficha: el id sale del token, no de la URL.
  // Van declaradas antes que :id para que "me" no se interprete como un id.
  @Get('me')
  @Roles(RolUsuario.CLIENTE)
  @ApiOperation({ summary: 'Ficha y packs del alumno autenticado' })
  obtenerMia(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.clientes.obtenerMia(usuario.id);
  }

  @Patch('me')
  @Roles(RolUsuario.CLIENTE)
  @ApiOperation({ summary: 'El alumno actualiza sus propios datos' })
  actualizarMia(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarMiFichaDto,
  ) {
    return this.clientes.actualizarMia(usuario.id, dto);
  }

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
