// Menu de contexto de uma aba (clique direito). Puro: recebe a ordem das abas e as ações e devolve o modelo do Menu.
function buildTabMenuTemplate({ tabId, order, canReopen, actions }) {
  const index = order.indexOf(tabId);
  const others = order.filter((id) => id !== tabId);
  const right = index >= 0 ? order.slice(index + 1) : [];
  return [
    { label: 'Nova aba', click: () => actions.newTab() },
    { type: 'separator' },
    { label: 'Recarregar', click: () => actions.reload(tabId) },
    { label: 'Duplicar', click: () => actions.duplicate(tabId) },
    { type: 'separator' },
    { label: 'Fechar aba', enabled: order.length > 1, click: () => actions.close(tabId) },
    { label: 'Fechar outras abas', enabled: others.length > 0, click: () => actions.closeMany(others, tabId) },
    { label: 'Fechar abas à direita', enabled: right.length > 0, click: () => actions.closeMany(right, tabId) },
    { type: 'separator' },
    { label: 'Reabrir aba fechada', enabled: Boolean(canReopen), click: () => actions.reopen() }
  ];
}

module.exports = { buildTabMenuTemplate };
