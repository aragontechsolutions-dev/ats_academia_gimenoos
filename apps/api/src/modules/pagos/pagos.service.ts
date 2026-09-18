import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CanalPago,
  EstadoPago,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { armarPagina, normalizarPaginacion } from '../../common/paginacion/paginacion';
import type {
  AprobarPagoDto,
  ComprobanteSubidoDto,
  CrearPagoEnEfectivoDto,
  CrearPagoPropioDto,
  ListarPagosDto,
  RechazarPagoDto,
} from './dto/pago.dto';

/** Lo que ve el alumno de sus propios pagos. */
const CAMPOS_DEL_ALUMNO = {
  id: true,
  monto: true,
  canal: true,
  estado: true,
  motivoRechazo: true,
  createdAt: true,
  servicio: { select: { id: true, nombre: true, cantidadClases: true } },
} satisfies Prisma.PagoSelect;

/**
 * Lo que ve la administración.
 *
 * Suma el alumno —con su documento, porque el buscador es por cédula—, el
 * comprobante y el rastro de la revisión. La `nota` es interna y por eso NO está
 * en los campos del alumno.
 */
const CAMPOS_DEL_PANEL = {
  ...CAMPOS_DEL_ALUMNO,
  montoEsperado: true,
  nota: true,
  comprobantePath: true,
  verificadoPor: true,
  verificadoAt: true,
  updatedAt: true,
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      telefono: true,
      tipoDocumento: true,
      paisDocumento: true,
      documento: true,
    },
  },
  compra: { select: { id: true, clasesTotales: true, clasesUsadas: true } },
} satisfies Prisma.PagoSelect;

/** Los estados desde los que un pago todavía se puede aprobar o rechazar. */
const REVISABLES: EstadoPago[] = [EstadoPago.PENDIENTE, EstadoPago.PENDIENTE_VERIFICACION];

@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // --------------------------------------------------------------------------
  // Lo que hace el alumno
  // --------------------------------------------------------------------------

  /** La ficha del alumno que está usando la app. */
  private async miFicha(usuarioId: string): Promise<{ id: string }> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException('Tu cuenta todavía no está vinculada a una ficha de alumno');
    }
    return cliente;
  }

  /**
   * Empieza un pago por transferencia.
   *
   * **El monto lo pone el servidor**, del precio de contado del catálogo. Nunca
   * se toma del navegador: si viniera de ahí, cualquiera podría declarar que su
   * pack de doce clases costó cien pesos.
   *
   * Queda en `PENDIENTE` —no en `PENDIENTE_VERIFICACION`— hasta que suba el
   * comprobante. La diferencia importa en el panel: un pago sin comprobante no
   * es algo que alguien tenga que revisar, es algo que el alumno dejó a medias.
   */
  async crearPropio(usuarioId: string, dto: CrearPagoPropioDto) {
    const cliente = await this.miFicha(usuarioId);

    const servicio = await this.prisma.servicio.findUnique({
      where: { id: dto.servicioId },
      select: { id: true, activo: true, precioContado: true, nombre: true },
    });
    if (!servicio || !servicio.activo) {
      throw new NotFoundException('Ese servicio no está disponible');
    }

    const pago = await this.prisma.pago.create({
      data: {
        clienteId: cliente.id,
        servicioId: servicio.id,
        monto: servicio.precioContado,
        montoEsperado: servicio.precioContado,
        canal: CanalPago.TRANSFERENCIA,
        estado: EstadoPago.PENDIENTE,
      },
      select: CAMPOS_DEL_ALUMNO,
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'PAGO_INICIADO',
      entidad: 'Pago',
      entidadId: pago.id,
      detalle: { servicio: servicio.nombre, canal: CanalPago.TRANSFERENCIA },
    });

    return pago;
  }

  /**
   * Registra el comprobante que el alumno acaba de subir al bucket.
   *
   * La ruta **se compone acá** con el id de la sesión y el del pago; del cuerpo
   * del pedido solo se toma el nombre del archivo. Si la ruta viniera de afuera,
   * alguien podría apuntarla al comprobante de otra persona y después pedir que
   * se la muestren desde el panel.
   */
  async registrarComprobante(usuarioId: string, pagoId: string, dto: ComprobanteSubidoDto) {
    const cliente = await this.miFicha(usuarioId);

    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      select: { id: true, clienteId: true, estado: true },
    });
    if (!pago || pago.clienteId !== cliente.id) {
      // El mismo error para «no existe» y «no es tuyo»: distinguirlos le diría a
      // quien pruebe identificadores cuáles existen.
      throw new NotFoundException('Ese pago no existe');
    }
    if (!REVISABLES.includes(pago.estado)) {
      throw new ConflictException('Ese pago ya fue revisado por la academia');
    }

    return this.prisma.pago.update({
      where: { id: pago.id },
      data: {
        comprobantePath: `${usuarioId}/${pago.id}/${dto.archivo}`,
        estado: EstadoPago.PENDIENTE_VERIFICACION,
      },
      select: CAMPOS_DEL_ALUMNO,
    });
  }

  /** Los pagos del alumno, del más nuevo al más viejo. */
  async listarMios(usuarioId: string) {
    const cliente = await this.miFicha(usuarioId);
    return this.prisma.pago.findMany({
      where: { clienteId: cliente.id },
      select: CAMPOS_DEL_ALUMNO,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // --------------------------------------------------------------------------
  // Lo que hace la administración
  // --------------------------------------------------------------------------

  /**
   * El listado del panel, con búsqueda por alumno.
   *
   * La búsqueda es por nombre, apellido, cédula o pasaporte. `mode: insensitive`
   * en los nombres, pero NO en el documento: un documento es dígitos o letras
   * mayúsculas, y comparar sin distinguir mayúsculas ahí solo cuesta índice.
   */
  async listar(consulta: ListarPagosDto) {
    const { pagina, porPagina, saltar } = normalizarPaginacion(consulta);
    const q = consulta.q?.trim();

    const filtro: Prisma.PagoWhereInput = {
      ...(consulta.estado ? { estado: consulta.estado } : {}),
      ...(q
        ? {
            cliente: {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { apellido: { contains: q, mode: 'insensitive' } },
                { documento: { contains: q } },
              ],
            },
          }
        : {}),
    };

    const [total, datos] = await this.prisma.$transaction([
      this.prisma.pago.count({ where: filtro }),
      this.prisma.pago.findMany({
        where: filtro,
        select: CAMPOS_DEL_PANEL,
        orderBy: { createdAt: 'desc' },
        skip: saltar,
        take: porPagina,
      }),
    ]);

    return armarPagina(datos, total, pagina, porPagina);
  }

  /** Un pago, con todo lo que el panel necesita para revisarlo. */
  async obtener(id: string) {
    const pago = await this.prisma.pago.findUnique({ where: { id }, select: CAMPOS_DEL_PANEL });
    if (!pago) throw new NotFoundException('Ese pago no existe');
    return pago;
  }

  /**
   * Registra un pago cobrado en el mostrador.
   *
   * Nace **aprobado**: no hay nada que verificar, el dinero ya está. Y por eso
   * mismo acredita las clases en el acto.
   */
  async crearEnEfectivo(dto: CrearPagoEnEfectivoDto, usuarioId: string) {
    const [cliente, servicio] = await Promise.all([
      this.prisma.cliente.findUnique({ where: { id: dto.clienteId }, select: { id: true } }),
      this.prisma.servicio.findUnique({
        where: { id: dto.servicioId },
        select: { id: true, nombre: true, precioContado: true, cantidadClases: true },
      }),
    ]);
    if (!cliente) throw new NotFoundException('El alumno indicado no existe');
    if (!servicio) throw new NotFoundException('El servicio indicado no existe');

    const monto = dto.monto !== undefined ? new Prisma.Decimal(dto.monto) : servicio.precioContado;

    const pago = await this.prisma.$transaction(async (tx) => {
      const compra = await this.crearCompra(tx, cliente.id, servicio, monto);
      return tx.pago.create({
        data: {
          clienteId: cliente.id,
          servicioId: servicio.id,
          compraId: compra.id,
          monto,
          montoEsperado: servicio.precioContado,
          canal: CanalPago.EFECTIVO,
          estado: EstadoPago.APROBADO,
          verificadoPor: usuarioId,
          verificadoAt: new Date(),
          nota: dto.nota ?? null,
        },
        select: CAMPOS_DEL_PANEL,
      });
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'PAGO_REGISTRADO_EN_EFECTIVO',
      entidad: 'Pago',
      entidadId: pago.id,
      detalle: {
        clienteId: cliente.id,
        servicio: servicio.nombre,
        monto: monto.toString(),
        distintoDelCatalogo: !monto.equals(servicio.precioContado),
      },
    });

    return pago;
  }

  /**
   * Aprueba un pago y le acredita las clases al alumno.
   *
   * Las dos cosas van en **una transacción**: un pago aprobado sin clases
   * acreditadas es un alumno que pagó y no puede reservar, y una compra sin pago
   * es plata que nadie cobró. Ninguno de los dos estados puede existir.
   *
   * El monto se puede corregir por el que figura en el banco. Queda en la
   * auditoría de cuánto a cuánto: sin eso, un pago corregido es indistinguible
   * de uno que siempre fue por ese importe.
   */
  async aprobar(id: string, dto: AprobarPagoDto, usuarioId: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        monto: true,
        clienteId: true,
        servicioId: true,
        compraId: true,
      },
    });
    if (!pago) throw new NotFoundException('Ese pago no existe');
    if (!REVISABLES.includes(pago.estado)) {
      throw new ConflictException('Ese pago ya fue revisado');
    }
    if (!pago.servicioId) {
      throw new BadRequestException('Ese pago no tiene un servicio asociado y no se puede aprobar');
    }

    const servicio = await this.prisma.servicio.findUnique({
      where: { id: pago.servicioId },
      select: { id: true, nombre: true, cantidadClases: true, precioContado: true },
    });
    if (!servicio) throw new NotFoundException('El servicio de ese pago ya no existe');

    const montoFinal = dto.monto !== undefined ? new Prisma.Decimal(dto.monto) : pago.monto;
    const seCorrigio = !montoFinal.equals(pago.monto);

    const aprobado = await this.prisma.$transaction(async (tx) => {
      const compra = await this.crearCompra(tx, pago.clienteId, servicio, montoFinal);
      return tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: EstadoPago.APROBADO,
          monto: montoFinal,
          compraId: compra.id,
          verificadoPor: usuarioId,
          verificadoAt: new Date(),
          motivoRechazo: null,
          ...(dto.nota === undefined ? {} : { nota: dto.nota }),
        },
        select: CAMPOS_DEL_PANEL,
      });
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'PAGO_APROBADO',
      entidad: 'Pago',
      entidadId: pago.id,
      detalle: {
        servicio: servicio.nombre,
        clasesAcreditadas: servicio.cantidadClases,
        ...(seCorrigio
          ? { montoCorregido: { de: pago.monto.toString(), a: montoFinal.toString() } }
          : { monto: montoFinal.toString() }),
      },
    });

    return aprobado;
  }

  /** Rechaza un pago. No acredita nada y el alumno ve el motivo. */
  async rechazar(id: string, dto: RechazarPagoDto, usuarioId: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!pago) throw new NotFoundException('Ese pago no existe');
    if (!REVISABLES.includes(pago.estado)) {
      throw new ConflictException('Ese pago ya fue revisado');
    }

    const rechazado = await this.prisma.pago.update({
      where: { id: pago.id },
      data: {
        estado: EstadoPago.RECHAZADO,
        motivoRechazo: dto.motivo.trim(),
        verificadoPor: usuarioId,
        verificadoAt: new Date(),
      },
      select: CAMPOS_DEL_PANEL,
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'PAGO_RECHAZADO',
      entidad: 'Pago',
      entidadId: pago.id,
      // El motivo NO va a la auditoría: lo escribe una persona y puede nombrar a
      // otra. Queda en el pago, que es donde se lee.
      detalle: {},
    });

    return rechazado;
  }

  /**
   * Crea la compra que le acredita las clases al alumno.
   *
   * Recibe la transacción porque siempre va junto con el pago: ver `aprobar`.
   */
  private crearCompra(
    tx: Prisma.TransactionClient | PrismaClient,
    clienteId: string,
    servicio: { id: string; cantidadClases: number },
    monto: Prisma.Decimal,
  ) {
    return tx.compraServicio.create({
      data: {
        clienteId,
        servicioId: servicio.id,
        clasesTotales: servicio.cantidadClases,
        montoTotal: monto,
      },
      select: { id: true },
    });
  }
}
