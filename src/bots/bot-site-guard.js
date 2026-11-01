'use strict';

// Barreira de navegação do Bot, usada pelo processo principal (main.js).
// Fica separada do Electron para poder ser testada com uma sessão falsa: o teste prova
// que o pedido de navegação para fora da lista é cancelado antes de abrir a rede.

const { isUrlAllowedForBot, siteBlockedMessage } = require('./site-policy');

function createBotSiteGuard({ bot = {}, onBlocked = null } = {}) {
  const state = {
    botId: bot?.id ? String(bot.id) : null,
    allowedSites: Array.isArray(bot?.allowedSites) ? [...bot.allowedSites] : []
  };
  let sessionGuarded = false;

  const notifyBlocked = (url) => {
    const message = siteBlockedMessage(url, state.allowedSites);
    if (typeof onBlocked === 'function') {
      try {
        onBlocked({ botId: state.botId, url: String(url ?? ''), message });
      } catch {}
    }
    return message;
  };

  return {
    get botId() {
      return state.botId;
    },
    get allowedSites() {
      return [...state.allowedSites];
    },

    // A ficha do Bot pode ser editada entre execuções: a barreira segue a lista mais recente.
    updatePolicy(nextBot = {}) {
      if (nextBot?.id) state.botId = String(nextBot.id);
      if (Array.isArray(nextBot?.allowedSites)) state.allowedSites = [...nextBot.allowedSites];
      return this;
    },

    allows(url) {
      return isUrlAllowedForBot(url, state.allowedSites);
    },

    block(url) {
      return notifyBlocked(url);
    },

    // Cancela, na sessão do Bot, qualquer navegação principal para fora da lista.
    // Cobre o loadURL do agente, que não dispara will-navigate.
    guardSession(ses) {
      if (sessionGuarded) return false;
      if (!ses?.webRequest || typeof ses.webRequest.onBeforeRequest !== 'function') return false;
      sessionGuarded = true;
      ses.webRequest.onBeforeRequest((details, callback) => {
        // Sub-recursos (imagem, script, fonte) não mudam o site da aba.
        if (details?.resourceType && details.resourceType !== 'mainFrame') return callback({});
        if (isUrlAllowedForBot(details?.url, state.allowedSites)) return callback({});
        notifyBlocked(details?.url);
        return callback({ cancel: true });
      });
      return true;
    }
  };
}

module.exports = { createBotSiteGuard };
