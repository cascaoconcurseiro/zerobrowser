// Registra no servidor da avaliação o que aconteceu na página. O id da tarefa vem de <body data-tarefa>.
window.registrar = (dados) => fetch(`/api/estado/${document.body.dataset.tarefa}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(dados),
  keepalive: true
});

window.avisar = (texto) => {
  const aviso = document.getElementById('aviso');
  if (aviso) aviso.textContent = texto;
};
