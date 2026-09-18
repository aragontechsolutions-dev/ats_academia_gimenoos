-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "monto_esperado" DECIMAL(12,2),
ADD COLUMN     "nota" TEXT,
ADD COLUMN     "servicio_id" UUID;

-- CreateIndex
CREATE INDEX "pagos_created_at_idx" ON "pagos"("created_at");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
