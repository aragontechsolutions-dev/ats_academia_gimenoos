import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cuánto se espera a Supabase antes de cortar por nuestra cuenta.
 *
 * Está holgado a propósito. Mandar el correo lo hace Supabase hablando con un
 * servidor SMTP, y eso puede tardar; si Supabase va a contestar con su propio
 * error, ese error dice bastante más que un corte nuestro. El tope está para que
 * una llamada que no vuelve NUNCA no deje colgados al servidor y al panel, no
 * para apurar la respuesta.
 */
const ESPERA_MAXIMA_MS = 60_000;

/**
 * Qué mirar cuando el envío del correo no llega a completarse.
 *
 * Se usa en dos lugares —el corte por tiempo y el 5xx— porque en los dos la
 * pregunta de quien atiende es la misma: «¿y ahora qué hago?».
 */
const PISTA_SMTP =
  'Al mandar el correo, lo único que depende de un servicio de afuera es el servidor SMTP: ' +
  'ahí hay que mirar primero. En Supabase, Authentication → Emails y el registro de Auth, ' +
  'que dice el error exacto. Ojo: la cuenta puede haber quedado creada igual. Mientras tanto ' +
  'el enlace por WhatsApp sirve, porque no pasa por el correo. Ver docs/19-correo.md.';

/**
 * La dirección ya tiene cuenta en Supabase Auth.
 *
 * Se distingue del resto de los fallos porque es el único con salida: a esa
 * cuenta ya no se la puede invitar, pero sí mandarle un enlace de acceso normal.
 * Quien llama necesita reconocer el caso sin leer el texto del mensaje.
 */
export class CuentaYaRegistradaError extends ConflictException {
  constructor() {
    super(
      'Esa dirección ya tiene cuenta en el sistema. No hace falta invitarla: ' +
        'puede entrar con el enlace de acceso.',
    );
  }
}

/** Un pedido a la API de Auth, con lo que hace falta para explicar un fallo. */
interface Pedido {
  /** Camino dentro de la API de Auth. */
  camino: string;
  /** A dónde cae la persona al tocar el enlace. */
  redirigirA: string;
  cuerpo: Record<string, unknown>;
  /** Se usa en los mensajes: «no se pudo {accion}». En infinitivo. */
  accion: string;
  /** Si el pedido manda un correo. Cambia dónde hay que buscar el problema. */
  mandaCorreo: boolean;
}

/**
 * Lo único que la API le pide a Supabase Auth como administrador.
 *
 * Se habla con `fetch` contra la API de Auth y no con `supabase-js`, que es el
 * mismo criterio que ya usa `scripts/verificar-supabase.ts`: para dos llamadas
 * no se suma una dependencia entera al backend.
 *
 * La clave `service_role` saltea RLS y puede crear cuentas. Vive solo acá, en el
 * servidor. Si alguna vez aparece en un `VITE_*`, la CI falla a propósito.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(private readonly config: ConfigService) {}

  /** true cuando hay con qué hablarle a Supabase. En las pruebas no lo hay. */
  get configurado(): boolean {
    return Boolean(this.url && this.clave);
  }

  private get url(): string {
    return (this.config.get<string>('SUPABASE_URL') ?? '').replace(/\/$/, '');
  }

  private get clave(): string {
    return this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  }

  /**
   * Crea la cuenta en Supabase Auth y le manda el correo de invitación.
   *
   * `redirigirA` es dónde cae la persona al tocar el enlace: la app del alumno o
   * el panel, según a qué se la invita.
   *
   * NO se manda ningún rol en `data`: eso viajaría a `user_metadata`, que el
   * propio usuario puede editar. El rol vive en la invitación, en esta base.
   */
  async invitar(email: string, redirigirA: string): Promise<void> {
    const pedido: Pedido = {
      camino: '/auth/v1/invite',
      redirigirA,
      cuerpo: { email },
      accion: 'invitar',
      mandaCorreo: true,
    };

    const respuesta = await this.llamar(pedido);
    if (respuesta.ok) return;
    throw await this.problemaDe(respuesta, pedido);
  }

  /**
   * Pide el código de acceso de una persona, SIN mandar ningún correo.
   *
   * Devuelve el `token_hash`, no la dirección que arma Supabase. La diferencia
   * importa: esa dirección se consume con **una sola visita**, y las
   * aplicaciones de mensajería visitan los enlaces para armar la vista previa.
   * Mandarla por WhatsApp la quemaba antes de que la persona la tocara, y al
   * abrirla recibía «el enlace es inválido o expiró».
   *
   * Con el `token_hash`, el enlace apunta a una pantalla propia que recién ahí
   * lo canjea, desde JavaScript. Los rastreadores de vista previa no ejecutan
   * JavaScript, así que el código sobrevive a la previa. Es lo que recomienda la
   * propia documentación de Supabase para este problema.
   *
   * Lo devuelto es una **credencial**: quien la tenga entra como esa persona.
   * No se guarda en la base, no se escribe en los registros y no se puede volver
   * a pedir la misma.
   */
  async generarCodigo(
    email: string,
    redirigirA: string,
    esPrimerAcceso: boolean,
  ): Promise<{ tokenHash: string; tipo: 'invite' | 'magiclink' }> {
    // `invite` crea la cuenta; `magiclink` sirve para quien ya la tiene. El tipo
    // viaja después en el enlace: la pantalla que canjea el código lo necesita.
    const tipo = esPrimerAcceso ? 'invite' : 'magiclink';

    const pedido: Pedido = {
      camino: '/auth/v1/admin/generate_link',
      redirigirA,
      cuerpo: { type: tipo, email },
      accion: 'generar el código',
      // Este camino NO manda correo: es justamente para lo que existe.
      mandaCorreo: false,
    };

    const respuesta = await this.llamar(pedido);
    if (!respuesta.ok) throw await this.problemaDe(respuesta, pedido);

    // El cuerpo de esta respuesta NUNCA se registra: trae la credencial adentro.
    //
    // Los campos vienen en la RAÍZ. Es el cliente `supabase-js` el que los anida
    // bajo `properties`, y como acá se habla directo con la API de Auth, ese
    // nivel no existe. Se contemplan los dos por si alguna versión cambia.
    const datos = (await respuesta.json()) as {
      hashed_token?: string;
      properties?: { hashed_token?: string };
    };
    const tokenHash = datos.hashed_token ?? datos.properties?.hashed_token;
    if (!tokenHash) {
      this.logger.error('Supabase devolvió una respuesta sin hashed_token');
      throw new ServiceUnavailableException('Supabase no devolvió un código utilizable.');
    }
    return { tokenHash, tipo };
  }

  // --- Interno --------------------------------------------------------------

  /**
   * Hace el pedido y devuelve la respuesta tal cual, diga que sí o que no.
   *
   * Solo tira cuando NO se llegó a hablar con Supabase, que es un problema
   * distinto a que Supabase conteste que no.
   */
  private async llamar(pedido: Pedido): Promise<Response> {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      );
    }

    const destino = new URL(`${this.url}${pedido.camino}`);
    destino.searchParams.set('redirect_to', pedido.redirigirA);

    try {
      return await fetch(destino, {
        method: 'POST',
        headers: {
          apikey: this.clave,
          Authorization: `Bearer ${this.clave}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pedido.cuerpo),
        // Sin esto, una llamada que no vuelve deja el pedido abierto hasta que
        // lo corte la plataforma, con el panel girando y sin decir nada.
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
    } catch (problema) {
      const seAgotoElTiempo = (problema as Error).name === 'TimeoutError';
      this.logger.error(
        `No se pudo ${pedido.accion} en Supabase Auth: ${(problema as Error).message}`,
      );

      if (seAgotoElTiempo) {
        throw new ServiceUnavailableException(
          `Supabase no contestó en ${ESPERA_MAXIMA_MS / 1000} segundos al ${pedido.accion}. ` +
            (pedido.mandaCorreo
              ? PISTA_SMTP
              : 'Es un problema del lado de Supabase; probá de nuevo en un momento.'),
        );
      }

      throw new ServiceUnavailableException(
        `No se pudo conectar con Supabase para ${pedido.accion}. Probá de nuevo en un momento.`,
      );
    }
  }

  /**
   * Traduce un «no» de Supabase al mensaje que necesita quien atiende.
   *
   * Devuelve el error en vez de tirarlo, para que lo tire quien llama y el
   * compilador vea que después de eso no sigue nada.
   *
   * Se mira QUÉ dijo Supabase, no solo el código. Antes, cualquier 422 se
   * traducía a «ya tiene cuenta», y Supabase usa ese código para varias cosas
   * distintas: invitar a un alumno de verdad respondía que ya tenía cuenta, que
   * es falso y manda a buscar el problema donde no está.
   */
  private async problemaDe(respuesta: Response, pedido: Pedido): Promise<Error> {
    const cuerpo = await respuesta.text().catch(() => '');
    // El correo no se registra: el detalle va al log del servidor sin el dato
    // personal, y el mensaje que ve quien atiende dice qué hacer.
    this.logger.error(
      `Supabase respondió ${respuesta.status} al ${pedido.accion}: ${cuerpo.slice(0, 300)}`,
    );

    // El remitente que trae Supabase de fábrica SOLO le escribe a los correos
    // del equipo del proyecto. A un alumno no le llega nada.
    if (/not authorized|not_authorized/i.test(cuerpo)) {
      return new ServiceUnavailableException(
        'Supabase no tiene permitido escribirle a esa dirección: el remitente que viene de fábrica ' +
          'solo le entrega a las cuentas del equipo del proyecto. Hay que configurar un servidor de ' +
          'correo propio (SMTP). Ver docs/19-correo.md.',
      );
    }

    if (/already.*registered|already been registered|user already exists/i.test(cuerpo)) {
      return new CuentaYaRegistradaError();
    }

    if (respuesta.status === 429 || /rate limit/i.test(cuerpo)) {
      return new ServiceUnavailableException(
        'Supabase está limitando el envío de correos. El remitente de fábrica permite apenas ' +
          '2 por hora; con un servidor de correo propio ese tope desaparece. ' +
          'Ver docs/19-correo.md.',
      );
    }

    // Un 5xx NO es un rechazo: es que del otro lado no se completó. Llamarlo
    // «rechazo» manda a revisar el pedido, que está bien, en vez del servicio
    // que se colgó.
    if (respuesta.status >= 500 || /timeout|timed out/i.test(cuerpo)) {
      const agotado = /timeout|timed out/i.test(cuerpo) ? ': se agotó el tiempo' : '';
      return new ServiceUnavailableException(
        pedido.mandaCorreo
          ? `Supabase no llegó a completar el envío del correo (${respuesta.status}${agotado}). ` +
            PISTA_SMTP
          : `Supabase falló al ${pedido.accion} (${respuesta.status}${agotado}). ` +
            'Es un problema del lado de Supabase; probá de nuevo en un momento.',
      );
    }

    return new ServiceUnavailableException(
      `Supabase rechazó el pedido al ${pedido.accion} (${respuesta.status}). ` +
        'Revisá la configuración de correo del proyecto.',
    );
  }
}
