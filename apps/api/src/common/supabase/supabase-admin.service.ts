import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      );
    }

    const destino = new URL(`${this.url}/auth/v1/invite`);
    destino.searchParams.set('redirect_to', redirigirA);

    let respuesta: Response;
    try {
      respuesta = await fetch(destino, {
        method: 'POST',
        headers: {
          apikey: this.clave,
          Authorization: `Bearer ${this.clave}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
    } catch (problema) {
      this.logger.error(`No se pudo llegar a Supabase Auth: ${(problema as Error).message}`);
      throw new ServiceUnavailableException(
        'No se pudo conectar con Supabase para mandar la invitación. Probá de nuevo en un momento.',
      );
    }

    if (respuesta.ok) return;

    const cuerpo = await respuesta.text().catch(() => '');
    // El correo no se registra: el detalle va al log del servidor sin el dato
    // personal, y el mensaje que ve quien atiende dice qué hacer.
    this.logger.error(`Supabase respondió ${respuesta.status} al invitar: ${cuerpo.slice(0, 300)}`);

    // Se mira QUÉ dijo Supabase, no solo el código.
    //
    // Antes, cualquier 422 se traducía a «ya tiene cuenta», y Supabase usa ese
    // código para varias cosas distintas. Invitar a un alumno de verdad
    // respondía que ya tenía cuenta, que es falso y manda a buscar el problema
    // donde no está.

    // El remitente que trae Supabase de fábrica SOLO le escribe a los correos
    // del equipo del proyecto. A un alumno no le llega nada. Es la causa más
    // probable de este error y la que menos se adivina sola.
    if (/not authorized|not_authorized/i.test(cuerpo)) {
      throw new ServiceUnavailableException(
        'Supabase no tiene permitido escribirle a esa dirección: el remitente que viene de fábrica ' +
          'solo le entrega a las cuentas del equipo del proyecto. Hay que configurar un servidor de ' +
          'correo propio (SMTP). Ver docs/18-cuentas-e-invitaciones.md.',
      );
    }

    if (/already.*registered|already been registered|user already exists/i.test(cuerpo)) {
      throw new ServiceUnavailableException(
        'Esa dirección ya tiene cuenta en el sistema. No hace falta invitarla: puede ingresar con el enlace por correo desde la app.',
      );
    }

    if (respuesta.status === 429 || /rate limit/i.test(cuerpo)) {
      throw new ServiceUnavailableException(
        'Supabase está limitando el envío de correos. El remitente de fábrica permite apenas ' +
          '2 por hora; con un servidor de correo propio ese tope desaparece. ' +
          'Ver docs/18-cuentas-e-invitaciones.md.',
      );
    }

    throw new ServiceUnavailableException(
      `Supabase rechazó la invitación (${respuesta.status}). Revisá la configuración de correo del proyecto.`,
    );
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
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      );
    }

    const destino = new URL(`${this.url}/auth/v1/admin/generate_link`);
    destino.searchParams.set('redirect_to', redirigirA);

    // `invite` crea la cuenta; `magiclink` sirve para quien ya la tiene. El tipo
    // viaja después en el enlace: la pantalla que canjea el código lo necesita.
    const tipo = esPrimerAcceso ? 'invite' : 'magiclink';

    let respuesta: Response;
    try {
      respuesta = await fetch(destino, {
        method: 'POST',
        headers: {
          apikey: this.clave,
          Authorization: `Bearer ${this.clave}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: tipo, email }),
      });
    } catch (problema) {
      this.logger.error(`No se pudo llegar a Supabase Auth: ${(problema as Error).message}`);
      throw new ServiceUnavailableException(
        'No se pudo conectar con Supabase para generar el enlace. Probá de nuevo en un momento.',
      );
    }

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => '');
      this.logger.error(
        `Supabase respondió ${respuesta.status} al generar el código: ${cuerpo.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        `Supabase rechazó la generación del código (${respuesta.status}).`,
      );
    }

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
}
