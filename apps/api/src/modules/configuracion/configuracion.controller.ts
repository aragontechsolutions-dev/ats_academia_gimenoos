import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../../common/auth/publico.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('publica')
  @Publico()
  @ApiOperation({ summary: 'Datos de contacto y politicas que consume la landing' })
  async obtenerPublica() {
    const config = await this.prisma.configuracionAcademia.findUnique({
      where: { id: 1 },
      select: {
        nombre: true,
        direccion: true,
        telefono: true,
        whatsapp: true,
        email: true,
        antelacionMinimaHoras: true,
        cancelacionMinimaHoras: true,
      },
    });

    if (!config) {
      throw new NotFoundException('La configuracion de la academia todavia no fue inicializada');
    }
    return config;
  }
}
