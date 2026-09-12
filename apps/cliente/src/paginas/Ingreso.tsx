import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(evento) => void manejarEnvio(evento)}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8"
      >
        <h1 className="text-xl font-bold text-slate-900">Academia Gimenoos</h1>
        <p className="mt-1 text-sm text-slate-500">Ingresá para ver tus clases.</p>

        {enviado ? (
          <p className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            Si el correo está registrado, te enviamos un enlace para ingresar. Revisá tu bandeja
            de entrada.
          </p>
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
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-marca-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={enviando}
              className="mt-6 w-full rounded-lg bg-marca-600 py-2.5 font-semibold text-white transition hover:bg-marca-700 disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviarme el enlace'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
