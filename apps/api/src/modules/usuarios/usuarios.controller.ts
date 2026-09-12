import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
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
}
