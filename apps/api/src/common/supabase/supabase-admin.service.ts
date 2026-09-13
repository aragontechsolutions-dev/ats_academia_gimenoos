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
   * Genera el enlace de acceso SIN mandar ningún correo.
   *
   * Es lo que permite cerrar el ciclo cuando la persona llegó por WhatsApp: la
   * academia ya está conversando con ella, así que el enlace se pega en esa
   * conversación en vez de mandarlo a una casilla que capaz no mira.
   *
   * El enlace devuelto es una **credencial**: quien lo tenga entra como esa
   * persona. Por eso no se guarda en la base, no se escribe en los registros y
   * no se puede volver a pedir el mismo. El plazo de validez lo fija el proyecto
   * de Supabase, no este código.
   */
  async generarEnlace(email: string, redirigirA: string, esPrimerAcceso: boolean): Promise<string> {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.',
      );
    }

    const destino = new URL(`${this.url}/auth/v1/admin/generate_link`);
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
        // `invite` crea la cuenta; `magiclink` sirve para quien ya la tiene.
        body: JSON.stringify({ type: esPrimerAcceso ? 'invite' : 'magiclink', email }),
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
        `Supabase respondió ${respuesta.status} al generar el enlace: ${cuerpo.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        `Supabase rechazó la generación del enlace (${respuesta.status}).`,
      );
    }

    // El cuerpo de esta respuesta NUNCA se registra: trae el enlace adentro.
    //
    // `action_link` viene en la RAÍZ de la respuesta. Es el cliente
    // `supabase-js` el que lo anida bajo `properties`, y como acá se habla
    // directo con la API de Auth, ese nivel no existe. Se contemplan los dos por
    // si alguna versión cambia de forma.
    const datos = (await respuesta.json()) as {
      action_link?: string;
      properties?: { action_link?: string };
    };
    const enlace = datos.action_link ?? datos.properties?.action_link;
    if (!enlace) {
      this.logger.error('Supabase devolvió una respuesta sin action_link al generar el enlace');
      throw new ServiceUnavailableException('Supabase no devolvió un enlace utilizable.');
    }
    return enlace;
  }
}
