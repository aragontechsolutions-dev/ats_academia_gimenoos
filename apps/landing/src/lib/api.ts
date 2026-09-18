/** Cliente HTTP minimo para los endpoints publicos de la API. */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface ServicioPublico {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'CLASE_SUELTA' | 'PACK' | 'CURSO_COMPLETO' | 'GESTORIA';
  tipoVehiculo: 'MOTO' | 'AUTO' | null;
  cantidadClases: number;
  duracionMin: number;
  /** Prisma serializa Decimal como string para no perder precision. */
  precioContado: string;
  precioTarjeta: string;
}

/**
 * La landing es un sitio publico: si la API no responde, la pagina debe
 * seguir siendo util. Por eso los errores devuelven una lista vacia en lugar
 * de romper el renderizado.
 */
export async function obtenerServicios(): Promise<ServicioPublico[]> {
  try {
    const respuesta = await fetch(`${API_URL}/catalogo/servicios`);
    if (!respuesta.ok) return [];
    return (await respuesta.json()) as ServicioPublico[];
  } catch {
    return [];
  }
}

// --- Egresados -------------------------------------------------------------

export interface GraduadoPublico {
  id: string;
  nombre: string;
  apellido: string;
  categoria: 'A' | 'G1' | 'G2' | 'G3';
  anio: number;
  /** Dirección pública ya armada por la API. Null si no hay foto. */
  fotoUrl: string | null;
}

/** Misma forma que devuelven todos los listados paginados de la API. */
export interface PaginaGraduados {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  datos: GraduadoPublico[];
}

const PAGINA_VACIA: PaginaGraduados = {
  total: 0,
  pagina: 1,
  porPagina: 10,
  paginas: 1,
  datos: [],
};

export async function obtenerGraduados(parametros: {
  pagina?: number;
  porPagina?: number;
  anio?: number;
}): Promise<PaginaGraduados> {
  const busqueda = new URLSearchParams();
  if (parametros.pagina) busqueda.set('pagina', String(parametros.pagina));
  if (parametros.porPagina) busqueda.set('porPagina', String(parametros.porPagina));
  if (parametros.anio) busqueda.set('anio', String(parametros.anio));

  try {
    const respuesta = await fetch(`${API_URL}/graduados/publicos?${busqueda.toString()}`);
    if (!respuesta.ok) return PAGINA_VACIA;
    return (await respuesta.json()) as PaginaGraduados;
  } catch {
    return PAGINA_VACIA;
  }
}

/** Un año de la galería, con sus egresados. */
export interface AnioDeEgresados {
  anio: number;
  /** Cuántos hay en ese año en total, que puede ser más de los que vienen. */
  total: number;
  graduados: GraduadoPublico[];
}

/**
 * La galería entera, agrupada por año, en una sola petición.
 *
 * Reemplazó al filtro por año más la paginación: la página es ahora una lista
 * de años, cada uno con su carrusel, y se baja en vez de filtrar.
 */
export async function obtenerGaleriaPorAnio(): Promise<AnioDeEgresados[]> {
  try {
    const respuesta = await fetch(`${API_URL}/graduados/galeria`);
    if (!respuesta.ok) return [];
    return (await respuesta.json()) as AnioDeEgresados[];
  } catch {
    return [];
  }
}

export interface VerificacionDiploma {
  valido: true;
  nombre: string;
  apellido: string;
  categoria: string;
  anio: number;
  fechaEgreso: string;
}

/** Devuelve null si el código no corresponde a ningún diploma. */
export async function verificarDiploma(codigo: string): Promise<VerificacionDiploma | null> {
  try {
    const respuesta = await fetch(
      `${API_URL}/graduados/verificar/${encodeURIComponent(codigo.trim())}`,
    );
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as VerificacionDiploma;
  } catch {
    return null;
  }
}

// --- Aviso de contacto por WhatsApp ----------------------------------------

/**
 * Desde dónde salió el contacto. Tiene que coincidir con el enum de la API
 * (`SeccionDeContacto`), que rechaza cualquier otro valor.
 */
export type SeccionDeContacto =
  | 'hero'
  | 'encabezado'
  | 'modalidades'
  | 'planes'
  | 'cta-final'
  | 'pie'
  | 'boton-flotante'
  | 'formulario';

/**
 * Le avisa a la academia que alguien está por escribirle, y desde qué sección.
 *
 * Tres reglas, y las tres existen por el mismo motivo —que el botón de WhatsApp
 * siga siendo un botón de WhatsApp—:
 *
 * 1. **No se espera la respuesta.** Quien llama no hace `await`. Si la API está
 *    caída o lenta, WhatsApp abre igual.
 * 2. **No se propaga ningún error.** El `catch` se traga todo. Un aviso que no
 *    salió no es asunto de quien visita el sitio.
 * 3. **`keepalive`.** El clic puede llevarse la pestaña por delante; con esto el
 *    navegador termina de mandar la petición aunque la página se vaya.
 *
 * No manda nada de quien toca el botón: sólo la sección y, si existe, de qué
 * página venía. La API se queda únicamente con el dominio de eso.
 */
export function avisarContactoWhatsApp(seccion: SeccionDeContacto): void {
  try {
    void fetch(`${API_URL}/landing/contacto-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seccion,
        // Cadena vacía cuando se entró escribiendo la dirección: se manda
        // `undefined` para que el campo directamente no viaje.
        desde: document.referrer || undefined,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Ni siquiera armar la petición puede romper el clic.
  }
}
