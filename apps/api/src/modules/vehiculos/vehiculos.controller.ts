import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { VehiculosService } from './vehiculos.service';
import { ActualizarVehiculoDto, CrearVehiculoDto, ListarVehiculosDto } from './dto/vehiculo.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('vehiculos')
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculos: VehiculosService) {}

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.INSTRUCTOR)
  @ApiOperation({ summary: 'Vehículos de la academia' })
  listar(@Query() consulta: ListarVehiculosDto) {
    return this.vehiculos.listar(consulta.incluirInactivos ?? false, consulta);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.INSTRUCTOR)
  @ApiOperation({ summary: 'Detalle de un vehículo' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiculos.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Da de alta un vehículo' })
  crear(@Body() dto: CrearVehiculoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.vehiculos.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza un vehículo (estado MANTENIMIENTO o BAJA lo saca de la agenda)' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarVehiculoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.vehiculos.actualizar(id, dto, usuario.id);
  }
}
