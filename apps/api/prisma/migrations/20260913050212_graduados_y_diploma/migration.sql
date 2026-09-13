-- CreateTable
CREATE TABLE "graduados" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "categoria" "CategoriaLicencia" NOT NULL,
    "fecha_egreso" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "autorizacion_at" TIMESTAMPTZ(3),
    "autorizacion_firmante" TEXT,
    "autorizacion_es_tutor" BOOLEAN NOT NULL DEFAULT false,
    "foto_ruta" TEXT,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "creado_por" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "graduados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graduados_codigo_key" ON "graduados"("codigo");

-- CreateIndex
CREATE INDEX "graduados_publicado_anio_fecha_egreso_idx" ON "graduados"("publicado", "anio", "fecha_egreso");

-- CreateIndex
CREATE INDEX "graduados_cliente_id_idx" ON "graduados"("cliente_id");

-- AddForeignKey
ALTER TABLE "graduados" ADD CONSTRAINT "graduados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
