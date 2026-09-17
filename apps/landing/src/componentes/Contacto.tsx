import { useState, type FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { motivosConsulta } from '../contenido';
import { construirEnlaceWhatsApp, useNegocio, useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';
import { avisarContactoWhatsApp } from '../lib/api';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { clasesBoton } from './ui/Boton';

/**
 * Formulario de contacto.
 *
 * Decisión deliberada: el formulario NO envía nada a un servidor. Arma un
 * mensaje de WhatsApp con lo que la persona escribió y abre la conversación.
 *
 * Por qué:
 * - No se almacena ningún dato personal, así que no se suman obligaciones de
 *   la Ley 18.331 (consentimiento, base de datos registrada ante la URCDP,
 *   derechos de acceso y supresión) para algo que igual termina en un chat.
 * - La consulta llega al mismo lugar donde la academia ya atiende.
 *
 * Si no hay número de WhatsApp cargado, el formulario no se muestra: no tendría
 * a dónde enviar. La sección se degrada a los datos de contacto disponibles.
 */
export function Contacto() {
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState<string>(motivosConsulta[0]);
  const [mensaje, setMensaje] = useState('');

  const negocio = useNegocio();
  const config = useSeccion('contacto');
  const hayWhatsApp = Boolean(negocio.whatsapp);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const presentacion = `Hola, soy ${nombre.trim()}. ${motivo}.`;
    const cuerpo = mensaje.trim();
    const enlace = construirEnlaceWhatsApp(
      negocio.whatsapp,
      cuerpo ? `${presentacion}\n${cuerpo}` : presentacion,
    );
    if (!enlace) return;

    // El aviso a la academia NO lleva nada de lo que se escribió acá: ni el
    // nombre, ni el motivo, ni el mensaje. Sólo que alguien está por escribir y
    // desde qué sección. Lo de arriba dice, en letra grande, que los datos no se
    // guardan en ningún lado; eso tiene que seguir siendo cierto.
    avisarContactoWhatsApp('formulario');
    window.open(enlace, '_blank', 'noopener,noreferrer');
  }

  return (
    <Seccion id="contacto" className="bg-slate-50">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <TituloSeccion
            sobretitulo={texto(config.etiqueta, 'Contacto')}
            titulo={texto(config.titulo, 'Escribinos y empezamos')}
            bajada={texto(config.bajada, 'Contanos en qué estás y te decimos cómo seguir. Sin compromiso.')}
          />

          {hayWhatsApp ? (
            <p className="aparece mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <MessageCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-marca-500" />
              <span>
                Al enviar se abre WhatsApp con tu consulta ya escrita.{' '}
                <strong className="font-bold text-carbon-950">
                  No guardamos tus datos en ningún lado
                </strong>
                : la conversación queda entre vos y la academia.
              </span>
            </p>
          ) : (
            <p className="aparece mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Todavía no está publicado el canal de contacto directo. Mientras tanto, mirá los
              datos de la sección{' '}
              <a href="#ubicacion" className="font-bold text-marca-600 underline">
                Dónde estamos
              </a>
              .
            </p>
          )}
        </div>

        {hayWhatsApp && (
          <form onSubmit={enviar} className="aparece rounded-2xl border border-slate-200 bg-white p-7">
            <div>
              <label htmlFor="contacto-nombre" className="block text-sm font-bold text-carbon-950">
                Tu nombre
              </label>
              <input
                id="contacto-nombre"
                name="nombre"
                type="text"
                required
                maxLength={80}
                autoComplete="name"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-carbon-950 outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
              />
            </div>

            <div className="mt-5">
              <label htmlFor="contacto-motivo" className="block text-sm font-bold text-carbon-950">
                ¿Qué necesitás?
              </label>
              <select
                id="contacto-motivo"
                name="motivo"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-carbon-950 outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
              >
                {motivosConsulta.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              <label htmlFor="contacto-mensaje" className="block text-sm font-bold text-carbon-950">
                Contanos un poco más <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="contacto-mensaje"
                name="mensaje"
                rows={4}
                maxLength={500}
                value={mensaje}
                onChange={(evento) => setMensaje(evento.target.value)}
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-carbon-950 outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
              />
            </div>

            <button type="submit" className={`${clasesBoton('primario')} mt-6 w-full`}>
              <Send size={18} aria-hidden="true" />
              Enviar por WhatsApp
            </button>
          </form>
        )}
      </div>
    </Seccion>
  );
}
