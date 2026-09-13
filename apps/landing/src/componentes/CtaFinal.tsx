import { ArrowRight, MessageCircle } from 'lucide-react';
import { BotonEnlace } from './ui/Boton';
import { useDestinoPrincipal, useEnlaceWhatsApp, useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';

/** Último empujón antes del pie: una sola idea y dos formas de actuar. */
export function CtaFinal() {
  const principal = useDestinoPrincipal();
  const whatsapp = useEnlaceWhatsApp();
  const config = useSeccion('ctaFinal');
  if (!config.visible) return null;

  return (
    <section className="relative overflow-hidden bg-marca-500">
      {/* Líneas diagonales: velocidad, sin recurrir a ninguna imagen. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.6) 22px 24px)',
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="aparece text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          {texto(config.titulo, 'La primera clase es la que más cuesta arrancar')}
        </h2>
        <p className="aparece mx-auto mt-4 max-w-2xl text-lg text-marca-50">
          {texto(config.bajada, 'Escribinos y coordinamos. Después, manejar es cuestión de práctica.')}
        </p>
        <div className="aparece mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <BotonEnlace href={principal.href} externo={principal.externo} variante="claro">
            {texto(config.accion, 'Quiero empezar')}
            <ArrowRight size={18} aria-hidden="true" />
          </BotonEnlace>
          {whatsapp && (
            <BotonEnlace href={whatsapp} externo variante="contorno">
              <MessageCircle size={18} aria-hidden="true" />
              Escribinos por WhatsApp
            </BotonEnlace>
          )}
        </div>
      </div>
    </section>
  );
}
