/**
 * Pruebas de la validación de rutas de foto.
 *
 * Estas rutas llegan desde el panel y terminan armando la dirección que el sitio
 * publica, así que la lista de casos rechazados no es un ejercicio: cada uno es
 * algo que se podría guardar si la validación fuera "que sea texto".
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { RUTA_FOTO, rutaFotoONula } from '../src/common/formato/foto';
import { FotoVehiculoDto } from '../src/modules/vehiculos/dto/vehiculo.dto';

const ID = '3f1c2d4e-5a6b-4c8d-9e0f-1a2b3c4d5e6f';

/** Corre el DTO entero, no solo la expresión: es lo que se ejecuta en producción. */
async function erroresDe(fotoRuta: unknown) {
  const dto = plainToInstance(FotoVehiculoDto, { fotoRuta });
  const errores = await validate(dto);
  return errores.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('forma de la ruta', () => {
  it('acepta la ruta que arma el panel', () => {
    for (const extension of ['jpg', 'jpeg', 'webp']) {
      expect(RUTA_FOTO.test(`${ID}/foto-1757779200000.${extension}`)).toBe(true);
    }
  });

  it('rechaza una dirección de otro servidor', async () => {
    expect(await erroresDe('https://cualquier-servidor.com/imagen.jpg')).not.toHaveLength(0);
    expect(await erroresDe('//cualquier-servidor.com/imagen.jpg')).not.toHaveLength(0);
  });

  it('rechaza un javascript: disfrazado de ruta', async () => {
    expect(await erroresDe('javascript:alert(1)//foto.jpg')).not.toHaveLength(0);
  });

  it('rechaza salir de la carpeta hacia un bucket privado', async () => {
    expect(await erroresDe(`../expedientes/${ID}/cedula.jpg`)).not.toHaveLength(0);
    expect(await erroresDe(`${ID}/../../expedientes/cedula.jpg`)).not.toHaveLength(0);
  });

  it('rechaza extensiones que pueden traer código adentro', async () => {
    for (const nombre of ['foto.svg', 'foto.html', 'foto.js', 'foto.jpg.html']) {
      expect(await erroresDe(`${ID}/${nombre}`)).not.toHaveLength(0);
    }
  });

  it('rechaza una carpeta que no es un id', async () => {
    expect(await erroresDe('publico/foto.jpg')).not.toHaveLength(0);
    expect(await erroresDe('foto.jpg')).not.toHaveLength(0);
  });

  it('acepta una ruta válida sin errores', async () => {
    expect(await erroresDe(`${ID}/foto-1757779200000.jpg`)).toHaveLength(0);
  });
});

describe('quitar la foto', () => {
  // El panel manda '' cuando se aprieta "Quitar": tiene que pasar la validación
  // y llegar a la base como null, no rebotar como si fuera una ruta mal escrita.
  it('la cadena vacía y null pasan la validación', async () => {
    expect(await erroresDe('')).toHaveLength(0);
    expect(await erroresDe(null)).toHaveLength(0);
  });

  it('la cadena vacía se guarda como null y el campo ausente no toca nada', () => {
    expect(rutaFotoONula('')).toBeNull();
    expect(rutaFotoONula('   ')).toBeNull();
    expect(rutaFotoONula(null)).toBeNull();
    expect(rutaFotoONula(undefined)).toBeUndefined();
    expect(rutaFotoONula(` ${ID}/foto.jpg `)).toBe(`${ID}/foto.jpg`);
  });
});
