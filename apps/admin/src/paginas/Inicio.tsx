import { useSesion } from '../lib/sesion';

export function Inicio() {
  const { perfil } = useSesion();

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">
        Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}
      </h1>
      <p className="mt-2 text-slate-600">
        Este es el panel de la academia. La agenda, los alumnos, los pagos y los expedientes
        se incorporan en las siguientes etapas del desarrollo.
      </p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Próximas etapas</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Etapa 1 — Agenda: calendario, instructores, vehículos y reservas.</li>
          <li>Etapa 2 — Pagos: cobro online, terminal Point y verificación de transferencias.</li>
          <li>Etapa 3 — Expedientes de libreta, PWA del alumno y recordatorios.</li>
        </ol>
      </section>
    </>
  );
}
