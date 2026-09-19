import { useCallback, useEffect, useState } from 'react';

import { Boton } from './ui/Boton';
import { useAvisos } from '../lib/avisos';
import {
  activar,
  desactivar,
  estado as leerEstado,
  type EstadoDeLosAvisos,
} from '../lib/avisosDelTelefono';

/**
 * Prender y apagar los recordatorios en el teléfono.
 *
 * Se usa de dos formas, y la diferencia importa:
 *
 * - `variante="tarjeta"` en «Mis clases»: **una sola vez**, cuando todavía no se
 *   preguntó y el alumno tiene una clase por delante. Ese es el momento en que
 *   la oferta se entiende sin explicar nada.
 * - `variante="control"` en el perfil: siempre visible, para prenderlo o
 *   apagarlo cuando quiera.
 *
 * Nunca se pide el permiso al entrar a la app. Los navegadores rechazan el
 * pedido que no viene de un clic, y Chrome además penaliza al sitio que
 * pregunta apenas carga. Siempre hay un botón de por medio.
 */
export function AvisosDelTelefono({ variante }: { variante: 'tarjeta' | 'control' }) {
  const avisos = useAvisos();
  const [estado, setEstado] = useState<EstadoDeLosAvisos | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const refrescar = useCallback(() => {
    void leerEstado().then(setEstado).catch(() => setEstado('no-disponible'));
  }, []);

  useEffect(refrescar, [refrescar]);

  async function cambiar(encender: boolean) {
    setTrabajando(true);
    try {
      const nuevo = encender ? await activar() : await desactivar();
      setEstado(nuevo);

      if (nuevo === 'activos') avisos.exito('Listo, te vamos a avisar antes de cada clase');
      else if (nuevo === 'bloqueados') {
        avisos.error(
          new Error(
            'El navegador quedó con los avisos bloqueados. Se cambia desde sus ajustes, en los permisos de este sitio.',
          ),
        );
      } else if (!encender) avisos.exito('Ya no vas a recibir avisos en este teléfono');
    } catch (problema) {
      avisos.error(problema);
    } finally {
      setTrabajando(false);
    }
  }

  // Mientras se averigua, no se dibuja nada: mostrar «desactivado» un instante y
  // que después salte a «activado» se lee como un error.
  if (estado === null) return null;

  /*
   * La academia todavía no cargó las claves. No se ofrece nada: antes se
   * mostraba la tarjeta, el alumno tocaba «Sí, avisame», el navegador le pedía
   * permiso, y recién ahí aparecía un error rojo diciendo que la academia no lo
   * tenía configurado. Ese permiso se pide una sola vez con comodidad.
   */
  if (estado === 'sin-configurar') {
    return variante === 'control' ? (
      <p className="text-sm text-slate-500">
        Los avisos en el teléfono todavía no están disponibles. Los estamos preparando.
      </p>
    ) : null;
  }

  // Un navegador que no puede no tiene por qué enterarse de que esto existe.
  if (estado === 'no-disponible') {
    return variante === 'control' ? (
      <p className="text-sm text-slate-500">
        Este navegador no puede mostrar avisos. Si estás en iPhone, agregá la app a la pantalla
        de inicio y volvé a entrar desde ahí.
      </p>
    ) : null;
  }

  if (variante === 'tarjeta') {
    // La tarjeta es una oferta, no un estado: si ya están prendidos, o si ya
    // dijo que no, no hay nada que ofrecer.
    if (estado !== 'sin-pedir') return null;

    return (
      <section className="mt-4 rounded-xl border border-marca-600 bg-marca-50 p-4">
        <p className="font-semibold text-marca-900">¿Te avisamos antes de cada clase?</p>
        <p className="mt-1 text-sm text-marca-900">
          Te llega un aviso el día antes y otro dos horas antes. Lo podés apagar cuando quieras.
        </p>
        <Boton className="mt-3 w-full" disabled={trabajando} onClick={() => void cambiar(true)}>
          {trabajando ? 'Activando…' : 'Sí, avisame'}
        </Boton>
      </section>
    );
  }

  if (estado === 'bloqueados') {
    return (
      <p className="text-sm text-slate-600">
        Los avisos están bloqueados en este navegador. Para volver a recibirlos hay que
        permitirlos desde sus ajustes, en los permisos de este sitio.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-700">
        {estado === 'activos'
          ? 'Te avisamos el día antes y dos horas antes de cada clase.'
          : 'No estás recibiendo avisos en este teléfono.'}
      </span>
      <Boton
        variante="secundario"
        disabled={trabajando}
        onClick={() => void cambiar(estado !== 'activos')}
      >
        {trabajando ? '…' : estado === 'activos' ? 'Apagar' : 'Activar'}
      </Boton>
    </div>
  );
}
