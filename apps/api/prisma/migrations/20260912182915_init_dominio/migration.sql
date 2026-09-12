-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'INSTRUCTOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('MOTO', 'AUTO');

-- CreateEnum
CREATE TYPE "CategoriaLicencia" AS ENUM ('A', 'G1', 'G2', 'G3');

-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('ACTIVO', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('CLASE_SUELTA', 'PACK', 'CURSO_COMPLETO', 'GESTORIA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA', 'AUSENTE');

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('BLOQUEO', 'DISPONIBILIDAD_EXTRA');

-- CreateEnum
CREATE TYPE "CanalPago" AS ENUM ('MP_ONLINE', 'MP_POINT', 'TRANSFERENCIA', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PENDIENTE_VERIFICACION', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "EstadoExpediente" AS ENUM ('INICIADO', 'DOCS_PENDIENTES', 'MEDICO_OK', 'CHARLA_OK', 'TEORICO_APROBADO', 'PRACTICO_APROBADO', 'EMITIDA', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CEDULA', 'CONSTANCIA_DOMICILIO', 'CARNE_SALUD', 'SOA', 'FOTO', 'AUTORIZACION_MENOR', 'LIBRE_MULTAS', 'OTRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "RolUsuario" NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "consentimiento_datos_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cedula" TEXT,
    "fecha_nacimiento" DATE,
    "direccion" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'San Carlos',
    "notas_internas" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructores" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "habilita_moto" BOOLEAN NOT NULL DEFAULT false,
    "habilita_auto" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "color_agenda" TEXT NOT NULL DEFAULT '#2563eb',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instructores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" UUID NOT NULL,
    "patente" TEXT NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "cilindrada" INTEGER,
    "anio" INTEGER,
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'ACTIVO',
    "soa_vence" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidad_plantillas" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "minuto_inicio" INTEGER NOT NULL,
    "minuto_fin" INTEGER NOT NULL,
    "vigente_desde" DATE,
    "vigente_hasta" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "disponibilidad_plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excepciones_disponibilidad" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excepciones_disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoServicio" NOT NULL,
    "tipo_vehiculo" "TipoVehiculo",
    "cantidad_clases" INTEGER NOT NULL DEFAULT 1,
    "duracion_min" INTEGER NOT NULL DEFAULT 45,
    "precio_contado" DECIMAL(12,2) NOT NULL,
    "precio_tarjeta" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_servicio" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "servicio_id" UUID NOT NULL,
    "clases_totales" INTEGER NOT NULL,
    "clases_usadas" INTEGER NOT NULL DEFAULT 0,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "vigente_hasta" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "compras_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "vehiculo_id" UUID,
    "compra_id" UUID,
    "tipo" "TipoVehiculo" NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fin" TIMESTAMPTZ(3) NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE',
    "lugar_encuentro" TEXT,
    "observaciones" TEXT,
    "cancelada_at" TIMESTAMPTZ(3),
    "motivo_cancelacion" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "compra_id" UUID,
    "reserva_id" UUID,
    "monto" DECIMAL(12,2) NOT NULL,
    "canal" "CanalPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "mp_payment_id" TEXT,
    "mp_order_id" TEXT,
    "external_ref" TEXT,
    "comprobante_path" TEXT,
    "verificado_por" UUID,
    "verificado_at" TIMESTAMPTZ(3),
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "categoria" "CategoriaLicencia" NOT NULL,
    "estado" "EstadoExpediente" NOT NULL DEFAULT 'INICIADO',
    "libre_multas" BOOLEAN NOT NULL DEFAULT false,
    "charla_fecha" TIMESTAMPTZ(3),
    "teorico_fecha" TIMESTAMPTZ(3),
    "teorico_aprobado" BOOLEAN,
    "practico_fecha" TIMESTAMPTZ(3),
    "practico_aprobado" BOOLEAN,
    "emitida_fecha" DATE,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_expediente" (
    "id" UUID NOT NULL,
    "expediente_id" UUID NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanio_bytes" INTEGER NOT NULL,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "verificado_por" UUID,
    "verificado_at" TIMESTAMPTZ(3),
    "vence_el" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_academia" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL DEFAULT 'Academia de Choferes Gimenoos',
    "direccion" TEXT NOT NULL DEFAULT 'San Carlos, Maldonado, Uruguay',
    "telefono" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "buffer_minutos" INTEGER NOT NULL DEFAULT 15,
    "antelacion_minima_horas" INTEGER NOT NULL DEFAULT 12,
    "cancelacion_minima_horas" INTEGER NOT NULL DEFAULT 24,
    "ventana_reserva_dias" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "configuracion_academia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_usuario_id_key" ON "clientes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cedula_key" ON "clientes"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "instructores_usuario_id_key" ON "instructores"("usuario_id");

-- CreateIndex
CREATE INDEX "instructores_activo_idx" ON "instructores"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_patente_key" ON "vehiculos"("patente");

-- CreateIndex
CREATE INDEX "vehiculos_tipo_estado_idx" ON "vehiculos"("tipo", "estado");

-- CreateIndex
CREATE INDEX "disponibilidad_plantillas_instructor_id_dia_semana_idx" ON "disponibilidad_plantillas"("instructor_id", "dia_semana");

-- CreateIndex
CREATE INDEX "excepciones_disponibilidad_instructor_id_inicio_idx" ON "excepciones_disponibilidad"("instructor_id", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_slug_key" ON "servicios"("slug");

-- CreateIndex
CREATE INDEX "servicios_activo_publico_orden_idx" ON "servicios"("activo", "publico", "orden");

-- CreateIndex
CREATE INDEX "compras_servicio_cliente_id_idx" ON "compras_servicio"("cliente_id");

-- CreateIndex
CREATE INDEX "reservas_inicio_estado_idx" ON "reservas"("inicio", "estado");

-- CreateIndex
CREATE INDEX "reservas_instructor_id_inicio_idx" ON "reservas"("instructor_id", "inicio");

-- CreateIndex
CREATE INDEX "reservas_vehiculo_id_inicio_idx" ON "reservas"("vehiculo_id", "inicio");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_inicio_idx" ON "reservas"("cliente_id", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mp_payment_id_key" ON "pagos"("mp_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mp_order_id_key" ON "pagos"("mp_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_external_ref_key" ON "pagos"("external_ref");

-- CreateIndex
CREATE INDEX "pagos_estado_canal_idx" ON "pagos"("estado", "canal");

-- CreateIndex
CREATE INDEX "pagos_cliente_id_created_at_idx" ON "pagos"("cliente_id", "created_at");

-- CreateIndex
CREATE INDEX "expedientes_estado_idx" ON "expedientes"("estado");

-- CreateIndex
CREATE INDEX "expedientes_cliente_id_idx" ON "expedientes"("cliente_id");

-- CreateIndex
CREATE INDEX "documentos_expediente_expediente_id_tipo_idx" ON "documentos_expediente"("expediente_id", "tipo");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidad_entidad_id_idx" ON "registros_auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "registros_auditoria_created_at_idx" ON "registros_auditoria"("created_at");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructores" ADD CONSTRAINT "instructores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad_plantillas" ADD CONSTRAINT "disponibilidad_plantillas_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepciones_disponibilidad" ADD CONSTRAINT "excepciones_disponibilidad_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_servicio" ADD CONSTRAINT "compras_servicio_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_servicio" ADD CONSTRAINT "compras_servicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras_servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_expediente" ADD CONSTRAINT "documentos_expediente_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
