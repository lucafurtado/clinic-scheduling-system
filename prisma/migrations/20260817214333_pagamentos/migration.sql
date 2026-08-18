-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('PENDENTE_PAGAMENTO', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "status" "StatusAgendamento" NOT NULL DEFAULT 'PENDENTE_PAGAMENTO';

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" SERIAL NOT NULL,
    "agendamento_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "stripe_session_id" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_agendamento_id_key" ON "pagamentos"("agendamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_stripe_session_id_key" ON "pagamentos"("stripe_session_id");

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
