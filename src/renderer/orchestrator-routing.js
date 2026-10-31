(function attachOrchestratorRouting(root, factory) {
  const routing = factory();
  if (typeof module === 'object' && module.exports) module.exports = routing;
  else root.ZeroOrchestratorRouting = routing;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const ROUTES = [
    {
      kind: 'price',
      terms: ['preco', 'precos', 'frete', 'comparar preco', 'pesquisar preco', 'menor valor', 'oferta', 'promocao']
    },
    {
      kind: 'market',
      terms: ['cotacao', 'ticker', 'bolsa de valores', 'mercado financeiro', 'carteira de investimentos', 'acoes da empresa', 'indicadores financeiros']
    },
    {
      kind: 'inbox',
      terms: ['email', 'emails', 'e mail', 'e mails', 'caixa de entrada', 'mensagens nao lidas', 'triagem de mensagens', 'agenda do dia', 'reuniao de hoje']
    }
  ];

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function matchesTask(task, kind) {
    const profile = normalize(`${task?.id || ''} ${task?.specialty || ''} ${task?.specialtyTitle || ''} ${task?.name || ''}`);
    if (kind === 'price') return /price|preco|shop|compra/.test(profile);
    if (kind === 'market') return /market|mercado|finance|cotac|radar/.test(profile);
    if (kind === 'inbox') return /inbox|email|mail|triagem|agenda/.test(profile);
    return false;
  }

  function classifyRequest(prompt, tasks = []) {
    const text = normalize(prompt);
    if (!text) return { kind: 'general', bot: null, reason: 'empty' };
    const ranked = ROUTES.map((route) => ({
      route,
      score: route.terms.filter((term) => ` ${text} `.includes(` ${normalize(term)} `)).length
    })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const matchedRoutes = ranked.filter((item) => item.score > 0);
    if (!best?.score || matchedRoutes.length > 1) return { kind: 'general', bot: null, reason: best?.score ? 'ambiguous' : 'no-specialty-match' };
    const bot = (Array.isArray(tasks) ? tasks : []).find((task) => matchesTask(task, best.route.kind));
    if (!bot) return { kind: 'general', bot: null, reason: 'specialist-unavailable' };
    return { kind: 'specialist', specialty: best.route.kind, bot, reason: 'keyword-match' };
  }

  return { classifyRequest };
});
