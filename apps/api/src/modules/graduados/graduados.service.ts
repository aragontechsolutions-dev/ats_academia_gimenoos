import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { generarCodigo, normalizarCodigo } from './codigo';
import {
  armarPagina,
  normalizarPaginacion,
  type ConsultaPaginadaDto,
} from '../../common/paginacion/paginacion';
import type {
  ActualizarGraduadoDto,
  ConsultaGaleriaDto,
  CrearGraduadoDto,
} from './dto/graduado.dto';

/**
 * Lo único que ve el público de un egresado.
 *
 * Nombre, apellido, categoría, año y foto. Nada más: ni cédula, ni fecha de
 * nacimiento, ni teléfono, ni quién firmó la autorización. La lista es
 * explícita y no un `exclude`, para que agregar un campo sensible al modelo no
 * lo publique sin que nadie lo decida.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  categoria: true,
  anio: true,
  fotoRuta: true,
  cliente: { select: { nombre: true, apellido: true } },
} as const;

/**
 * Cuántas fotos trae cada año de la galería agrupada.
 *
 * Veinticuatro son cuatro pantallas de carrusel: suficiente para que se note el
 * volumen de la academia sin cargar una promoción entera de golpe. Si un año
 * tiene más, la página lo dice en vez de esconderlo.
 */
const POR_ANIO_MAXIMO = 24;

/** Cuántos años se muestran. Los más recientes son los que interesan. */
const ANIOS_MAXIMOS = 12;

@Injectable()
export class GraduadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Dirección pública de una foto, armada a partir de la ruta guardada.
   *
   * Se compone acá y no se guarda entera en la base: así el dominio de Supabase
   * vive en la configuración, y mover el proyecto de Storage no obliga a
   * reescribir una fila por cada egresado.
   */
  private urlFoto(ruta: string | null): string | null {
    if (!ruta) return null;
    const base = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    if (!base) return null;
    return `${base}/storage/v1/object/public/graduados/${ruta}`;
  }

  // -------------------------------------------------------------------------
  // Público
  // -------------------------------------------------------------------------

  /** Galería pública: solo egresados publicados, paginados. */
  async galeria(consulta: ConsultaGaleriaDto) {
    const { pagina, porPagina, saltar } = normalizarPaginacion(consulta);

    const where: Prisma.GraduadoWhereInput = {
      publicado: true,
      ...(consulta.anio ? { anio: consulta.anio } : {}),
    };

    const [total, filas] = await Promise.all([
      this.prisma.graduado.count({ where }),
      this.prisma.graduado.findMany({
        where,
        select: CAMPOS_PUBLICOS,
        orderBy: [{ anio: 'desc' }, { fechaEgreso: 'desc' }],
        skip: saltar,
        take: porPagina,
      }),
    ]);

    // Misma forma de página que el resto de los listados de la API.
    return armarPagina(
      filas.map((fila) => ({
        id: fila.id,
        nombre: fila.cliente.nombre,
        apellido: fila.cliente.apellido,
        categoria: fila.categoria,
        anio: fila.anio,
        fotoUrl: this.urlFoto(fila.fotoRuta),
      })),
      total,
      pagina,
      porPagina,
    );
  }

  /**
   * La galería entera, agrupada por año.
   *
   * Es lo que dibuja la página pública: un carrusel por año, de más nuevo a más
   * viejo, en **una sola petición**. Hacerlo con la galería paginada obligaría a
   * pedir un año por vez y la página tardaría tantos viajes como años tenga la
   * academia.
   *
   * Hay dos topes, y no son decorativos: sin ellos, dentro de cinco años esta
   * ruta —que es **pública, sin sesión**— devuelve mil fotos en cada carga y se
   * convierte en la forma más barata de tirar abajo el sitio.
   */
  async galeriaPorAnio() {
    const anios = (
      await this.prisma.graduado.groupBy({
        by: ['anio'],
        where: { publicado: true },
        _count: { _all: true },
        orderBy: { anio: 'desc' },
      })
    ).slice(0, ANIOS_MAXIMOS);

    // Una consulta por año, en paralelo. Traer todo junto y agrupar en memoria
    // no permitiría recortar CADA año a su tope.
    const grupos = await Promise.all(
      anios.map(async (fila) => {
        const filas = await this.prisma.graduado.findMany({
          where: { publicado: true, anio: fila.anio },
          select: CAMPOS_PUBLICOS,
          orderBy: { fechaEgreso: 'desc' },
          take: POR_ANIO_MAXIMO,
        });
        return {
          anio: fila.anio,
          total: fila._count._all,
          graduados: filas.map((g) => ({
            id: g.id,
            nombre: g.cliente.nombre,
            apellido: g.cliente.apellido,
            categoria: g.categoria,
            anio: g.anio,
            fotoUrl: this.urlFoto(g.fotoRuta),
          })),
        };
      }),
    );

    return grupos;
  }

  /**
   * Verificación de un diploma por su código.
   *
   * Funciona haya o no autorización para publicar: son dos cosas distintas. La
   * autorización habilita la galería; el diploma es válido igual, y quien lo
   * tiene en la mano ya ve su propio nombre impreso. Se devuelve el mínimo que
   * permite confirmar que el papel es auténtico.
   */
  async verificar(codigoCrudo: string) {
    const codigo = normalizarCodigo(codigoCrudo);
    const graduado = await this.prisma.graduado.findUnique({
      where: { codigo },
      select: {
        categoria: true,
        anio: true,
        fechaEgreso: true,
        cliente: { select: { nombre: true, apellido: true } },
      },
    });

    if (!graduado) throw new NotFoundException('No existe un diploma con ese código');

    return {
      valido: true,
      nombre: graduado.cliente.nombre,
      apellido: graduado.cliente.apellido,
      categoria: graduado.categoria,
      anio: graduado.anio,
      fechaEgreso: graduado.fechaEgreso,
    };
  }

  // -------------------------------------------------------------------------
  // Panel
  // -------------------------------------------------------------------------

  async listar(
    filtros: { anio?: number; soloSinAutorizacion?: boolean },
    consulta: ConsultaPaginadaDto,
  ) {
    const { pagina, porPagina, saltar } = normalizarPaginacion(consulta);
    const where = {
      ...(filtros.anio ? { anio: filtros.anio } : {}),
      ...(filtros.soloSinAutorizacion ? { autorizacionAt: null } : {}),
    };

    const [total, datos] = await Promise.all([
      this.prisma.graduado.count({ where }),
      this.prisma.graduado.findMany({
        where,
        orderBy: [{ anio: 'desc' }, { fechaEgreso: 'desc' }],
        include: { cliente: { select: { id: true, nombre: true, apellido: true } } },
        skip: saltar,
        take: porPagina,
      }),
    ]);

    return armarPagina(datos, total, pagina, porPagina);
  }

  /**
   * Lo que el encabezado del panel necesita saber sobre TODOS los egresados, no
   * solo sobre la página que se está viendo.
   *
   * Con el listado paginado, calcular esto en el navegador daba resultados
   * distintos según en qué página estuviera parado quien mira: el filtro de años
   * solo ofrecía los años de esa página, y el aviso de autorizaciones faltantes
   * contaba de a diez.
   */
  async resumen() {
    const [sinAutorizacion, anios] = await Promise.all([
      this.prisma.graduado.count({ where: { autorizacionAt: null } }),
      this.prisma.graduado.groupBy({ by: ['anio'], orderBy: { anio: 'desc' } }),
    ]);
    return { sinAutorizacion, anios: anios.map((fila) => fila.anio) };
  }

  async obtener(id: string) {
    const graduado = await this.prisma.graduado.findUnique({
      where: { id },
      include: { cliente: { select: { id: true, nombre: true, apellido: true } } },
    });
    if (!graduado) throw new NotFoundException('El egresado no existe');
    return graduado;
  }

  async crear(dto: CrearGraduadoDto, usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('El alumno no existe');

    const datos = this.datos(dto);

    const graduado = await this.conCodigoUnico((codigo) =>
      this.prisma.graduado.create({
        data: {
          clienteId: dto.clienteId,
          categoria: dto.categoria,
          fechaEgreso: datos.fechaEgreso!,
          anio: datos.anio!,
          codigo,
          autorizacionAt: datos.autorizacionAt,
          autorizacionFirmante: datos.autorizacionFirmante,
          autorizacionEsTutor: dto.autorizacionEsTutor ?? false,
          publicado: dto.publicado ?? false,
          notas: datos.notas,
          creadoPor: usuarioId,
        },
      }),
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GRADUADO_CREADO',
      entidad: 'Graduado',
      entidadId: graduado.id,
      detalle: { anio: graduado.anio, publicado: graduado.publicado },
    });
    return graduado;
  }

  async actualizar(id: string, dto: ActualizarGraduadoDto, usuarioId: string) {
    await this.obtener(id);
    const datos = this.datos(dto);

    const graduado = await this.prisma.graduado.update({
      where: { id },
      data: {
        clienteId: dto.clienteId,
        categoria: dto.categoria,
        fechaEgreso: datos.fechaEgreso,
        anio: datos.anio,
        autorizacionAt: datos.autorizacionAt,
        autorizacionFirmante: datos.autorizacionFirmante,
        autorizacionEsTutor: dto.autorizacionEsTutor,
        publicado: dto.publicado,
        notas: datos.notas,
        fotoRuta: this.aTextoONulo(dto.fotoRuta),
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GRADUADO_ACTUALIZADO',
      entidad: 'Graduado',
      entidadId: id,
      detalle: { publicado: graduado.publicado, conAutorizacion: graduado.autorizacionAt !== null },
    });
    return graduado;
  }

  /**
   * Retira la autorización y despublica, en una sola operación.
   *
   * Van juntas porque la base no acepta un publicado sin autorización, y porque
   * es lo que corresponde: si alguien pide que lo saquen, sale.
   */
  async retirarAutorizacion(id: string, usuarioId: string) {
    await this.obtener(id);

    const graduado = await this.prisma.graduado.update({
      where: { id },
      data: {
        publicado: false,
        autorizacionAt: null,
        autorizacionFirmante: null,
        autorizacionEsTutor: false,
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GRADUADO_AUTORIZACION_RETIRADA',
      entidad: 'Graduado',
      entidadId: id,
    });
    return graduado;
  }

  /** Borrado definitivo. Es el derecho de supresión de la Ley 18.331. */
  async eliminar(id: string, usuarioId: string) {
    await this.obtener(id);
    await this.prisma.graduado.delete({ where: { id } });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GRADUADO_ELIMINADO',
      entidad: 'Graduado',
      entidadId: id,
    });
    return { eliminado: true };
  }

  // -------------------------------------------------------------------------

  /** Campos derivados y normalizados, compartidos por crear y actualizar. */
  private datos(dto: Partial<CrearGraduadoDto>) {
    const fechaEgreso = dto.fechaEgreso ? new Date(dto.fechaEgreso) : undefined;
    if (fechaEgreso && Number.isNaN(fechaEgreso.getTime())) {
      throw new BadRequestException('La fecha de egreso no es válida');
    }

    return {
      fechaEgreso,
      // El año se deriva de la fecha y nunca se recibe del cliente: la base
      // tiene una constraint que exige que coincidan, y dejar que lo mande
      // quien llama solo agrega una forma de que no coincidan.
      anio: fechaEgreso ? fechaEgreso.getUTCFullYear() : undefined,
      autorizacionAt: this.aFechaONulo(dto.autorizacionAt),
      autorizacionFirmante: this.aTextoONulo(dto.autorizacionFirmante),
      notas: this.aTextoONulo(dto.notas),
    };
  }

  private aFechaONulo(valor: string | null | undefined) {
    if (valor === undefined) return undefined;
    return valor === null || valor === '' ? null : new Date(valor);
  }

  private aTextoONulo(valor: string | null | undefined) {
    if (valor === undefined) return undefined;
    if (valor === null) return null;
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }

  /**
   * Reintenta si el código sorteado ya existía.
   *
   * La probabilidad es ínfima, pero "ínfima" no es "imposible": sin el reintento
   * la colisión aparecería como un error opaco justo al dar de alta a alguien.
   */
  private async conCodigoUnico<T>(operacion: (codigo: string) => Promise<T>): Promise<T> {
    for (let intento = 0; intento < 5; intento += 1) {
      try {
        return await operacion(generarCodigo());
      } catch (problema) {
        const esColision =
          problema instanceof Prisma.PrismaClientKnownRequestError &&
          problema.code === 'P2002' &&
          String(problema.meta?.target ?? '').includes('codigo');
        if (!esColision) throw problema;
      }
    }
    throw new Error('No se pudo generar un código de diploma único');
  }
}
