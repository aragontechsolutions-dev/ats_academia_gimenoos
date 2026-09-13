import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { DisponibilidadService } from './disponibilidad.service';
import { ReservasService } from './reservas.service';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ListarReservasDto } from './dto/listar-reservas.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { ReprogramarReservaDto } from './dto/reprogramar-reserva.dto';
import { CambiarEstadoReservaDto } from './dto/cambiar-estado-reserva.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('agenda')
@Controller('agenda')
export class AgendaController {
  constructor(
    private readonly disponibilidad: DisponibilidadService,
    private readonly reservas: ReservasService,
  ) {}

  @Get('disponibilidad')
  @ApiOperation({ summary: 'Horarios en los que hay instructor y vehículo libres' })
  consultarDisponibilidad(@Query() dto: ConsultarDisponibilidadDto) {
    return this.disponibilidad.calcular(dto);
  }

  @Get('reservas')
  @ApiOperation({ summary: 'Clases del rango indicado, acotadas al rol de quien consulta' })
  listarReservas(@Query() dto: ListarReservasDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reservas.listar(dto, usuario);
  }

  @Get('reservas/:id')
  @ApiOperation({ summary: 'Detalle de una clase' })
  obtenerReserva(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reservas.obtener(id, usuario);
  }

  @Post('reservas')
  @ApiOperation({ summary: 'Agenda una clase' })
  crearReserva(@Body() dto: CrearReservaDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reservas.crear(dto, usuario);
  }

  @Patch('reservas/:id/reprogramar')
  @ApiOperation({ summary: 'Mueve la clase de horario, instructor o vehículo' })
  reprogramarReserva(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReprogramarReservaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reservas.reprogramar(id, dto, usuario);
  }

  @Patch('reservas/:id/cancelar')
  @ApiOperation({ summary: 'Cancela la clase y libera el horario' })
  cancelarReserva(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarReservaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reservas.cancelar(id, dto.motivo, usuario);
  }

  @Patch('reservas/:id/estado')
  @Roles(RolUsuario.ADMIN, RolUsuario.INSTRUCTOR)
  @ApiOperation({ summary: 'Confirma la clase, o la marca como dictada o ausente' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoReservaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reservas.cambiarEstado(id, dto.estado, usuario);
  }
}
