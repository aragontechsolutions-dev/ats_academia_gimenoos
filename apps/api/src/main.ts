import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';
import { erroresDeValidacionEnEspanol } from './common/validacion/mensajes-de-validacion';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const entorno = config.getOrThrow<string>('NODE_ENV');

  app.setGlobalPrefix(API_PREFIX);

  // --- Cabeceras de seguridad ------------------------------------------------
  //
  // La API devuelve JSON y nada más, así que puede declarar que NO carga ningún
  // recurso de ningún lado. Es la política más restrictiva que existe y acá no
  // cuesta nada, porque no hay nada que permitir.
  //
  // Antes iba sin CSP, con el razonamiento de que una API no sirve HTML. Es
  // cierto hoy, pero no protege de mañana: alcanza con que un endpoint devuelva
  // HTML alguna vez —una página de error, una redirección— para que la falta se
  // note. Una cabecera que dice «nada» no puede quedar desactualizada.
  const cabecerasEstrictas = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        // Que nadie pueda incrustar las respuestas en un iframe de otro sitio.
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  // La documentación interactiva SÍ es HTML y carga sus propios scripts y
  // estilos: con la política de arriba quedaría en blanco. Solo existe fuera de
  // producción (ver más abajo), así que la excepción no llega al servidor real.
  const cabecerasDeLaDocumentacion = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  const rutaDocs = `/${API_PREFIX}/docs`;
  app.use((peticion: { path?: string; url: string }, respuesta: unknown, siguiente: unknown) => {
    const camino = peticion.path ?? peticion.url;
    const middleware = camino.startsWith(rutaDocs) ? cabecerasDeLaDocumentacion : cabecerasEstrictas;
    return (middleware as (a: unknown, b: unknown, c: unknown) => void)(
      peticion,
      respuesta,
      siguiente,
    );
  });

  // CORS con lista blanca explicita: nunca origin '*' junto a credenciales.
  //
  // Solo se parte por coma: los espacios, las entradas vacias y las barras
  // finales ya los limpia `envSchema`. Un origen con barra final nunca coincide
  // con el encabezado `Origin` del navegador, y esa limpieza vive en un solo
  // lugar para que no haya dos reglas distintas segun quien lea la variable.
  const origenes = config.getOrThrow<string>('CORS_ORIGINS').split(',');
  app.enableCors({
    origin: origenes,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist + forbidNonWhitelisted evitan mass assignment: cualquier campo
      // no declarado en el DTO hace fallar la peticion en vez de colarse al ORM.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Los mensajes de class-validator salen en ingles. Los lee quien
      // administra la academia, asi que se traducen en un solo lugar.
      exceptionFactory: erroresDeValidacionEnEspanol,
    }),
  );

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  // La documentacion interactiva no se publica en produccion.
  if (entorno !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('API Academia Gimenoos')
        .setDescription('API del sistema de gestion de la Academia de Choferes Gimenoos')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, documento);
    logger.log(`Documentacion disponible en /${API_PREFIX}/docs`);
  }

  const puerto = config.getOrThrow<number>('PORT');
  await app.listen(puerto);
  logger.log(`API escuchando en http://localhost:${puerto}/${API_PREFIX} (entorno: ${entorno})`);
}

void bootstrap();
