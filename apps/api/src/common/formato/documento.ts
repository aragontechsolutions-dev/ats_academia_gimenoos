import { BadRequestException } from '@nestjs/common';
import { TipoIdentificacion } from '@prisma/client';
import listaPaises from '@gimenoos/shared/paises.json';

const CODIGOS_PAIS: ReadonlySet<string> = new Set(
  (listaPaises.paises as Array<{ codigo: string }>).map((pais) => pais.codigo),
);

export interface DocumentoNormalizado {
  tipoDocumento: TipoIdentificacion;
  paisDocumento: string;
  documento: string | null;
}

/**
 * Normaliza y valida el documento de un alumno.
 *
 * Dos casos:
 *
 * - **Cédula uruguaya**: solo dígitos, 7 u 8, incluido el verificador. Se le
 *   quitan los puntos, guiones y espacios con los que la gente la escribe
 *   (`1.234.567-8`), porque la misma cédula escrita de tres formas distintas
 *   son tres fichas distintas a la hora de buscarla.
 * - **Pasaporte**: letras y dígitos, y se guarda **en mayúsculas**. Los
 *   pasaportes se escriben en mayúscula y `ab123456` y `AB123456` son el mismo
 *   documento; guardarlos distinto permitiría cargar dos veces a la misma
 *   persona.
 *
 * El país solo se pide para el pasaporte: una cédula de identidad uruguaya, por
 * definición, la emite Uruguay.
 */
export function normalizarDocumento(entrada: {
  tipoDocumento?: TipoIdentificacion;
  paisDocumento?: string;
  documento?: string | null;
}): DocumentoNormalizado {
  const tipo = entrada.tipoDocumento ?? TipoIdentificacion.CEDULA;

  const crudo = (entrada.documento ?? '').trim();
  if (crudo === '') {
    // Sin documento la ficha se puede crear igual: muchas veces el alumno llega
    // con el número en la cabeza y se carga después.
    return { tipoDocumento: tipo, paisDocumento: paisDe(tipo, entrada.paisDocumento), documento: null };
  }

  if (tipo === TipoIdentificacion.CEDULA) {
    const soloDigitos = crudo.replace(/[.\s-]/g, '');
    if (!/^\d{7,8}$/.test(soloDigitos)) {
      throw new BadRequestException(
        'La cédula son 7 u 8 dígitos, sin puntos, espacios ni letras (por ejemplo 12345678)',
      );
    }
    return { tipoDocumento: tipo, paisDocumento: 'UY', documento: soloDigitos };
  }

  const enMayusculas = crudo.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{5,20}$/.test(enMayusculas)) {
    throw new BadRequestException(
      'El pasaporte lleva entre 5 y 20 letras y números, sin espacios ni símbolos',
    );
  }

  return {
    tipoDocumento: tipo,
    paisDocumento: paisDe(tipo, entrada.paisDocumento),
    documento: enMayusculas,
  };
}

function paisDe(tipo: TipoIdentificacion, pedido: string | undefined): string {
  if (tipo === TipoIdentificacion.CEDULA) return 'UY';

  const codigo = (pedido ?? '').trim().toUpperCase();
  if (codigo === '') {
    throw new BadRequestException('Falta el país que emitió el pasaporte');
  }
  if (!CODIGOS_PAIS.has(codigo)) {
    throw new BadRequestException(`El país "${codigo}" no existe en la lista de países`);
  }
  return codigo;
}

/** La lista completa, para que el panel arme el desplegable. */
export const PAISES = listaPaises.paises as ReadonlyArray<{ codigo: string; nombre: string }>;
