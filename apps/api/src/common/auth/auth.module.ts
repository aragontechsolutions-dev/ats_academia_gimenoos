import { Global, Module } from '@nestjs/common';
import { SupabaseJwtService } from './supabase-jwt.service';
import { UsuariosModule } from '../../modules/usuarios/usuarios.module';

@Global()
@Module({
  imports: [UsuariosModule],
  providers: [SupabaseJwtService],
  exports: [SupabaseJwtService, UsuariosModule],
})
export class AuthModule {}
