/**
 * ARCHIVO UNICO DE CONTENIDO DE LA LANDING
 * =======================================
 *
 * Todo el texto y los datos del sitio publico viven aca. Para actualizar el sitio
 * NO hace falta tocar componentes: se edita este archivo.
 *
 * Las marcas TODO(datos-reales) senialan valores PLACEHOLDER que hay que
 * reemplazar por informacion real antes de publicar. Los campos que quedan
 * vacios o en null simplemente no se muestran en el sitio, de modo que nunca
 * se publica informacion inventada.
 *
 * Las marcas TODO(verificar) senialan informacion sobre el tramite de libreta
 * que debe confirmarse en la fuente oficial (gub.uy / Intendencia de Maldonado)
 * antes de publicarse, porque los requisitos y domicilios cambian.
 */

export const academia = {
  nombre: 'Academia de Choferes Gimenoos',
  nombreCorto: 'Gimenoos',
  ciudad: 'San Carlos',
  departamento: 'Maldonado',
  pais: 'Uruguay',

  // TODO(datos-reales): direccion exacta del local.
  direccion: null as string | null,
  // TODO(datos-reales): telefono de contacto en formato internacional, ej. '+598 4266 0000'.
  telefono: null as string | null,
  // TODO(datos-reales): numero de WhatsApp SOLO con digitos y codigo de pais, ej. '59899123456'.
  whatsapp: null as string | null,
  // TODO(datos-reales): correo de contacto.
  email: null as string | null,

  // TODO(datos-reales): horarios de atencion reales.
  horarios: null as string | null,

  // TODO(datos-reales): coordenadas del local para el mapa (latitud, longitud).
  coordenadas: null as { lat: number; lng: number } | null,

  // TODO(datos-reales): enlaces a redes sociales. Dejar en null los que no existan.
  instagram: null as string | null,
  facebook: null as string | null,
} as const;

export const hero = {
  titulo: 'Sacá tu libreta de moto o auto en San Carlos',
  subtitulo:
    'Clases prácticas con instructores habilitados y acompañamiento del trámite ante la Intendencia de Maldonado. Reservás tu clase online, en el horario que te sirve.',
  ctaPrincipal: { texto: 'Agendá tu clase', destino: '#contacto' },
  ctaSecundario: { texto: 'Ver clases y precios', destino: '#servicios' },
};

/**
 * Bloques de servicio mostrados en el sitio.
 *
 * Los precios NO estan aca: se leen en vivo desde la API (`/catalogo/servicios`),
 * para que la academia los edite desde el panel sin tocar el codigo ni volver a
 * desplegar el sitio.
 */
export const categorias = [
  {
    id: 'moto',
    titulo: 'Clases de moto',
    descripcion:
      'Aprendé a manejar moto desde cero o mejorá tu técnica. Preparación para las categorías G1 y G2 de la libreta.',
    puntos: [
      'Clases individuales con instructor',
      'Moto de la academia incluida',
      'Preparación para el examen práctico',
    ],
  },
  {
    id: 'auto',
    titulo: 'Clases de auto',
    descripcion:
      'Clases prácticas de manejo de automóvil para quienes empiezan y para quienes quieren perder el miedo antes del examen.',
    puntos: [
      'Auto de doble comando de la academia',
      'Circuitos de ciudad y ruta',
      'Preparación para el examen práctico',
    ],
  },
];

export const pasos = [
  {
    numero: 1,
    titulo: 'Reservás tu clase',
    detalle: 'Elegís moto o auto, el día y la hora que te queden bien. Te confirmamos al instante.',
  },
  {
    numero: 2,
    titulo: 'Tomás las clases',
    detalle: 'Practicás con un instructor hasta que manejes con seguridad y estés listo para el examen.',
  },
  {
    numero: 3,
    titulo: 'Gestionamos el trámite',
    detalle:
      'Te ayudamos con la documentación y la preparación de los exámenes teórico y práctico ante la Intendencia.',
  },
  {
    numero: 4,
    titulo: 'Obtenés tu libreta',
    detalle: 'Rendís el examen y salís a la calle con tu Permiso Único Nacional de Conducir.',
  },
];

/**
 * Informacion sobre el tramite.
 *
 * IMPORTANTE: estos requisitos son los generales del tramite de licencia de
 * conducir. Los detalles operativos (domicilios, horarios de la charla de manejo
 * defensivo, lugar del examen practico) cambian y NO se publican aca hasta ser
 * confirmados en la fuente oficial.
 * TODO(verificar): confirmar en https://www.gub.uy y en el portal de la
 * Intendencia de Maldonado antes de ampliar esta seccion.
 */
export const tramite = {
  titulo: 'Cómo es el trámite de la libreta en Maldonado',
  introduccion:
    'La licencia se tramita ante la Intendencia de Maldonado y es el Permiso Único Nacional de Conducir, válido en todo el país. Estos son los pasos generales; te acompañamos en cada uno.',
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
    { codigo: 'G2', descripcion: 'Motocicletas con cambios hasta 200 cc' },
  ],
  aclaracion:
    'Los requisitos y las edades mínimas los define la Intendencia y pueden actualizarse. Consultanos y te confirmamos cómo está el trámite hoy.',
  enlaceOficial: 'https://www.gub.uy/tramites/',
};

/**
 * TODO(datos-reales): cargar los instructores reales de la academia.
 * La seccion no se muestra mientras el arreglo este vacio: nunca se publican
 * personas inventadas.
 */
export const instructores: Array<{
  nombre: string;
  rol: string;
  descripcion: string;
  foto: string | null;
}> = [];

/**
 * TODO(datos-reales): cargar testimonios REALES de alumnos, con su autorizacion
 * expresa para publicar nombre y comentario (es un dato personal: Ley 18.331).
 * Mientras el arreglo este vacio la seccion no se muestra. Nunca inventar resenias.
 */
export const testimonios: Array<{ nombre: string; texto: string }> = [];

export const preguntas = [
  {
    pregunta: '¿Necesito saber algo antes de la primera clase?',
    respuesta:
      'No. Las clases están pensadas para quien nunca manejó. Empezamos desde lo básico y avanzamos a tu ritmo.',
  },
  {
    pregunta: '¿La academia pone el vehículo?',
    respuesta:
      'Sí. Las clases se toman con los vehículos de la academia, preparados para la enseñanza.',
  },
  {
    pregunta: '¿Cuántas clases necesito para estar listo?',
    respuesta:
      'Depende de cada persona. En la primera clase el instructor evalúa tu nivel y te dice, con criterio realista, cuántas clases te conviene tomar.',
  },
  {
    pregunta: '¿Qué pasa si no puedo asistir a una clase?',
    respuesta:
      'Podés cancelar o reprogramar desde el sistema avisando con la antelación indicada en nuestra política de cancelación.',
  },
  {
    pregunta: '¿Me ayudan con el trámite de la libreta?',
    respuesta:
      'Sí. Te indicamos qué documentación necesitás, te preparamos para el examen teórico y te acompañamos en la gestión ante la Intendencia.',
  },
  {
    pregunta: '¿Cómo puedo pagar?',
    respuesta:
      'Aceptamos efectivo, transferencia bancaria y tarjetas de débito y crédito. Consultanos por el precio de cada modalidad.',
  },
];

export const legal = {
  // TODO(datos-reales): completar cuando esten publicadas las politicas.
  politicaPrivacidad: '/politica-de-privacidad',
  terminos: '/terminos-y-condiciones',
};
