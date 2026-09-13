/**
 * Se carga antes de cada archivo de pruebas.
 *
 * `reflect-metadata` es lo que hace funcionar los decoradores de class-validator
 * y class-transformer. Las pruebas que importan algo de NestJS lo cargan de
 * rebote, pero una que solo importe un DTO y lo valide falla con
 * "Reflect.getMetadata is not a function". Cargarlo acá quita esa dependencia
 * del orden de los imports.
 */
import 'reflect-metadata';
