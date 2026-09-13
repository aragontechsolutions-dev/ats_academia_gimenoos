/**
 * ARCHIVO ÚNICO DE CONTENIDO Y CONFIGURACIÓN DE LA LANDING
 * =======================================================
 *
 * Todo el texto y los datos del negocio viven acá. Para actualizar el sitio no
 * hace falta tocar ningún componente.
 *
 * Dos reglas que sostiene el código, no solo este comentario:
 *
 * 1. Lo que está en `null` o vacío NO SE MUESTRA. Una sección sin datos reales
 *    desaparece de la página en vez de exhibir un marcador. Publicar un dato
 *    inventado sobre el negocio es peor que no publicarlo.
 * 2. Los precios NO están acá: se leen en vivo desde el panel de administración
 *    (`/catalogo/servicios`), así la academia los cambia sin tocar el código ni
 *    volver a desplegar.
 *
 * Las marcas TODO(datos-reales) señalan lo que falta cargar.
 */

// ---------------------------------------------------------------------------
// Datos del negocio
// ---------------------------------------------------------------------------

export const negocio = {
  nombre: 'Academia Gimenoos',
  nombreCorto: 'GIMENOOS',
  descripcionCorta: 'Academia de choferes en San Carlos, Maldonado.',

  ciudad: 'San Carlos',
  departamento: 'Maldonado',
  pais: 'Uruguay',

  // TODO(datos-reales): número con código de país y sin símbolos, ej. '59899123456'.
  // Es el dato más importante de la página: sin él no hay botón de WhatsApp,
  // ni formulario de contacto, ni CTA principal.
  whatsapp: null as string | null,

  // TODO(datos-reales): teléfono para mostrar y para llamar, ej. '+598 4266 0000'.
  telefono: null as string | null,

  // TODO(datos-reales): correo de contacto.
  email: null as string | null,

  // TODO(datos-reales): dirección exacta del local.
  direccion: null as string | null,

  // TODO(datos-reales): horarios de atención, ej. 'Lunes a viernes de 9 a 19'.
  horarios: null as string | null,

  // TODO(datos-reales): enlace para "Cómo llegar". Se obtiene buscando el local
  // en Google Maps y usando Compartir > Copiar vínculo.
  mapaUrl: null as string | null,

  // TODO(datos-reales): redes sociales. Dejar en null las que no existan.
  instagram: null as string | null,
  facebook: null as string | null,

  // TODO(datos-reales): dominio definitivo, sin barra final.
  sitioUrl: 'https://www.academiagimenoos.com.uy',
} as const;

/** Mensaje con el que se abre WhatsApp desde los botones generales. */
export const MENSAJE_WHATSAPP = 'Hola, quiero consultar por las clases de manejo.';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const hero = {
  insignia: 'Academia de choferes · San Carlos',
  titulo: 'Aprendé a manejar con confianza',
  subtitulo:
    'Practicá con acompañamiento, a tu ritmo, hasta que manejar te resulte natural. En San Carlos y alrededores.',
  ctaPrincipal: 'Quiero aprender a manejar',
  ctaSecundario: 'Consultar por WhatsApp',
};

/**
 * Barra de confianza.
 *
 * Van beneficios y no números: no tenemos cantidad de alumnos, años de
 * trayectoria ni porcentaje de aprobados verificados, y publicar una cifra
 * inventada es exactamente lo que destruye la confianza que la barra busca
 * construir.
 * TODO(datos-reales): si la academia confirma cifras reales, se pueden sumar acá.
 */
export const beneficios = [
  { titulo: 'Clases individuales', detalle: 'Uno a uno con el instructor' },
  { titulo: 'Moto y auto', detalle: 'Las dos categorías' },
  { titulo: 'A tu ritmo', detalle: 'Sin apuro y sin vergüenza' },
  { titulo: 'Acá nomás', detalle: 'San Carlos y alrededores' },
];

// ---------------------------------------------------------------------------
// Por qué Gimenoos
// ---------------------------------------------------------------------------

export const porQue = {
  titulo: 'Aprendé a manejar, no solo a aprobar',
  texto:
    'Aprobar el examen es el trámite. Lo que importa es que después salgas a la calle tranquilo: que entiendas el auto, que leas el tránsito y que las maniobras te salgan sin pensarlas.',
  tarjetas: [
    {
      icono: 'volante',
      titulo: 'Práctica desde el primer día',
      detalle: 'Manejás vos. La teoría se entiende mucho mejor con el auto andando.',
    },
    {
      icono: 'escudo',
      titulo: 'La seguridad primero',
      detalle: 'Hábitos que te acompañan siempre: espejos, distancias, anticiparte.',
    },
    {
      icono: 'instructor',
      titulo: 'A tu ritmo',
      detalle: 'Cada persona avanza distinto. Nadie te apura ni te hace sentir mal.',
    },
    {
      icono: 'carretera',
      titulo: 'Tránsito de verdad',
      detalle: 'Calles, rotondas y estacionamiento reales, no solo un circuito cerrado.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Modalidades y opciones
// ---------------------------------------------------------------------------

export const modalidades = [
  {
    id: 'auto',
    icono: 'auto',
    titulo: 'Clases de auto',
    descripcion: 'Desde cero o para soltarte antes del examen.',
    puntos: ['Auto de la academia', 'Ciudad y ruta', 'Maniobras y estacionamiento'],
  },
  {
    id: 'moto',
    icono: 'moto',
    titulo: 'Clases de moto',
    descripcion: 'Para empezar o para mejorar tu técnica y tu seguridad.',
    puntos: ['Moto de la academia', 'Equilibrio y frenado', 'Categorías G1 y G2'],
  },
] as const;

export const opciones = [
  {
    icono: 'primeros',
    titulo: 'Primeros pasos',
    detalle: 'Nunca manejaste y querés empezar de cero, sin presión.',
  },
  {
    icono: 'examen',
    titulo: 'Preparación para el examen',
    detalle: 'Ya manejás algo y querés llegar seguro al día de la prueba.',
  },
  {
    icono: 'perfeccionamiento',
    titulo: 'Perfeccionamiento',
    detalle: 'Tenés libreta pero querés manejar con más confianza.',
  },
  {
    icono: 'personalizado',
    titulo: 'Clases a medida',
    detalle: 'Contanos qué te cuesta y armamos las clases alrededor de eso.',
  },
] as const;

// ---------------------------------------------------------------------------
// Proceso
// ---------------------------------------------------------------------------

export const pasos = [
  { numero: '01', titulo: 'Consultá', detalle: 'Escribinos y vemos juntos por dónde empezar.' },
  { numero: '02', titulo: 'Elegí cómo', detalle: 'Clases sueltas o un pack, moto o auto.' },
  { numero: '03', titulo: 'Practicá', detalle: 'Clase a clase, hasta que te salga solo.' },
  { numero: '04', titulo: 'Salí a manejar', detalle: 'Con la libreta y con la confianza.' },
] as const;

// ---------------------------------------------------------------------------
// Trámite de la libreta
// ---------------------------------------------------------------------------

/**
 * Requisitos generales del trámite. Los detalles operativos —domicilios,
 * horarios de la charla, edades mínimas— los define la Intendencia y cambian,
 * así que no se afirman acá: se enlaza la fuente oficial.
 * TODO(verificar): confirmar en gub.uy antes de ampliar esta sección.
 */
export const tramite = {
  titulo: 'El trámite de la libreta, sin vueltas',
  introduccion:
    'La licencia se tramita ante la Intendencia de Maldonado y vale en todo el país. Te decimos qué necesitás y te acompañamos en cada paso.',
  requisitos: [
    'Cédula de identidad vigente',
    'Constancia de domicilio',
    'Certificado de aptitud médica',
    'Charla de manejo defensivo',
    'Examen teórico',
    'Examen práctico',
    'Estar libre de multas',
  ],
  categorias: [
    { codigo: 'A', descripcion: 'Automóvil particular' },
    { codigo: 'G1', descripcion: 'Ciclomotores hasta 50 cc' },
    { codigo: 'G2', descripcion: 'Motos con cambios hasta 200 cc' },
  ],
  aclaracion:
    'Los requisitos y las edades mínimas los define la Intendencia y pueden cambiar. Consultanos y te confirmamos cómo está el trámite hoy.',
  enlaceOficial: 'https://www.gub.uy/tramites/',
} as const;

// ---------------------------------------------------------------------------
// Contenido que aparece solo cuando existe de verdad
// ---------------------------------------------------------------------------

/** TODO(datos-reales): vehículos de la academia. La sección no se muestra vacía. */
export const vehiculos: Array<{
  nombre: string;
  tipo: 'auto' | 'moto';
  detalles: string[];
  foto: string | null;
}> = [];

/** TODO(datos-reales): fotos reales de la academia, las clases y los vehículos. */
export const galeria: Array<{ src: string; alt: string }> = [];

/** TODO(datos-reales): instructores reales, con su autorización para publicar foto. */
export const instructores: Array<{
  nombre: string;
  rol: string;
  descripcion: string;
  foto: string | null;
}> = [];

/**
 * TODO(datos-reales): testimonios REALES, con autorización expresa del alumno
 * para publicar su nombre (es un dato personal: Ley 18.331).
 */
export const testimonios: Array<{ nombre: string; texto: string }> = [];

// ---------------------------------------------------------------------------
// Preguntas frecuentes
// ---------------------------------------------------------------------------

export const preguntas = [
  {
    pregunta: '¿Necesito saber algo antes de la primera clase?',
    respuesta:
      'No. Las clases están pensadas para quien nunca manejó: empezamos por lo básico y avanzamos a tu ritmo.',
  },
  {
    pregunta: '¿El vehículo lo pone la academia?',
    respuesta: 'Sí. Las clases se toman con los vehículos de la academia.',
  },
  {
    pregunta: '¿Cuántas clases voy a necesitar?',
    respuesta:
      'Depende de cada persona. En la primera clase el instructor evalúa tu nivel y te dice, con criterio realista, cuántas te conviene tomar.',
  },
  {
    pregunta: '¿Cómo coordino las clases?',
    respuesta:
      'Escribinos y coordinamos el día y la hora. Si ya sos alumno, también podés reservar y cancelar desde la aplicación.',
  },
  {
    pregunta: '¿Me preparan para el examen?',
    respuesta:
      'Sí. Practicamos las maniobras que se evalúan y te acompañamos con la documentación del trámite.',
  },
  {
    pregunta: '¿Qué pasa si no puedo ir a una clase?',
    respuesta:
      'Avisanos con antelación y la reprogramamos. Si sos alumno, podés cancelarla desde la aplicación.',
  },
  {
    pregunta: '¿Cómo puedo pagar?',
    respuesta:
      'Aceptamos efectivo, transferencia y tarjetas de débito y crédito. El precio de contado puede diferir del de tarjeta: consultanos.',
  },
] as const;

// ---------------------------------------------------------------------------
// Formulario de contacto
// ---------------------------------------------------------------------------

/**
 * Opciones del formulario. El envío arma un mensaje de WhatsApp: la consulta no
 * se almacena en ningún lado, lo que evita sumar obligaciones de tratamiento de
 * datos personales para algo que termina igual en una conversación.
 */
export const motivosConsulta = [
  'Quiero aprender desde cero',
  'Quiero preparar mi examen',
  'Quiero mejorar mi manejo',
  'Quiero consultar precios',
  'Otra cosa',
] as const;

// ---------------------------------------------------------------------------
// Legales
// ---------------------------------------------------------------------------

export const legal = {
  // TODO(datos-reales): publicar los textos antes de abrir el sitio al público.
  politicaPrivacidad: '/politica-de-privacidad',
  terminos: '/terminos-y-condiciones',
};

/**
 * Menú principal. Conviene mantenerlo en el mismo orden en que aparecen las
 * secciones en `App.tsx`: es lo que espera quien lo lee de arriba abajo.
 * (El indicador de sección activa no depende de este orden, pero la persona sí.)
 */
export const navegacion = [
  { texto: 'Inicio', destino: '#inicio' },
  { texto: 'Por qué', destino: '#por-que' },
  { texto: 'Clases', destino: '#clases' },
  { texto: 'Planes', destino: '#planes' },
  { texto: 'Preguntas', destino: '#preguntas' },
  { texto: 'Contacto', destino: '#contacto' },
] as const;
