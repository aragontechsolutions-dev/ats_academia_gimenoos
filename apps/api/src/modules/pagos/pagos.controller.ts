import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { PagosService } from './pagos.service';
import { ComprobantesService } from './comprobantes.service';
import {
  AprobarPagoDto,
  ComprobanteSubidoDto,
  CrearPagoEnEfectivoDto,
  CrearPagoPropioDto,
  ListarPagosDto,
  RechazarPagoDto,
} from './dto/pago.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('pagos')
@Controller('pagos')
export class PagosController {
  constructor(
    private readonly pagos: PagosService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  // --- Lo del alumno ---------------------------------------------------------
  //
  // Van ANTES de las rutas con `:id`: Nest resuelve en orden de declaración y
  // `:id` se comería `mios` si estuviera antes.

  @Get('mios')
  @Roles(RolUsuario.CLIENTE)
  @ApiOperation({ summary: 'Los pagos del alumno que consulta' })
  listarMios(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pagos.listarMios(usuario.id);
  }

  @Post('mios')
  @Roles(RolUsuario.CLIENTE)
  @ApiOperation({ summary: 'Empieza un pago por transferencia' })
  crearPropio(@Body() dto: CrearPagoPropioDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pagos.crearPropio(usuario.id, dto);
  }

  @Patch('mios/:id/comprobante')
  @Roles(RolUsuario.CLIENTE)
  @ApiOperation({ summary: 'Registra el comprobante que el alumno acaba de subir' })
  registrarComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComprobanteSubidoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.pagos.registrarComprobante(usuario.id, id, dto);
  }

  // --- Lo de la administración ----------------------------------------------

  @Get()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Pagos, con filtro por estado y búsqueda por alumno' })
  listar(@Query() consulta: ListarPagosDto) {
    return this.pagos.listar(consulta);
  }

  @Post('efectivo')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Registra un pago cobrado en el mostrador' })
  crearEnEfectivo(
    @Body() dto: CrearPagoEnEfectivoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.pagos.crearEnEfectivo(dto, usuario.id);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Un pago con todo lo necesario para revisarlo' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.pagos.obtener(id);
  }

  /**
   * Una dirección temporal para ver el comprobante.
   *
   * El bucket es privado: no hay URL fija que sirva. Se pide una firmada de
   * corta duración, y se pide **cada vez**, para que no quede guardada en ningún
   * lado una dirección que abre un documento de otra persona.
   */
  @Get(':id/comprobante')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Dirección temporal para ver el comprobante' })
  verComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.comprobantes.direccionTemporal(id, usuario.id);
  }

  @Post(':id/aprobar')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Aprueba el pago y le acredita las clases al alumno' })
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AprobarPagoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.pagos.aprobar(id, dto, usuario.id);
  }

  @Post(':id/rechazar')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Rechaza el pago, con el motivo que ve el alumno' })
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechazarPagoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.pagos.rechazar(id, dto, usuario.id);
  }
}
