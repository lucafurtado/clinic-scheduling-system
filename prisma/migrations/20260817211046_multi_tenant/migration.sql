-- CreateTable
CREATE TABLE "clinicas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" SERIAL NOT NULL,
    "clinica_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "datas_disponiveis" DATE[],

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" SERIAL NOT NULL,
    "clinica_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" SERIAL NOT NULL,
    "clinica_id" INTEGER NOT NULL,
    "paciente_id" INTEGER NOT NULL,
    "profissional_id" INTEGER NOT NULL,
    "data_consulta" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros" (
    "id" SERIAL NOT NULL,
    "clinica_id" INTEGER NOT NULL,
    "accesscore_user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinicas_slug_key" ON "clinicas"("slug");

-- CreateIndex
CREATE INDEX "profissionais_clinica_id_idx" ON "profissionais"("clinica_id");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_clinica_id_cpf_key" ON "pacientes"("clinica_id", "cpf");

-- CreateIndex
CREATE INDEX "agendamentos_clinica_id_idx" ON "agendamentos"("clinica_id");

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_profissional_id_data_consulta_key" ON "agendamentos"("profissional_id", "data_consulta");

-- CreateIndex
CREATE INDEX "membros_accesscore_user_id_idx" ON "membros"("accesscore_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "membros_clinica_id_accesscore_user_id_key" ON "membros"("clinica_id", "accesscore_user_id");

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
