/**
 * Pruebas de la normalización de teléfonos y documentos.
 *
 * Son funciones puras y la regla de negocio vive entera acá, así que se prueban
 * directamente y con todas las formas en que la gente escribe estas cosas en un
 * mostrador.
 */
import { TipoIdentificacion } from '@prisma/client';

import { normalizarTelefono } from '../src/common/formato/telefono';
import { digitosParaWhatsApp } from '@gimenoos/shared';
import { normalizarDocumento, PAISES } from '../src/common/formato/documento';

describe('teléfono', () => {
  it('deja el mismo número igual, se escriba como se escriba', () => {
    const equivalentes = [
      '098663201',
      '098 663 201',
      '098-663-201',
      '98663201',
      '+598 98663201',
      '+59898663201',
      '598 98663201',
      '(098) 663 201',
      '  098663201  ',
    ];
    for (const forma of equivalentes) {
      expect(normalizarTelefono(forma)).toBe('+598 98663201');
    }
  });

  it('normaliza también los fijos', () => {
    expect(normalizarTelefono('42660000')).toBe('+598 42660000');
    expect(normalizarTelefono('(042) 66 0000')).toBe('+598 42660000');
    expect(normalizarTelefono('2 4001234')).toBe('+598 24001234');
  });

  it('respeta un número de otro país', () => {
    // Un alumno extranjero puede tener su teléfono de origen; forzarle un +598
    // lo dejaría inutilizable.
    expect(normalizarTelefono('+55 11 99999 9999')).toBe('+5511999999999');
    expect(normalizarTelefono('+54 9 11 1234 5678')).toBe('+5491112345678');
  });

  it('vacío o ausente queda en null, no en cadena vacía', () => {
    expect(normalizarTelefono('')).toBeNull();
    expect(normalizarTelefono('   ')).toBeNull();
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
  });

  it('rechaza lo que no es un número uruguayo válido', () => {
    for (const invalido of ['123', '0986632010000', 'no es un teléfono', '09866320']) {
      expect(() => normalizarTelefono(invalido)).toThrow();
    }
  });

  it('el mensaje explica qué se espera y cómo poner uno extranjero', () => {
    expect(() => normalizarTelefono('123')).toThrow(/8 dígitos/);
    expect(() => normalizarTelefono('123')).toThrow(/otro país/);
  });
});

describe('cédula', () => {
  it('le saca los puntos, guiones y espacios con que la escribe la gente', () => {
    for (const forma of ['1.234.567-8', '1 234 567 8', '12345678', ' 12345678 ']) {
      expect(normalizarDocumento({ documento: forma })).toEqual({
        tipoDocumento: TipoIdentificacion.CEDULA,
        paisDocumento: 'UY',
        documento: '12345678',
      });
    }
  });

  it('acepta 7 dígitos', () => {
    expect(normalizarDocumento({ documento: '1234567' }).documento).toBe('1234567');
  });

  it('rechaza letras', () => {
    expect(() => normalizarDocumento({ documento: '1234567A' })).toThrow(/sin puntos/);
  });

  it('rechaza largos que no son de una cédula', () => {
    for (const invalida of ['123456', '123456789', '1']) {
      expect(() => normalizarDocumento({ documento: invalida })).toThrow();
    }
  });

  it('siempre es uruguaya, aunque pidan otro país', () => {
    // Una cédula de identidad uruguaya, por definición, la emite Uruguay.
    expect(normalizarDocumento({ documento: '12345678', paisDocumento: 'BR' }).paisDocumento)
      .toBe('UY');
  });

  it('sin documento la ficha se puede crear igual', () => {
    // Muchas veces el alumno llega con el número en la cabeza y se carga después.
    expect(normalizarDocumento({ documento: '' }).documento).toBeNull();
    expect(normalizarDocumento({}).documento).toBeNull();
  });
});

describe('pasaporte', () => {
  const base = { tipoDocumento: TipoIdentificacion.PASAPORTE, paisDocumento: 'BR' };

  it('pasa las letras a mayúsculas', () => {
    // `ab123456` y `AB123456` son el mismo documento: guardarlos distinto
    // permitiría cargar dos veces a la misma persona.
    expect(normalizarDocumento({ ...base, documento: 'ab123456' }).documento).toBe('AB123456');
    expect(normalizarDocumento({ ...base, documento: 'Ab 12-3456' }).documento).toBe('AB123456');
  });

  it('acepta números sin letras', () => {
    expect(normalizarDocumento({ ...base, documento: '123456789' }).documento).toBe('123456789');
  });

  it('guarda el país que emitió', () => {
    expect(normalizarDocumento({ ...base, documento: 'AB123456' }).paisDocumento).toBe('BR');
    expect(normalizarDocumento({ ...base, paisDocumento: 'ar', documento: 'X1' + '23456' })
      .paisDocumento).toBe('AR');
  });

  it('exige el país: un pasaporte sin emisor no identifica a nadie', () => {
    expect(() => normalizarDocumento({ tipoDocumento: TipoIdentificacion.PASAPORTE, documento: 'AB123456' }))
      .toThrow(/Falta el país/);
  });

  it('rechaza un país que no existe', () => {
    expect(() => normalizarDocumento({ ...base, paisDocumento: 'XX', documento: 'AB123456' }))
      .toThrow(/no existe/);
  });

  it('rechaza símbolos', () => {
    expect(() => normalizarDocumento({ ...base, documento: 'AB/123456' })).toThrow();
    expect(() => normalizarDocumento({ ...base, documento: 'AB@12' })).toThrow();
  });

  it('rechaza largos disparatados', () => {
    expect(() => normalizarDocumento({ ...base, documento: 'AB12' })).toThrow();
    expect(() => normalizarDocumento({ ...base, documento: 'A'.repeat(21) })).toThrow();
  });
});

describe('lista de países', () => {
  it('tiene los de la región y no tiene códigos retirados ni agrupaciones', () => {
    const codigos = new Set(PAISES.map((p) => p.codigo));
    for (const vigente of ['UY', 'AR', 'BR', 'PY', 'CL', 'BO', 'PE', 'VE', 'CO', 'CU', 'ES', 'IT']) {
      expect(codigos.has(vigente)).toBe(true);
    }
    // DD, SU, YU y CS son países que ya no existen; EU y EZ no son países.
    for (const retirado of ['DD', 'SU', 'YU', 'CS', 'ZR', 'EU', 'EZ', 'UN', 'ZZ']) {
      expect(codigos.has(retirado)).toBe(false);
    }
  });

  it('no tiene códigos repetidos y todos son dos letras mayúsculas', () => {
    expect(new Set(PAISES.map((p) => p.codigo)).size).toBe(PAISES.length);
    for (const pais of PAISES) {
      expect(pais.codigo).toMatch(/^[A-Z]{2}$/);
      expect(pais.nombre.length).toBeGreaterThan(1);
    }
  });
});

describe('el número que se le pasa a wa.me', () => {
  // Esta función NO normaliza: convierte lo que ya está guardado. Las reglas de
  // qué es un teléfono válido viven en `normalizarTelefono`, del lado de la API,
  // que es donde se guarda. Acá lo que importa es que nunca arme un enlace que
  // abra un chat con quien no es.

  it('un teléfono guardado como corresponde sale listo para wa.me', () => {
    expect(digitosParaWhatsApp('+598 98663201')).toBe('59898663201');
    expect(digitosParaWhatsApp('+5511999999999')).toBe('5511999999999');
  });

  it('sin código de país devuelve null, en vez de un enlace que abre otro chat', () => {
    // Este es el error concreto: `092331784` es un celular uruguayo bien
    // escrito, y quitándole los símbolos quedan nueve dígitos que wa.me toma
    // como un número de otro país. El botón existía y no llevaba a nadie.
    expect(digitosParaWhatsApp('092331784')).toBeNull();
    expect(digitosParaWhatsApp('092 331 784')).toBeNull();
    expect(digitosParaWhatsApp('98663201')).toBeNull();
  });

  it('un número sin «+» pero con código de país sí sirve', () => {
    // Diez dígitos o más ya no dejan lugar a dudas: ningún país tiene números
    // nacionales tan largos sin código.
    expect(digitosParaWhatsApp('59899123456')).toBe('59899123456');
  });

  it('devuelve null cuando no hay nada utilizable, en vez de inventar', () => {
    for (const entrada of [null, undefined, '', '   ', '123', 'no es un teléfono', '+', '9'.repeat(16)]) {
      expect(digitosParaWhatsApp(entrada)).toBeNull();
    }
  });

  it('lo que guarda la API siempre se puede convertir', () => {
    // El contrato entre las dos piezas: lo que sale de `normalizarTelefono`
    // tiene que entrar en `digitosParaWhatsApp`. Si alguien cambia el formato de
    // guardado y se olvida de esto, el enlace desaparece sin ningún error.
    for (const escrito of ['098663201', '098 663 201', '+598 98663201', '42660000', '+55 11 99999 9999']) {
      const guardado = normalizarTelefono(escrito);
      expect(guardado).not.toBeNull();
      expect(digitosParaWhatsApp(guardado)).not.toBeNull();
    }
  });
});
