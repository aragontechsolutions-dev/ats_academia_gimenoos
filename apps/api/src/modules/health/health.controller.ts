import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../../common/auth/publico.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Publico()
  @ApiOperation({ summary: 'Estado de la API y de la conexion a la base de datos' })
  async verificar() {
    // No se exponen versiones ni datos de infraestructura: solo si responde.
    await this.prisma.$queryRaw`SELECT 1`;
    return { estado: 'ok', timestamp: new Date().toISOString() };
  }
}
