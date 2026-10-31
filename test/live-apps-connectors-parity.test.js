'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LiveAppEngine, STRICT_OFFLINE_CSP } = require('../src/live-apps/live-app-engine');
const {
  NativeConnectorsHub,
  ExternalMcpClient,
  AuthorizedMessagingBridge
} = require('../src/connectors');
const {
  EarnedAutonomyTracker,
  SignedUpdateVerifier,
  SecureCsvPasswordImporter,
  SplitViewManager
} = require('../src/main/parity-essentials');
const { UntouchableCoreError } = require('../src/main/command-registry');
const { tagValueOrigin, createVerifiedReceipt } = require('../src/automation/service/intent-firewall');

test('LiveAppEngine cria protótipo de vencimentos com 3 fontes sem rede, exige recibo em ações e exporta sem dados pessoais', () => {
  const engine = new LiveAppEngine();
  const proto = LiveAppEngine.createWeeklyDueAppPrototype({ engine });

  assert.equal(proto.manifest.csp, STRICT_OFFLINE_CSP);
  assert.equal(proto.manifest.networkAccess, 'none');
  assert.equal(proto.manifest.sources.length, 3);
  assert.equal(proto.rows.length, 3);

  // Ação disparada do App Vivo sem recibo aprovado é bloqueada e devolve proposedReceipt
  const unapproved = engine.dispatchLiveAppAction(proto.manifest.appId, {
    action: 'bank.payBoleto',
    targetUrl: 'https://banco.exemplo.com/pay',
    params: { boletoId: tagValueOrigin('due-1', 'usuario'), amount: tagValueOrigin(245.90, 'usuario') }
  });
  assert.equal(unapproved.ok, false);
  assert.ok(unapproved.proposedReceipt);

  // Com o recibo verificado exatamente igual, a ação é executada
  const approved = engine.dispatchLiveAppAction(proto.manifest.appId, {
    action: 'bank.payBoleto',
    targetUrl: 'https://banco.exemplo.com/pay',
    params: { boletoId: tagValueOrigin('due-1', 'usuario'), amount: tagValueOrigin(245.90, 'usuario') },
    approvalReceipt: unapproved.proposedReceipt,
    executeFn: () => ({ paid: true })
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.result.paid, true);

  // Exportação do pacote não leva linhas de dados pessoais
  const exported = engine.exportPackageWithoutPersonalData(proto.manifest.appId);
  assert.equal(exported.rows.length, 0);
  assert.equal(exported.manifest.title, 'Meus vencimentos da semana');
});

test('NativeConnectorsHub etiqueta leituras como externo, cria rascunho com recibo na escrita e bloqueia remetente não autorizado no Telegram', () => {
  const hub = new NativeConnectorsHub();
  const emails = hub.readServiceData({
    connector: 'email.read',
    mockItems: [{ subject: 'Fatura', body: 'Segue boleto' }]
  });
  assert.equal(emails[0].data.origin, 'externo');

  // Escrita cria rascunho primeiro e exige recibo verificado para executar
  const draftRes = hub.createWriteDraft({
    connector: 'email.send',
    targetUrl: 'https://mail.exemplo.com',
    params: { to: tagValueOrigin('cliente@exemplo.com', 'usuario'), subject: tagValueOrigin('Proposta', 'usuario') }
  });
  assert.equal(draftRes.ok, true);
  assert.equal(draftRes.status, 'draft_created');

  // Se tentar alterar destinatário na hora do envio, o recibo reprova
  const mismatch = hub.executeApprovedDraft(draftRes.draftId, {
    approvalReceipt: draftRes.receipt,
    actualRequestParams: { to: tagValueOrigin('invasor@evil.com', 'usuario'), subject: tagValueOrigin('Proposta', 'usuario') }
  });
  assert.equal(mismatch.ok, false);

  const validExec = hub.executeApprovedDraft(draftRes.draftId, {
    approvalReceipt: draftRes.receipt
  });
  assert.equal(validExec.ok, true);

  // Servidor MCP de terceiros exige confirmação de risco
  const extMcp = new ExternalMcpClient();
  assert.throws(
    () => extMcp.connectServer({ serverId: 'untrusted', isThirdParty: true, thirdPartyRiskAcknowledged: false }),
    /aviso de risco/
  );

  // Ponte Telegram aceita apenas remetente autorizado e protege núcleo intocável
  const bridge = new AuthorizedMessagingBridge({ channel: 'telegram', authorizedSenderIds: ['chat-wesley-1'] });
  assert.equal(bridge.handleIncomingMessage({ senderId: 'stranger-99', command: 'bots.status' }).accepted, false);
  assert.equal(bridge.handleIncomingMessage({ senderId: 'chat-wesley-1', command: 'bots.status' }).accepted, true);
  assert.throws(
    () => bridge.handleIncomingMessage({ senderId: 'chat-wesley-1', command: 'security.stopAll' }),
    (err) => err instanceof UntouchableCoreError
  );
});

test('EarnedAutonomyTracker, SignedUpdateVerifier, SecureCsvPasswordImporter e SplitViewManager cumprem paridade e salto', () => {
  const tracker = new EarnedAutonomyTracker({ promotionThreshold: 3 });
  tracker.recordVerifiedOutcome('bot-1', 'https://loja.com', { success: true });
  tracker.recordVerifiedOutcome('bot-1', 'https://loja.com', { success: true });
  const third = tracker.recordVerifiedOutcome('bot-1', 'https://loja.com', { success: true });
  assert.equal(third.eligibleForPromotion, true);

  // Subir exige confirmação humana
  assert.throws(
    () => tracker.promoteAutonomy('bot-1', 'https://loja.com', { confirmedByUser: false }),
    /aceite humano explícito/
  );
  const promoted = tracker.promoteAutonomy('bot-1', 'https://loja.com', { confirmedByUser: true });
  assert.equal(promoted.autonomyStep, 2);

  // 1 falha rebaixa automaticamente para o degrau 1
  const demoted = tracker.recordVerifiedOutcome('bot-1', 'https://loja.com', { success: false });
  assert.equal(demoted.autonomyStep, 1);

  // Nenhum degrau desliga o núcleo intocável
  assert.throws(
    () => tracker.assertCoreRemainsActiveAtAnyStep(3, 'security.intentFirewall'),
    (err) => err instanceof UntouchableCoreError
  );

  // Atualização assinada Ed25519 + SHA-512 com rollback automático se adulterada
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const payload = Buffer.from('zero-browser-update-binary-0.1.59');
  const sha512 = crypto.createHash('sha512').update(payload).digest('hex');
  const sig = crypto.sign(null, payload, privateKey);

  const okUpdate = SignedUpdateVerifier.verifyAndApplyUpdate({
    payloadBuffer: payload,
    expectedSha512Hex: sha512,
    signatureBuffer: sig,
    publicKeyPem: pubPem
  });
  assert.equal(okUpdate.applied, true);

  const tamperedUpdate = SignedUpdateVerifier.verifyAndApplyUpdate({
    payloadBuffer: Buffer.from('tampered-binary'),
    expectedSha512Hex: sha512,
    signatureBuffer: sig,
    publicKeyPem: pubPem
  });
  assert.equal(tamperedUpdate.applied, false);
  assert.equal(tamperedUpdate.rolledBack, true);

  // Importador CSV de senhas apaga o CSV temporário do disco
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-csv-'));
  const csvPath = path.join(tmpDir, 'passwords.csv');
  fs.writeFileSync(csvPath, 'url,username,password\nhttps://site.com,wesley,secret123\n', 'utf8');
  const vault = new Map();
  const imp = SecureCsvPasswordImporter.importCsvAndShredFile({ csvFilePath: csvPath, vaultStore: vault });
  assert.equal(imp.importedCount, 1);
  assert.equal(imp.csvDeleted, true);
  assert.equal(vault.get('https://site.com::wesley'), 'secret123');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // SplitViewManager
  const split = new SplitViewManager();
  assert.equal(split.enableSplitView('tab-1', 'tab-2').enabled, true);
  assert.equal(split.disableSplitView().enabled, false);
});

