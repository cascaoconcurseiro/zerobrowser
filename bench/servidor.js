// Servidor local das páginas de tarefa. Só escuta em 127.0.0.1 e só serve arquivos da pasta paginas/.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { tarefas } = require('./tarefas');
const { tarefasDificeis } = require('./tarefas-dificeis');
const { tarefasStress } = require('./tarefas-stress');
const { tarefasEmail } = require('./tarefas-email');

const PAGINAS = path.join(__dirname, 'paginas');
const IDS = new Set([...tarefas, ...tarefasDificeis, ...tarefasStress, ...tarefasEmail].map((t) => t.id));
const TASKS_WITH_INITIAL_STATE = new Map(tarefasStress.filter((t) => t.estadoInicial).map((t) => [t.id, t]));
const ARQUIVOS_COMUNS = { '/_comum.js': 'text/javascript', '/_comum.css': 'text/css' };

function iniciarServidor({ porta = 0 } = {}) {
  const estados = new Map();
  const estadoInicialPara = (id) => {
    const tarefa = TASKS_WITH_INITIAL_STATE.get(id);
    return tarefa ? { estadoInicial: structuredClone(tarefa.estadoInicial), estadoFinal: null } : {};
  };
  for (const id of TASKS_WITH_INITIAL_STATE.keys()) estados.set(id, estadoInicialPara(id));
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const responder = (status, tipo, corpo) => {
      res.writeHead(status, { 'Content-Type': `${tipo}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(corpo);
    };

    const pagina = url.pathname.match(/^\/t\/([\w-]+)$/);
    if (req.method === 'GET' && pagina && IDS.has(pagina[1])) {
      return responder(200, 'text/html', fs.readFileSync(path.join(PAGINAS, `${pagina[1]}.html`)));
    }
    // Arquivos para as tarefas de download: sempre como anexo, para o navegador baixar em vez de mostrar.
    const arquivo = url.pathname.match(/^\/arquivos\/([\w.-]+)$/);
    if (req.method === 'GET' && arquivo && fs.existsSync(path.join(PAGINAS, 'arquivos', arquivo[1]))) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${arquivo[1]}"`, 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(PAGINAS, 'arquivos', arquivo[1])));
    }
    if (req.method === 'GET' && ARQUIVOS_COMUNS[url.pathname]) {
      return responder(200, ARQUIVOS_COMUNS[url.pathname], fs.readFileSync(path.join(PAGINAS, url.pathname.slice(1))));
    }

    const api = url.pathname.match(/^\/api\/estado\/([\w-]+)$/);
    if (api && IDS.has(api[1])) {
      const id = api[1];
      if (req.method === 'GET') return responder(200, 'application/json', JSON.stringify(estados.get(id) || {}));
      if (req.method === 'DELETE') {
        estados.set(id, estadoInicialPara(id));
        return responder(200, 'application/json', '{}');
      }
      if (req.method === 'POST') {
        let corpo = '';
        req.on('data', (parte) => {
          corpo += parte;
          if (corpo.length > 64 * 1024) req.destroy();
        });
        req.on('end', () => {
          try {
            const dados = JSON.parse(corpo || '{}');
            if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('objeto esperado');
            const existente = estados.get(id) || estadoInicialPara(id);
            const atualizado = { ...existente, ...dados };
            if (TASKS_WITH_INITIAL_STATE.has(id)) atualizado.estadoInicial = structuredClone(TASKS_WITH_INITIAL_STATE.get(id).estadoInicial);
            estados.set(id, atualizado);
            responder(200, 'application/json', '{}');
          } catch {
            responder(400, 'application/json', '{"erro":"JSON inválido"}');
          }
        });
        return;
      }
    }
    responder(404, 'text/plain', 'não encontrado');
  });

  return new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(porta, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${servidor.address().port}`;
      resolve({
        base,
        urlDa: (id) => `${base}/t/${id}`,
        estadoDe: (id) => estados.get(id) || estadoInicialPara(id),
        limpar: (id) => estados.set(id, estadoInicialPara(id)),
        fechar: () => new Promise((fim) => servidor.close(fim))
      });
    });
  });
}

module.exports = { iniciarServidor };
