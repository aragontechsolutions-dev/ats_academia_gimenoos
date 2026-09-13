-- AlterTable
ALTER TABLE "configuracion_academia" ADD COLUMN     "ciudad" TEXT NOT NULL DEFAULT 'San Carlos',
ADD COLUMN     "departamento" TEXT NOT NULL DEFAULT 'Maldonado',
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "horarios" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "mapa_url" TEXT;

-- CreateTable
CREATE TABLE "secciones_landing" (
    "clave" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "titulo" TEXT,
    "bajada" TEXT,
    "etiqueta" TEXT,
    "accion" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "actualizado_por" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "secciones_landing_pkey" PRIMARY KEY ("clave")
);
