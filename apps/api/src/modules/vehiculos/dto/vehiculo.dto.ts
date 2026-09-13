import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min,
} from 'class-validator';
import { EstadoVehiculo, TipoVehiculo } from '@prisma/client';
import { ConsultaPaginadaDto } from '../../../common/paginacion/paginacion';
import { EsRutaDeFoto } from '../../../common/formato/foto';

export class CrearVehiculoDto {
  /** Matrícula uruguaya, sin espacios ni guiones. Se normaliza a mayúsculas. */
  @IsString()
  @Matches(/^[A-Za-z0-9]{6,10}$/, {
    message: 'La patente debe tener entre 6 y 10 caracteres alfanuméricos, sin espacios',
  })
  patente!: string;

  @IsEnum(TipoVehiculo)
  tipo!: TipoVehiculo;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  marca?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  modelo?: string;

  /** Cilindrada en cc. Define para qué categoría de libreta sirve la moto. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3000)
  cilindrada?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  anio?: number;

  /** Vencimiento del SOA: la Intendencia lo exige vigente para el examen práctico. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  soaVence?: Date;

}

export class ActualizarVehiculoDto extends CrearVehiculoDto {
  @IsOptional()
  @IsEnum(EstadoVehiculo)
  estado?: EstadoVehiculo;
}

/**
 * Foto del vehículo. Tiene su propio endpoint y no viaja con el resto de los
 * datos a propósito.
 *
 * `PATCH /vehiculos/:id` reemplaza la ficha entera: los campos que no vienen se
 * guardan en null. Si la foto se mandara por ahí, subirla desde el listado
 * —donde no está el formulario— borraría la marca, el modelo y el SOA del
 * vehículo. Con un endpoint aparte eso no puede pasar.
 *
 * Mandar `''` quita la foto.
 */
export class FotoVehiculoDto {
  @EsRutaDeFoto('del vehículo')
  fotoRuta?: string | null;
}

/**
 * Parámetros del listado de vehículos.
 *
 * Declara todos los que acepta el endpoint: `@Query()` valida el objeto entero
 * contra este DTO y cualquiera que falte devuelve 400.
 */
export class ListarVehiculosDto extends ConsultaPaginadaDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluirInactivos?: boolean;
}
