import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { DateTime } from 'luxon';

import { LandingService } from './landing.service';
import { ActualizarSeccionDto } from './dto/seccion.dto';
import { ActualizarNegocioDto } from './dto/negocio.dto';
import { ContactoWhatsAppDto } from './dto/contacto-whatsapp.dto';
import { dispositivoLegible, mensajeDeContacto, origenLegible } from './contacto';
import { TelegramService } from '../../common/telegram/telegram.service';
import { esClaveValida } from './claves';
import { Publico } from '../../common/auth/publico.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';

@ApiTags('landing')
@Controller('landing')
export class LandingController {
  constructor(
    private readonly landing: LandingService,
    private readonly telegram: TelegramService,
  ) {}

  @Get('contenido')
  @Publico()
  @ApiOperation({ summary: 'Contenido y datos de contacto que consume el sitio público' })
  contenido() {
    return this.landing.contenidoPublico();
  }

  /**
   * Avisa que alguien está por escribir por WhatsApp.
   *
   * Lo llama el sitio justo antes de abrir WhatsApp, y **sin esperar la
   * respuesta**: si esta petición fallara o tardara, el botón tiene que abrir
   * igual. Por eso contesta 204 y nada más; no hay nada que el sitio necesite
   * leer de acá.
   *
   * Es público, como todo lo que consume el sitio. Eso trae un riesgo real y
   * conocido: cualquiera que lo descubra puede hacer sonar el teléfono de la
   * academia. Se acota por tres lados:
   *
   * 1. Un límite propio, mucho más estrecho que el general. Nadie toca el botón
   *    de WhatsApp diez veces por minuto.
   * 2. La sección es una lista cerrada y el resto del mensaje lo arma el
   *    servidor, así que no se puede elegir qué dice el aviso.
   * 3. El interruptor del panel lo apaga en el momento, sin desplegar nada.
   */
  @Post('contacto-whatsapp')
  @Publico()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registra que alguien tocó un botón de WhatsApp del sitio' })
  contactoWhatsApp(
    @Body() dto: ContactoWhatsAppDto,
    @Headers('user-agent') userAgent?: string,
  ): void {
    const hora = DateTime.now().setZone('America/Montevideo').toFormat('HH:mm');
    const texto = mensajeDeContacto(
      dto.seccion,
      hora,
      dispositivoLegible(userAgent),
      origenLegible(dto.desde),
    );

    // Sin `await`: quien tocó el botón ya está yendo a WhatsApp. `avisar` no
    // falla hacia afuera, así que no hay promesa rechazada que atrapar.
    void this.telegram.avisar('clicWhatsapp', texto);
  }

  @Get('secciones')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Todas las secciones configurables, para el panel' })
  listarSecciones() {
    return this.landing.listarParaPanel();
  }

  @Put('secciones/:clave')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza el contenido de una sección del sitio' })
  actualizarSeccion(
    @Param('clave') clave: string,
    @Body() dto: ActualizarSeccionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    // La clave viene de la URL, así que se valida acá contra la lista cerrada:
    // sin esto se podrían crear secciones que el sitio nunca lee.
    if (!esClaveValida(clave)) {
      throw new BadRequestException(`La sección "${clave}" no existe`);
    }
    return this.landing.actualizarSeccion(clave, dto, usuario.id);
  }

  @Get('negocio')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Datos de contacto del negocio, para el panel' })
  obtenerNegocio() {
    return this.landing.obtenerNegocio();
  }

  @Patch('negocio')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Actualiza los datos de contacto que muestra el sitio' })
  actualizarNegocio(
    @Body() dto: ActualizarNegocioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.landing.actualizarNegocio(dto, usuario.id);
  }
}
