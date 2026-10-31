'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { UNTOUCHABLE_CORE_IDS, UntouchableCoreError } = require('./command-registry');

class EarnedAutonomyTracker {
  constructor({ promotionThreshold = 5 } = {}) {
    this.promotionThreshold = Math.max(1, Number(promotionThreshold) || 5);
    this.trustMap = new Map(); // `${botId}::${site}` -> { step, consecutiveSuccesses, totalRuns, failures }
  }

  _key(botId, site) {
    return `${botId}::${site}`;
  }

  getTrustRecord(botId, site) {
    const key = this._key(botId, site);
    if (!this.trustMap.has(key)) {
      this.trustMap.set(key, {
        botId,
        site,
        autonomyStep: 1,
        consecutiveSuccesses: 0,
        totalRuns: 0,
        failures: 0,
        eligibleForPromotion: false
      });
    }
    return { ...this.trustMap.get(key) };
  }

  recordVerifiedOutcome(botId, site, { success = true } = {}) {
    const key = this._key(botId, site);
    const current = this.getTrustRecord(botId, site);
    current.totalRuns += 1;
    if (success) {
      current.consecutiveSuccesses += 1;
      current.eligibleForPromotion = current.consecutiveSuccesses >= this.promotionThreshold && current.autonomyStep < 3;
    } else {
      current.failures += 1;
      current.consecutiveSuccesses = 0;
      current.eligibleForPromotion = false;
      // Rebaixamento automático na 1ª falha
      current.autonomyStep = 1;
    }
    this.trustMap.set(key, current);
    return { ...current };
  }

  promoteAutonomy(botId, site, { confirmedByUser = false } = {}) {
    const key = this._key(botId, site);
    const current = this.getTrustRecord(botId, site);
    if (!confirmedByUser) {
      throw new Error('Subir degrau de autonomia conquistada exige aceite humano explícito.');
    }
    if (!current.eligibleForPromotion) {
      throw new Error(`O Bot ainda não atingiu ${this.promotionThreshold} execuções verificadas consecutivas sem erro neste site.`);
    }
    current.autonomyStep = Math.min(3, current.autonomyStep + 1);
    current.consecutiveSuccesses = 0;
    current.eligibleForPromotion = false;
    this.trustMap.set(key, current);
    return { ...current };
  }

  assertCoreRemainsActiveAtAnyStep(autonomyStep, targetCommandId) {
    if (UNTOUCHABLE_CORE_IDS.includes(targetCommandId)) {
      throw new UntouchableCoreError(
        `Mesmo no degrau de autonomia ${autonomyStep}, o comando "${targetCommandId}" do núcleo intocável nunca pode ser desativado.`,
        targetCommandId
      );
    }
    return true;
  }
}

class SignedUpdateVerifier {
  static verifyAndApplyUpdate({
    payloadBuffer,
    expectedSha512Hex,
    signatureBuffer,
    publicKeyPem,
    currentVersion = '0.1.58-dev',
    targetVersion = '0.1.59-dev'
  } = {}) {
    const actualSha512 = crypto.createHash('sha512').update(payloadBuffer).digest('hex');
    if (actualSha512.toLowerCase() !== String(expectedSha512Hex || '').toLowerCase()) {
      return {
        applied: false,
        rolledBack: true,
        activeVersion: currentVersion,
        reason: 'Falha na verificação de hash SHA-512; atualização abortada com rollback automático.'
      };
    }

    const signatureValid = crypto.verify(
      null,
      payloadBuffer,
      publicKeyPem,
      signatureBuffer
    );
    if (!signatureValid) {
      return {
        applied: false,
        rolledBack: true,
        activeVersion: currentVersion,
        reason: 'Assinatura digital inválida; atualização abortada com rollback automático.'
      };
    }

    return {
      applied: true,
      rolledBack: false,
      activeVersion: targetVersion,
      sha512: actualSha512
    };
  }
}

class SecureCsvPasswordImporter {
  static importCsvAndShredFile({ csvFilePath, vaultStore } = {}) {
    if (!csvFilePath || !fs.existsSync(csvFilePath)) {
      throw new Error('Arquivo CSV de senhas não encontrado.');
    }
    const raw = fs.readFileSync(csvFilePath, 'utf8');
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let importedCount = 0;

    for (let i = 1; i < lines.length; i += 1) {
      const [origin, username, password] = lines[i].split(',');
      if (origin && username && password) {
        vaultStore.set(`${origin}::${username}`, password);
        importedCount += 1;
      }
    }

    // Sobrescreve e apaga o CSV temporário com segurança
    fs.writeFileSync(csvFilePath, '0'.repeat(raw.length), 'utf8');
    fs.unlinkSync(csvFilePath);

    return {
      importedCount,
      csvDeleted: !fs.existsSync(csvFilePath)
    };
  }
}

class SplitViewManager {
  constructor() {
    this.activeSplit = null;
  }

  enableSplitView(leftTabId, rightTabId, { ratio = 0.5 } = {}) {
    if (!leftTabId || !rightTabId || leftTabId === rightTabId) {
      throw new Error('Divisão de tela requer 2 abas distintas.');
    }
    this.activeSplit = {
      enabled: true,
      leftTabId,
      rightTabId,
      ratio: Math.min(0.8, Math.max(0.2, Number(ratio) || 0.5))
    };
    return { ...this.activeSplit };
  }

  disableSplitView() {
    this.activeSplit = null;
    return { enabled: false };
  }
}

class AdTrackerListFilter {
  constructor({ blockedPatterns = ['doubleclick.net', 'googlesyndication.com', 'google-analytics.com', 'connect.facebook.net', 'adservice.google.com', 'taboola.com', 'outbrain.com'] } = {}) {
    this.blockedPatterns = [...blockedPatterns];
    this.allowedSiteExceptions = new Set();
    this.blockedCountsByPage = new Map();
  }

  allowSiteException(siteOrigin) {
    this.allowedSiteExceptions.add(String(siteOrigin || '').toLowerCase());
  }

  removeSiteException(siteOrigin) {
    this.allowedSiteExceptions.delete(String(siteOrigin || '').toLowerCase());
  }

  shouldBlockRequest({ pageOrigin, requestUrl } = {}) {
    const normalizedPage = String(pageOrigin || '').toLowerCase();
    if (this.allowedSiteExceptions.has(normalizedPage)) {
      return { blocked: false, reason: 'site_exception' };
    }
    const urlLower = String(requestUrl || '').toLowerCase();
    const matched = this.blockedPatterns.find((pattern) => urlLower.includes(pattern));
    if (matched) {
      const current = this.blockedCountsByPage.get(normalizedPage) || 0;
      this.blockedCountsByPage.set(normalizedPage, current + 1);
      return { blocked: true, matchedPattern: matched, blockedCountForPage: current + 1 };
    }
    return { blocked: false };
  }

  getBlockedCount(pageOrigin) {
    return this.blockedCountsByPage.get(String(pageOrigin || '').toLowerCase()) || 0;
  }
}

class PdfQuestionBridge {
  static buildPdfQuestionPayload({ tabUrl, pdfTitle = '', selectedText = '', userQuestion = '' } = {}) {
    if (!userQuestion || !String(userQuestion).trim()) {
      throw new Error('Pergunta sobre o PDF não pode ser vazia.');
    }
    return {
      mode: 'read-only',
      sourceUrl: String(tabUrl || ''),
      documentTitle: String(pdfTitle || 'Documento PDF'),
      excerpt: String(selectedText || '').slice(0, 4000),
      question: String(userQuestion).trim(),
      prompt: `Documento: ${pdfTitle || tabUrl}\nTrecho selecionado: ${selectedText || '(documento completo)'}\nPergunta: ${userQuestion.trim()}`
    };
  }
}

module.exports = {
  EarnedAutonomyTracker,
  SignedUpdateVerifier,
  SecureCsvPasswordImporter,
  SplitViewManager,
  AdTrackerListFilter,
  PdfQuestionBridge
};

