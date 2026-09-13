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

/** Tamaños que acepta la API. Cualquier otro lo ignora y usa el de por defecto. */
export const TAMANOS_PAGINA = [10, 20, 50, 100] as const;

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

/** Años con egresados publicados, para el filtro. */
export async function obtenerAniosGraduados(): Promise<number[]> {
  try {
    const respuesta = await fetch(`${API_URL}/graduados/anios`);
    if (!respuesta.ok) return [];
    return (await respuesta.json()) as number[];
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
