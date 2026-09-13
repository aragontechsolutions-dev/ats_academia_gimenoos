import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { SECCIONES_LANDING, ordenPorDefecto } from './claves';
import type { ActualizarSeccionDto } from './dto/seccion.dto';
import type { ActualizarNegocioDto } from './dto/negocio.dto';

/** Campos del negocio que el sitio público puede leer. Nada más que esto. */
const CAMPOS_NEGOCIO = {
  nombre: true,
  direccion: true,
  ciudad: true,
  departamento: true,
  telefono: true,
  whatsapp: true,
  email: true,
  horarios: true,
  mapaUrl: true,
  latitud: true,
  longitud: true,
  instagram: true,
  facebook: true,
} as const;

@Injectable()
export class LandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Todo lo que el sitio público necesita, en una sola petición.
   *
   * Se devuelven también las secciones ocultas, con su bandera `visible`: el
   * sitio decide qué dibujar. Filtrarlas acá no aportaría nada —el contenido no
   * es secreto, es texto de marketing— y en cambio obligaría a una segunda
   * petición para que el panel pudiera previsualizar.
   */
  async contenidoPublico() {
    const [negocio, secciones] = await Promise.all([
      this.prisma.configuracionAcademia.findUnique({
        where: { id: 1 },
        select: CAMPOS_NEGOCIO,
      }),
      this.prisma.seccionLanding.findMany({ orderBy: { orden: 'asc' } }),
    ]);

    const porClave = new Map(secciones.map((seccion) => [seccion.clave, seccion]));

    return {
      // Si la configuración todavía no se inicializó, el sitio usa sus valores
      // por defecto. La landing es pública: nunca debe fallar por esto.
      negocio: negocio ?? null,

      // Se devuelven TODAS las secciones, incluidas las que nadie configuró.
      //
      // Devolver solo las guardadas obligaba al sitio a inventar una posición
      // para el resto, y esa numeración local no coincidía con la de acá: con
      // unas pocas secciones guardadas, el orden de la página salía mezclado
      // —contacto terminaba antes que preguntas—. Con la lista completa hay una
      // sola fuente de verdad para el orden, que es esta.
      secciones: SECCIONES_LANDING.map((definicion) => {
        const guardada = porClave.get(definicion.clave);
        return {
          clave: definicion.clave,
          visible: guardada?.visible ?? true,
          orden: guardada?.orden ?? ordenPorDefecto(definicion.clave),
          titulo: guardada?.titulo ?? null,
          bajada: guardada?.bajada ?? null,
          etiqueta: guardada?.etiqueta ?? null,
          accion: guardada?.accion ?? null,
          items: guardada?.items ?? [],
        };
      }).sort((a, b) => a.orden - b.orden),
    };
  }

  /**
   * Las secciones para el panel: siempre la lista completa y en orden, estén o
   * no guardadas en la base. Así el formulario muestra todas las secciones desde
   * el primer día, sin que nadie tenga que "crearlas".
   */
  async listarParaPanel() {
    const guardadas = await this.prisma.seccionLanding.findMany();
    const porClave = new Map(guardadas.map((seccion) => [seccion.clave, seccion]));

    return SECCIONES_LANDING.map((definicion) => {
      const guardada = porClave.get(definicion.clave);
      return {
        clave: definicion.clave,
        nombre: definicion.nombre,
        admiteItems: definicion.items,
        visible: guardada?.visible ?? true,
        orden: guardada?.orden ?? ordenPorDefecto(definicion.clave),
        titulo: guardada?.titulo ?? null,
        bajada: guardada?.bajada ?? null,
        etiqueta: guardada?.etiqueta ?? null,
        accion: guardada?.accion ?? null,
        items: guardada?.items ?? [],
        personalizada: guardada !== undefined,
      };
    }).sort((a, b) => a.orden - b.orden);
  }

  async actualizarSeccion(clave: string, dto: ActualizarSeccionDto, usuarioId: string) {
    // Una cadena vacía significa "volver al texto por defecto del sitio", que en
    // la base se representa como null. Guardar "" en su lugar dejaría la sección
    // con un encabezado en blanco, que es justo lo que nadie quiere.
    const datos = {
      visible: dto.visible,
      orden: dto.orden,
      titulo: this.aNulo(dto.titulo),
      bajada: this.aNulo(dto.bajada),
      etiqueta: this.aNulo(dto.etiqueta),
      accion: this.aNulo(dto.accion),
      items: dto.items as Prisma.InputJsonValue | undefined,
      actualizadoPor: usuarioId,
    };

    const seccion = await this.prisma.seccionLanding.upsert({
      where: { clave },
      create: {
        ...datos,
        clave,
        // Al crearla, si nadie fijó un orden se usa la posición que la sección
        // tiene en la lista. Va DESPUÉS del spread: al revés, el `orden`
        // indefinido de `datos` pisaba este valor y todas las secciones nuevas
        // nacían en la posición 0.
        orden: dto.orden ?? ordenPorDefecto(clave),
      },
      update: datos,
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'LANDING_SECCION_ACTUALIZADA',
      entidad: 'SeccionLanding',
      entidadId: clave,
      detalle: { visible: seccion.visible, orden: seccion.orden },
    });
    return seccion;
  }

  /** Datos del negocio para el panel. */
  async obtenerNegocio() {
    const negocio = await this.prisma.configuracionAcademia.findUnique({
      where: { id: 1 },
      select: CAMPOS_NEGOCIO,
    });
    if (!negocio) throw new NotFoundException('La configuración de la academia no fue inicializada');
    return negocio;
  }

  async actualizarNegocio(dto: ActualizarNegocioDto, usuarioId: string) {
    this.comprobarCoordenadas(dto);

    const negocio = await this.prisma.configuracionAcademia.update({
      where: { id: 1 },
      data: {
        nombre: dto.nombre,
        direccion: dto.direccion,
        ciudad: dto.ciudad,
        departamento: dto.departamento,
        telefono: this.aNulo(dto.telefono),
        whatsapp: this.aNulo(dto.whatsapp),
        email: this.aNulo(dto.email),
        horarios: this.aNulo(dto.horarios),
        mapaUrl: this.aNulo(dto.mapaUrl),
        latitud: dto.latitud,
        longitud: dto.longitud,
        instagram: this.aNulo(dto.instagram),
        facebook: this.aNulo(dto.facebook),
      },
      select: CAMPOS_NEGOCIO,
    });

    // Qué campos se tocaron, nunca sus valores: el teléfono y el correo del
    // negocio no son secretos, pero la auditoría no es lugar para copiar datos.
    await this.auditoria.registrar({
      usuarioId,
      accion: 'LANDING_NEGOCIO_ACTUALIZADO',
      entidad: 'ConfiguracionAcademia',
      entidadId: '1',
      detalle: { campos: Object.keys(dto) },
    });
    return negocio;
  }

  /**
   * Las dos coordenadas o ninguna.
   *
   * La base lo obliga con un CHECK, pero un error de constraint le llega a quien
   * atiende como un texto en inglés con el nombre de la restricción adentro.
   * Acá se dice qué falta.
   *
   * Solo se mira cuando el pedido toca alguna de las dos: guardar el teléfono no
   * tiene por qué exigir que el local ya esté ubicado en el mapa.
   */
  private comprobarCoordenadas(dto: ActualizarNegocioDto) {
    const toca = dto.latitud !== undefined || dto.longitud !== undefined;
    if (!toca) return;

    const lat = dto.latitud ?? null;
    const lon = dto.longitud ?? null;
    if ((lat === null) !== (lon === null)) {
      throw new BadRequestException(
        'La ubicación en el mapa necesita latitud y longitud. Marcá el punto en el mapa o quitá las dos.',
      );
    }
  }

  /** `undefined` se ignora (no se tocó el campo); `''` borra el dato. */
  private aNulo(valor: string | null | undefined): string | null | undefined {
    if (valor === undefined) return undefined;
    if (valor === null) return null;
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }
}
