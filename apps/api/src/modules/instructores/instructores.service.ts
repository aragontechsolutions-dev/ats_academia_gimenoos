import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarTelefono } from '../../common/formato/telefono';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import type {
  ActualizarInstructorDto,
  CrearExcepcionDto,
  CrearInstructorDto,
  ReemplazarDisponibilidadDto,
} from './dto/instructor.dto';

@Injectable()
export class InstructoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  listar(incluirInactivos: boolean) {
    return this.prisma.instructor.findMany({
      where: incluirInactivos ? {} : { activo: true },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { disponibilidades: { orderBy: [{ diaSemana: 'asc' }, { minutoInicio: 'asc' }] } },
    });
  }

  async obtener(id: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id },
      include: {
        disponibilidades: { orderBy: [{ diaSemana: 'asc' }, { minutoInicio: 'asc' }] },
        excepciones: { orderBy: { inicio: 'asc' } },
      },
    });
    if (!instructor) throw new NotFoundException('El instructor no existe');
    return instructor;
  }

  async crear(dto: CrearInstructorDto, usuarioId: string) {
    this.validarHabilitaciones(dto);

    const instructor = await this.prisma.instructor.create({
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        telefono: normalizarTelefono(dto.telefono),
        habilitaMoto: dto.habilitaMoto ?? false,
        habilitaAuto: dto.habilitaAuto ?? true,
        colorAgenda: dto.colorAgenda ?? '#2563eb',
        usuarioId: dto.usuarioId ?? null,
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'INSTRUCTOR_CREADO',
      entidad: 'Instructor',
      entidadId: instructor.id,
    });
    return instructor;
  }

  async actualizar(id: string, dto: ActualizarInstructorDto, usuarioId: string) {
    await this.obtener(id);
    this.validarHabilitaciones(dto);

    const instructor = await this.prisma.instructor.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        telefono: normalizarTelefono(dto.telefono),
        habilitaMoto: dto.habilitaMoto ?? false,
        habilitaAuto: dto.habilitaAuto ?? true,
        colorAgenda: dto.colorAgenda,
        usuarioId: dto.usuarioId ?? null,
        ...(dto.activo === undefined ? {} : { activo: dto.activo }),
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'INSTRUCTOR_ACTUALIZADO',
      entidad: 'Instructor',
      entidadId: id,
      detalle: { activo: instructor.activo },
    });
    return instructor;
  }

  /**
   * Reemplaza la plantilla semanal completa.
   *
   * Se reemplaza en vez de editar franja por franja porque la plantilla se
   * define como un todo: "estos son mis horarios". Va en una transacción para
   * que no quede a medias si una franja es inválida.
   */
  async reemplazarDisponibilidad(id: string, dto: ReemplazarDisponibilidadDto, usuarioId: string) {
    await this.obtener(id);

    for (const franja of dto.franjas) {
      if (franja.minutoFin <= franja.minutoInicio) {
        throw new BadRequestException(
          'Cada franja debe terminar después de empezar (revisá el día ' + franja.diaSemana + ')',
        );
      }
    }
    this.verificarSolapes(dto.franjas);

    await this.prisma.$transaction([
      this.prisma.disponibilidadPlantilla.deleteMany({ where: { instructorId: id } }),
      this.prisma.disponibilidadPlantilla.createMany({
        data: dto.franjas.map((f) => ({
          instructorId: id,
          diaSemana: f.diaSemana,
          minutoInicio: f.minutoInicio,
          minutoFin: f.minutoFin,
          vigenteDesde: f.vigenteDesde ?? null,
          vigenteHasta: f.vigenteHasta ?? null,
        })),
      }),
    ]);

    await this.auditoria.registrar({
      usuarioId,
      accion: 'INSTRUCTOR_ACTUALIZADO',
      entidad: 'Instructor',
      entidadId: id,
      detalle: { franjas: dto.franjas.length },
    });

    return this.obtener(id);
  }

  async crearExcepcion(id: string, dto: CrearExcepcionDto, usuarioId: string) {
    await this.obtener(id);
    if (dto.fin <= dto.inicio) {
      throw new BadRequestException('La excepción debe terminar después de empezar');
    }

    const excepcion = await this.prisma.excepcionDisponibilidad.create({
      data: {
        instructorId: id,
        tipo: dto.tipo,
        inicio: dto.inicio,
        fin: dto.fin,
        motivo: dto.motivo ?? null,
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'INSTRUCTOR_ACTUALIZADO',
      entidad: 'ExcepcionDisponibilidad',
      entidadId: excepcion.id,
      detalle: { instructorId: id, tipo: dto.tipo },
    });
    return excepcion;
  }

  async eliminarExcepcion(instructorId: string, excepcionId: string, usuarioId: string) {
    const excepcion = await this.prisma.excepcionDisponibilidad.findUnique({
      where: { id: excepcionId },
      select: { instructorId: true },
    });
    if (!excepcion || excepcion.instructorId !== instructorId) {
      throw new NotFoundException('La excepción no existe para ese instructor');
    }

    await this.prisma.excepcionDisponibilidad.delete({ where: { id: excepcionId } });
    await this.auditoria.registrar({
      usuarioId,
      accion: 'INSTRUCTOR_ACTUALIZADO',
      entidad: 'ExcepcionDisponibilidad',
      entidadId: excepcionId,
      detalle: { instructorId, eliminada: true },
    });
  }

  /** Un instructor que no da ni moto ni auto no puede aparecer en ninguna búsqueda. */
  private validarHabilitaciones(dto: { habilitaMoto?: boolean; habilitaAuto?: boolean }): void {
    if (dto.habilitaMoto === false && dto.habilitaAuto === false) {
      throw new BadRequestException('El instructor tiene que dar clases de moto, de auto o de ambos');
    }
  }

  /** Dos franjas superpuestas el mismo día generarían huecos duplicados. */
  private verificarSolapes(franjas: Array<{ diaSemana: number; minutoInicio: number; minutoFin: number }>): void {
    const porDia = new Map<number, Array<{ minutoInicio: number; minutoFin: number }>>();
    for (const franja of franjas) {
      const delDia = porDia.get(franja.diaSemana) ?? [];
      if (delDia.some((o) => franja.minutoInicio < o.minutoFin && o.minutoInicio < franja.minutoFin)) {
        throw new BadRequestException(
          `Hay franjas superpuestas en el día ${franja.diaSemana} de la plantilla`,
        );
      }
      delDia.push(franja);
      porDia.set(franja.diaSemana, delDia);
    }
  }
}
