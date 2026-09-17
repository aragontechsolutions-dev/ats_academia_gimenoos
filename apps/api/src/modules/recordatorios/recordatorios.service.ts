import { Injectable, Logger } from '@nestjs/common';
import {
  CanalRecordatorio,
  EstadoReserva,
  Prisma,
  TipoRecordatorio,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { PushService } from '../../common/push/push.service';
import { ANTELACION_HORAS, correspondeMandar } from './reglas';
import { recordatorioParaElAlumno, recordatorioParaLaAcademia } from './mensajes';

/** Qué pasó en una pasada. Es lo que devuelve el endpoint y lo que se registra. */
export interface ResumenDeLaPasada {
  /** Clases que se miraron. */
  revisadas: number;
  /** Recordatorios que salieron. */
  enviados: number;
  /** Los que ya se habían mandado antes: la carrera que evita la clave única. */
  repetidos: number;
  /** Los que no correspondía mandar: sin bot, sin destino, o el aviso apagado. */
  omitidos: number;
  /** Los que se intentaron y fallaron. */
  fallidos: number;
}

/** Los datos de la clase que hacen falta para decidir y para redactar. */
const SELECCION = {
  id: true,
  inicio: true,
  tipo: true,
  createdAt: true,
  // `usuarioId` para saber a qué teléfono mandarle el aviso. Un alumno sin
  // cuenta —la ficha existe pero nunca fue invitado— lo tiene en null, y
  // simplemente no recibe push.
  cliente: { select: { nombre: true, apellido: true, telefono: true, usuarioId: true } },
  instructor: { select: { nombre: true, apellido: true } },
} satisfies Prisma.ReservaSelect;

/**
 * Los recordatorios de clase.
 *
 * Se dispara desde afuera —ver `recordatorios.controller.ts`— y no con un
 * temporizador interno. El motivo está explicado ahí, y es concreto: en el plan
 * gratuito de Render el servicio se duerme, y un temporizador dormido no
 * dispara nada. Fallaría en silencio, que para un recordatorio es la peor forma
 * de fallar.
 *
 * Por eso esta clase no guarda estado entre pasadas: cada llamada mira la base,
 * decide y actúa. Dos llamadas seguidas no hacen daño.
 */
@Injectable()
export class RecordatoriosService {
  private readonly log = new Logger(RecordatoriosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly push: PushService,
  ) {}

  /**
   * Mira qué clases tienen un recordatorio pendiente y lo manda.
   *
   * `ahora` se puede pasar para probar: todas las decisiones dependen de ese
   * valor y de ninguna otra lectura del reloj.
   */
  async procesar(ahora: Date = new Date()): Promise<ResumenDeLaPasada> {
    const resumen: ResumenDeLaPasada = {
      revisadas: 0,
      enviados: 0,
      repetidos: 0,
      omitidos: 0,
      fallidos: 0,
    };

    // Se trae una sola vez el rango más amplio que puede necesitar cualquier
    // recordatorio, y después se filtra en memoria. Son las clases de las
    // próximas 24 horas: nunca van a ser muchas.
    const masLejos = Math.max(...Object.values(ANTELACION_HORAS));
    const clases = await this.prisma.reserva.findMany({
      where: {
        // Una clase cancelada, dictada o con ausencia no se recuerda.
        estado: { in: [EstadoReserva.PENDIENTE, EstadoReserva.CONFIRMADA] },
        inicio: {
          gt: ahora,
          lte: new Date(ahora.getTime() + masLejos * 60 * 60 * 1000),
        },
      },
      select: SELECCION,
      orderBy: { inicio: 'asc' },
    });

    resumen.revisadas = clases.length;

    for (const clase of clases) {
      for (const tipo of Object.values(TipoRecordatorio)) {
        if (!correspondeMandar(clase, tipo, ahora)) continue;
        // Los dos canales son independientes: que el alumno no tenga la app
        // instalada no puede dejar a la academia sin su aviso, ni al revés.
        await this.mandarALaAcademia(clase, tipo, ahora, resumen);
        await this.mandarAlAlumno(clase, tipo, ahora, resumen);
      }
    }

    if (resumen.enviados > 0 || resumen.fallidos > 0) {
      this.log.log(
        `Recordatorios: ${resumen.enviados} enviados, ${resumen.fallidos} fallidos, ` +
          `${resumen.repetidos} ya estaban, sobre ${resumen.revisadas} clases`,
      );
    }

    return resumen;
  }

  /**
   * Manda un recordatorio y lo deja anotado.
   *
   * El orden importa y es a propósito: **primero se reserva el lugar en la base
   * y después se manda**. Al revés, dos pasadas simultáneas mandarían las dos
   * antes de que ninguna alcanzara a anotarlo. Así, la segunda choca contra la
   * clave única y se detiene sin haber mandado nada.
   *
   * El costo de este orden es que un aviso que falle queda anotado igual, y no
   * se reintenta. Es lo correcto para un recordatorio: reintentarlo cada quince
   * minutos hasta que la clase empiece sería peor que perderlo, y el motivo del
   * fallo queda guardado para poder mirarlo.
   *
   * La excepción es el aviso que **no correspondía mandar** —todavía no hay bot,
   * o el interruptor está apagado—: ahí la anotación se borra. Si se dejara,
   * configurar el bot hoy dejaría sin recordatorio a las clases de mañana, que
   * ya habrían quedado marcadas como avisadas sin que nadie recibiera nada.
   */
  private mandarALaAcademia(
    clase: Clase,
    tipo: TipoRecordatorio,
    ahora: Date,
    resumen: ResumenDeLaPasada,
  ): Promise<void> {
    return this.porUnCanal(clase, tipo, CanalRecordatorio.TELEGRAM, resumen, () =>
      this.telegram.avisar('recordatorio', recordatorioParaLaAcademia(clase, tipo, ahora)),
    );
  }

  private async mandarAlAlumno(
    clase: Clase,
    tipo: TipoRecordatorio,
    ahora: Date,
    resumen: ResumenDeLaPasada,
  ): Promise<void> {
    // Una ficha sin cuenta no tiene a dónde recibir. No es un fallo ni algo que
    // anotar: es un alumno al que todavía nadie invitó a usar la app.
    const usuarioId = clase.cliente.usuarioId;
    if (!usuarioId) return;

    await this.porUnCanal(clase, tipo, CanalRecordatorio.PUSH, resumen, async () => {
      const resultado = await this.push.avisar(
        usuarioId,
        recordatorioParaElAlumno(clase, tipo, ahora),
      );
      // `enviado` trae además a cuántos dispositivos llegó; acá sólo importa si
      // llegó o no.
      return resultado.estado === 'enviado' ? { estado: 'enviado' as const } : resultado;
    });
  }

  /**
   * El ciclo que comparten todos los canales: reservar el lugar, mandar, anotar.
   *
   * Está factorizado porque la parte delicada —el orden de las escrituras— tiene
   * que ser idéntica en los tres canales. Duplicarla sería tener tres lugares
   * donde equivocarse con lo mismo.
   */
  private async porUnCanal(
    clase: Clase,
    tipo: TipoRecordatorio,
    canal: CanalRecordatorio,
    resumen: ResumenDeLaPasada,
    mandar: () => Promise<ResultadoDeEnvio>,
  ): Promise<void> {
    try {
      await this.prisma.recordatorioEnviado.create({
        data: { reservaId: clase.id, tipo, canal },
      });
    } catch (problema) {
      // P2002 es la clave única: este recordatorio ya se mandó. No es un error.
      if (problema instanceof Prisma.PrismaClientKnownRequestError && problema.code === 'P2002') {
        resumen.repetidos++;
        return;
      }
      throw problema;
    }

    const donde = { reservaId_tipo_canal: { reservaId: clase.id, tipo, canal } };
    const resultado = await mandar();

    if (resultado.estado === 'enviado') {
      resumen.enviados++;
      return;
    }

    if (resultado.estado === 'omitido') {
      resumen.omitidos++;
      await this.prisma.recordatorioEnviado.delete({ where: donde });
      return;
    }

    resumen.fallidos++;
    await this.prisma.recordatorioEnviado.update({
      where: donde,
      data: { entregado: false, error: resultado.motivo.slice(0, 500) },
    });
  }
}

/** La clase, con los campos que trae `SELECCION`. */
type Clase = Prisma.ReservaGetPayload<{ select: typeof SELECCION }>;

/** Lo que cualquier canal tiene que contestar. */
type ResultadoDeEnvio =
  | { estado: 'enviado' }
  | { estado: 'omitido' }
  | { estado: 'fallo'; motivo: string };
