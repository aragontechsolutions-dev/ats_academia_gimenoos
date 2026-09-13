import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { UsuariosService } from './usuarios.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { ActualizarUsuarioDto, ListarUsuariosDto } from './dto/usuario.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  obtenerMiPerfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.usuarios.obtenerPerfil(usuario.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualiza nombre, apellido y telefono del usuario autenticado' })
  async actualizarMiPerfil(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarPerfilDto,
  ) {
    // El rol nunca se toma del cuerpo del request: solo lo cambia un admin.
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { nombre: dto.nombre, apellido: dto.apellido, telefono: dto.telefono ?? null },
    });
    return this.usuarios.obtenerPerfil(usuario.id);
  }

  // --- Administración de cuentas --------------------------------------------
  // Van DESPUÉS de las rutas `me`: Nest resuelve en orden de declaración y
  // `:id` se comería `me` si estuviera antes.

  @Get()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Cuentas del sistema, con su ficha vinculada' })
  listar(@Query() consulta: ListarUsuariosDto) {
    return this.usuarios.listar(consulta);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Cambia el rol o da de baja una cuenta' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() administrador: UsuarioAutenticado,
  ) {
    return this.usuarios.actualizar(id, dto, administrador.id);
  }
}
