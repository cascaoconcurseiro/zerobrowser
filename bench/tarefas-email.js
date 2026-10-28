// E-mail local: organizar mensagens, marcar como lida e escrever rascunho/envio. Fixture determinística,
// sem conta real. A verificação usa o texto visível depois da tarefa.
const norm = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const compactar = (texto) => String(texto || '').replace(/\s+/g, ' ').trim();
const ok = (aprovado, motivo) => ({ aprovado: Boolean(aprovado), motivo });
const resposta = (r) => `resposta: ${compactar(r.mensagem).slice(0, 140)} | texto: ${compactar(r.pageText).slice(0, 200)}`;

const tarefasEmail = [
  {
    id: '48-email-organizar',
    categoria: 'email',
    verificarPagina: true,
    pedido: 'Mova a mensagem "Relatório mensal" para a pasta Trabalho, marque a mensagem "Nota fiscal" como lida e salve um rascunho para teste@exemplo.com com o assunto "Rascunho Zero". Depois diga o assunto do rascunho e onde o relatório ficou.',
    verificar: (_e, r) => {
      const texto = norm(r.pageText);
      const mensagem = norm(r.mensagem);
      const cofre = /trabalho:\s*1/.test(texto) && /rascunhos:\s*1/.test(texto);
      const assunto = mensagem.includes(norm('Rascunho Zero'));
      return ok(cofre && assunto, [resposta(r), `pasta/rascunho: ${cofre}`, `assunto na resposta: ${assunto}`].join(' | '));
    }
  },
  {
    id: '49-email-enviar',
    categoria: 'email',
    verificarPagina: true,
    pedido: 'Escreva um e-mail para equipe@exemplo.com com o assunto "Teste de envio" e o corpo "Mensagem automática de teste". Envie e diga o assunto enviado.',
    verificar: (_e, r) => {
      const texto = norm(r.pageText);
      const enviado = /enviados:\s*1/.test(texto);
      const assunto = norm(r.mensagem).includes(norm('Teste de envio'));
      return ok(enviado && assunto, `${resposta(r)} | enviados: ${enviado} | assunto: ${assunto}`);
    }
  }
];

module.exports = { tarefasEmail };
