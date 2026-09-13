import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';
import { Logotipo } from '../componentes/Logotipo';

type Estado = 'canjeando' | 'listo' | 'error';

/**
 * Canjea el código de un enlace de acceso.
 *
 * Existe por un motivo muy concreto: la dirección de verificación que arma
 * Supabase **se consume con una sola visita**, y las aplicaciones de mensajería
 * y los antivirus de correo visitan los enlaces para armar la vista previa o
 * revisarlos. Mandar esa dirección por WhatsApp la quemaba antes de que la
 * persona la tocara, y al abrirla recibía «el enlace es inválido o expiró».
 *
 * Acá el código viaja en la dirección pero **se canjea desde JavaScript**, que
 * los rastreadores de vista previa no ejecutan. Es lo que recomienda la propia
 * documentación de Supabase para este problema.
 *
 * Los nombres de los parámetros (`token_hash`, `type`) son los de Supabase a
 * propósito: la plantilla de correo los arma con sus propias variables, y
 * renombrarlos acá sería una fuente de desajustes silenciosos.
 */
export function Entrar() {
  const [parametros] = useSearchParams();
  const { sesion } = useSesion();
  const [estado, setEstado] = useState<Estado>('canjeando');

  const tokenHash = parametros.get('token_hash');
  const tipo = parametros.get('type');

  useEffect(() => {
    if (!tokenHash) {
      setEstado('error');
      return;
    }

    let vigente = true;
    void supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: (tipo ?? 'magiclink') as 'invite' | 'magiclink' })
      .then(({ error }) => {
        if (!vigente) return;
        setEstado(error ? 'error' : 'listo');
      });

    return () => {
      vigente = false;
    };
  }, [tokenHash, tipo]);

  // Ya adentro: a sus clases. `replace` para que el botón de atrás no devuelva a
  // esta pantalla con un código ya gastado.
  if (estado === 'listo' || (estado === 'canjeando' && sesion)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-carbon-950 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Logotipo className="justify-center text-2xl text-white" />
        <p className="mt-2 text-center text-sm text-slate-400">Academia de Choferes · San Carlos</p>

        <div className="mt-8 rounded-2xl bg-white p-6 text-center shadow-xl shadow-black/30">
          {estado === 'canjeando' ? (
            <>
              <h1 className="text-xl font-bold text-slate-900">Entrando…</h1>
              <p className="mt-2 text-sm text-slate-500">Un segundo, estamos abriendo tu cuenta.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900">Este enlace ya no sirve</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Los enlaces de acceso vencen a las 24 horas y se usan una sola vez. Puede que
                este ya lo hayas usado, o que haya pasado el plazo.
              </p>
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Escribile a la academia y te mandamos uno nuevo al toque.
              </p>
              <a
                href="/ingresar"
                className="mt-5 inline-block text-sm font-medium text-marca-600 hover:text-marca-700"
              >
                Pedir un enlace por correo
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
