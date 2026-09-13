import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarTelefono } from '../../common/formato/telefono';
import { normalizarDocumento } from '../../common/formato/documento';
import { armarPagina, normalizarPaginacion } from '../../common/paginacion/paginacion';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import type { UsuarioAutenticado } from '../../common/auth/jwt-payload.interface';
import type {
  ActualizarClienteDto, ActualizarMiFichaDto, BuscarClientesDto, CrearClienteDto,
} from './dto/cliente.dto';

/**
 * Datos que ve un instructor: lo necesario para dar la clase y coordinar.
 * La cédula, el domicilio y las notas internas quedan fuera a propósito.
 */
const CAMPOS_BASICOS = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  email: true,
  ciudad: true,
  activo: true,
} satisfies Prisma.ClienteSelect;

/**
 * Lo que el alumno ve de su propia ficha.
 * Incluye sus datos identificatorios —son suyos— pero nunca las notas internas,
 * que son observaciones del instructor sobre su desempeño.
 */
const CAMPOS_PROPIOS = {
  ...CAMPOS_BASICOS,
  tipoDocumento: true,
  paisDocumento: true,
  documento: true,
  fechaNacimiento: true,
  direccion: true,
} satisfies Prisma.ClienteSelect;

/** Lo que ve un administrador: incluye los datos identificatorios. */
const CAMPOS_COMPLETOS = {
  ...CAMPOS_BASICOS,
  tipoDocumento: true,
  paisDocumento: true,
  documento: true,
  fechaNacimiento: true,
  direccion: true,
  notasInternas: true,
  usuarioId: true,
  createdAt: true,
} satisfies Prisma.ClienteSelect;

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * La cédula es un dato identificatorio protegido por la Ley 18.331 y el
   * domicilio y las notas internas no hacen falta para dictar una clase. Por eso
   * el conjunto de campos depende del rol y no se filtra en el frontend: lo que
   * no se necesita, no se envía.
   */
  private campos(rol: RolUsuario) {
    return rol === RolUsuario.ADMIN ? CAMPOS_COMPLETOS : CAMPOS_BASICOS;
  }

  async listar(dto: BuscarClientesDto, usuario: UsuarioAutenticado) {
    const termino = dto.q?.trim();

    const where: Prisma.ClienteWhereInput = {
      ...(dto.incluirInactivos ? {} : { activo: true }),
      ...(termino
        ? {
            OR: [
              { nombre: { contains: termino, mode: 'insensitive' } },
              { apellido: { contains: termino, mode: 'insensitive' } },
              { email: { contains: termino, mode: 'insensitive' } },
              // Buscar por documento es habitual en el mostrador, pero solo
              // tiene sentido para quien puede verlo.
              ...(usuario.rol === RolUsuario.ADMIN
                ? [
                    {
                      documento: {
                        contains: termino.replace(/[.\s-]/g, '').toUpperCase(),
                        mode: 'insensitive',
                      } as Prisma.StringNullableFilter,
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };

    const { pagina, porPagina, saltar } = normalizarPaginacion(dto);

    const [total, datos] = await Promise.all([
      this.prisma.cliente.count({ where }),
      this.prisma.cliente.findMany({
        where,
        select: this.campos(usuario.rol),
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        skip: saltar,
        take: porPagina,
      }),
    ]);

    return armarPagina(datos, total, pagina, porPagina);
  }

  /** Ficha con el historial de clases, de la más reciente a la más antigua. */
  async obtener(id: string, usuario: UsuarioAutenticado) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      select: {
        ...this.campos(usuario.rol),
        reservas: {
          select: {
            id: true,
            inicio: true,
            fin: true,
            estado: true,
            tipo: true,
            instructor: { select: { id: true, nombre: true, apellido: true } },
            vehiculo: { select: { patente: true } },
          },
          orderBy: { inicio: 'desc' },
          take: 100,
        },
        compras: {
          select: {
            id: true,
            clasesTotales: true,
            clasesUsadas: true,
            vigenteHasta: true,
            servicio: { select: { nombre: true, tipoVehiculo: true, duracionMin: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cliente) throw new NotFoundException('El alumno no existe');
    return cliente;
  }

  async crear(dto: CrearClienteDto, usuario: UsuarioAutenticado) {
    const cliente = await this.prisma.cliente.create({
      data: this.datos(dto),
      select: this.campos(usuario.rol),
    });

    // No se registra el nombre ni la cédula en la bitácora: alcanza con saber
    // qué ficha se creó y quién lo hizo.
    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'CLIENTE_CREADO',
      entidad: 'Cliente',
      entidadId: cliente.id,
    });
    return cliente;
  }

  async actualizar(id: string, dto: ActualizarClienteDto, usuario: UsuarioAutenticado) {
    const existe = await this.prisma.cliente.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('El alumno no existe');

    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: { ...this.datos(dto), ...(dto.activo === undefined ? {} : { activo: dto.activo }) },
      select: this.campos(usuario.rol),
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'CLIENTE_ACTUALIZADO',
      entidad: 'Cliente',
      entidadId: id,
    });
    return cliente;
  }

  // --------------------------------------------------------------------------
  // La ficha del propio alumno (PWA)
  // --------------------------------------------------------------------------

  /**
   * Busca la ficha a partir del usuario autenticado.
   *
   * El identificador NUNCA llega por parámetro: se resuelve desde el token. Es
   * lo que hace imposible que un alumno pida la ficha de otro cambiando un id.
   */
  private async miFicha(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Tu usuario todavía no tiene ficha de alumno. Comunicate con la academia.',
      );
    }
    return cliente;
  }

  async obtenerMia(usuarioId: string) {
    const { id } = await this.miFicha(usuarioId);
    return this.prisma.cliente.findUniqueOrThrow({
      where: { id },
      select: {
        ...CAMPOS_PROPIOS,
        compras: {
          select: {
            id: true,
            clasesTotales: true,
            clasesUsadas: true,
            vigenteHasta: true,
            servicio: { select: { nombre: true, tipoVehiculo: true, duracionMin: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async actualizarMia(usuarioId: string, dto: ActualizarMiFichaDto) {
    const { id } = await this.miFicha(usuarioId);

    const actualizada = await this.prisma.cliente.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        telefono: normalizarTelefono(dto.telefono),
        ...normalizarDocumento(dto),
        fechaNacimiento: dto.fechaNacimiento ?? null,
        direccion: dto.direccion ?? null,
        ...(dto.ciudad ? { ciudad: dto.ciudad } : {}),
      },
      select: CAMPOS_PROPIOS,
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'CLIENTE_ACTUALIZADO',
      entidad: 'Cliente',
      entidadId: id,
      detalle: { porElPropioAlumno: true },
    });
    return actualizada;
  }

  private datos(dto: CrearClienteDto) {
    return {
      nombre: dto.nombre,
      apellido: dto.apellido,
      telefono: normalizarTelefono(dto.telefono),
      email: dto.email ?? null,
      ...normalizarDocumento(dto),
      fechaNacimiento: dto.fechaNacimiento ?? null,
      direccion: dto.direccion ?? null,
      ciudad: dto.ciudad ?? 'San Carlos',
      notasInternas: dto.notasInternas ?? null,
    };
  }
}
