'use strict';

const BUILTIN_BOT_TEMPLATES = Object.freeze({
  'price-researcher': {
    id: 'price-researcher',
    name: 'Pesquisador de preços',
    description: 'Monitora o preço de um produto confirmado por você nas lojas escolhidas e avisa quando atingir a meta.',
    permission: 'somente-leitura',
    requiredInputs: ['productName', 'targetPrice', 'stores'],
    defaultSchedule: { enabled: true, kind: 'interval', intervalHours: 6 }
  },
  'stock-quote': {
    id: 'stock-quote',
    name: 'Preço de ação / ativo',
    description: 'Consulta cotação em modo somente leitura e avisa quando cruzar a faixa configurada.',
    permission: 'somente-leitura',
    requiredInputs: ['ticker', 'alertAbove', 'alertBelow'],
    defaultSchedule: { enabled: true, kind: 'interval', intervalHours: 1 }
  },
  'email-assistant': {
    id: 'email-assistant',
    name: 'Assistente de e-mail (rascunho seguro)',
    description: 'Classifica e resume mensagens; no degrau 2 prepara apenas rascunho para sua aprovação.',
    permission: 'somente-leitura',
    requiredInputs: ['webmailUrl'],
    defaultSchedule: { enabled: false, kind: 'manual', intervalHours: null }
  }
});

class PriceResearcherBotService {
  constructor({ store }) {
    if (!store) throw new Error('PriceResearcherBotService requer BotTaskStore.');
    this.store = store;
    this.confirmedProducts = new Map(); // botId -> Map(storeHost, confirmedProductSpec)
    this.priceSeries = new Map(); // botId -> Array<{ store, price, shipping, total, timestamp, usedRecipe }>
  }

  createFromTemplate({ productName, targetPrice, stores = [], cep = null } = {}) {
    if (!productName || !Number.isFinite(Number(targetPrice))) {
      throw new Error('Pesquisador de preços exige productName e targetPrice numérico.');
    }
    return this.store.createBot({
      name: `Preço · ${productName}`,
      template: 'price-researcher',
      goal: `Monitorar "${productName}" e avisar quando o preço ficar <= R$ ${Number(targetPrice).toFixed(2)}`,
      inputs: {
        productName,
        targetPrice: Number(targetPrice),
        stores,
        cep
      },
      allowedSites: stores,
      permission: 'somente-leitura',
      schedule: { enabled: true, kind: 'interval', intervalHours: 6 }
    });
  }

  confirmCandidateProduct(botId, { storeUrl, productTitle, sku, confirmedByUser = false } = {}) {
    if (!confirmedByUser) {
      throw new Error('A primeira execução exige confirmação humana de qual é o produto exato em cada loja.');
    }
    if (!this.confirmedProducts.has(botId)) {
      this.confirmedProducts.set(botId, new Map());
    }
    const perStore = this.confirmedProducts.get(botId);
    const entry = {
      storeUrl,
      productTitle,
      sku: sku || null,
      confirmedAt: new Date().toISOString()
    };
    perStore.set(storeUrl, entry);
    return entry;
  }

  recordPriceObservation(botId, { storeUrl, price, shipping = 0, usedRecipe = true, fallbackReason = null, timestamp = Date.now() } = {}) {
    const bot = this.store.getBot(botId);
    if (!bot) throw new Error(`Bot "${botId}" não encontrado.`);
    const confirmed = this.confirmedProducts.get(botId)?.get(storeUrl);
    if (!confirmed) {
      throw new Error(`Produto ainda não confirmado pelo usuário para a loja "${storeUrl}".`);
    }

    const numericPrice = Number(price);
    const numericShipping = Number(shipping) || 0;
    const total = Number((numericPrice + numericShipping).toFixed(2));
    if (!this.priceSeries.has(botId)) {
      this.priceSeries.set(botId, []);
    }
    const history = this.priceSeries.get(botId);
    const previousLowest = history.length ? Math.min(...history.map((h) => h.total)) : Infinity;

    const point = {
      storeUrl,
      productTitle: confirmed.productTitle,
      price: numericPrice,
      shipping: numericShipping,
      total,
      usedRecipe: Boolean(usedRecipe),
      fallbackReason: usedRecipe ? null : (fallbackReason || 'Receita quebrou; usado agente com modelo'),
      timestamp
    };
    history.push(point);

    const targetPrice = Number(bot.inputs.targetPrice);
    const reachedTarget = total <= targetPrice;
    const isHistoricalLow = total < previousLowest;

    return {
      point,
      reachedTarget,
      isHistoricalLow,
      shouldAlert: reachedTarget || isHistoricalLow
    };
  }

  getMetrics(botId) {
    const series = this.priceSeries.get(botId) || [];
    if (!series.length) {
      return { totalObservations: 0, recipeFreeRatio: 0, lowestTotal: null };
    }
    const recipeCount = series.filter((s) => s.usedRecipe).length;
    return {
      totalObservations: series.length,
      recipeFreeRatio: Number((recipeCount / series.length).toFixed(4)),
      lowestTotal: Math.min(...series.map((s) => s.total))
    };
  }
}

function evaluateStockQuoteAlert({ ticker, currentPrice, alertAbove = null, alertBelow = null } = {}) {
  const price = Number(currentPrice);
  const triggeredAbove = alertAbove != null && price >= Number(alertAbove);
  const triggeredBelow = alertBelow != null && price <= Number(alertBelow);
  return {
    ticker: String(ticker || '').toUpperCase(),
    price,
    permission: 'somente-leitura',
    shouldAlert: triggeredAbove || triggeredBelow,
    reason: triggeredAbove
      ? `Cotação de ${ticker} atingiu/superou R$ ${Number(alertAbove).toFixed(2)}`
      : triggeredBelow
        ? `Cotação de ${ticker} caiu para/abaixo de R$ ${Number(alertBelow).toFixed(2)}`
        : null
  };
}

module.exports = {
  BUILTIN_BOT_TEMPLATES,
  PriceResearcherBotService,
  evaluateStockQuoteAlert
};

