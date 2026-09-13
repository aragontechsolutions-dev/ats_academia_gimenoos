import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';

type Estado = 'canjeando' | 'listo' | 'error';

/**
 * Canjea el código de un enlace de acceso al panel.
 *
 * Es la misma pantalla que tiene la app del alumno, y existe por el mismo
 * motivo: la dirección de verificación que arma Supabase **se consume con una
 * sola visita**, y los antivirus de correo —Safe Links de Outlook, por ejemplo—
 * y las aplicaciones de mensajería visitan los enlaces antes que la persona.
 * El enlace llegaba quemado.
 *
 * Acá el código se canjea **desde JavaScript**, que esos rastreadores no
 * ejecutan.
 *
 * Se mantiene una copia por aplicación, igual que el manejo de sesión, para que
 * cada frontend siga siendo desplegable por separado.
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

  if (estado === 'listo' || (estado === 'canjeando' && sesion)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-carbon-950 px-4">
      <div className="w-full max-w-sm">
        <span className="flex items-baseline justify-center gap-1 text-2xl font-extrabold tracking-tight text-white">
          GIMENOOS
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-marca-500" />
        </span>
        <p className="mt-2 text-center text-xs uppercase tracking-widest text-slate-400">Panel</p>

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
                Los enlaces de acceso vencen a las 24 horas y se usan una sola vez. Pedile a la
                administración que te mande uno nuevo.
              </p>
              <a
                href="/ingresar"
                className="mt-5 inline-block text-sm font-medium text-marca-600 hover:text-marca-700"
              >
                Ir al ingreso
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
