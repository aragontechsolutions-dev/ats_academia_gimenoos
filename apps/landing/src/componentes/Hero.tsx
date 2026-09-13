import { MapPin, MessageCircle } from 'lucide-react';

import { hero } from '../contenido';
import {
  useDestinoPrincipal,
  useEnlaceWhatsApp,
  useNegocio,
  useSeccion,
} from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';
import { BotonEnlace } from './ui/Boton';

export function Hero() {
  const negocio = useNegocio();
  const wa = useEnlaceWhatsApp();
  const principal = useDestinoPrincipal();

  // Lo que la academia cargó desde el panel gana; si no cargó nada, el texto
  // del código.
  const config = useSeccion('hero');
  const insignia = texto(config.etiqueta, hero.insignia);
  const titulo = texto(config.titulo, hero.titulo);
  const subtitulo = texto(config.bajada, hero.subtitulo);
  const ctaPrincipal = texto(config.accion, hero.ctaPrincipal);

  return (
    <section id="inicio" className="relative overflow-hidden bg-carbon-950 text-white">
      {/* Composición decorativa: líneas de pista y un resplandor rojo. Es
          decoración, no una fotografía del negocio: publicar la foto de un auto
          que no es el de la academia sería afirmar algo que no es cierto. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-marca-500/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-acento-500/10 blur-3xl" />
        <svg
          className="absolute inset-y-0 right-0 h-full w-full opacity-[0.07]"
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="white" strokeWidth="2" fill="none">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M${-200 + i * 190} 620 L${260 + i * 190} -20`} />
            ))}
          </g>
        </svg>
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-32 sm:pt-36 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-28">
        <div className="aparece visible">
          <p className="inline-flex items-center gap-2 rounded-full border border-marca-500/40 bg-marca-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-marca-200">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-acento-400" />
            {insignia}
          </p>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {titulo.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="text-marca-500">{titulo.split(' ').slice(-1)}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-300">{subtitulo}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <BotonEnlace href={principal.href} externo={principal.externo} variante="primario">
              {ctaPrincipal}
            </BotonEnlace>

            {wa ? (
              <BotonEnlace href={wa} externo variante="contorno">
                <MessageCircle size={20} aria-hidden="true" />
                {hero.ctaSecundario}
              </BotonEnlace>
            ) : (
              <BotonEnlace href="#planes" variante="contorno">
                Ver clases y precios
              </BotonEnlace>
            )}
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-slate-400">
            <MapPin size={16} aria-hidden="true" className="text-marca-500" />
            {negocio.ciudad} · {negocio.departamento} · {negocio.pais}
          </p>
        </div>

        {/* Panel decorativo: un velocímetro estilizado. Refuerza la identidad
            automotriz sin simular una fotografía de la academia. */}
        <div aria-hidden="true" className="relative hidden lg:block">
          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-6 rounded-full border border-white/10" />
            <svg viewBox="0 0 200 200" className="absolute inset-0">
              <defs>
                <linearGradient id="arco" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFC400" />
                  <stop offset="55%" stopColor="#FF7A00" />
                  <stop offset="100%" stopColor="#D90429" />
                </linearGradient>
              </defs>
              <path
                d="M40 155 A 78 78 0 1 1 160 155"
                fill="none"
                stroke="#2A2D33"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M40 155 A 78 78 0 0 1 148 44"
                fill="none"
                stroke="url(#arco)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {Array.from({ length: 9 }, (_, i) => {
                const angulo = Math.PI * (1 - i / 8);
                return (
                  <line
                    key={i}
                    x1={100 + Math.cos(angulo) * 60}
                    y1={155 - Math.sin(angulo) * 60}
                    x2={100 + Math.cos(angulo) * 52}
                    y2={155 - Math.sin(angulo) * 52}
                    stroke="white"
                    strokeOpacity="0.25"
                    strokeWidth="2"
                  />
                );
              })}
              <circle cx="100" cy="155" r="6" fill="#D90429" />
              <line x1="100" y1="155" x2="146" y2="66" stroke="#D90429" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <p className="absolute inset-x-0 bottom-12 text-center text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
              {negocio.nombreCorto}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
