/**
 * Datos iniciales de desarrollo.
 *
 * ATENCION: todos los valores marcados con TODO son PLACEHOLDERS inventados para
 * poder desarrollar. NO son datos reales de la academia. Antes de usar el sistema
 * en produccion hay que reemplazarlos por los datos reales de Gimenoos
 * (precios, instructores, vehiculos, telefono, direccion).
 *
 * El seed es idempotente: se puede correr varias veces sin duplicar registros.
 */
import { PrismaClient, TipoServicio, TipoVehiculo } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // --- Configuracion general (fila unica) ----------------------------------
  await prisma.configuracionAcademia.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombre: 'Academia de Choferes Gimenoos',
      // TODO(datos-reales): direccion exacta del local en San Carlos.
      direccion: 'San Carlos, Maldonado, Uruguay',
      // TODO(datos-reales): telefono y WhatsApp reales de la academia.
      telefono: null,
      whatsapp: null,
      email: null,
      bufferMinutos: 15,
      antelacionMinimaHoras: 12,
      cancelacionMinimaHoras: 24,
      ventanaReservaDias: 30,
    },
  });

  // --- Catalogo de servicios -----------------------------------------------
  // TODO(datos-reales): precios en pesos uruguayos definidos por la academia.
  // Los importes de abajo son 0 a proposito para que nadie los confunda con
  // precios reales: se cargan desde el panel o editando este seed.
  const servicios = [
    {
      slug: 'clase-suelta-auto',
      nombre: 'Clase suelta de auto',
      descripcion: 'Clase practica individual de manejo de automovil.',
      tipo: TipoServicio.CLASE_SUELTA,
      tipoVehiculo: TipoVehiculo.AUTO,
      cantidadClases: 1,
      duracionMin: 45,
      orden: 10,
    },
    {
      slug: 'pack-10-auto',
      nombre: 'Pack 10 clases de auto',
      descripcion: 'Diez clases practicas de automovil.',
      tipo: TipoServicio.PACK,
      tipoVehiculo: TipoVehiculo.AUTO,
      cantidadClases: 10,
      duracionMin: 45,
      orden: 20,
    },
    {
      slug: 'clase-suelta-moto',
      nombre: 'Clase suelta de moto',
      descripcion: 'Clase practica individual de manejo de motocicleta.',
      tipo: TipoServicio.CLASE_SUELTA,
      tipoVehiculo: TipoVehiculo.MOTO,
      cantidadClases: 1,
      duracionMin: 45,
      orden: 30,
    },
    {
      slug: 'pack-10-moto',
      nombre: 'Pack 10 clases de moto',
      descripcion: 'Diez clases practicas de motocicleta.',
      tipo: TipoServicio.PACK,
      tipoVehiculo: TipoVehiculo.MOTO,
      cantidadClases: 10,
      duracionMin: 45,
      orden: 40,
    },
    {
      slug: 'gestoria-libreta',
      nombre: 'Gestoria de libreta ante la Intendencia',
      descripcion:
        'Acompaniamiento del tramite del Permiso Unico Nacional de Conducir ante la Intendencia de Maldonado.',
      tipo: TipoServicio.GESTORIA,
      tipoVehiculo: null,
      cantidadClases: 0,
      duracionMin: 0,
      orden: 50,
    },
  ];

  for (const servicio of servicios) {
    await prisma.servicio.upsert({
      where: { slug: servicio.slug },
      update: {},
      create: { ...servicio, precioContado: 0, precioTarjeta: 0 },
    });
  }

  // --- Instructores y vehiculos de ejemplo (solo desarrollo) ---------------
  // TODO(datos-reales): reemplazar por los instructores y vehiculos de Gimenoos.
  if (process.env.NODE_ENV !== 'production') {
    await prisma.instructor.upsert({
      where: { id: '00000000-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-4000-8000-000000000001',
        nombre: 'Instructor',
        apellido: 'Ejemplo',
        habilitaAuto: true,
        habilitaMoto: true,
        colorAgenda: '#2563eb',
      },
    });

    await prisma.vehiculo.upsert({
      where: { patente: 'DEV0001' },
      update: {},
      create: { patente: 'DEV0001', tipo: TipoVehiculo.AUTO, marca: 'Ejemplo', modelo: 'Demo' },
    });

    await prisma.vehiculo.upsert({
      where: { patente: 'DEV0002' },
      update: {},
      create: {
        patente: 'DEV0002',
        tipo: TipoVehiculo.MOTO,
        marca: 'Ejemplo',
        modelo: 'Demo',
        cilindrada: 125,
      },
    });
  }

  console.log('Seed completado. Recorda reemplazar los valores marcados con TODO(datos-reales).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
