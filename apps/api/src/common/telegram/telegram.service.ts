import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Cuánto se espera a Telegram antes de cortar.
 *
 * Corto a propósito, al revés que el envío de correo. Un aviso es un extra: lo
 * que no puede pasar es que reservar una clase tarde diez segundos porque
 * Telegram está lento. Si no llega en cinco, no llega.
 */
const ESPERA_MAXIMA_MS = 5_000;

/** Los avisos que el panel puede prender y apagar por separado. */
export type ClaseDeAviso =
  | 'reservaNueva'
  | 'claseCerrada'
  | 'claseCancelada'
  | 'clicWhatsapp'
  | 'recordatorio';

/** Qué columna manda sobre cada aviso. */
const INTERRUPTOR = {
  reservaNueva: 'avisaReservaNueva',
  claseCerrada: 'avisaClaseCerrada',
  claseCancelada: 'avisaClaseCancelada',
  clicWhatsapp: 'avisaClicWhatsapp',
  recordatorio: 'avisaRecordatorios',
} as const satisfies Record<ClaseDeAviso, string>;

/**
 * Cómo terminó un aviso.
 *
 * `avisar()` no lanza nunca, pero quien manda recordatorios necesita distinguir
 * tres finales distintos: salió, no correspondía mandarlo, o se intentó y
 * falló. Los que solo avisan y siguen pueden ignorar esto.
 */
export type ResultadoDeAviso =
  | { estado: 'enviado' }
  /** No hay bot, no hay conversación elegida, o ese aviso está apagado. */
  | { estado: 'omitido' }
  | { estado: 'fallo'; motivo: string };

/** Una conversación que le habló al bot, como la muestra el panel. */
export interface ChatDisponible {
  id: string;
  nombre: string;
  /** `privado` es una persona; `grupo` es un grupo o un canal. */
  tipo: 'privado' | 'grupo';
}

/**
 * Escapa lo que Telegram interpretaría como marcado.
 *
 * Los avisos se mandan en modo HTML para poder poner algo en negrita, y adentro
 * viajan datos que escribieron personas: el nombre de un alumno, el motivo de
 * una cancelación. Un apellido con un `<` rompería el mensaje entero y Telegram
 * lo rechazaría con un 400; algo armado a propósito podría meter un enlace.
 *
 * Son los tres caracteres que la documentación de Telegram pide escapar, y el
 * `&` va primero para no escapar dos veces lo que acaba de escaparse.
 */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Los avisos por Telegram.
 *
 * Está partido en dos mitades a propósito:
 *
 * - El **token** es una credencial y vive en la variable de entorno. No entra a
 *   la base, así que no viaja en los respaldos.
 * - El **destino y los interruptores** viven en la base, porque cambian con el
 *   tiempo y los maneja quien administra, desde el panel, sin desplegar nada.
 *
 * La regla que ordena todo lo demás: **un aviso nunca puede romper la operación
 * que lo disparó**. Si Telegram está caído, la clase igual se agenda. Por eso
 * `avisar()` no devuelve error ni lo propaga: lo registra y sigue.
 */
@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** El token, o null si todavía no se configuró el bot. */
  private get token(): string | null {
    const valor = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    return valor && valor.length > 0 ? valor : null;
  }

  /** Si hay bot. Lo usa el panel para explicar qué falta. */
  get configurado(): boolean {
    return this.token !== null;
  }

  /**
   * Manda un aviso. No falla nunca hacia afuera.
   *
   * Se llama sin `await` desde donde ocurre el hecho: la reserva ya se guardó y
   * el aviso es posterior. Devuelve cómo terminó para quien lo necesite —los
   * recordatorios—, y quien solo avisa y sigue puede ignorarlo.
   */
  async avisar(clase: ClaseDeAviso, texto: string): Promise<ResultadoDeAviso> {
    try {
      const destino = await this.destinoPara(clase);
      if (!destino) return { estado: 'omitido' };
      await this.mandar(destino, texto);
      await this.anotarEnvio();
      return { estado: 'enviado' };
    } catch (problema) {
      const motivo = problema instanceof Error ? problema.message : String(problema);
      // A nivel warn y no error: que Telegram falle no es una falla del sistema,
      // y ensuciar el registro de errores con esto esconde los que sí importan.
      this.log.warn(`No se pudo avisar por Telegram (${clase}): ${motivo}`);
      await this.anotarError(motivo).catch(() => undefined);
      return { estado: 'fallo', motivo };
    }
  }

  /**
   * A qué chat mandar este aviso, o null si no corresponde mandarlo.
   *
   * Tres cosas tienen que estar: el bot creado, un chat elegido y el interruptor
   * de ESE aviso en encendido.
   */
  private async destinoPara(clase: ClaseDeAviso): Promise<string | null> {
    if (!this.token) return null;

    const ajustes = await this.prisma.avisosTelegram.findUnique({ where: { id: 1 } });
    if (!ajustes?.chatId) return null;
    if (!ajustes[INTERRUPTOR[clase]]) return null;

    return ajustes.chatId;
  }

  /**
   * Manda un mensaje de prueba y devuelve cómo salió.
   *
   * Es el botón «probar» del panel, y por eso este sí propaga el error: quien lo
   * apretó está esperando la respuesta y necesita el motivo.
   */
  async probar(chatId: string): Promise<void> {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'Todavía no hay bot configurado. Falta cargar TELEGRAM_BOT_TOKEN en el servidor.',
      );
    }

    try {
      await this.mandar(
        chatId,
        '<b>Prueba desde el panel</b>\nSi estás leyendo esto, los avisos de la academia van a llegar acá.',
      );
      await this.anotarEnvio();
    } catch (problema) {
      const motivo = problema instanceof Error ? problema.message : String(problema);
      await this.anotarError(motivo).catch(() => undefined);
      throw new ServiceUnavailableException(`Telegram no aceptó el mensaje: ${motivo}`);
    }
  }

  /**
   * Las conversaciones que le hablaron al bot.
   *
   * Existe porque el identificador de un chat es un número que no se ve en
   * ningún lado de la aplicación de Telegram. Sin esto hay que ir a buscarlo con
   * otro bot o leyendo la respuesta cruda de la API, que es justo donde la gente
   * abandona.
   *
   * Telegram sólo devuelve lo de las últimas 24 horas, así que quien va a
   * recibir los avisos tiene que apretar «Start» (o escribir algo en el grupo)
   * poco antes de tocar el botón del panel. Eso no es un detalle nuestro: un bot
   * no puede escribirle primero a nadie, y esa conversación inicial es lo que lo
   * habilita.
   */
  async chatsDisponibles(): Promise<ChatDisponible[]> {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'Todavía no hay bot configurado. Falta cargar TELEGRAM_BOT_TOKEN en el servidor.',
      );
    }

    const datos = await this.llamar<TelegramUpdate[]>('getUpdates', { limit: 100 });

    // Un mapa y no una lista: si alguien escribió cinco veces, es un solo chat.
    const encontrados = new Map<string, ChatDisponible>();
    for (const novedad of datos) {
      const chat = novedad.message?.chat ?? novedad.channel_post?.chat;
      if (!chat) continue;

      const nombre =
        chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ') ?? chat.username;

      encontrados.set(String(chat.id), {
        id: String(chat.id),
        nombre: nombre && nombre.length > 0 ? nombre : `Chat ${chat.id}`,
        tipo: chat.type === 'private' ? 'privado' : 'grupo',
      });
    }

    return [...encontrados.values()];
  }

  private async mandar(chatId: string, texto: string): Promise<void> {
    await this.llamar('sendMessage', {
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      // Sin vista previa: un aviso que menciona una dirección no tiene por qué
      // desplegar media pantalla de imagen en el teléfono de quien atiende.
      disable_web_page_preview: true,
    });
  }

  /** Una llamada a la API de Telegram, con el error ya traducido a algo legible. */
  private async llamar<T>(metodo: string, cuerpo: Record<string, unknown>): Promise<T> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`https://api.telegram.org/bot${this.token}/${metodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
    } catch (problema) {
      const agotado = problema instanceof Error && problema.name === 'TimeoutError';
      throw new Error(
        agotado
          ? `no contestó en ${ESPERA_MAXIMA_MS / 1000} segundos`
          : `no se pudo conectar (${problema instanceof Error ? problema.message : 'error desconocido'})`,
      );
    }

    const datos = (await respuesta.json().catch(() => null)) as RespuestaTelegram<T> | null;

    if (!datos?.ok) {
      // `description` es lo único que Telegram manda pensado para leerse, y es
      // bastante preciso: "chat not found", "bot was blocked by the user".
      throw new Error(datos?.description ?? `respondió ${respuesta.status}`);
    }

    return datos.result;
  }

  /**
   * Deja anotado el último envío o el último fallo.
   *
   * `upsert` y no `update`: la fila puede no existir todavía la primera vez.
   */
  private async anotarEnvio(): Promise<void> {
    const ahora = new Date();
    await this.prisma.avisosTelegram.upsert({
      where: { id: 1 },
      create: { id: 1, ultimoEnvioAt: ahora },
      // El último error se limpia al salir uno bien: si ya anda, el fallo de
      // ayer sólo confunde a quien mira la pantalla hoy.
      update: { ultimoEnvioAt: ahora, ultimoError: null, ultimoErrorAt: null },
    });
  }

  private async anotarError(motivo: string): Promise<void> {
    const ahora = new Date();
    // Se recorta: el motivo lo escribe Telegram y lo lee una persona en una
    // pantalla, no hace falta guardar un párrafo.
    const texto = motivo.slice(0, 500);
    await this.prisma.avisosTelegram.upsert({
      where: { id: 1 },
      create: { id: 1, ultimoErrorAt: ahora, ultimoError: texto },
      update: { ultimoErrorAt: ahora, ultimoError: texto },
    });
  }
}

/** Lo que contesta la API de Telegram, en todos sus métodos. */
interface RespuestaTelegram<T> {
  ok: boolean;
  result: T;
  description?: string;
}

/** Sólo la parte de una novedad que se usa para listar conversaciones. */
interface TelegramUpdate {
  message?: { chat: TelegramChat };
  channel_post?: { chat: TelegramChat };
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}
