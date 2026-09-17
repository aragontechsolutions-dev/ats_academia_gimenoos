import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Boton } from '../ui/Boton';
import { agenda } from '../../lib/recursos';
import { fechaLarga, hora } from '../../lib/fecha';
import { useAvisos } from '../../lib/avisos';
import { ETIQUETA_ESTADO, type Reserva } from '../../lib/tipos';

/** Estados a los que se puede llevar una clase que sigue vigente. */
const ACCIONES = [
  // `hecho` es lo que se avisa cuando la acción sale bien. Va en la misma tabla
  // que el botón para que no se despeguen: si mañana se agrega un estado, el
  // aviso se agrega en el mismo renglón o no compila.
  { estado: 'CONFIRMADA', texto: 'Confirmar', hecho: 'Clase confirmada' },
  { estado: 'COMPLETADA', texto: 'Marcar dictada', hecho: 'Clase marcada como dictada' },
  { estado: 'AUSENTE', texto: 'No asistió', hecho: 'Clase marcada: el alumno no asistió' },
] as const;

export function DetalleReserva({
  reserva,
  onCerrar,
  onCambio,
}: {
  reserva: Reserva;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const avisos = useAvisos();
  const [trabajando, setTrabajando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);

  const vigente = reserva.estado === 'PENDIENTE' || reserva.estado === 'CONFIRMADA';

  async function ejecutar(accion: () => Promise<unknown>, hecho: string) {
    setTrabajando(true);
    try {
      await accion();
      avisos.exito(hecho);
      onCambio();
      onCerrar();
    } catch (problema) {
      avisos.error(problema);
      setTrabajando(false);
    }
  }

  return (
    <Modal titulo="Clase" onCerrar={onCerrar}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Alumno</dt>
          <dd className="text-right font-medium text-slate-900">
            {reserva.cliente.nombre} {reserva.cliente.apellido}
            {reserva.cliente.telefono && (
              <span className="block text-xs font-normal text-slate-500">
                {reserva.cliente.telefono}
              </span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Cuándo</dt>
          <dd className="text-right text-slate-900">
            {fechaLarga(reserva.inicio)}
            <span className="block text-xs text-slate-500">
              {hora(reserva.inicio)} a {hora(reserva.fin)}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Instructor</dt>
          <dd className="text-slate-900">
            {reserva.instructor.nombre} {reserva.instructor.apellido}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Vehículo</dt>
          <dd className="text-slate-900">
            {reserva.vehiculo ? `${reserva.vehiculo.patente} (${reserva.tipo.toLowerCase()})` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Estado</dt>
          <dd className="font-medium text-slate-900">{ETIQUETA_ESTADO[reserva.estado]}</dd>
        </div>
        {reserva.observaciones && (
          <div>
            {/* «De la academia» y no «Observaciones» a secas: justo debajo puede
                aparecer la del instructor, y sin decir de quién es cada una se
                confunden. */}
            <dt className="text-slate-500">Observaciones de la academia</dt>
            <dd className="mt-1 text-slate-700">{reserva.observaciones}</dd>
          </div>
        )}
        {reserva.notaInstructor && (
          <div>
            <dt className="text-slate-500">Cómo fue la clase (lo anotó el instructor)</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-amber-950">
              {reserva.notaInstructor}
            </dd>
          </div>
        )}
        {reserva.motivoCancelacion && (
          <div>
            <dt className="text-slate-500">Motivo de la cancelación</dt>
            <dd className="mt-1 text-slate-700">{reserva.motivoCancelacion}</dd>
          </div>
        )}
      </dl>

      {vigente && !confirmandoCancelacion && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {ACCIONES.filter((a) => a.estado !== reserva.estado).map((accion) => (
            <Boton
              key={accion.estado}
              variante="secundario"
              disabled={trabajando}
              onClick={() => void ejecutar(() => agenda.cambiarEstado(reserva.id, accion.estado), accion.hecho)}
            >
              {accion.texto}
            </Boton>
          ))}
          <Boton
            variante="peligro"
            disabled={trabajando}
            onClick={() => setConfirmandoCancelacion(true)}
            className="ml-auto"
          >
            Cancelar clase
          </Boton>
        </div>
      )}

      {confirmandoCancelacion && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-700">
            Se libera el horario y el alumno deja de tenerla agendada.
          </p>
          <input
            type="text"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Motivo (opcional)"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marca-600 focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <Boton
              variante="peligro"
              disabled={trabajando}
              onClick={() => void ejecutar(() => agenda.cancelar(reserva.id, motivo || undefined), 'Clase cancelada')}
            >
              {trabajando ? 'Cancelando…' : 'Sí, cancelar'}
            </Boton>
            <Boton variante="secundario" onClick={() => setConfirmandoCancelacion(false)}>
              Volver
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
