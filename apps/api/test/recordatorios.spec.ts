import { TipoRecordatorio } from '@prisma/client';

import { correspondeMandar } from '../src/modules/recordatorios/reglas';
import {
  recordatorioParaLaAcademia,
  type ClaseParaRecordar,
} from '../src/modules/recordatorios/mensajes';

const hs = (n: number) => n * 60 * 60 * 1000;

/** Una clase el 18/09/2026 a las 14:00 de Uruguay (17:00 UTC). */
const INICIO = new Date('2026-09-18T17:00:00.000Z');

/** Reservada con una semana de antelación, salvo que se diga otra cosa. */
const clase = (createdAt = new Date(INICIO.getTime() - hs(24 * 7))) => ({
  inicio: INICIO,
  createdAt,
});

describe('cuándo corresponde mandar un recordatorio', () => {
  describe('el de 24 horas', () => {
    const tipo = TipoRecordatorio.VEINTICUATRO_HORAS;

    it('no sale con 25 horas por delante: todavía no toca', () => {
      expect(correspondeMandar(clase(), tipo, new Date(INICIO.getTime() - hs(25)))).toBe(false);
    });

    it('sale apenas se abre la ventana', () => {
      expect(correspondeMandar(clase(), tipo, new Date(INICIO.getTime() - hs(24)))).toBe(true);
    });

    it('sigue saliendo más tarde: si la pasada anterior se perdió, esta lo manda', () => {
      expect(correspondeMandar(clase(), tipo, new Date(INICIO.getTime() - hs(20)))).toBe(true);
    });
  });

  describe('el de 2 horas', () => {
    const tipo = TipoRecordatorio.DOS_HORAS;

    it('no sale con 3 horas por delante', () => {
      expect(correspondeMandar(clase(), tipo, new Date(INICIO.getTime() - hs(3)))).toBe(false);
    });

    it('sale con 2 horas', () => {
      expect(correspondeMandar(clase(), tipo, new Date(INICIO.getTime() - hs(2)))).toBe(true);
    });
  });

  describe('lo que no es obvio', () => {
    it('NUNCA sale para una clase que ya empezó', () => {
      // Si el disparador estuvo caído medio día, al volver no puede mandar
      // recordatorios de clases que ya pasaron.
      for (const tipo of Object.values(TipoRecordatorio)) {
        expect(correspondeMandar(clase(), tipo, INICIO)).toBe(false);
        expect(correspondeMandar(clase(), tipo, new Date(INICIO.getTime() + hs(1)))).toBe(false);
      }
    });

    it('quien reserva con 3 horas de antelación NO recibe el de 24 horas', () => {
      // Sin esta regla lo recibiría en el acto: la ventana de 24 horas ya estaba
      // abierta cuando reservó. Sería un aviso sobre algo que acaba de hacer.
      const reservadaTarde = clase(new Date(INICIO.getTime() - hs(3)));
      const ahora = new Date(INICIO.getTime() - hs(3) + 60_000);
      expect(correspondeMandar(reservadaTarde, TipoRecordatorio.VEINTICUATRO_HORAS, ahora)).toBe(false);
    });

    it('pero SÍ recibe el de 2 horas, que todavía tiene sentido', () => {
      const reservadaTarde = clase(new Date(INICIO.getTime() - hs(3)));
      expect(correspondeMandar(reservadaTarde, TipoRecordatorio.DOS_HORAS, new Date(INICIO.getTime() - hs(2)))).toBe(true);
    });

    it('quien reserva con media hora de antelación no recibe ninguno', () => {
      const sobreLaHora = clase(new Date(INICIO.getTime() - hs(0.5)));
      const ahora = new Date(INICIO.getTime() - hs(0.4));
      for (const tipo of Object.values(TipoRecordatorio)) {
        expect(correspondeMandar(sobreLaHora, tipo, ahora)).toBe(false);
      }
    });

    it('reservada justo en el borde de la ventana: entra', () => {
      const justo = clase(new Date(INICIO.getTime() - hs(24)));
      expect(correspondeMandar(justo, TipoRecordatorio.VEINTICUATRO_HORAS, new Date(INICIO.getTime() - hs(24)))).toBe(true);
    });
  });
});

describe('el texto del recordatorio', () => {
  const CLASE: ClaseParaRecordar = {
    inicio: INICIO,
    tipo: 'AUTO',
    cliente: { nombre: 'Lautaro', apellido: 'Pérez', telefono: '+598 92331784' },
    instructor: { nombre: 'Marta', apellido: 'Gómez' },
  };

  it('dice la hora de Uruguay, no la del servidor', () => {
    // El servidor corre en UTC: sin convertir diría 17:00.
    const ahora = new Date(INICIO.getTime() - hs(24));
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.VEINTICUATRO_HORAS, ahora)).toContain('14:00');
  });

  it('dice «mañana» cuando es mañana', () => {
    const ahora = new Date(INICIO.getTime() - hs(24));
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.VEINTICUATRO_HORAS, ahora)).toContain('mañana a las 14:00');
  });

  it('y «hoy» cuando es hoy', () => {
    const ahora = new Date(INICIO.getTime() - hs(2));
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.DOS_HORAS, ahora)).toContain('hoy a las 14:00');
  });

  it('«mañana» se decide por el día de Uruguay, no por restar 24 horas', () => {
    // A las 23:00 del 17 en Uruguay (02:00 UTC del 18), una clase del 18 a las
    // 14:00 está a 15 horas: no son «24 horas» pero sí es mañana.
    const ahora = new Date('2026-09-18T02:00:00.000Z');
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.DOS_HORAS, ahora)).toContain('mañana');
  });

  it('lleva el teléfono: el aviso existe para poder llamarlo', () => {
    const ahora = new Date(INICIO.getTime() - hs(2));
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.DOS_HORAS, ahora)).toContain('+598 92331784');
  });

  it('sin teléfono no deja el renglón colgado', () => {
    const sinTelefono = { ...CLASE, cliente: { ...CLASE.cliente, telefono: null } };
    const ahora = new Date(INICIO.getTime() - hs(2));
    expect(recordatorioParaLaAcademia(sinTelefono, TipoRecordatorio.DOS_HORAS, ahora)).not.toContain('Teléfono');
  });

  it('un apellido con < no rompe el mensaje', () => {
    const traviesa = {
      ...CLASE,
      cliente: { nombre: '<b>Ana', apellido: '</b><a href="http://x">y</a>', telefono: null },
    };
    const aviso = recordatorioParaLaAcademia(traviesa, TipoRecordatorio.DOS_HORAS, new Date(INICIO.getTime() - hs(2)));
    expect(aviso).not.toContain('<a href');
    expect(aviso).toContain('&lt;a href');
  });

  it('los dos tipos se distinguen de un vistazo', () => {
    const ahora = new Date(INICIO.getTime() - hs(24));
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.VEINTICUATRO_HORAS, ahora)).toContain('Clase mañana');
    expect(recordatorioParaLaAcademia(CLASE, TipoRecordatorio.DOS_HORAS, new Date(INICIO.getTime() - hs(2)))).toContain('Clase en un rato');
  });
});
