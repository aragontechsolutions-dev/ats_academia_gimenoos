import { EstadoReserva } from '@prisma/client';

import { escaparHtml } from '../src/common/telegram/telegram.service';
import {
  avisoDeCancelacion,
  avisoDeCierre,
  avisoDeReservaNueva,
  type ClaseParaAvisar,
} from '../src/modules/agenda/avisos-de-agenda';
import {
  dispositivoLegible,
  mensajeDeContacto,
  origenLegible,
} from '../src/modules/landing/contacto';
import { SeccionDeContacto } from '../src/modules/landing/dto/contacto-whatsapp.dto';

const CLASE: ClaseParaAvisar = {
  // 14:30 de Uruguay (UTC-3) el martes 17 de septiembre de 2026.
  inicio: new Date('2026-09-17T17:30:00.000Z'),
  cliente: { nombre: 'Lautaro', apellido: 'Pérez' },
  instructor: { nombre: 'Marta', apellido: 'Gómez' },
};

describe('escaparHtml', () => {
  it('neutraliza lo que Telegram interpretaría como marcado', () => {
    expect(escaparHtml('<b>hola</b>')).toBe('&lt;b&gt;hola&lt;/b&gt;');
  });

  it('escapa el & primero, para no escapar dos veces', () => {
    // Si el & se escapara al final, `&lt;` quedaría como `&amp;lt;` y el
    // mensaje mostraría el escape en vez del carácter.
    expect(escaparHtml('a & <b')).toBe('a &amp; &lt;b');
  });

  it('deja el texto normal intacto', () => {
    expect(escaparHtml('Clase de auto con Martín')).toBe('Clase de auto con Martín');
  });
});

describe('avisos de la agenda', () => {
  it('usa la hora de Uruguay y no la del servidor', () => {
    // El servidor corre en UTC: sin convertir diría 17:30, que es una clase que
    // nadie agendó.
    expect(avisoDeReservaNueva(CLASE, false)).toContain('a las 14:30');
  });

  it('distingue quién agendó, porque cambia qué hay que hacer', () => {
    expect(avisoDeReservaNueva(CLASE, true)).toContain('pendiente de confirmar');
    expect(avisoDeReservaNueva(CLASE, false)).toContain('ya confirmada');
  });

  it('nombra al alumno y al instructor', () => {
    const aviso = avisoDeReservaNueva(CLASE, true);
    expect(aviso).toContain('Lautaro Pérez');
    expect(aviso).toContain('Marta Gómez');
  });

  it('NO manda datos personales más allá del nombre', () => {
    // La cédula, el teléfono y el correo del alumno no salen del sistema hacia
    // Telegram. Si alguna vez se agregan, esta prueba tiene que fallar primero.
    const todos = [
      avisoDeReservaNueva(CLASE, true),
      avisoDeCierre(CLASE, EstadoReserva.COMPLETADA),
      avisoDeCancelacion(CLASE, 'El auto quedó en el taller'),
    ].join('\n');
    expect(todos).not.toMatch(/@|\d{7,}|cédula|cedula|teléfono|telefono/i);
  });

  it('un apellido con < no rompe el mensaje', () => {
    const traviesa: ClaseParaAvisar = {
      ...CLASE,
      cliente: { nombre: '<b>Ana', apellido: '</b><a href="http://x">click</a>' },
    };
    const aviso = avisoDeReservaNueva(traviesa, true);
    expect(aviso).not.toContain('<a href');
    expect(aviso).toContain('&lt;a href');
  });

  it('el motivo de la cancelación también se escapa', () => {
    const aviso = avisoDeCancelacion(CLASE, '<script>alert(1)</script>');
    expect(aviso).not.toContain('<script>');
    expect(aviso).toContain('&lt;script&gt;');
  });

  it('dice cuando no hay motivo, en vez de dejar el renglón colgado', () => {
    expect(avisoDeCancelacion(CLASE, null)).toContain('Sin motivo anotado');
    expect(avisoDeCancelacion(CLASE, '   ')).toContain('Sin motivo anotado');
  });

  describe('cierre de clase', () => {
    it('avisa la dictada y la ausencia con textos distintos', () => {
      expect(avisoDeCierre(CLASE, EstadoReserva.COMPLETADA)).toContain('Clase dictada');
      expect(avisoDeCierre(CLASE, EstadoReserva.AUSENTE)).toContain('no vino');
    });

    it('NO avisa al confirmar: eso lo acaba de hacer quien recibiría el aviso', () => {
      expect(avisoDeCierre(CLASE, EstadoReserva.CONFIRMADA)).toBeNull();
      expect(avisoDeCierre(CLASE, EstadoReserva.PENDIENTE)).toBeNull();
    });
  });
});

describe('aviso del clic de WhatsApp', () => {
  it('nombra la sección en castellano, no la clave interna', () => {
    const aviso = mensajeDeContacto(SeccionDeContacto.BOTON_FLOTANTE, '22:41', 'desde el celular', 'entró directo');
    expect(aviso).toContain('Botón flotante');
    expect(aviso).not.toContain('boton-flotante');
    expect(aviso).toContain('22:41');
  });

  it('TODAS las secciones tienen nombre: una nueva sin nombre no puede pasar', () => {
    for (const seccion of Object.values(SeccionDeContacto)) {
      const aviso = mensajeDeContacto(seccion, '10:00', 'desde una computadora', 'entró directo');
      expect(aviso).not.toContain('undefined');
    }
  });

  describe('de dónde venía la visita', () => {
    it('se queda sólo con el dominio', () => {
      expect(origenLegible('https://www.google.com/search?q=academia+de+choferes')).toBe(
        'vino de google.com',
      );
    });

    it('descarta la ruta y la consulta, que pueden traer lo que sea', () => {
      const origen = origenLegible('https://x.com/a?dato=<script>');
      expect(origen).toBe('vino de x.com');
      expect(origen).not.toContain('script');
    });

    it('sin referrer, o con uno que no es una dirección, dice que entró directo', () => {
      expect(origenLegible(undefined)).toBe('entró directo');
      expect(origenLegible('')).toBe('entró directo');
      expect(origenLegible('no soy una url')).toBe('entró directo');
    });
  });

  describe('dispositivo', () => {
    it('reconoce un teléfono', () => {
      expect(dispositivoLegible('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15')).toBe(
        'desde el celular',
      );
      expect(dispositivoLegible('Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36')).toBe(
        'desde el celular',
      );
    });

    it('y una computadora', () => {
      expect(dispositivoLegible('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe(
        'desde una computadora',
      );
    });

    it('sin User-Agent no inventa', () => {
      expect(dispositivoLegible(undefined)).toBe('dispositivo desconocido');
    });
  });
});
