import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';

/**
 * Cuánto dura la dirección que se le da al panel para ver un comprobante.
 *
 * Cinco minutos: lo que tarda alguien en abrirlo y mirarlo. Es una dirección que
 * abre el documento bancario de una persona **sin pedir sesión**, así que cuanto
 * menos viva, mejor. Si se vence, se pide otra: son dos clics.
 */
const DURACION_SEGUNDOS = 300;

/** Cuánto se espera a Supabase antes de cortar. */
const ESPERA_MAXIMA_MS = 10_000;

/**
 * El acceso a los comprobantes de transferencia.
 *
 * El bucket `comprobantes` es **privado**: no existe una dirección fija que lo
 * sirva. Para mostrar un comprobante hay que pedirle a Supabase una dirección
 * firmada de corta duración, y eso solo se puede hacer con la clave de servicio,
 * que vive únicamente en el backend.
 *
 * Que el archivo no pase por la API es a propósito: son varios megabytes que no
 * tienen por qué atravesar el servidor. Lo que sí pasa por acá es **el permiso**
 * para verlo.
 */
@Injectable()
export class ComprobantesService {
  private readonly log = new Logger(ComprobantesService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Una dirección temporal para ver el comprobante de un pago.
   *
   * **Queda en la auditoría.** Mirar el comprobante bancario de alguien es un
   * acceso a un dato personal, y la Ley 18.331 pide poder responder quién vio
   * qué. Es también la razón por la que la dirección se pide de a una y no se
   * guarda en ningún lado.
   */
  async direccionTemporal(pagoId: string, usuarioId: string): Promise<{ url: string }> {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      select: { id: true, comprobantePath: true, clienteId: true },
    });
    if (!pago) throw new NotFoundException('Ese pago no existe');
    if (!pago.comprobantePath) {
      throw new NotFoundException('Ese pago todavía no tiene comprobante cargado');
    }

    const url = await this.firmar(pago.comprobantePath);

    await this.auditoria.registrar({
      usuarioId,
      accion: 'COMPROBANTE_CONSULTADO',
      entidad: 'Pago',
      entidadId: pago.id,
      // La ruta NO va al detalle: junto con la clave de servicio permitiría
      // llegar al archivo, y la auditoría la lee más gente que la base.
      detalle: { clienteId: pago.clienteId },
    });

    return { url };
  }

  /** Le pide a Supabase la dirección firmada. */
  private async firmar(ruta: string): Promise<string> {
    const base = this.config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    const clave = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/storage/v1/object/sign/comprobantes/${ruta}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: clave,
          Authorization: `Bearer ${clave}`,
        },
        body: JSON.stringify({ expiresIn: DURACION_SEGUNDOS }),
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
    } catch (problema) {
      const agotado = problema instanceof Error && problema.name === 'TimeoutError';
      this.log.error(`No se pudo firmar el comprobante: ${agotado ? 'tiempo agotado' : problema}`);
      throw new ServiceUnavailableException(
        'No se pudo abrir el comprobante ahora. Probá de nuevo en un momento.',
      );
    }

    if (!respuesta.ok) {
      // 400 y 404 de Storage significan casi siempre que el archivo no está: el
      // alumno lo borró, o la subida quedó a medias.
      if (respuesta.status === 400 || respuesta.status === 404) {
        throw new NotFoundException(
          'El archivo del comprobante ya no está en el servidor. Pedile al alumno que lo suba de nuevo.',
        );
      }
      this.log.error(`Storage respondió ${respuesta.status} al firmar un comprobante`);
      throw new ServiceUnavailableException('No se pudo abrir el comprobante ahora.');
    }

    const datos = (await respuesta.json().catch(() => null)) as { signedURL?: string } | null;
    if (!datos?.signedURL) {
      this.log.error('Storage devolvió una respuesta sin signedURL');
      throw new ServiceUnavailableException('No se pudo abrir el comprobante ahora.');
    }

    // Storage devuelve una ruta relativa: hay que anteponerle el origen.
    return `${base}/storage/v1${datos.signedURL}`;
  }
}
