import lista from '@gimenoos/shared/paises.json';

/** Países para el desplegable del pasaporte. Misma lista que valida la API. */
export const PAISES = lista.paises as ReadonlyArray<{ codigo: string; nombre: string }>;
