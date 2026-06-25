require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get('/especialidades', async (req, res) => {
  const { data, error } = await supabase
    .from('profissionais')
    .select('especialidade');
  if (error) return res.status(500).json({ erro: error.message });
  const unicas = [...new Set(data.map(p => p.especialidade))];
  res.json(unicas);
});

app.get('/profissionais', async (req, res) => {
  let query = supabase.from('profissionais').select('*');
  if (req.query.especialidade) {
    query = query.ilike('especialidade', req.query.especialidade);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

app.get('/profissionais/:id/datas', async (req, res) => {
  const { data: prof, error } = await supabase
    .from('profissionais')
    .select('datas_disponiveis')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ erro: 'Profissional não encontrado.' });

  const { data: agendados } = await supabase
    .from('agendamentos')
    .select('data_consulta')
    .eq('profissional_id', req.params.id);

  const datasOcupadas = new Set((agendados || []).map(a => a.data_consulta));
  const disponiveis = (prof.datas_disponiveis || []).filter(d => !datasOcupadas.has(d));
  res.json(disponiveis);
});

app.post('/agendamentos', async (req, res) => {
  const { nome, cpf, telefone, profissionalId, dataConsulta } = req.body;

  if (!nome || !cpf || !telefone || !profissionalId || !dataConsulta) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  const cpfLimpo = String(cpf).replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpfLimpo)) {
    return res.status(400).json({ erro: 'CPF deve ter 11 dígitos, com ou sem formatação.' });
  }

  const { data: prof, error: errProf } = await supabase
    .from('profissionais')
    .select('*')
    .eq('id', profissionalId)
    .single();
  if (errProf) return res.status(404).json({ erro: 'Profissional não encontrado.' });

  if (!prof.datas_disponiveis.includes(dataConsulta)) {
    return res.status(400).json({ erro: 'Essa data não existe para o profissional selecionado.' });
  }

  const { data: ocupado } = await supabase
    .from('agendamentos')
    .select('id')
    .eq('profissional_id', profissionalId)
    .eq('data_consulta', dataConsulta)
    .maybeSingle();

  if (ocupado) {
    return res.status(400).json({ erro: 'Essa data já foi reservada para esse profissional.' });
  }

  const { data, error } = await supabase
    .from('agendamentos')
    .insert({ nome, cpf: cpfLimpo, telefone, profissional_id: profissionalId, data_consulta: dataConsulta })
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });

  res.status(201).json({
    mensagem: 'Agendamento realizado com sucesso.',
    agendamento: {
      ...data,
      especialidade: prof.especialidade,
      profissional: prof.nome,
      dataConsulta: data.data_consulta
    }
  });
});

app.get('/agendamentos/:cpf', async (req, res) => {
  const cpfLimpo = req.params.cpf.replace(/\D/g, '');
  const { data, error } = await supabase
    .from('agendamentos')
    .select('*, profissionais(nome, especialidade)')
    .eq('cpf', cpfLimpo);
  if (error) return res.status(500).json({ erro: error.message });

  const resultado = (data || []).map(a => ({
    ...a,
    especialidade: a.profissionais?.especialidade,
    profissional: a.profissionais?.nome,
    dataConsulta: a.data_consulta
  }));

  res.json(resultado);
});

app.delete('/agendamentos/:id', async (req, res) => {
  const { error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ mensagem: 'Agendamento cancelado com sucesso.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
