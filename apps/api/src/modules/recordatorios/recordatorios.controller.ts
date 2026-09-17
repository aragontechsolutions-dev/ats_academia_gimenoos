import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RecordatoriosService } from './recordatorios.service';
import { Publico } from '../../common/auth/publico.decorator';

/** El encabezado por el que viaja el secreto. */
const ENCABEZADO = 'x-recordatorios-token';

@ApiTags('recordatorios')
@Controller('recordatorios')
export class RecordatoriosController {
  constructor(
    private readonly recordatorios: RecordatoriosService,
    private readonly config: ConfigService,
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
