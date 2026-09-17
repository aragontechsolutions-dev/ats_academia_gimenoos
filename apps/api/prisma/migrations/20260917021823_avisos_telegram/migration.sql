-- CreateTable
CREATE TABLE "avisos_telegram" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "chat_id" TEXT,
    "chat_nombre" TEXT,
    "avisa_reserva_nueva" BOOLEAN NOT NULL DEFAULT true,
    "avisa_clase_cerrada" BOOLEAN NOT NULL DEFAULT true,
    "avisa_clase_cancelada" BOOLEAN NOT NULL DEFAULT true,
    "avisa_clic_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_envio_at" TIMESTAMPTZ(3),
    "ultimo_error_at" TIMESTAMPTZ(3),
    "ultimo_error" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "avisos_telegram_pkey" PRIMARY KEY ("id")
);
