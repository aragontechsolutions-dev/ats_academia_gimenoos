import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { InvitacionesService } from './invitaciones.service';
import { CrearInvitacionDto } from './dto/invitacion.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('invitaciones')
@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  @Get()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Invitaciones de una ficha de alumno' })
  listar(@Query('clienteId', ParseUUIDPipe) clienteId: string) {
    return this.invitaciones.listarDeCliente(clienteId);
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Invita a alguien a usar el sistema' })
  crear(@Body() dto: CrearInvitacionDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.invitaciones.crear(dto, usuario.id);
  }

  @Post(':id/reenviar')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Vuelve a mandar el correo de una invitación pendiente' })
  reenviar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.invitaciones.reenviar(id, usuario.id);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Da de baja una invitación que todavía no se usó' })
  revocar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.invitaciones.revocar(id, usuario.id);
  }
}
