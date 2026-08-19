import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '../lib/logger';

let transporterPromise: Promise<Transporter> | null = null;

// Com SMTP_HOST configurada, usa um provedor real. Sem isso (padrão em dev),
// provisiona uma conta de teste do Ethereal automaticamente — nenhum e-mail
// real é enviado, mas o fluxo inteiro roda de ponta a ponta, com uma URL de
// preview logada no console para inspeção.
async function obterTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = process.env.SMTP_HOST
      ? Promise.resolve(
          nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
          }),
        )
      : nodemailer.createTestAccount().then((conta) =>
          nodemailer.createTransport({
            host: conta.smtp.host,
            port: conta.smtp.port,
            secure: conta.smtp.secure,
            auth: { user: conta.user, pass: conta.pass },
          }),
        );
  }
  return transporterPromise;
}

async function enviar(destinatario: string, assunto: string, html: string) {
  try {
    const transporter = await obterTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? '"ClinicFlow" <nao-responda@clinicflow.dev>',
      to: destinatario,
      subject: assunto,
      html,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) logger.info({ preview }, '[email] preview');
  } catch (error) {
    // Falha de e-mail nunca pode derrubar o fluxo que chamou isto — só loga.
    logger.error(error, '[email] falha ao enviar');
  }
}

interface DadosAgendamentoParaEmail {
  nome: string;
  especialidade: string;
  profissional: string;
  dataConsulta: string;
}

function formatarDataBr(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

export const emailService = {
  enviarConfirmacao(destinatario: string, dados: DadosAgendamentoParaEmail) {
    return enviar(
      destinatario,
      'Agendamento confirmado — ClinicFlow',
      `<p>Olá, ${dados.nome}!</p>
       <p>Seu pagamento foi aprovado e o agendamento está confirmado:</p>
       <ul>
         <li><strong>Especialidade:</strong> ${dados.especialidade}</li>
         <li><strong>Profissional:</strong> ${dados.profissional}</li>
         <li><strong>Data:</strong> ${formatarDataBr(dados.dataConsulta)}</li>
       </ul>
       <p>Até lá!</p>`,
    );
  },

  enviarCancelamento(destinatario: string, dados: DadosAgendamentoParaEmail) {
    return enviar(
      destinatario,
      'Agendamento cancelado — ClinicFlow',
      `<p>Olá, ${dados.nome}.</p>
       <p>Seu agendamento foi cancelado:</p>
       <ul>
         <li><strong>Especialidade:</strong> ${dados.especialidade}</li>
         <li><strong>Profissional:</strong> ${dados.profissional}</li>
         <li><strong>Data:</strong> ${formatarDataBr(dados.dataConsulta)}</li>
       </ul>
       <p>Se precisar, é só agendar novamente.</p>`,
    );
  },
};
