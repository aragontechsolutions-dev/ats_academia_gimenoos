import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validarEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditoriaModule } from './common/auditoria/auditoria.module';
import { AuthModule } from './common/auth/auth.module';
import { SupabaseAuthGuard } from './common/auth/supabase-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { SupabaseModule } from './common/supabase/supabase.module';
import { TelegramModule } from './common/telegram/telegram.module';
import { PushModule } from './common/push/push.module';

import { HealthModule } from './modules/health/health.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { AvisosModule } from './modules/avisos/avisos.module';
import { RecordatoriosModule } from './modules/recordatorios/recordatorios.module';
import { PushApiModule } from './modules/push/push-api.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { InstructoresModule } from './modules/instructores/instructores.module';
import { VehiculosModule } from './modules/vehiculos/vehiculos.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { LandingModule } from './modules/landing/landing.module';
import { GraduadosModule } from './modules/graduados/graduados.module';
import { InvitacionesModule } from './modules/invitaciones/invitaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Sin este validador la API podria arrancar sin credenciales y fallar en runtime.
      validate: validarEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('THROTTLE_TTL_SEGUNDOS') * 1000,
          limit: config.getOrThrow<number>('THROTTLE_LIMITE'),
        },
      ],
    }),
    PrismaModule,
    AuditoriaModule,
    SupabaseModule,
    TelegramModule,
    PushModule,
    AuthModule,
    HealthModule,
    UsuariosModule,
    CatalogoModule,
    ConfiguracionModule,
    AvisosModule,
    RecordatoriosModule,
    PushApiModule,
    AgendaModule,
    InstructoresModule,
    VehiculosModule,
    ClientesModule,
    LandingModule,
    GraduadosModule,
    InvitacionesModule,
  ],
  providers: [
    // El orden importa: primero se limita la tasa, luego se autentica, luego se autoriza.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
