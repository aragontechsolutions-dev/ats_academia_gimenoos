import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import type { ActualizarServicioDto, CrearServicioDto } from './dto/servicio.dto';

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Servicios visibles en la landing pública.
   * Se devuelven solo los campos necesarios: nada de datos internos.
   */
  listarPublicos() {
    return this.prisma.servicio.findMany({
      where: { activo: true, publico: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        slug: true,
        nombre: true,
        descripcion: true,
        tipo: true,
        tipoVehiculo: true,
        cantidadClases: true,
        duracionMin: true,
        precioContado: true,
        precioTarjeta: true,
      },
    });
  }

  /** Catálogo completo para el panel, incluidos los servicios dados de baja. */
  listarTodos() {
    return this.prisma.servicio.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  }

  async crear(dto: CrearServicioDto, usuarioId: string) {
    const servicio = await this.prisma.servicio.create({ data: this.datos(dto) });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'SERVICIO_CREADO',
      entidad: 'Servicio',
      entidadId: servicio.id,
      detalle: { slug: servicio.slug },
    });
    return servicio;
  }

  async actualizar(id: string, dto: ActualizarServicioDto, usuarioId: string) {
    const existe = await this.prisma.servicio.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('El servicio no existe');

    const servicio = await this.prisma.servicio.update({ where: { id }, data: this.datos(dto) });

    // Los precios son el dato que más se revisa; dejar rastro de cada cambio
    // permite responder "¿desde cuándo vale esto?".
    await this.auditoria.registrar({
      usuarioId,
      accion: 'SERVICIO_ACTUALIZADO',
      entidad: 'Servicio',
      entidadId: id,
      detalle: {
        slug: servicio.slug,
        precioContado: servicio.precioContado.toString(),
        precioTarjeta: servicio.precioTarjeta.toString(),
        activo: servicio.activo,
      },
    });
    return servicio;
  }

  private datos(dto: CrearServicioDto) {
    return {
      slug: dto.slug,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      tipo: dto.tipo,
      tipoVehiculo: dto.tipoVehiculo ?? null,
      cantidadClases: dto.cantidadClases,
      duracionMin: dto.duracionMin,
      precioContado: dto.precioContado,
      precioTarjeta: dto.precioTarjeta,
      orden: dto.orden ?? 0,
      activo: dto.activo ?? true,
      publico: dto.publico ?? true,
    };
  }
}
