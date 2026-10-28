// Sites públicos difíceis, sem login: heavy SPA, anti-bot, banner de cookies, docs densas.
// A verificação combina regra do site + citação do texto final da página (o modelo precisa ter lido o que diz).
const norm = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const compactar = (texto) => String(texto || '').replace(/\s+/g, ' ').trim();
const ok = (aprovado, motivo) => ({ aprovado: Boolean(aprovado), motivo });
const resposta = (r) => `resposta: ${compactar(r.mensagem).slice(0, 110)}${r.urlFinal ? ` | url: ${r.urlFinal}` : ''} | texto final: ${String(r.pageText || '').length} chars${String(r.pageText || '').trim() ? ` | trecho: ${compactar(r.pageText).slice(0, 220)}` : ' (vazio)'}`;

// Procura na resposta um trecho que exista no texto final da página: negrito, aspas ou sequência de palavras.
function citouPagina(mensagem, pageText) {
  // Espaço em branco da página é colapsado: innerText quebra linha no meio de manchete de carrossel.
  const page = norm(pageText).replace(/\s+/g, ' ');
  if (page.length < 40) return false;
  const msg = compactar(mensagem);
  const strong = [...msg.matchAll(/\*\*([^*]{4,180})\*\*/g)].map((match) => match[1]);
  const quoted = [...msg.matchAll(/["“”']([^"“”']{4,180})["“”']/g)].map((match) => match[1]);
  for (const candidate of [...quoted, ...strong]) {
    if (page.includes(norm(candidate).replace(/\s+/g, ' '))) return true;
  }
  // Sem marcador: qualquer sequência de 2 a 6 palavras do texto citado que exista na página (>= 14 caracteres).
  const words = norm(msg).split(/[^a-z0-9-]+/).filter(Boolean);
  // (o texto da página já foi colapsado acima)
  for (let size = 6; size >= 2; size--) {
    for (let index = 0; index + size <= words.length; index++) {
      const phrase = words.slice(index, index + size).join(' ');
      if (phrase.length >= 14 && page.includes(phrase)) return true;
    }
  }
  return false;
}

const tarefasReaisDificeis = [
  {
    id: 'x01-hackernews-listagem',
    categoria: 'listagem',
    startUrl: 'https://news.ycombinator.com/newest',
    hosts: ['news.ycombinator.com'],
    verificarPagina: true,
    pedido: 'Abra a lista de histórias mais recentes e diga o título da primeira história listada, exatamente como aparece.',
    verificar: (_e, r) => ok(citouPagina(r.mensagem, r.pageText), `${resposta(r)} | página lida: ${r.pageTextRead}`)
  },
  {
    id: 'x02-github-releases',
    categoria: 'leitura',
    startUrl: 'https://github.com/electron/electron/releases',
    hosts: ['github.com'],
    verificarPagina: true,
    pedido: 'Diga qual é a versão da release mais recente listada nesta página (só o número, ex.: 32.0.1).',
    verificar: (_e, r) => {
      const versao = compactar(r.mensagem).match(/v?(\d+\.\d+\.\d+)/);
      const naPagina = versao ? norm(r.pageText).includes(versao[1]) : false;
      return ok(Boolean(versao) && naPagina, `${resposta(r)} | versão na página: ${naPagina}`);
    }
  },
  {
    id: 'x03-g1-cookies',
    categoria: 'banner',
    startUrl: 'https://g1.globo.com/',
    hosts: ['g1.globo.com', 'globo.com'],
    verificarPagina: true,
    pedido: 'Se aparecer um aviso de cookies/LGPD, aceite ou feche. Depois diga o título da primeira manchete da página, exatamente como aparece.',
    verificar: (_e, r) => ok(citouPagina(r.mensagem, r.pageText), `${resposta(r)} | página lida: ${r.pageTextRead}`)
  },
  {
    id: 'x04-uol-manchete',
    categoria: 'spa',
    startUrl: 'https://www.uol.com.br/',
    hosts: ['uol.com.br', 'www.uol.com.br'],
    verificarPagina: true,
    pedido: 'Se aparecer um aviso de cookies, aceite. Depois diga o título da primeira manchete da página, exatamente como aparece.',
    verificar: (_e, r) => ok(citouPagina(r.mensagem, r.pageText), resposta(r))
  },
  {
    id: 'x05-govbr-noticia',
    categoria: 'portal',
    startUrl: 'https://www.gov.br/pt-br',
    hosts: ['gov.br', 'www.gov.br'],
    verificarPagina: true,
    pedido: 'Na seção "MAIS ACESSADOS" da página inicial, qual é o 5º serviço listado? Diga o nome como aparece.',
    verificar: (_e, r) => {
      const citou = /consultar cpf/i.test(norm(r.mensagem));
      const naPagina = /consultar cpf/i.test(norm(r.pageText));
      return ok(citou, `${resposta(r)} | serviço na página: ${naPagina}`);
    }
  },
  {
    id: 'x06-mdn-closures',
    categoria: 'documentacao',
    startUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures',
    hosts: ['developer.mozilla.org'],
    verificarPagina: true,
    pedido: 'Cite em inglês a primeira frase da definição de closure desta página e explique em uma frase em português.',
    verificar: (_e, r) => {
      const explicou = /closure/i.test(r.mensagem) && /(escopo|scope|fun[cç][aã]o|function)/i.test(r.mensagem);
      return ok(explicou && citouPagina(r.mensagem, r.pageText), `${resposta(r)} | citação: ${citouPagina(r.mensagem, r.pageText)}`)
    }
  }
];

module.exports = { tarefasReaisDificeis, citouPagina };
