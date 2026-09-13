import { useEffect, useState } from 'react';

import { obtenerGraduados, type GraduadoPublico } from './api';

/** Cuántos egresados se muestran en la portada antes del enlace al histórico. */
export const EGRESADOS_EN_PORTADA = 6;

export interface Egresados {
  lista: GraduadoPublico[];
  total: number;
  /**
   * Si ya se sabe la respuesta.
   *
   * Sin esto el enlace del navbar aparecería y desaparecería al cargar la
   * página, que se ve peor que tardar un instante en aparecer.
   */
  cargado: boolean;
}

const SIN_RESPUESTA: Egresados = { lista: [], total: 0, cargado: false };

/**
 * La petición, compartida por toda la página.
 *
 * La necesitan dos lugares —la sección de egresados y el enlace del navbar, que
 * no se dibuja si no hay ninguno— y sin esto serían dos peticiones idénticas.
 *
 * Se guarda a nivel de módulo y no se invalida nunca: el sitio es una página que
 * se carga una vez. `obtenerGraduados` nunca rechaza —devuelve una página vacía
 * si la API no contesta—, así que acá no queda cacheada una promesa fallida.
 */
let pedido: Promise<Egresados> | null = null;

function pedirEgresados(): Promise<Egresados> {
  pedido ??= obtenerGraduados({ porPagina: 10 }).then((pagina) => ({
    lista: pagina.datos.slice(0, EGRESADOS_EN_PORTADA),
    total: pagina.total,
    cargado: true,
  }));
  return pedido;
}

/** Los egresados de la portada. Devuelve la lista vacía mientras carga. */
export function useEgresados(): Egresados {
  const [datos, setDatos] = useState<Egresados>(SIN_RESPUESTA);

  useEffect(() => {
    let vigente = true;
    void pedirEgresados().then((resultado) => {
      if (vigente) setDatos(resultado);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return datos;
}
