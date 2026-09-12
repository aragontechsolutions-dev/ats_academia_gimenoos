import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Servicios visibles en la landing publica.
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

  /** Catalogo completo para el panel, incluidos los servicios dados de baja. */
  listarTodos() {
    return this.prisma.servicio.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  }
}
