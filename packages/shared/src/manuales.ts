/**
 * Los manuales de uso, uno por rol.
 *
 * Viven acá y no dentro de cada aplicacion por una razon concreta: **el panel
 * muestra los tres**. Quien atiende el mostrador tiene que poder leer lo mismo
 * que ve el alumno cuando lo llama por telefono sin entender una pantalla. Con
 * el texto repartido en tres proyectos, el del alumno y el que lee la academia
 * se irian separando sin que nadie lo notara.
 *
 * Es DATO, no marcado. Cada aplicacion lo dibuja con su propio aspecto, y
 * ninguna necesita `dangerouslySetInnerHTML`: en este proyecto no hay uno solo,
 * y un manual no es motivo para estrenarlo.
 *
 * Tampoco es un archivo `.tsx`: este paquete lo consumen Vite, `tsc`, `ts-node`
 * y Jest, y la API lo importa desde Node. Manteniendolo en TypeScript pelado
 * sigue sirviendo para todos.
 *
 * QUE VA EN CADA UNO
 *
 * - Alumno e instructor: **lo que pueden hacer**, y nada mas. No necesitan saber
 *   como funciona el sistema por dentro; necesitan saber donde tocar.
 * - Administracion: lo que puede hacer **y los flujos completos**, incluidos los
 *   de los otros dos roles, porque es quien contesta cuando algo no se entiende.
 */

export type RolDelManual = 'ADMIN' | 'INSTRUCTOR' | 'CLIENTE';

/** Un paso de un flujo, con quien lo hace. */
export interface PasoDeFlujo {
  /** «El alumno», «La academia», «El sistema». Quien actua, no que pantalla. */
  quien: string;
  hace: string;
}

/** Algo que se puede hacer, y donde. */
export interface AccionDelManual {
  que: string;
  /** Como se hace. Opcional: hay acciones que no necesitan explicacion. */
  como?: string;
}

export interface SeccionDelManual {
  id: string;
  titulo: string;
  intro?: string;
  acciones?: AccionDelManual[];
  /** Solo en el manual de administracion. */
  flujo?: PasoDeFlujo[];
  /** Algo que conviene saber y que no es una accion. */
  aviso?: string;
}

export interface Manual {
  rol: RolDelManual;
  /** Como se lo nombra en la pantalla que lo muestra. */
  titulo: string;
  bajada: string;
  secciones: SeccionDelManual[];
}

// ---------------------------------------------------------------------------
// Alumno
// ---------------------------------------------------------------------------

const ALUMNO: Manual = {
  rol: 'CLIENTE',
  titulo: 'Manual del alumno',
  bajada: 'Todo lo que podés hacer desde la app, y dónde está cada cosa.',
  secciones: [
    {
      id: 'entrar',
      titulo: 'Entrar a la app',
      intro: 'No hay contraseña que recordar. Se entra con un enlace que te llega por correo.',
      acciones: [
        { que: 'Pedir el enlace', como: 'Escribí tu correo y tocá «Enviarme el enlace». Te llega un mensaje: abrilo desde el mismo teléfono.' },
        { que: 'Instalar la app en el teléfono', como: 'Desde el menú del navegador, «Agregar a la pantalla de inicio». Queda como cualquier otra app y no hay que volver a entrar.' },
      ],
      aviso: 'El enlace sirve una sola vez y por poco tiempo. Si se venció, pedí otro: no pasa nada.',
    },
    {
      id: 'mis-clases',
      titulo: 'Mis clases',
      intro: 'Es la pantalla con la que abre la app.',
      acciones: [
        { que: 'Ver tus próximas clases', como: 'Con el día, la hora, el instructor y el vehículo.' },
        { que: 'Ver las que ya pasaron', como: 'Más abajo, en el historial.' },
        { que: 'Cancelar una clase', como: 'Tocá «Cancelar clase» en la tarjeta de esa clase.' },
      ],
      aviso: 'Se puede cancelar hasta 24 horas antes. Si falta menos, hay que avisarle a la academia.',
    },
    {
      id: 'reservar',
      titulo: 'Reservar una clase',
      acciones: [
        { que: 'Elegir auto o moto' },
        { que: 'Elegir el día', como: 'El calendario muestra solo los días con lugar.' },
        { que: 'Elegir el horario', como: 'Aparecen únicamente los horarios libres.' },
        { que: 'Confirmar', como: 'Tocá «Confirmar reserva». La clase te aparece enseguida en «Mis clases».' },
      ],
      aviso: 'Si no aparece ningún horario, es que no hay lugar ese día. Probá con otro.',
    },
    {
      id: 'pagar',
      titulo: 'Pagar',
      intro: 'Por ahora solo por transferencia bancaria.',
      acciones: [
        { que: 'Pedir los datos de la cuenta', como: 'Por WhatsApp, con el número que figura en la pantalla.' },
        { que: 'Elegir qué pagaste', como: 'De la lista de precios. El importe lo pone la academia; vos no lo escribís.' },
        { que: 'Subir el comprobante', como: 'El PDF o la captura que te da el banco. Hasta 5 MB. Si la foto pesa de más, la app la reduce sola.' },
        { que: 'Ver en qué quedó', como: 'Abajo, en «Tus pagos»: «En revisión», «Aprobado» o «Rechazado» con el motivo.' },
        { que: 'Completar un pago que quedó a medias', como: 'Si dice «Falta el comprobante», tocá «Subir el comprobante» en esa tarjeta. No hace falta empezar de cero.' },
      ],
      aviso: 'Las clases se te acreditan cuando la academia aprueba el pago, no cuando subís el comprobante.',
    },
    {
      id: 'perfil',
      titulo: 'Mi perfil',
      acciones: [
        { que: 'Completar tus datos', como: 'Nombre, apellido, teléfono, documento, fecha de nacimiento y dirección.' },
        { que: 'Elegir cédula o pasaporte', como: 'Si es pasaporte, indicá el país que lo emitió.' },
        { que: 'Prender o apagar los avisos en el teléfono', como: 'Te llega uno el día antes de cada clase y otro dos horas antes.' },
        { que: 'Dejar de recibir correos', como: 'Desde el enlace que trae cada correo, o desde acá.' },
        { que: 'Cerrar sesión' },
      ],
      aviso: 'El documento hace falta para el trámite de la libreta. Conviene cargarlo desde el principio.',
    },
    {
      id: 'problemas',
      titulo: 'Si algo no anda',
      acciones: [
        { que: 'No me llega el enlace para entrar', como: 'Mirá en correo no deseado. Si no está, pedilo de nuevo o escribile a la academia.' },
        { que: 'No puedo cancelar', como: 'Faltan menos de 24 horas. Avisale a la academia por WhatsApp.' },
        { que: 'No me deja subir el comprobante', como: 'Tiene que ser PDF, JPG o PNG. Si es una foto de iPhone y no la toma, mandá una captura de pantalla.' },
        { que: 'No me llegan los avisos', como: 'En el iPhone hay que tener la app agregada a la pantalla de inicio; en el navegador no funcionan.' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Instructor
// ---------------------------------------------------------------------------

const INSTRUCTOR: Manual = {
  rol: 'INSTRUCTOR',
  titulo: 'Manual del instructor',
  bajada: 'Tu agenda y lo que podés hacer con cada clase.',
  secciones: [
    {
      id: 'entrar',
      titulo: 'Entrar a la app',
      acciones: [
        { que: 'Pedir el enlace', como: 'Escribí tu correo y tocá «Enviarme el enlace». Se abre desde el mismo teléfono.' },
        { que: 'Instalar la app', como: 'Desde el menú del navegador, «Agregar a la pantalla de inicio». Así no hay que volver a entrar.' },
      ],
      aviso: 'Ves solamente TUS clases. Las de los demás instructores no aparecen.',
    },
    {
      id: 'agenda',
      titulo: 'Ver tu agenda',
      acciones: [
        { que: 'Cambiar de vista', como: 'Día, semana o mes, con los botones de arriba.' },
        { que: 'Moverte entre períodos', como: 'Con las flechas. El día de hoy queda marcado.' },
        { que: 'Ver el detalle de una clase', como: 'Alumno, hora, vehículo, punto de encuentro y las indicaciones de la academia.' },
      ],
    },
    {
      id: 'cerrar',
      titulo: 'Cerrar una clase',
      intro: 'Cuando la clase terminó, decí qué pasó.',
      acciones: [
        { que: 'Marcarla como dictada', como: 'Botón «Dictada», y confirmás con «Sí, se dio».' },
        { que: 'Marcar que el alumno no vino', como: 'Botón «Faltó», y confirmás con «Sí, faltó».' },
      ],
      aviso: 'Estos dos botones aparecen recién cuando la clase ya empezó. Antes no se puede cerrar algo que todavía no pasó.',
    },
    {
      id: 'cancelar',
      titulo: 'Cancelar una clase',
      acciones: [
        { que: 'Cancelar con motivo', como: 'Tocá «Cancelar la clase», escribí por qué —por ejemplo «el auto quedó en el taller»— y confirmá.' },
      ],
      aviso: 'El motivo es obligatorio: lo ve la academia y sirve para saber qué pasó sin tener que preguntar.',
    },
    {
      id: 'nota',
      titulo: 'Anotar cómo fue la clase',
      acciones: [
        { que: 'Escribir una observación', como: 'Con «Anotar cómo fue». Sirve para la próxima clase y para la academia.' },
        { que: 'Editarla o borrarla', como: 'Con «Editar la observación».' },
      ],
      aviso: 'El alumno NO ve esta nota. Es para la academia y para vos.',
    },
    {
      id: 'contacto',
      titulo: 'Contactar al alumno',
      acciones: [
        { que: 'Llamarlo', como: 'Botón «Llamar», si tiene teléfono cargado.' },
        { que: 'Escribirle por WhatsApp', como: 'Botón «WhatsApp».' },
      ],
      aviso: 'Si el alumno no tiene teléfono cargado, los botones no aparecen.',
    },
    {
      id: 'avisos',
      titulo: 'Avisos en el teléfono',
      acciones: [
        { que: 'Prenderlos o apagarlos', como: 'Desde tu perfil.' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Administracion
// ---------------------------------------------------------------------------

const ADMIN: Manual = {
  rol: 'ADMIN',
  titulo: 'Manual de administración',
  bajada:
    'Las acciones de cada sección del panel y los flujos completos del sistema, incluidos los de alumno e instructor.',
  secciones: [
    {
      id: 'quien-puede',
      titulo: 'Quién puede hacer qué',
      intro:
        'Hay tres roles y cada uno tiene su propia aplicación. No es una cuestión de pantallas: la API rechaza lo que no corresponde aunque alguien llegue por otro camino.',
      acciones: [
        { que: 'Administración — el panel', como: 'Ve y toca todo: agenda, alumnos, instructores, vehículos, precios, pagos, egresados, sitio, cuentas y avisos.' },
        { que: 'Instructor — su propia app', como: 'Solo SU agenda. Cierra, cancela y anota sus clases. No entra al panel ni ve alumnos que no tenga asignados.' },
        { que: 'Alumno — su propia app', como: 'Solo lo suyo: sus clases, sus reservas, sus pagos y su ficha.' },
      ],
      aviso:
        'Un instructor no puede agendar clases ni ver la ficha de un alumno. Un alumno no puede reservar a nombre de otro: si lo intenta, el sistema usa su propia ficha e ignora lo que mande.',
    },
    {
      id: 'resumen',
      titulo: 'Resumen (la pantalla de inicio)',
      intro: 'Con lo que abre el panel: cuánta plata entró, qué quedó sin revisar y cuántas clases se dieron.',
      acciones: [
        { que: 'Cambiar el período', como: 'Hoy, Semana (de lunes a hoy), Mes (del 1 a hoy) u «Otro período» con dos fechas.' },
        { que: 'Ver lo cobrado', como: 'Total del período, y desglosado por forma de pago y por servicio.' },
        { que: 'Ver qué falta revisar', como: 'La tarjeta «Para revisar» lleva directo a Pagos.' },
        { que: 'Ver las clases', como: 'Dictadas, agendadas por delante, canceladas y ausentes; y cuántas dio cada instructor.' },
      ],
      aviso:
        'Dos criterios que hay que tener claros para que los números cierren: un pago cuenta en el día en que SE HIZO, no en el que se aprobó; y los pagos para revisar se muestran TODOS, sin importar el período, porque son trabajo pendiente y no historia.',
    },
    {
      id: 'agenda',
      titulo: 'Agenda',
      acciones: [
        { que: 'Ver el calendario', como: 'Por día, semana o mes, con un color por instructor.' },
        { que: 'Agendar una clase', como: 'Elegís alumno, tipo de vehículo, día y horario. Solo aparecen los horarios realmente libres.' },
        { que: 'Confirmar una clase', como: 'Las que reserva el alumno quedan pendientes hasta que alguien las confirma.' },
        { que: 'Reprogramar', como: 'Mover una clase a otro día u horario. Solo puede hacerlo administración.' },
        { que: 'Cancelar', como: 'Con el motivo, que queda registrado.' },
        { que: 'Cerrar una clase', como: 'Marcarla como dictada o como ausente, igual que el instructor.' },
      ],
      aviso:
        'El sistema no deja que un instructor o un vehículo queden en dos clases a la misma hora. Eso no lo controla la pantalla: lo impide la base de datos, así que no hay forma de saltearlo.',
    },
    {
      id: 'flujo-clase',
      titulo: 'Flujo: el ciclo de una clase',
      flujo: [
        { quien: 'El alumno o la academia', hace: 'Agenda la clase eligiendo tipo, día y horario entre los que están libres.' },
        { quien: 'El sistema', hace: 'Si la agendó el alumno, la deja PENDIENTE. Si la agendó la academia, queda confirmada.' },
        { quien: 'El sistema', hace: 'Avisa por Telegram que hay una clase nueva.' },
        { quien: 'La academia', hace: 'Confirma la clase pendiente.' },
        { quien: 'El sistema', hace: 'Le recuerda al alumno el día antes y dos horas antes, por el teléfono y por correo.' },
        { quien: 'El instructor', hace: 'Al terminar, la marca como dictada o como ausente, y anota cómo fue si quiere.' },
        { quien: 'El sistema', hace: 'Descuenta la clase del pack del alumno y avisa por Telegram que se cerró.' },
      ],
      aviso: 'Cualquiera de los tres puede cancelar, siempre con motivo, y el aviso sale igual.',
    },
    {
      id: 'alumnos',
      titulo: 'Alumnos',
      acciones: [
        { que: 'Buscar', como: 'Por nombre, apellido, cédula o pasaporte. Busca mientras escribís.' },
        { que: 'Dar de alta', como: 'Con los datos que tengas. El alumno completa el resto desde su app.' },
        { que: 'Ver la ficha', como: 'Datos, historial de clases, packs comprados y clases que le quedan.' },
        { que: 'Escribir notas internas', como: 'El alumno NO las ve.' },
        { que: 'Dar de baja', como: 'Deja de aparecer en los listados sin borrar su historial.' },
      ],
    },
    {
      id: 'instructores',
      titulo: 'Instructores',
      acciones: [
        { que: 'Dar de alta', como: 'Nombre, si da moto o auto, y el color con el que se lo ve en el calendario.' },
        { que: 'Cargar los horarios de la semana', como: 'La plantilla semanal. Sin esto el sistema no puede ofrecer ningún turno.' },
        { que: 'Cargar licencias y bloqueos', como: 'Días o franjas en los que no está disponible.' },
        { que: 'Agregar disponibilidad extra', como: 'Para un día puntual fuera de su horario habitual.' },
      ],
      aviso: 'Si un instructor no tiene plantilla cargada, no aparece ningún horario libre para él. Es la causa número uno de «no me deja reservar».',
    },
    {
      id: 'vehiculos',
      titulo: 'Vehículos',
      acciones: [
        { que: 'Dar de alta', como: 'Patente, tipo, y cilindrada si es moto.' },
        { que: 'Cargar el vencimiento del SOA' },
        { que: 'Subir una foto' },
        { que: 'Marcar fuera de servicio', como: 'Deja de ofrecerse para nuevas clases.' },
      ],
    },
    {
      id: 'precios',
      titulo: 'Precios',
      acciones: [
        { que: 'Crear o editar un servicio', como: 'Clase suelta, packs, gestoría.' },
        { que: 'Poner los dos precios', como: 'Contado o transferencia, y tarjeta.' },
        { que: 'Decidir si se publica en el sitio' },
      ],
      aviso: 'Mientras un precio esté en cero, el sitio público muestra «Consultanos el precio» en vez de un importe falso.',
    },
    {
      id: 'pagos',
      titulo: 'Pagos',
      acciones: [
        { que: 'Buscar', como: 'Por nombre, cédula o pasaporte, mientras escribís.' },
        { que: 'Filtrar', como: 'Entra en «Para revisar», que es a lo que se entra.' },
        { que: 'Ver el comprobante', como: 'Se abre en otra pestaña. La dirección dura cinco minutos y se pide de nuevo cada vez.' },
        { que: 'Corregir el importe', como: 'Si el banco dice otra cosa, se escribe el real antes de aprobar.' },
        { que: 'Aprobar', como: 'Acredita las clases al alumno en el mismo momento.' },
        { que: 'Rechazar', como: 'Con un motivo obligatorio, que el alumno ve en su app.' },
        { que: 'Registrar un cobro en efectivo', como: 'Buscás al alumno, elegís qué pagó y, si hace falta, corregís el importe.' },
      ],
      aviso:
        'Cada vez que alguien abre un comprobante queda registrado quién lo miró y cuándo. Es un documento bancario de otra persona y la Ley 18.331 obliga a poder responder quién vio qué.',
    },
    {
      id: 'flujo-pago',
      titulo: 'Flujo: el ciclo de un pago por transferencia',
      flujo: [
        { quien: 'El alumno', hace: 'Pide los datos de la cuenta por WhatsApp y hace la transferencia desde su banco.' },
        { quien: 'El alumno', hace: 'En la app elige qué pagó. El sistema crea el pago con el precio del catálogo.' },
        { quien: 'El sistema', hace: 'Deja el pago en «Falta el comprobante» hasta que suba el archivo.' },
        { quien: 'El alumno', hace: 'Sube el comprobante. El archivo va directo al depósito privado, sin pasar por el servidor.' },
        { quien: 'El sistema', hace: 'Pasa el pago a «Para revisar» y avisa por Telegram que llegó uno.' },
        { quien: 'La academia', hace: 'Abre el comprobante, corrige el importe si hace falta, y aprueba o rechaza.' },
        { quien: 'El sistema', hace: 'Si se aprueba, crea la compra y acredita las clases en la misma operación: o pasan las dos cosas o no pasa ninguna.' },
        { quien: 'El sistema', hace: 'Le avisa al alumno al teléfono. Si se aprobó, le dice cuántas clases le quedaron.' },
      ],
      aviso:
        'Un cobro en efectivo salta todo esto: nace aprobado y acredita las clases en el acto, porque lo registra la academia con la plata en la mano.',
    },
    {
      id: 'egresados',
      titulo: 'Egresados',
      acciones: [
        { que: 'Registrar un egresado', como: 'Buscás al alumno por nombre, cédula o pasaporte, elegís la categoría y la fecha.' },
        { que: 'Marcar la autorización de imagen', como: 'Solo con la autorización firmada la foto puede publicarse.' },
        { que: 'Subir la foto', como: 'Sacada sosteniendo el diploma, nunca la libreta: la libreta muestra el documento y la fecha de nacimiento.' },
        { que: 'Imprimir el diploma', como: 'Con su código de verificación.' },
        { que: 'Quitar de la galería', como: 'Deja de publicarse sin borrar el registro.' },
      ],
      aviso:
        'Sin autorización firmada el diploma se emite igual, pero el egresado NO puede aparecer en la galería del sitio. Eso no depende de acordarse: el sistema lo impide.',
    },
    {
      id: 'sitio',
      titulo: 'Sitio web',
      acciones: [
        { que: 'Cargar los datos de contacto', como: 'WhatsApp, teléfono, dirección, correo, horarios y redes.' },
        { que: 'Marcar la ubicación en el mapa' },
        { que: 'Editar los textos de cada sección', como: 'Títulos, bajadas y preguntas frecuentes, sin tocar código.' },
        { que: 'Ordenar o esconder secciones' },
      ],
      aviso:
        'El número de WhatsApp es el dato más importante del sitio: sin él no hay botón flotante, ni formulario de contacto, ni forma de convertir una visita en una consulta.',
    },
    {
      id: 'cuentas',
      titulo: 'Cuentas e invitaciones',
      acciones: [
        { que: 'Invitar a alguien', como: 'Por correo, eligiendo con qué rol entra.' },
        { que: 'Ver las invitaciones sin usar', como: 'Y reenviarlas o revocarlas.' },
        { que: 'Cambiarle el rol a una cuenta' },
        { que: 'Dar de baja una cuenta', como: 'Deja de poder entrar en el momento, aunque tenga la sesión abierta.' },
      ],
      aviso: 'Nadie puede cambiarse el rol a sí mismo, ni siquiera mandándolo a mano: el sistema ignora el rol que venga del navegador.',
    },
    {
      id: 'flujo-cuenta',
      titulo: 'Flujo: cómo entra alguien nuevo al sistema',
      flujo: [
        { quien: 'La academia', hace: 'Invita por correo eligiendo el rol: administración, instructor o alumno.' },
        { quien: 'El sistema', hace: 'Manda el correo con un enlace de un solo uso.' },
        { quien: 'La persona', hace: 'Abre el enlace desde el teléfono o la computadora donde va a usar el sistema.' },
        { quien: 'El sistema', hace: 'Crea la cuenta con el rol de la invitación y la lleva a la app que le corresponde.' },
        { quien: 'La persona', hace: 'Agrega la app a la pantalla de inicio. No tiene que volver a entrar.' },
      ],
      aviso:
        'Un alumno también puede registrarse solo desde el sitio. En ese caso entra con rol de alumno y su ficha se vincula por el correo.',
    },
    {
      id: 'avisos',
      titulo: 'Avisos',
      intro: 'Los mensajes que le llegan a la academia por Telegram.',
      acciones: [
        { que: 'Elegir a quién le llegan', como: 'Una conversación privada o un grupo.' },
        { que: 'Prender y apagar cada aviso por separado', como: 'Clase agendada, cerrada, cancelada, recordatorio, comprobante de pago y clic de WhatsApp.' },
        { que: 'Mandar un mensaje de prueba' },
        { que: 'Ver si está andando', como: 'Cuándo salió bien el último y cuál fue el último error.' },
      ],
      aviso:
        'El aviso del clic de WhatsApp es el que más puede sonar, porque depende de cuánta gente visite el sitio. Si molesta, se apaga solo ese.',
    },
    {
      id: 'flujo-avisos',
      titulo: 'Flujo: quién recibe qué aviso',
      flujo: [
        { quien: 'La academia', hace: 'Recibe por Telegram: clase agendada, cerrada o cancelada, comprobante de pago nuevo, y alguien que va a escribir por WhatsApp.' },
        { quien: 'El alumno', hace: 'Recibe en el teléfono: el recordatorio el día antes y dos horas antes, y la decisión sobre su pago.' },
        { quien: 'El alumno', hace: 'Recibe por correo: el mismo recordatorio, si no se dio de baja.' },
        { quien: 'El instructor', hace: 'Recibe en el teléfono los recordatorios de sus clases, si los prendió.' },
      ],
      aviso:
        'El motivo de un pago rechazado NO viaja en la notificación: puede nombrar el banco del alumno y una notificación se lee en la pantalla bloqueada. El motivo entero está en la app.',
    },
    {
      id: 'problemas',
      titulo: 'Cuando alguien llama porque algo no le anda',
      acciones: [
        { que: '«No me deja reservar, no aparece ningún horario»', como: 'Casi siempre es que el instructor no tiene la plantilla semanal cargada, o que está todo ocupado ese día.' },
        { que: '«No me llega el correo para entrar»', como: 'Que mire en no deseado. Desde Cuentas se le puede reenviar la invitación.' },
        { que: '«Subí el comprobante y no pasó nada»', como: 'Fijate en Pagos con el filtro «Sin comprobante»: si quedó ahí, el alumno puede completarlo desde su app con el botón «Subir el comprobante».' },
        { que: '«No me llegan los avisos al teléfono»', como: 'En iPhone tiene que tener la app agregada a la pantalla de inicio. Y las claves de avisos tienen que estar cargadas en el servidor.' },
        { que: '«Cancelé y me sigue apareciendo»', como: 'Las canceladas no desaparecen: quedan en el historial con su motivo.' },
      ],
    },
  ],
};

/** Los tres manuales, por rol. */
export const MANUALES: Record<RolDelManual, Manual> = {
  CLIENTE: ALUMNO,
  INSTRUCTOR,
  ADMIN,
};

/** El orden en que se ofrecen en el panel: el propio primero. */
export const ORDEN_DE_MANUALES: RolDelManual[] = ['ADMIN', 'INSTRUCTOR', 'CLIENTE'];
