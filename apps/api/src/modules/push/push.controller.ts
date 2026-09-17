import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { BorrarSuscripcionDto, CrearSuscripcionDto } from './dto/suscripcion.dto';
import { Publico } from '../../common/auth/publico.decorator';
import { UsuarioActual } from '../../common/auth/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService } from '../../common/push/push.service';

/**
 * Suscripción a los avisos en el teléfono.
 *
 * No lleva `@Roles`: **cualquiera que tenga cuenta puede suscribirse**, y eso es
 * una decisión, no un olvido. Hoy sólo la app del alumno lo usa, pero un
 * instructor querer que le avisen de su propia agenda es razonable, y nada de
 * esto le da acceso a datos de nadie: sólo registra su propio navegador.
 */
@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * La clave pública VAPID, que el navegador necesita para suscribirse.
   *
   * Es pública por definición —viaja en cada suscripción— y por eso el endpoint
   * es abierto. Se sirve desde acá y no se copia a una variable del frontend a
   * propósito: con dos copias, el día que se rote una queda la otra vieja y las
   * suscripciones dejan de funcionar sin que nadie entienda por qué.
   */
  @Get('clave-publica')
  @Publico()
  @ApiOperation({ summary: 'Clave pública VAPID para suscribirse a los avisos' })
  clavePublica() {
    return { clave: this.push.clavePublica };
  }

  /**
   * Registra este navegador.
   *
   * El dueño sale de la sesión y **nunca del cuerpo del pedido**: si viniera en
   * el cuerpo, cualquiera con cuenta podría registrar un navegador a nombre de
   * otra persona y recibir sus avisos.
   *
   * Es idempotente: el navegador reusa la misma dirección si ya estaba
   * suscripto, así que suscribirse dos veces actualiza en vez de duplicar.
   */
  @Post('suscripciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Registra este navegador para recibir avisos' })
  async suscribir(
    @Body() dto: CrearSuscripcionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.prisma.suscripcionPush.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        usuarioId: usuario.id,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        dispositivo: dto.dispositivo ?? null,
      },
      // Si la dirección ya existía a nombre de otra persona, pasa a ser de quien
      // está usando el navegador ahora. Es el caso de un teléfono prestado o de
      // una cuenta que se cerró y se abrió otra: quien está adentro es quien
      // tiene que recibir los avisos.
      update: {
        usuarioId: usuario.id,
        p256dh: dto.p256dh,
        auth: dto.auth,
        dispositivo: dto.dispositivo ?? null,
      },
    });
  }

  /**
   * Da de baja este navegador.
   *
   * Sólo borra si la suscripción es de quien pide: con la dirección de otra
   * persona no se puede dejar sin avisos a nadie.
   */
  @Delete('suscripciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deja de recibir avisos en este navegador' })
  async desuscribir(
    @Body() dto: BorrarSuscripcionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.prisma.suscripcionPush.deleteMany({
      where: { endpoint: dto.endpoint, usuarioId: usuario.id },
    });
  }
}
