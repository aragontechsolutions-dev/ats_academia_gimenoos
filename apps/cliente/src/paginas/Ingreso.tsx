import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';
import { Logotipo } from '../componentes/Logotipo';

/**
 * Ingreso del alumno con enlace por correo (magic link).
 *
 * Se elige este metodo y no contrasenia porque evita que el alumno tenga que
 * recordar una clave y elimina el riesgo de contrasenias debiles reutilizadas.
 */
export function Ingreso() {
  const { sesion } = useSesion();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Navigate to="/" replace />;

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    // Se muestra el mismo mensaje exista o no la cuenta: asi no se puede
    // averiguar que correos estan registrados en el sistema.
    setEnviado(true);
    setEnviando(false);
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-carbon-950 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Logotipo className="justify-center text-2xl text-white" />
        <p className="mt-2 text-center text-sm text-slate-400">Academia de Choferes · San Carlos</p>

        <form
          onSubmit={(evento) => void manejarEnvio(evento)}
          className="mt-8 rounded-2xl bg-white p-6 shadow-xl shadow-black/30"
        >
          <h1 className="text-xl font-bold text-slate-900">Tus clases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Te mandamos un enlace por correo. No hace falta contraseña.
          </p>

          {enviado ? (
            <>
              <p className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                Si el correo está registrado, te enviamos un enlace para ingresar. Revisá tu bandeja
                de entrada.
              </p>
              <button
                type="button"
                onClick={() => setEnviado(false)}
                className="mt-4 w-full text-sm font-medium text-marca-600 hover:text-marca-700"
              >
                Probar con otro correo
              </button>
            </>
          ) : (
            <>
              <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="email">
                Tu correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900 transition focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-200"
              />
              <button
                type="submit"
                disabled={enviando}
                className="mt-6 w-full rounded-lg bg-marca-600 py-3 font-semibold text-white transition hover:bg-marca-700 disabled:opacity-60"
              >
                {enviando ? 'Enviando…' : 'Enviarme el enlace'}
              </button>
            </>
          )}
        </form>

        {/* slate-400 y no slate-500: sobre el negro de la marca, slate-500 da 4.13
            de contraste y el criterio AA pide 4.5 para texto de este tamaño. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          ¿Todavía no sos alumno? Escribinos y te contamos cómo empezar.
        </p>
      </div>
    </div>
  );
}
