-- CreateTable
CREATE TABLE "suscripciones_push" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "dispositivo" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_envio_at" TIMESTAMPTZ(3),

    CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_push_endpoint_key" ON "suscripciones_push"("endpoint");

-- CreateIndex
CREATE INDEX "suscripciones_push_usuario_id_idx" ON "suscripciones_push"("usuario_id");

-- AddForeignKey
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
