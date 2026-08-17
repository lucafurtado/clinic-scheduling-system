import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const profissionais = [
  {
    nome: 'Dr. João Martins',
    especialidade: 'Clínico Geral',
    datas: ['2026-04-20', '2026-04-21', '2026-04-22'],
  },
  {
    nome: 'Dra. Fernanda Rocha',
    especialidade: 'Clínico Geral',
    datas: ['2026-04-27', '2026-04-28'],
  },
  { nome: 'Dra. Marina Costa', especialidade: 'Nutrição', datas: ['2026-04-23', '2026-04-24'] },
  { nome: 'Dr. Carlos Abreu', especialidade: 'Exames', datas: ['2026-04-25', '2026-04-26'] },
  { nome: 'Dra. Camila Nogueira', especialidade: 'Pediatria', datas: ['2026-04-29', '2026-04-30'] },
  {
    nome: 'Dr. Rafael Teixeira',
    especialidade: 'Cardiologia',
    datas: ['2026-05-02', '2026-05-03'],
  },
  { nome: 'Dra. Paula Mendes', especialidade: 'Dermatologia', datas: ['2026-05-04', '2026-05-05'] },
  { nome: 'Dr. Eduardo Lima', especialidade: 'Ortopedia', datas: ['2026-05-06', '2026-05-07'] },
  {
    nome: 'Dra. Juliana Barros',
    especialidade: 'Ginecologia',
    datas: ['2026-05-08', '2026-05-09'],
  },
  { nome: 'Dr. André Soares', especialidade: 'Neurologia', datas: ['2026-05-10', '2026-05-11'] },
];

async function main() {
  await prisma.agendamento.deleteMany();
  await prisma.profissional.deleteMany();

  for (const p of profissionais) {
    await prisma.profissional.create({
      data: {
        nome: p.nome,
        especialidade: p.especialidade,
        datasDisponiveis: p.datas.map((d) => new Date(`${d}T00:00:00.000Z`)),
      },
    });
  }

  console.log(`Seed concluído: ${profissionais.length} profissionais criados.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
