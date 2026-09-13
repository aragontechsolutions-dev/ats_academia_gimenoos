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

    if (respuesta.status === 422 || /already.*registered|already been registered/i.test(cuerpo)) {
      throw new ServiceUnavailableException(
        'Esa dirección ya tiene cuenta en el sistema. No hace falta invitarla: puede ingresar con el enlace por correo desde la app.',
      );
    }
    if (respuesta.status === 429) {
      throw new ServiceUnavailableException(
        'Supabase está limitando el envío de correos. Esperá unos minutos y volvé a intentar.',
      );
    }
    throw new ServiceUnavailableException(
      `Supabase rechazó la invitación (${respuesta.status}). Revisá la configuración de correo del proyecto.`,
    );
  }
}
