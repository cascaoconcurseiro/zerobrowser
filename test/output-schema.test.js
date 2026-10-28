const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOutputSchema, validateOutput, parseNumber, parseBoolean, parseArray, parseRange } = require('../src/automation/output-schema');
const { validateRecipe } = require('../src/automation/recipe-store');

test('numbers are read with Brazilian grouping and currency', () => {
  assert.equal(parseNumber('R$ 1.234,56'), 1234.56);
  assert.equal(parseNumber('1.234'), 1234);
  assert.equal(parseNumber('1,5'), 1.5);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('(12)'), -12);
  assert.equal(parseNumber('-3,25'), -3.25);
  assert.equal(parseNumber('12%'), 12);
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber(''), null);
});

test('booleans and arrays accept common spreadsheet text', () => {
  assert.equal(parseBoolean('Sim'), true);
  assert.equal(parseBoolean('não'), false);
  assert.equal(parseBoolean('0'), false);
  assert.equal(parseBoolean('talvez'), null);
  assert.deepEqual(parseArray('a\nb'), ['a', 'b']);
  assert.deepEqual(parseArray('a; b'), ['a', 'b']);
  assert.deepEqual(parseArray(''), []);
});

test('output schema requires A1 cells and known types', () => {
  assert.equal(validateOutputSchema(null), null);
  assert.equal(validateOutputSchema({ properties: { total: { type: 'number', cell: 'b2' } } }), null);
  assert.match(validateOutputSchema({ properties: {} }), /ao menos um campo/);
  assert.match(validateOutputSchema({ properties: { total: { type: 'money', cell: 'B2' } } }), /type/);
  assert.match(validateOutputSchema({ properties: { total: { type: 'number', cell: 'B' } } }), /célula A1/);
  assert.match(validateOutputSchema({ properties: { total: { type: 'number', cell: 'B2' } }, required: ['outro'] }), /required/);
  assert.deepEqual(parseRange('A1:C3'), { startColumn: 0, startRow: 0, endColumn: 2, endRow: 2 });
});

test('output is validated against the grid actually read', () => {
  const grid = [['Produto', 'Qtd', 'Preço'], ['Cabo', '2', 'R$ 1.234,50'], ['Fita', '', '10,5']];
  const schema = {
    properties: {
      produto: { type: 'string', cell: 'A2' },
      qtd: { type: 'number', cell: 'B2' },
      preco: { type: 'number', cell: 'C3' },
      vazio: { type: 'array', cell: 'B3' }
    },
    required: ['produto', 'qtd']
  };
  const verdict = validateOutput(schema, { grid, range: 'A1:C3' });
  assert.equal(verdict.ok, true, verdict.problems.join('; '));
  assert.deepEqual(verdict.output, { produto: 'Cabo', qtd: 2, preco: 10.5, vazio: [] });

  const missing = validateOutput(schema, { grid, range: 'B2:C3' });
  assert.equal(missing.ok, false, 'A2 fora do intervalo lido não vira valor inventado');
  assert.ok(missing.problems.some((problem) => /fora do intervalo/.test(problem)));

  const noRead = validateOutput(schema, {});
  assert.equal(noRead.ok, false);
  assert.match(noRead.problems[0], /nenhuma leitura/);
});

test('recipes accept sheets steps and an output contract, refusing writes when read-only', () => {
  const output = { properties: { total: { type: 'number', cell: 'B2' } } };
  const readStep = { tool: 'sheets', args: { action: 'read', range: 'A1:B2' } };
  assert.equal(validateRecipe({ name: 'ler', steps: [readStep], authority: 'read', output }), null);
  assert.match(validateRecipe({ name: 'ler', steps: [{ tool: 'sheets', args: { action: 'read' } }] }), /range A1/);
  assert.match(validateRecipe({ name: 'ler', steps: [{ tool: 'sheets', args: { action: 'apagar', range: 'A1' } }] }), /action/);
  assert.match(validateRecipe({ name: 'gravar', steps: [{ tool: 'sheets', args: { action: 'write', range: 'A1', values: [['x']] } }], authority: 'read' }), /sheets write/);
  assert.match(validateRecipe({ name: 'ler', steps: [readStep], output: { properties: { x: { type: 'number', cell: 'Z0' } } } }), /célula A1/);
});

test('runRecipe reads the sheet, validates the contract and reports an invalid output', async () => {
  const { AutomationService } = require('../src/automation/service');
  const service = new AutomationService();
  const tab = {
    state: {},
    webContents: {
      isDestroyed: () => false, isLoading: () => false,
      getURL: () => 'https://docs.google.com/spreadsheets/d/abc/edit',
      executeJavaScript: async () => ''
    }
  };
  service.tabs.set('tab-sheet', tab);
  let calls = 0;
  service.sheetsAction = async () => {
    calls += 1;
    return { success: true, range: 'A1:C3', values: [['Produto', 'Qtd', 'Preço'], ['Cabo', '2', 'R$ 1.234,50'], ['Fita', '3', '10,5']] };
  };

  const steps = [{ tool: 'sheets', args: { action: 'read', range: 'A1:C3' } }];
  const schema = { properties: { produto: { type: 'string', cell: 'A2' }, total: { type: 'number', cell: 'C2' } }, required: ['produto', 'total'] };
  const ok = await service.runRecipe('tab-sheet', tab, steps, {}, schema);
  assert.equal(ok.success, true);
  assert.equal(ok.outputValid, true);
  assert.deepEqual(ok.output, { produto: 'Cabo', total: 1234.5 });
  assert.equal(calls, 1);

  const invalid = await service.runRecipe('tab-sheet', tab, steps, {}, {
    properties: { ausente: { type: 'number', cell: 'D9' } }, required: ['ausente']
  });
  assert.equal(invalid.success, false);
  assert.equal(invalid.code, 'OUTPUT_INVALID');
  assert.ok(invalid.problems.length >= 1);
  assert.match(invalid.error, /contrato/);

  const semLeitura = await service.runRecipe('tab-sheet', tab, [{ tool: 'sheets', args: { action: 'goto', range: 'A1' } }], {}, schema);
  assert.equal(semLeitura.success, false);
  assert.match(semLeitura.problems[0], /nenhuma leitura/);
});
