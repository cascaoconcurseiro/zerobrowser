const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRisk, classifyIntent, isSensitiveField, approvalReasonForMode } = require('../src/automation/risk');

test('credential fields are recognised by type, autocomplete, name or label', () => {
  assert.equal(isSensitiveField({ type: 'password' }), true);
  assert.equal(isSensitiveField({ autocomplete: 'cc-number' }), true);
  assert.equal(isSensitiveField({ name: 'otp' }), true);
  assert.equal(isSensitiveField({ label: 'Senha atual' }), true);
  assert.equal(isSensitiveField({ type: 'text', name: 'busca' }), false);
  assert.equal(classifyRisk({ node: { type: 'password' } }).level, 'credential');
});

test('destructive actions require approval and are named in the reason', () => {
  assert.deepEqual(classifyIntent('Excluir conta'), { level: 'destructive', term: 'excluir' });
  assert.equal(classifyRisk({ context: 'Cancelar pedido' }).level, 'destructive');
  assert.equal(classifyRisk({ context: 'DELETE FROM users' }).level, 'destructive');
  assert.match(classifyRisk({ context: 'Excluir item' }).reason, /destrutiva: excluir/);
});

test('commitment and write actions are separated from destructive ones', () => {
  assert.deepEqual(classifyIntent('Finalizar compra'), { level: 'commitment', term: 'finalizar compra' });
  assert.equal(classifyRisk({ context: 'Place order' }).level, 'commitment');
  assert.equal(classifyRisk({ context: 'Enviar pedido' }).level, 'commitment');
  assert.equal(classifyRisk({ context: 'Salvar alterações' }).level, 'write');
  assert.equal(classifyRisk({ context: 'Atualizar dados' }).level, 'write');
  assert.equal(classifyRisk({ context: 'Cadastrar cliente' }).level, 'write');
});

test('neutral controls stay neutral, including the old false positives', () => {
  assert.equal(classifyRisk({ context: 'Ver detalhes' }).level, 'none');
  assert.equal(classifyRisk({ context: 'Voltar' }).level, 'none');
  assert.equal(classifyRisk({ context: 'Meus pedidos' }).level, 'none');
  assert.equal(classifyRisk({ context: 'Minha conta' }).level, 'none', 'conta sozinha não é ação');
  assert.equal(classifyRisk({ context: 'ExcluirItem' }).level, 'none', 'sem fronteira de palavra não casa');
});

test('submit controls and POST forms are commitments even without a telling name', () => {
  assert.deepEqual(classifyRisk({ node: { isSubmitControl: true } }), { level: 'commitment', reason: 'Envio de formulário' });
  assert.equal(classifyRisk({ node: { formMethod: 'POST' } }).level, 'commitment');
  assert.equal(classifyRisk({ node: { formMethod: 'get', isSubmitControl: false }, context: 'Continuar' }).level, 'none');
});

test('credential wins over intent and destructive wins over commitment', () => {
  assert.equal(classifyRisk({ node: { type: 'password' }, context: 'Salvar senha' }).level, 'credential');
  assert.equal(classifyRisk({ context: 'Cancelar pedido' }).level, 'destructive');
  assert.equal(classifyRisk({ context: 'Confirmar compra' }).level, 'commitment');
});

test('the approval mode alone explains the confirmation when the control is not risky', () => {
  assert.match(approvalReasonForMode('always-ask'), /Sempre perguntar/);
  assert.match(approvalReasonForMode('allow-read', { readOnly: false }), /Permitir leitura/);
  assert.equal(approvalReasonForMode('allow-read', { readOnly: true }), null);
  assert.equal(approvalReasonForMode('low-risk', { readOnly: false }), null);
  assert.equal(approvalReasonForMode('allow-all'), null);
});
