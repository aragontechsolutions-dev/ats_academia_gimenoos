import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSesion } from '../lib/sesion';

export function Ingreso() {
  const { sesion } = useSesion();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Navigate to="/" replace />;

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const { error: errorAuth } = await supabase.auth.signInWithPassword({ email, password: clave });

    if (errorAuth) {
      // Mensaje generico a proposito: no revela si el correo existe en el sistema.
      setError('No pudimos iniciar sesión. Revisá el correo y la contraseña.');
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(evento) => void manejarEnvio(evento)}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8"
      >
        <h1 className="text-xl font-bold text-slate-900">Panel de administración</h1>
        <p className="mt-1 text-sm text-slate-500">Academia de Choferes Gimenoos</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-marca-600 focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="clave">
          Contraseña
        </label>
        <input
          id="clave"
          type="password"
          required
          autoComplete="current-password"
          value={clave}
          onChange={(evento) => setClave(evento.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-marca-600 focus:outline-none"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-6 w-full rounded-lg bg-marca-600 py-2.5 font-semibold text-white transition hover:bg-marca-700 disabled:opacity-60"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
