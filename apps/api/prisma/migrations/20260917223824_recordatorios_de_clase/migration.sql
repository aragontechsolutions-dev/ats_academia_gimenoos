-- CreateEnum
CREATE TYPE "TipoRecordatorio" AS ENUM ('VEINTICUATRO_HORAS', 'DOS_HORAS');

-- CreateEnum
CREATE TYPE "CanalRecordatorio" AS ENUM ('TELEGRAM', 'PUSH', 'CORREO');

-- CreateTable
CREATE TABLE "recordatorios_enviados" (
    "id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "tipo" "TipoRecordatorio" NOT NULL,
    "canal" "CanalRecordatorio" NOT NULL,
    "entregado" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordatorios_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recordatorios_enviados_created_at_idx" ON "recordatorios_enviados"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "recordatorios_enviados_reserva_id_tipo_canal_key" ON "recordatorios_enviados"("reserva_id", "tipo", "canal");

-- AddForeignKey
ALTER TABLE "recordatorios_enviados" ADD CONSTRAINT "recordatorios_enviados_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
