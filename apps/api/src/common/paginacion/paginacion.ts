import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Tamaños de página que se aceptan.
 *
 * Es una lista cerrada a propósito: sin ella, un `porPagina=100000` es una
 * forma barata de hacer que la base devuelva una tabla entera en cada petición.
 */
export const TAMANOS_PAGINA = [10, 20, 50, 100] as const;

export const POR_PAGINA_POR_DEFECTO = 10;

/** Parámetros de paginación, comunes a todos los listados. */
export class ConsultaPaginadaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página tiene que ser un número' })
  @Min(1, { message: 'La página empieza en 1' })
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([...TAMANOS_PAGINA], {
    message: `Los tamaños de página permitidos son ${TAMANOS_PAGINA.join(', ')}`,
  })
  porPagina?: number;
}

/** Una página de resultados. La misma forma en todos los listados de la API. */
export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  datos: T[];
}

/**
 * Normaliza los parámetros recibidos.
 *
 * Segunda barrera, después del DTO: el DTO protege el borde HTTP, y esto
 * protege cualquier llamada interna que se haga al servicio sin pasar por él.
 */
export function normalizarPaginacion(consulta: ConsultaPaginadaDto): {
  pagina: number;
  porPagina: number;
  saltar: number;
} {
  const porPagina = (TAMANOS_PAGINA as readonly number[]).includes(consulta.porPagina ?? 0)
    ? (consulta.porPagina as number)
    : POR_PAGINA_POR_DEFECTO;
  const pagina = Number.isInteger(consulta.pagina) && (consulta.pagina as number) >= 1
    ? (consulta.pagina as number)
    : 1;

  return { pagina, porPagina, saltar: (pagina - 1) * porPagina };
}

export function armarPagina<T>(
  datos: T[],
  total: number,
  pagina: number,
  porPagina: number,
): Pagina<T> {
  return {
    total,
    pagina,
    porPagina,
    // Al menos una página siempre: "página 1 de 0" no significa nada.
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    datos,
  };
}
