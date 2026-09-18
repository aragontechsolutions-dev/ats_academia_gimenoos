-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "recibe_avisos_por_correo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "token_baja" UUID NOT NULL DEFAULT gen_random_uuid();
