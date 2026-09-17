import { BadRequestException, Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { ActualizarAvisosTelegramDto } from './dto/avisos-telegram.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramService } from '../../common/telegram/telegram.service';

/** Los valores con los que arranca todo si la fila todavía no existe. */
const POR_DEFECTO = {
  chatId: null,
  chatNombre: null,
  avisaReservaNueva: true,
  avisaClaseCerrada: true,
  avisaClaseCancelada: true,
  avisaClicWhatsapp: true,
  avisaRecordatorios: true,
  ultimoEnvioAt: null,
  ultimoErrorAt: null,
  ultimoError: null,
};

/**
 * Configuración de los avisos por Telegram, para el panel.
 *
 * Todo es de ADMIN. No hay ni un endpoint público acá: quién recibe los avisos
 * de la academia no es un dato del sitio.
 */
@ApiTags('avisos')
@Controller('avisos/telegram')
@Roles(RolUsuario.ADMIN)
export class AvisosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado de los avisos por Telegram' })
  async estado() {
    const ajustes = await this.prisma.avisosTelegram.findUnique({ where: { id: 1 } });
    return {
      // Si el bot existe lo sabe el servidor, no el panel: el panel nunca ve el
      // token, sólo si hay uno. Con esto alcanza para explicar qué falta.
      botConfigurado: this.telegram.configurado,
      ...POR_DEFECTO,
      ...(ajustes ?? {}),
    };
  }

  @Get('chats')
  @ApiOperation({ summary: 'Conversaciones que le hablaron al bot en las últimas 24 horas' })
  chats() {
    return this.telegram.chatsDisponibles();
  }

  @Patch()
  @ApiOperation({ summary: 'Elige la conversación destino y qué se avisa' })
  async actualizar(
    @Body() dto: ActualizarAvisosTelegramDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const guardado = await this.prisma.avisosTelegram.upsert({
      where: { id: 1 },
      create: { id: 1, ...dto },
      update: dto,
    });

    // Queda en auditoría porque cambia a dónde sale información de la academia.
    // El detalle no lleva secretos: el chat elegido y los interruptores.
    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'AVISOS_TELEGRAM_ACTUALIZADOS',
      entidad: 'AvisosTelegram',
      entidadId: '1',
      detalle: { ...dto },
    });

    return { botConfigurado: this.telegram.configurado, ...guardado };
  }

  @Post('probar')
  @ApiOperation({ summary: 'Manda un mensaje de prueba a la conversación elegida' })
  async probar() {
    const ajustes = await this.prisma.avisosTelegram.findUnique({ where: { id: 1 } });
    if (!ajustes?.chatId) {
      // 400 y no 500: falta un paso de configuración, no se rompió nada.
      throw new BadRequestException(
        'Todavía no elegiste a qué conversación mandar los avisos.',
      );
    }
    await this.telegram.probar(ajustes.chatId);
    return { enviado: true };
  }
}
