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
