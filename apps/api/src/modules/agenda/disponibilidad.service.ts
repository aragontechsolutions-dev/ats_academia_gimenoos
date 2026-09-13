import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoVehiculo, TipoExcepcion, TipoVehiculo } from '@prisma/client';
import { DateTime, Interval } from 'luxon';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Zona en la que la academia razona sus horarios. En la base todo es UTC. */
const ZONA = 'America/Montevideo';

/** Estados de reserva que ocupan agenda. Debe coincidir con las EXCLUDE constraints. */
const ESTADOS_QUE_OCUPAN = ['PENDIENTE', 'CONFIRMADA'] as const;

export interface ParametrosDisponibilidad {
  tipo: TipoVehiculo;
  desde: Date;
  hasta: Date;
  duracionMin: number;
  /** Limita la búsqueda a un instructor concreto. */
  instructorId?: string;
}

export interface HuecoDisponible {
  inicio: Date;
  fin: Date;
  instructorId: string;
  instructorNombre: string;
  vehiculoId: string;
  vehiculoPatente: string;
}

/** Intervalo que una reserva ya ocupa, con su horario real. */
interface Ocupacion {
  instructorId: string;
  vehiculoId: string | null;
  intervalo: Interval;
}

/**
 * Calcula los horarios en los que realmente se puede dar una clase.
 *
 * Una clase necesita DOS recursos libres a la vez: el instructor y el vehículo.
 * Ofrecer un horario mirando solo la agenda del instructor lleva a prometer
 * clases que no se pueden dar porque el auto está ocupado.
 *
 * La fórmula es:
 *
 *     plantilla del instructor
 *       + excepciones de disponibilidad extra
 *       − bloqueos (licencias, feriados)
 *       − reservas que ocupan agenda, expandidas con el buffer
 *       ∩ vehículos del tipo pedido que estén libres en ese mismo rango
 *
 * Este servicio NO reserva nada: solo informa. La garantía de que dos personas
 * no tomen el mismo horario vive en las EXCLUDE constraints de Postgres, porque
 * entre consultar y reservar siempre hay una ventana.
 */
@Injectable()
export class DisponibilidadService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(
    parametros: ParametrosDisponibilidad,
    ahora: Date = new Date(),
  ): Promise<HuecoDisponible[]> {
    const { tipo, duracionMin, instructorId } = parametros;

    if (duracionMin <= 0) {
      throw new BadRequestException('La duración de la clase debe ser mayor a cero');
    }
    if (parametros.hasta <= parametros.desde) {
      throw new BadRequestException('El fin del rango debe ser posterior al inicio');
    }

    const config = await this.obtenerConfiguracion();
    const ventana = this.acotarVentana(parametros, config, ahora);
    if (!ventana) return [];

    const [instructores, vehiculos] = await Promise.all([
      this.prisma.instructor.findMany({
        where: {
          activo: true,
          ...(instructorId ? { id: instructorId } : {}),
          ...(tipo === TipoVehiculo.MOTO ? { habilitaMoto: true } : { habilitaAuto: true }),
        },
        select: { id: true, nombre: true, apellido: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.vehiculo.findMany({
        where: { tipo, estado: EstadoVehiculo.ACTIVO },
        select: { id: true, patente: true },
        orderBy: { patente: 'asc' },
      }),
    ]);

    // Sin instructor habilitado o sin vehículo del tipo no hay nada que ofrecer.
    if (instructores.length === 0 || vehiculos.length === 0) return [];

    const idsInstructores = instructores.map((i) => i.id);
    const ocupaciones = await this.cargarOcupaciones(ventana, config.bufferMinutos);
    const franjas = await this.cargarFranjas(idsInstructores, ventana);

    const huecos: HuecoDisponible[] = [];
    // Paso entre inicios de clase: cada clase más su buffer. Produce una agenda
    // regular y predecible, en vez de una lista de horarios casi idénticos.
    const paso = duracionMin + config.bufferMinutos;

    for (const instructor of instructores) {
      const franjasDelInstructor = franjas.get(instructor.id) ?? [];

      for (const franja of franjasDelInstructor) {
        let inicio = franja.start;
        if (!inicio) continue;

        while (inicio.plus({ minutes: duracionMin }) <= (franja.end as DateTime)) {
          const fin = inicio.plus({ minutes: duracionMin });
          // La clase candidata se ensancha con el buffer a cada lado: así se
          // exige exactamente ese descanso contra las reservas ya existentes.
          // Los intervalos de Luxon son semiabiertos, por lo que dos clases que
          // se tocan en el extremo no se consideran superpuestas.
          const claseConBuffer = Interval.fromDateTimes(
            inicio.minus({ minutes: config.bufferMinutos }),
            fin.plus({ minutes: config.bufferMinutos }),
          );

          if (
            inicio >= ventana.start! &&
            fin <= ventana.end! &&
            this.recursoLibre(ocupaciones, claseConBuffer, (o) => o.instructorId === instructor.id)
          ) {
            const vehiculo = vehiculos.find((v) =>
              this.recursoLibre(ocupaciones, claseConBuffer, (o) => o.vehiculoId === v.id),
            );

            if (vehiculo) {
              huecos.push({
                inicio: inicio.toJSDate(),
                fin: fin.toJSDate(),
                instructorId: instructor.id,
                instructorNombre: `${instructor.nombre} ${instructor.apellido}`.trim(),
                vehiculoId: vehiculo.id,
                vehiculoPatente: vehiculo.patente,
              });
            }
          }

          inicio = inicio.plus({ minutes: paso });
        }
      }
    }

    return huecos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  }

  private async obtenerConfiguracion() {
    const config = await this.prisma.configuracionAcademia.findUnique({ where: { id: 1 } });
    if (!config) {
      throw new BadRequestException(
        'La configuración de la academia no está inicializada. Ejecutá el seed.',
      );
    }
    return config;
  }

  /**
   * Recorta el rango pedido con las políticas de la academia: no se puede
   * reservar con menos antelación que la mínima, ni más allá de la ventana.
   * Devuelve null si no queda nada por ofrecer.
   */
  private acotarVentana(
    parametros: ParametrosDisponibilidad,
    config: { antelacionMinimaHoras: number; ventanaReservaDias: number },
    ahora: Date,
  ): Interval | null {
    const referencia = DateTime.fromJSDate(ahora);
    const minimo = DateTime.max(
      DateTime.fromJSDate(parametros.desde),
      referencia.plus({ hours: config.antelacionMinimaHoras }),
    );
    const maximo = DateTime.min(
      DateTime.fromJSDate(parametros.hasta),
      referencia.plus({ days: config.ventanaReservaDias }),
    );

    if (maximo <= minimo) return null;
    return Interval.fromDateTimes(minimo, maximo);
  }

  /**
   * Reservas que ocupan agenda en el rango, con su horario tal cual.
   *
   * El buffer NO se aplica acá: se aplica una sola vez, al intervalo de la clase
   * candidata. Expandir los dos lados exigiría el doble de separación que la
   * configurada — con un buffer de 15 minutos, una clase que termina 9:45 y otra
   * que empieza 10:00 quedarían marcadas como incompatibles, cuando cumplen
   * exactamente la política.
   */
  private async cargarOcupaciones(ventana: Interval, bufferMinutos: number): Promise<Ocupacion[]> {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: { in: [...ESTADOS_QUE_OCUPAN] },
        // El rango de la consulta sí se ensancha con el buffer: una clase que
        // termina justo antes de la ventana igual condiciona al primer horario.
        fin: { gt: ventana.start!.minus({ minutes: bufferMinutos }).toJSDate() },
        inicio: { lt: ventana.end!.plus({ minutes: bufferMinutos }).toJSDate() },
      },
      select: { instructorId: true, vehiculoId: true, inicio: true, fin: true },
    });

    return reservas.map((reserva) => ({
      instructorId: reserva.instructorId,
      vehiculoId: reserva.vehiculoId,
      intervalo: Interval.fromDateTimes(
        DateTime.fromJSDate(reserva.inicio),
        DateTime.fromJSDate(reserva.fin),
      ),
    }));
  }

  private recursoLibre(
    ocupaciones: Ocupacion[],
    clase: Interval,
    corresponde: (ocupacion: Ocupacion) => boolean,
  ): boolean {
    return !ocupaciones.some((o) => corresponde(o) && o.intervalo.overlaps(clase));
  }

  /**
   * Franjas en las que cada instructor está disponible, resueltas a instantes.
   *
   * La plantilla guarda minutos desde medianoche en hora local, no un instante:
   * "los martes de 9 a 13" es una regla, no un momento. Convertirla exige
   * posarla sobre cada día concreto en la zona de la academia; hacerlo con
   * aritmética de offsets fijos es la fuente clásica de clases corridas una hora.
   */
  private async cargarFranjas(
    idsInstructores: string[],
    ventana: Interval,
  ): Promise<Map<string, Interval[]>> {
    const primerDia = ventana.start!.setZone(ZONA).startOf('day');
    const ultimoDia = ventana.end!.setZone(ZONA).endOf('day');

    const [plantillas, excepciones] = await Promise.all([
      this.prisma.disponibilidadPlantilla.findMany({
        where: {
          instructorId: { in: idsInstructores },
          OR: [{ vigenteDesde: null }, { vigenteDesde: { lte: ultimoDia.toJSDate() } }],
          AND: [{ OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: primerDia.toJSDate() } }] }],
        },
      }),
      this.prisma.excepcionDisponibilidad.findMany({
        where: {
          instructorId: { in: idsInstructores },
          fin: { gt: primerDia.toJSDate() },
          inicio: { lt: ultimoDia.toJSDate() },
        },
      }),
    ]);

    const resultado = new Map<string, Interval[]>();

    for (const instructorId of idsInstructores) {
      const suyas = plantillas.filter((p) => p.instructorId === instructorId);
      const franjas: Interval[] = [];

      for (let dia = primerDia; dia <= ultimoDia; dia = dia.plus({ days: 1 })) {
        // Luxon numera los días 1 (lunes) a 7 (domingo); la base usa 0 (domingo) a 6.
        const diaSemana = dia.weekday % 7;

        for (const plantilla of suyas) {
          if (plantilla.diaSemana !== diaSemana) continue;
          if (plantilla.vigenteDesde && dia < DateTime.fromJSDate(plantilla.vigenteDesde)) continue;
          if (plantilla.vigenteHasta && dia > DateTime.fromJSDate(plantilla.vigenteHasta).endOf('day')) {
            continue;
          }

          franjas.push(
            Interval.fromDateTimes(
              dia.plus({ minutes: plantilla.minutoInicio }),
              dia.plus({ minutes: plantilla.minutoFin }),
            ),
          );
        }
      }

      const suyasExcepciones = excepciones.filter((e) => e.instructorId === instructorId);

      for (const extra of suyasExcepciones.filter(
        (e) => e.tipo === TipoExcepcion.DISPONIBILIDAD_EXTRA,
      )) {
        franjas.push(
          Interval.fromDateTimes(
            DateTime.fromJSDate(extra.inicio),
            DateTime.fromJSDate(extra.fin),
          ),
        );
      }

      const bloqueos = suyasExcepciones
        .filter((e) => e.tipo === TipoExcepcion.BLOQUEO)
        .map((b) =>
          Interval.fromDateTimes(DateTime.fromJSDate(b.inicio), DateTime.fromJSDate(b.fin)),
        );

      // Un bloqueo puede partir una franja en dos (una licencia a media mañana),
      // por eso difference() devuelve una lista y no un único intervalo.
      const disponibles = franjas
        .flatMap((franja) => franja.difference(...bloqueos))
        .filter((franja) => franja.isValid && franja.length('minutes') > 0);

      resultado.set(instructorId, disponibles);
    }

    return resultado;
  }
}
