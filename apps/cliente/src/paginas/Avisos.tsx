import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Logotipo } from '../componentes/Logotipo';
import { llamarApi } from '../lib/api';

/**
 * Darse de baja de los recordatorios por correo.
 *
 * Es la pantalla a la que lleva el enlace del pie de cada correo, y **funciona
 * sin haber iniciado sesión**: quien abre un correo no necesariamente tiene la
 * app abierta, y obligarlo a entrar para dejar de recibir correos es la forma
 * más rápida de que marque el correo como spam.
 *
 * El botón no es un adorno. La baja no puede pasar por el solo hecho de abrir
 * esta dirección, porque los antivirus de correo visitan los enlaces antes que
 * la persona —Safe Links de Outlook es el caso típico— y darían de baja a medio
 * padrón sin que nadie tocara nada. Hace falta un clic de verdad.
 */
export function Avisos() {
  const [parametros] = useSearchParams();
  const token = parametros.get('baja') ?? '';

  const [estado, setEstado] = useState<'pendiente' | 'trabajando' | 'listo'>('pendiente');
  const [error, setError] = useState<string | null>(null);

  async function darDeBaja() {
    setEstado('trabajando');
    setError(null);
    try {
      await llamarApi<void>('/recordatorios/baja', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setEstado('listo');
    } catch (problema) {
      setError((problema as Error).message);
      setEstado('pendiente');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-carbon-950 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-lg items-center px-4 py-3">
          <Logotipo etiqueta="Alumnos" className="text-lg" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        {!token ? (
          <Aviso tipo="error">
            Este enlace está incompleto. Abrilo de nuevo desde el correo que recibiste.
          </Aviso>
        ) : estado === 'listo' ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="text-xl font-bold text-slate-900">Listo</h1>
            <p className="mt-2 text-sm text-slate-600">
              No vamos a mandarte más recordatorios por correo. Tus clases siguen igual, y las
              podés ver cuando quieras desde la app.
            </p>
            <p className="mt-4 text-sm text-slate-600">
              Si cambiás de idea, se vuelve a activar desde <strong>Mi perfil</strong>.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="text-xl font-bold text-slate-900">
              ¿Dejar de recibir los recordatorios por correo?
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Son los avisos que te llegan el día antes y dos horas antes de cada clase.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Tus clases no cambian: solo dejás de recibir el correo.
            </p>

            {error && (
              <div className="mt-4">
                <Aviso tipo="error">{error}</Aviso>
              </div>
            )}

            <Boton
              className="mt-5 w-full"
              disabled={estado === 'trabajando'}
              onClick={() => void darDeBaja()}
            >
              {estado === 'trabajando' ? 'Dando de baja…' : 'Sí, dar de baja'}
            </Boton>
          </div>
        )}
      </main>
    </div>
  );
}
