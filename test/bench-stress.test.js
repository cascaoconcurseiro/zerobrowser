const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { tarefasStress } = require('../bench/tarefas-stress');
const { iniciarServidor } = require('../bench/servidor');
const { lerArgumentos } = require('../bench/avaliar');

test('observation is the default and benchmark can explicitly disable it', () => {
  assert.equal(lerArgumentos(['--conjunto=stress']).observeAfterActions, true);
  const options = lerArgumentos(['trial', '--conjunto=stress', '--observe']);
  assert.equal(options.conjunto, 'stress');
  assert.equal(options.observeAfterActions, true);
  assert.equal(lerArgumentos(['--conjunto=stress', '--no-observe']).observeAfterActions, false);
});

test('SPA stress verifier requires the actual saved state and every dynamic stage', () => {
  const task = tarefasStress[0];
  const expected = task.gabarito.estado;
  assert.equal(task.verificar(expected).aprovado, true);
  assert.equal(task.verificar({}, { mensagem: 'Reembolso registrado. Protocolo RB-5842-731.' }).aprovado, false);
  for (const field of ['cliente', 'pedido', 'serie', 'valor', 'protocolo']) {
    assert.equal(task.verificar({ ...expected, reembolso: { ...expected.reembolso, [field]: 'errado' } }).aprovado, false, field);
  }
  for (const missing of expected.etapas) {
    assert.equal(task.verificar({ ...expected, etapas: expected.etapas.filter((step) => step !== missing) }).aprovado, false, missing);
  }
});

test('ecommerce SPA verifier requires the persisted exact SKU, variant, quantity, price and stages', () => {
  const task = tarefasStress.find((item) => item.id === '47-spa-loja-carrinho');
  const expected = task.gabarito.estado;
  assert.equal(task.verificar(expected, { mensagem: 'Adicionado ao carrinho!' }).aprovado, true);
  assert.equal(task.verificar({}, { mensagem: 'Fone Aurora X Pro adicionado ao carrinho, total R$ 1.499,80.' }).aprovado, false, 'texto de sucesso sem estado');
  for (const field of ['sku', 'produto', 'marca', 'categoria', 'cor', 'conexao', 'quantidade', 'precoUnitario', 'subtotal']) {
    const wrong = structuredClone(expected);
    wrong.carrinho.itens[0][field] = field === 'quantidade' ? 1 : 'incorreto';
    assert.equal(task.verificar(wrong).aprovado, false, `estado incorreto: ${field}`);
  }
  for (const missing of expected.etapas) {
    assert.equal(task.verificar({ ...expected, etapas: expected.etapas.filter((step) => step !== missing) }).aprovado, false, `etapa ausente: ${missing}`);
  }
});

test('stress page and independent state endpoint are served by the dynamic local server', async () => {
  const server = await iniciarServidor();
  try {
    const id = tarefasStress[0].id;
    assert.equal(tarefasStress[0].startUrl, undefined, 'the evaluator must use its allocated loopback port');
    const page = await fetch(server.urlDa(id));
    assert.equal(page.status, 200);
    assert.match(await page.text(), /data-tarefa="45-spa-recovery"/);
    const state = tarefasStress[0].gabarito.estado;
    const response = await fetch(`${server.base}/api/estado/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    assert.equal(response.status, 200);
    assert.deepEqual(server.estadoDe(id), state);

    const shopId = '47-spa-loja-carrinho';
    const shopPage = await fetch(server.urlDa(shopId));
    assert.equal(shopPage.status, 200);
    const shopHtml = await shopPage.text();
    assert.match(shopHtml, /data-tarefa="47-spa-loja-carrinho"/);
    assert.match(shopHtml, /setTimeout\(load,300\)/, 'catalog search is debounced');
    assert.match(shopHtml, /const delay = query.length % 2 \? 680 : 260/, 'search responses have deterministic out-of-order latency');
    const commonScript = await (await fetch(`${server.base}/_comum.js`)).text();
    assert.match(commonScript, /api\/estado\//, 'the cart writes to the independent loopback state endpoint');
    assert.equal(tarefasStress.find((item) => item.id === shopId).startUrl, undefined, 'the evaluator must allocate a loopback URL');
    const expected = tarefasStress.find((item) => item.id === shopId).gabarito.estado;
    const posted = await fetch(`${server.base}/api/estado/${shopId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expected) });
    assert.equal(posted.status, 200);
    assert.deepEqual(server.estadoDe(shopId), expected);
  } finally {
    await server.fechar();
  }
});

test('ecommerce SPA inline JavaScript parses without runtime dependencies', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'bench', 'paginas', '47-spa-loja-carrinho.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter((source) => source.trim());
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: '47-spa-loja-carrinho.html' }));
});

test('spreadsheet task 48 requires exact independent seed, isolated edits, two autosaves and sorted row', () => {
  const task = tarefasStress.find((item) => item.id === '48-spreadsheet-grid');
  const initial = structuredClone(task.estadoInicial);
  const rows = initial.rows.map((row) => ({ ...row, ...(row.id === 'P-1021' ? { unidades: 8, valorUnitario: 260 } : {}), total: row.id === 'P-1021' ? 2080 : row.unidades * row.valorUnitario }));
  const unitSnapshot = Object.fromEntries(initial.rows.map((row) => [row.id, { unidades: row.id === 'P-1021' ? 8 : row.unidades, valorUnitario: row.valorUnitario, total: row.id === 'P-1021' ? 1000 : row.unidades * row.valorUnitario }]));
  const finalSnapshot = Object.fromEntries(rows.map((row) => [row.id, { unidades: row.unidades, valorUnitario: row.valorUnitario, total: row.total }]));
  const final = {
    estadoInicial: initial,
    estadoFinal: {
      rows,
      order: [...rows].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).map((row) => row.id),
      saves: [
        { revision: 1, rowId: 'P-1021', field: 'unidades', from: 3, to: 8, snapshot: unitSnapshot },
        { revision: 2, rowId: 'P-1021', field: 'valorUnitario', from: 125, to: 260, snapshot: finalSnapshot }
      ],
      saveCount: 2
    }
  };
  assert.equal(task.verificar(final).aprovado, true);
  assert.equal(task.verificar({ ...final, estadoInicial: { ...initial, rows: [] } }).aprovado, false, 'seed is fixed independently');
  const wrongField = structuredClone(final);
  wrongField.estadoFinal.rows.find((row) => row.id === 'P-1021').unidades = 7;
  assert.equal(task.verificar(wrongField).aprovado, false, 'target values must match');
  const dirtyOtherRow = structuredClone(final);
  dirtyOtherRow.estadoFinal.rows[0].unidades++;
  assert.equal(task.verificar(dirtyOtherRow).aprovado, false, 'other projects must remain unchanged');
  const missingSave = structuredClone(final);
  missingSave.estadoFinal.saves.pop();
  missingSave.estadoFinal.saveCount--;
  assert.equal(task.verificar(missingSave).aprovado, false, 'each edit must be persisted separately');
});

test('spreadsheet server restores fixed seed and ignores attempts to replace it', async () => {
  const server = await iniciarServidor();
  const id = '48-spreadsheet-grid';
  try {
    const seeded = await (await fetch(`${server.base}/api/estado/${id}`)).json();
    assert.deepEqual(seeded.estadoInicial, tarefasStress.find((task) => task.id === id).estadoInicial);
    await fetch(`${server.base}/api/estado/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estadoInicial: { rows: [] }, estadoFinal: { saveCount: 1 } }) });
    assert.equal(server.estadoDe(id).estadoInicial.rows.length, 60);
    server.limpar(id);
    assert.equal(server.estadoDe(id).estadoFinal, null);
    assert.equal(server.estadoDe(id).estadoInicial.rows.length, 60);
    const response = await fetch(server.urlDa(id));
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /data-tarefa="48-spreadsheet-grid"/);
    assert.match(html, /aria-label=/);
    assert.match(html, /Total calculado/);
    assert.match(html, /setTimeout\(resolve,650\)/, 'autosave has deterministic asynchronous latency');
    const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter((source) => source.trim());
    assert.equal(inline.length, 1);
    assert.doesNotThrow(() => new vm.Script(inline[0], { filename: '48-spreadsheet-grid.html' }));
  } finally {
    await server.fechar();
  }
});
