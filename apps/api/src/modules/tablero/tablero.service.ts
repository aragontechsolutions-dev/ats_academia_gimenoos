import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoPago, EstadoReserva, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { ConsultarTableroDto } from './dto/tablero.dto';

/** La academia está en San Carlos: todo día de calendario es un día de acá. */
const ZONA = 'America/Montevideo';

/**
 * El período más largo que se acepta de una sola vez.
 *
 * Un año y pico alcanza para «todo el año pasado» y corta de raíz un
 * `desde=1900-01-01` que haga recorrer la tabla entera en cada carga.
 */
const DIAS_MAXIMOS = 400;

/** Los estados de pago que representan plata efectivamente entrada. */
const COBRADO: EstadoPago[] = [EstadoPago.APROBADO];

/** Los estados desde los que un pago todavía espera una decisión. */
const EN_ESPERA: EstadoPago[] = [EstadoPago.PENDIENTE, EstadoPago.PENDIENTE_VERIFICACION];

/** Una fila de la serie diaria, tal como sale de la base. */
interface FilaDiaria {
  dia: Date;
  monto: string | null;
  cantidad: number;
}

/**
 * El tablero del panel: lo que pasó en la academia en un período.
 *
 * **Criterio de fechas, que conviene tener claro para leer los números:** un
 * pago cuenta en el día en que se *hizo* (cuando el alumno lo cargó o cuando se
 * cobró en el mostrador), no en el día en que la administración lo aprobó. Es
 * la fecha en la que la plata se movió de verdad; si se contara por la
 * aprobación, una transferencia del viernes revisada el lunes aparecería como
 * ingreso del lunes y el corte semanal no cerraría contra el banco.
 *
 * Las clases, en cambio, cuentan por su hora de inicio: una clase es del día en
 * que se dio.
 *
 * Los pendientes de revisión NO se filtran por período: son una cola de
 * trabajo, no un hecho del pasado. Un comprobante de hace tres semanas sin
 * revisar tiene que seguir molestando aunque se mire «hoy».
 */
@Injectable()
export class TableroService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Traduce el período pedido a dos instantes.
   *
   * Sin parámetros, el período es el mes en curso: es lo que uno quiere ver al
   * entrar, y evita que la primera carga tenga que adivinar nada.
   */
  private periodo(consulta: ConsultarTableroDto): { desde: DateTime; hasta: DateTime } {
    const hoy = DateTime.now().setZone(ZONA).startOf('day');

    const desde = consulta.desde
      ? DateTime.fromISO(consulta.desde, { zone: ZONA }).startOf('day')
      : hoy.startOf('month');
    // `hasta` es inclusivo para quien pregunta y exclusivo para la base: se
    // guarda el comienzo del día siguiente y se compara con «menor que».
    const hasta = consulta.hasta
      ? DateTime.fromISO(consulta.hasta, { zone: ZONA }).startOf('day').plus({ days: 1 })
      : hoy.plus({ days: 1 });

    if (!desde.isValid || !hasta.isValid) {
      throw new BadRequestException('Ese período no es una fecha válida');
    }
    if (hasta <= desde) {
      throw new BadRequestException('La fecha final tiene que ser igual o posterior a la inicial');
    }
    if (hasta.diff(desde, 'days').days > DIAS_MAXIMOS) {
      throw new BadRequestException(`El período no puede pasar de ${DIAS_MAXIMOS} días`);
    }

    return { desde, hasta };
  }

  async resumen(consulta: ConsultarTableroDto) {
    const { desde, hasta } = this.periodo(consulta);
    const inicio = desde.toJSDate();
    const fin = hasta.toJSDate();

    const enElPeriodo = { createdAt: { gte: inicio, lt: fin } };

    const [
      cobrosPorCanal,
      rechazados,
      pendientes,
      pendienteMasViejo,
      clasesPorEstado,
      alumnosNuevos,
      porServicio,
      porInstructor,
      serieDePagos,
      serieDeClases,
      clasesSinUsar,
    ] = await Promise.all([
      // Plata entrada, abierta por forma de pago: es exactamente lo que se pidió
      // ver por separado (transferencia y efectivo).
      this.prisma.pago.groupBy({
        by: ['canal'],
        where: { estado: { in: COBRADO }, ...enElPeriodo },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.pago.count({ where: { estado: EstadoPago.RECHAZADO, ...enElPeriodo } }),
      // Sin filtro de fechas: es la cola de trabajo, no un dato histórico.
      this.prisma.pago.groupBy({
        by: ['canal'],
        where: { estado: { in: EN_ESPERA } },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.pago.findFirst({
        where: { estado: { in: EN_ESPERA } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.reserva.groupBy({
        by: ['estado'],
        where: { inicio: { gte: inicio, lt: fin } },
        _count: { _all: true },
      }),
      this.prisma.cliente.count({ where: enElPeriodo }),
      this.prisma.pago.groupBy({
        by: ['servicioId'],
        where: { estado: { in: COBRADO }, servicioId: { not: null }, ...enElPeriodo },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.reserva.groupBy({
        by: ['instructorId'],
        where: { estado: EstadoReserva.COMPLETADA, inicio: { gte: inicio, lt: fin } },
        _count: { _all: true },
      }),
      this.serieDePagos(inicio, fin),
      this.serieDeClases(inicio, fin),
      // Clases compradas que todavía no se dieron: es plata ya cobrada que la
      // academia debe en horas de auto. No depende del período.
      this.prisma.$queryRaw<{ pendientes: bigint }[]>`
        SELECT COALESCE(SUM(clases_totales - clases_usadas), 0)::bigint AS pendientes
        FROM compras_servicio
        WHERE clases_usadas < clases_totales
      `,
    ]);

    const [nombresDeServicios, nombresDeInstructores] = await Promise.all([
      this.nombresDeServicios(porServicio.map((fila) => fila.servicioId!)),
      this.nombresDeInstructores(porInstructor.map((fila) => fila.instructorId)),
    ]);

    const claseDe = (estado: EstadoReserva) =>
      clasesPorEstado.find((fila) => fila.estado === estado)?._count._all ?? 0;

    return {
      periodo: { desde: desde.toISODate(), hasta: hasta.minus({ days: 1 }).toISODate() },

      cobrado: {
        total: this.sumar(cobrosPorCanal.map((fila) => fila._sum.monto)),
        cantidad: cobrosPorCanal.reduce((suma, fila) => suma + fila._count._all, 0),
        porCanal: cobrosPorCanal.map((fila) => ({
          canal: fila.canal,
          monto: this.texto(fila._sum.monto),
          cantidad: fila._count._all,
        })),
      },

      pendientes: {
        cantidad: pendientes.reduce((suma, fila) => suma + fila._count._all, 0),
        monto: this.sumar(pendientes.map((fila) => fila._sum.monto)),
        desdeCuando: pendienteMasViejo?.createdAt ?? null,
      },

      rechazados,

      clases: {
        dictadas: claseDe(EstadoReserva.COMPLETADA),
        agendadas: claseDe(EstadoReserva.PENDIENTE) + claseDe(EstadoReserva.CONFIRMADA),
        canceladas: claseDe(EstadoReserva.CANCELADA),
        ausentes: claseDe(EstadoReserva.AUSENTE),
        sinUsar: Number(clasesSinUsar[0]?.pendientes ?? 0),
      },

      alumnosNuevos,

      porServicio: porServicio
        .map((fila) => ({
          servicio: nombresDeServicios.get(fila.servicioId!) ?? 'Sin servicio',
          monto: this.texto(fila._sum.monto),
          cantidad: fila._count._all,
        }))
        .sort((a, b) => Number(b.monto) - Number(a.monto)),

      porInstructor: porInstructor
        .map((fila) => ({
          instructor: nombresDeInstructores.get(fila.instructorId) ?? 'Sin instructor',
          clases: fila._count._all,
        }))
        .sort((a, b) => b.clases - a.clases),

      dias: this.unirSeries(desde, hasta, serieDePagos, serieDeClases),
    };
  }

  /**
   * Lo cobrado por día, agrupado en la zona de la academia.
   *
   * Va en SQL crudo porque Prisma no sabe agrupar por «día de Montevideo»:
   * agruparía por el día UTC, y las tres primeras horas de cada noche caerían
   * en el día siguiente. `AT TIME ZONE` lo resuelve en la base, que es donde
   * están los datos.
   */
  private serieDePagos(inicio: Date, fin: Date) {
    return this.prisma.$queryRaw<FilaDiaria[]>`
      SELECT (created_at AT TIME ZONE ${ZONA})::date AS dia,
             SUM(monto)::text                        AS monto,
             COUNT(*)::int                           AS cantidad
      FROM pagos
      WHERE estado = ${EstadoPago.APROBADO}::"EstadoPago"
        AND created_at >= ${inicio} AND created_at < ${fin}
      GROUP BY 1
      ORDER BY 1
    `;
  }

  /** Las clases dictadas por día, con el mismo criterio de zona horaria. */
  private serieDeClases(inicio: Date, fin: Date) {
    return this.prisma.$queryRaw<FilaDiaria[]>`
      SELECT (inicio AT TIME ZONE ${ZONA})::date AS dia,
             NULL::text                          AS monto,
             COUNT(*)::int                       AS cantidad
      FROM reservas
      WHERE estado = ${EstadoReserva.COMPLETADA}::"EstadoReserva"
        AND inicio >= ${inicio} AND inicio < ${fin}
      GROUP BY 1
      ORDER BY 1
    `;
  }

  /**
   * Arma un día por cada día del período, incluidos los vacíos.
   *
   * Sin esto, un gráfico con dos días cargados y cinco sin nada dibujaría dos
   * barras pegadas y mentiría sobre el ritmo de la semana.
   */
  private unirSeries(
    desde: DateTime,
    hasta: DateTime,
    pagos: FilaDiaria[],
    clases: FilaDiaria[],
  ) {
    const clave = (fila: FilaDiaria) => DateTime.fromJSDate(fila.dia, { zone: 'utc' }).toISODate()!;
    const cobradoPorDia = new Map(pagos.map((fila) => [clave(fila), fila]));
    const clasesPorDia = new Map(clases.map((fila) => [clave(fila), fila.cantidad]));

    const dias: { dia: string; cobrado: string; pagos: number; clases: number }[] = [];
    for (let cursor = desde; cursor < hasta; cursor = cursor.plus({ days: 1 })) {
      const dia = cursor.toISODate()!;
      const pago = cobradoPorDia.get(dia);
      dias.push({
        dia,
        cobrado: pago?.monto ?? '0',
        pagos: pago?.cantidad ?? 0,
        clases: clasesPorDia.get(dia) ?? 0,
      });
    }
    return dias;
  }

  private async nombresDeServicios(ids: string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const servicios = await this.prisma.servicio.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true },
    });
    return new Map(servicios.map((servicio) => [servicio.id, servicio.nombre]));
  }

  private async nombresDeInstructores(ids: string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const instructores = await this.prisma.instructor.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, apellido: true },
    });
    return new Map(instructores.map((i) => [i.id, `${i.nombre} ${i.apellido}`]));
  }

  /**
   * Los montos viajan como texto, no como número.
   *
   * `Decimal` en JSON sería un `number` de coma flotante, y ahí un total de
   * 1.234.567,89 deja de ser exacto. El panel solo los muestra, así que el
   * texto le alcanza y no pierde un peso por el camino.
   */
  private texto(monto: Prisma.Decimal | null): string {
    return (monto ?? new Prisma.Decimal(0)).toFixed(2);
  }

  private sumar(montos: (Prisma.Decimal | null)[]): string {
    return montos
      .reduce<Prisma.Decimal>((total, monto) => total.plus(monto ?? 0), new Prisma.Decimal(0))
      .toFixed(2);
  }
}
