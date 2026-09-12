import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'es_publico';

/**
 * Marca un endpoint como accesible sin autenticacion.
 * El guard de autenticacion es global: sin este decorador, todo requiere token.
 */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
