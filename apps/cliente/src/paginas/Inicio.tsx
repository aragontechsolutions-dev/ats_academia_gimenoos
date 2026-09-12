import { useSesion } from '../lib/sesion';

export function Inicio() {
  const { perfil, cerrarSesion } = useSesion();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{perfil?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        >
          Salir
        </button>
      </header>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Tus clases</h2>
        <p className="mt-2 text-sm text-slate-600">
          Acá vas a ver y reservar tus clases cuando esté lista la agenda (Etapa 1).
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Tu trámite de libreta</h2>
        <p className="mt-2 text-sm text-slate-600">
          Acá vas a poder subir tu documentación y seguir el estado del trámite (Etapa 3).
        </p>
      </section>
    </div>
  );
}
