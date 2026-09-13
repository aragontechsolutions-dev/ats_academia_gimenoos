import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoVehiculo } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  armarPagina,
  normalizarPaginacion,
  type ConsultaPaginadaDto,
} from '../../common/paginacion/paginacion';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { rutaFotoONula } from '../../common/formato/foto';
import type { ActualizarVehiculoDto, CrearVehiculoDto } from './dto/vehiculo.dto';

@Injectable()
export class VehiculosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(incluirInactivos: boolean, consulta: ConsultaPaginadaDto) {
    const { pagina, porPagina, saltar } = normalizarPaginacion(consulta);
    const where = incluirInactivos ? {} : { estado: EstadoVehiculo.ACTIVO };

    const [total, datos] = await Promise.all([
      this.prisma.vehiculo.count({ where }),
      this.prisma.vehiculo.findMany({
        where,
        orderBy: [{ tipo: 'asc' }, { patente: 'asc' }],
        skip: saltar,
        take: porPagina,
      }),
    ]);

    return armarPagina(datos, total, pagina, porPagina);
  }

  async obtener(id: string) {
    const vehiculo = await this.prisma.vehiculo.findUnique({ where: { id } });
    if (!vehiculo) throw new NotFoundException('El vehículo no existe');
    return vehiculo;
  }

  async crear(dto: CrearVehiculoDto, usuarioId: string) {
    const vehiculo = await this.prisma.vehiculo.create({
      data: { ...this.datos(dto), patente: dto.patente.toUpperCase() },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'VEHICULO_CREADO',
      entidad: 'Vehiculo',
      entidadId: vehiculo.id,
      detalle: { patente: vehiculo.patente },
    });
    return vehiculo;
  }

  async actualizar(id: string, dto: ActualizarVehiculoDto, usuarioId: string) {
    await this.obtener(id);

    const vehiculo = await this.prisma.vehiculo.update({
      where: { id },
      data: {
        ...this.datos(dto),
        patente: dto.patente.toUpperCase(),
        ...(dto.estado === undefined ? {} : { estado: dto.estado }),
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'VEHICULO_ACTUALIZADO',
      entidad: 'Vehiculo',
      entidadId: id,
      detalle: { estado: vehiculo.estado },
    });
    return vehiculo;
  }

  /**
   * Guarda la ruta de la foto, sin tocar el resto de la ficha.
   *
   * El archivo ya está en Storage: el panel lo sube directo desde el navegador y
   * acá llega solamente dónde quedó. La forma de esa ruta la valida el DTO.
   */
  async guardarFoto(id: string, fotoRuta: string | null | undefined, usuarioId: string) {
    await this.obtener(id);

    const vehiculo = await this.prisma.vehiculo.update({
      where: { id },
      data: { fotoRuta: rutaFotoONula(fotoRuta) ?? null },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: vehiculo.fotoRuta ? 'VEHICULO_FOTO_CARGADA' : 'VEHICULO_FOTO_QUITADA',
      entidad: 'Vehiculo',
      entidadId: id,
      detalle: { patente: vehiculo.patente },
    });
    return vehiculo;
  }

  private datos(dto: CrearVehiculoDto) {
    return {
      tipo: dto.tipo,
      marca: dto.marca ?? null,
      modelo: dto.modelo ?? null,
      cilindrada: dto.cilindrada ?? null,
      anio: dto.anio ?? null,
      soaVence: dto.soaVence ?? null,
    };
  }
}
