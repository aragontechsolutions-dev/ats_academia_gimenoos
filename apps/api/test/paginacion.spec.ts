/**
 * Pruebas del paginado común a todos los listados.
 *
 * La normalización es la segunda barrera: el DTO protege el borde HTTP y esto
 * protege cualquier llamada interna que se haga al servicio sin pasar por él.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  ConsultaPaginadaDto,
  TAMANOS_PAGINA,
  armarPagina,
  normalizarPaginacion,
} from '../src/common/paginacion/paginacion';

async function validarDto(cuerpo: unknown) {
  const instancia = plainToInstance(ConsultaPaginadaDto, cuerpo, { enableImplicitConversion: true });
  return validate(instancia as object, { whitelist: true, forbidNonWhitelisted: true });
}

describe('parámetros que llegan por la URL', () => {
  it('acepta los cuatro tamaños permitidos', async () => {
    for (const tamano of TAMANOS_PAGINA) {
      expect(await validarDto({ porPagina: String(tamano) })).toHaveLength(0);
    }
  });

  it('rechaza un tamaño desmedido', async () => {
    // Un porPagina=100000 en un listado es una forma barata de hacer que la
    // base devuelva una tabla entera en cada petición.
    expect((await validarDto({ porPagina: '100000' })).length).toBeGreaterThan(0);
    expect((await validarDto({ porPagina: '37' })).length).toBeGreaterThan(0);
    expect((await validarDto({ porPagina: '0' })).length).toBeGreaterThan(0);
  });

  it('rechaza páginas que no existen', async () => {
    expect((await validarDto({ pagina: '0' })).length).toBeGreaterThan(0);
    expect((await validarDto({ pagina: '-3' })).length).toBeGreaterThan(0);
    expect((await validarDto({ pagina: 'dos' })).length).toBeGreaterThan(0);
  });

  it('el mensaje dice cuáles son los tamaños permitidos', async () => {
    const errores = await validarDto({ porPagina: '37' });
    expect(JSON.stringify(errores)).toContain('10, 20, 50, 100');
  });
});

describe('normalización', () => {
  it('sin parámetros devuelve la primera página de 10', () => {
    expect(normalizarPaginacion({})).toEqual({ pagina: 1, porPagina: 10, saltar: 0 });
  });

  it('ignora un tamaño que no está permitido en vez de obedecerlo', () => {
    expect(normalizarPaginacion({ porPagina: 100000 }).porPagina).toBe(10);
    expect(normalizarPaginacion({ porPagina: 37 }).porPagina).toBe(10);
    expect(normalizarPaginacion({ porPagina: 0 }).porPagina).toBe(10);
  });

  it('ignora páginas inválidas', () => {
    expect(normalizarPaginacion({ pagina: 0 }).pagina).toBe(1);
    expect(normalizarPaginacion({ pagina: -5 }).pagina).toBe(1);
    expect(normalizarPaginacion({ pagina: 1.5 }).pagina).toBe(1);
  });

  it('calcula bien cuántos saltear', () => {
    expect(normalizarPaginacion({ pagina: 3, porPagina: 20 }).saltar).toBe(40);
    expect(normalizarPaginacion({ pagina: 1, porPagina: 50 }).saltar).toBe(0);
  });
});

describe('forma de la página', () => {
  it('redondea las páginas hacia arriba', () => {
    expect(armarPagina([], 21, 1, 10).paginas).toBe(3);
    expect(armarPagina([], 20, 1, 10).paginas).toBe(2);
    expect(armarPagina([], 1, 1, 10).paginas).toBe(1);
  });

  it('sin resultados hay una página, no cero', () => {
    // "Página 1 de 0" no significa nada.
    expect(armarPagina([], 0, 1, 10).paginas).toBe(1);
  });

  it('devuelve siempre la misma forma', () => {
    const pagina = armarPagina([{ id: 'a' }], 1, 1, 10);
    expect(Object.keys(pagina).sort()).toEqual(
      ['datos', 'pagina', 'paginas', 'porPagina', 'total'].sort(),
    );
  });
});
