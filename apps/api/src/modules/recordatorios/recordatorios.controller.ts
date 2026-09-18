import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RecordatoriosService } from './recordatorios.service';
import { BajaDeAvisosDto } from './dto/baja.dto';
import { Publico } from '../../common/auth/publico.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

/** El encabezado por el que viaja el secreto. */
const ENCABEZADO = 'x-recordatorios-token';

@ApiTags('recordatorios')
@Controller('recordatorios')
export class RecordatoriosController {
  constructor(
    private readonly recordatorios: RecordatoriosService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Manda los recordatorios que correspondan ahora.
   *
   * **Por qué lo dispara algo de afuera y no un temporizador interno.** En el
   * plan gratuito de Render el servicio se suspende por inactividad, y un
   * temporizador suspendido no dispara nada: los recordatorios dejarían de
   * salir sin un solo error en ningún registro. Una llamada desde afuera
   * resuelve las dos cosas con un solo mecanismo: **despierta** al servicio y
   * **hace** el trabajo.
   *
   * Hoy lo llama un workflow de GitHub Actions cada quince minutos, pero sirve
   * cualquier cosa que sepa hacer un POST. Ver `docs/24-recordatorios.md`.
   *
   * Llamarlo dos veces no hace daño: lo ya mandado no se manda de nuevo, y eso
   * lo garantiza una clave única de la base, no una comprobación acá.
   *
   * **No usa la sesión de Supabase** —quien llama es una máquina, no una
   * persona— sino un secreto compartido en un encabezado. Sin
   * `RECORDATORIOS_TOKEN` configurado, el endpoint contesta 503 en lugar de
   * quedar abierto: una puerta sin llave es peor que una puerta cerrada.
   */
  @Post('procesar')
  @Publico()
  @ApiOperation({ summary: 'Manda los recordatorios de clase pendientes' })
  async procesar(@Headers(ENCABEZADO) tokenRecibido?: string) {
    const esperado = this.config.get<string>('RECORDATORIOS_TOKEN');

    if (!esperado) {
      throw new ServiceUnavailableException(
        'Los recordatorios no están configurados: falta RECORDATORIOS_TOKEN en el servidor.',
      );
    }
    if (!mismoSecreto(tokenRecibido, esperado)) {
      throw new UnauthorizedException('Token de recordatorios inválido');
    }

    return this.recordatorios.procesar();
  }

  /**
   * Deja de mandarle recordatorios por correo a quien lo pide.
   *
   * **Es POST y no GET, y eso no es un detalle.** Los antivirus de correo
   * visitan los enlaces antes que la persona —Safe Links de Outlook es el caso
   * típico— y con un GET darían de baja a medio padrón sin que nadie tocara
   * nada. Es el mismo problema que ya quemó los enlaces de invitación
   * (ver `docs/19-correo.md`).
   *
   * Por eso el enlace del correo lleva a una pantalla de la app del alumno, que
   * muestra un botón; el botón es el que llama acá. Los clientes de correo que
   * entienden RFC 8058 mandan este POST directamente desde su propio botón de
   * «cancelar suscripción», que es lo que declaran las cabeceras
   * `List-Unsubscribe`.
   *
   * No pide sesión a propósito: quien abre un correo no necesariamente tiene la
   * app abierta, y obligarlo a entrar para dejar de recibir correos es la forma
   * más rápida de que marque el correo como spam.
   *
   * El token identifica a una persona y **solo sirve para esto**: no da acceso a
   * ningún dato ni a ninguna otra acción.
   */
  @Post('baja')
  @Publico()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Deja de recibir los recordatorios por correo' })
  async darDeBaja(@Body() dto: BajaDeAvisosDto): Promise<void> {
    // `updateMany` y no `update`: con un token que no existe no tiene que
    // fallar, tiene que no hacer nada. Un 404 acá le confirmaría a quien probara
    // tokens al azar cuáles son válidos, y además le mostraría un error a
    // alguien que simplemente tocó dos veces el mismo enlace.
    await this.prisma.cliente.updateMany({
      where: { tokenBaja: dto.token },
      data: { recibeAvisosPorCorreo: false },
    });
  }
}

/**
 * Compara dos secretos en tiempo constante.
 *
 * Con `===`, el tiempo que tarda en devolver falso depende de cuántos
 * caracteres coincidieron desde el principio, y eso alcanza para adivinar el
 * secreto de a un carácter por vez. `timingSafeEqual` tarda siempre lo mismo.
 *
 * Exige que los dos lados midan igual, así que el largo se compara aparte. Eso
 * filtra el largo del secreto, que es una pista sin valor práctico.
 */
function mismoSecreto(recibido: string | undefined, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
