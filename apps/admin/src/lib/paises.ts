import lista from '@gimenoos/shared/paises.json';

/**
 * Países para el desplegable del pasaporte.
 *
 * Sale del mismo archivo que valida la API, así el panel no puede ofrecer un
 * país que el servidor después rechaza.
 */
export const PAISES = lista.paises as ReadonlyArray<{ codigo: string; nombre: string }>;

const POR_CODIGO = new Map(PAISES.map((pais) => [pais.codigo, pais.nombre]));

export function nombrePais(codigo: string | undefined): string {
  if (!codigo) return '';
  return POR_CODIGO.get(codigo.toUpperCase()) ?? codigo;
}

/**
 * Documento para mostrar: "12345678" para una cédula, "AB123456 (Brasil)" para
 * un pasaporte. El número solo no dice de qué documento se trata.
 */
export function documentoLegible(persona: {
  tipoDocumento?: 'CEDULA' | 'PASAPORTE';
  paisDocumento?: string;
  documento?: string | null;
}): string {
  if (!persona.documento) return '—';
  if (persona.tipoDocumento === 'PASAPORTE') {
    return `${persona.documento} (${nombrePais(persona.paisDocumento)})`;
  }
  return persona.documento;
}
