-- DropForeignKey
ALTER TABLE "pagamentos" DROP CONSTRAINT "pagamentos_agendamento_id_fkey";

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
