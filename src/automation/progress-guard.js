// Guardião de progresso: cada rodada é uma chamada ao modelo. Se ele só lê, ou se o orçamento está acabando,
// o host injeta uma instrução curta em vez de deixar o modelo repetir até o limite.

const READ_TOOLS = new Set(['inspect_page', 'see_page', 'scroll', 'wait_for', 'calculate', 'check_task']);
const READ_ACTIONS = {
  tabs: new Set(['list', 'read_batch', 'switch']),
  downloads: new Set(['list', 'read', 'wait']),
  memory: new Set(['list']),
  recipe: new Set(['list', 'run']),
  module: new Set(['list', 'run']),
  sheets: new Set(['read', 'goto'])
};

// sheets batch conta como leitura só quando todas as operações são read/goto.
function isReadOnly(name, args = {}) {
  if (READ_TOOLS.has(name)) return true;
  const actions = READ_ACTIONS[name];
  if (!actions) return false;
  if (name === 'sheets' && args.action === 'batch') {
    const operations = Array.isArray(args.operations) ? args.operations : [];
    return operations.length > 0 && operations.every((operation) => ['read', 'goto'].includes(operation?.action));
  }
  return actions.has(args.action);
}

function createProgressGuard({ maxSteps = 40, halfAt = null } = {}) {
  let readTurns = 0;
  const used = new Set();
  const half = Number.isInteger(halfAt) ? halfAt : Math.ceil(maxSteps / 2);
  return {
    // turn: { tools: [{ name, args, ok }], budgetLeft }
    record({ tools = [], budgetLeft = 0 } = {}) {
      const mutated = tools.some((tool) => tool.ok !== false && !isReadOnly(tool.name, tool.args));
      readTurns = mutated ? 0 : readTurns + 1;
      const notes = [];
      if (readTurns === 3) notes.push('Você só leu nas últimas 3 rodadas. Aja com o que já sabe (click/type_text/sheets write) ou conclua.');
      if (readTurns === 5) notes.push('Cinco rodadas sem alterar nada. Pare de inspecionar: execute a ação que falta ou encerre dizendo o que bloqueou.');
      if (budgetLeft === half && !used.has('half')) {
        used.add('half');
        notes.push(`Restam ${budgetLeft} ações de ${maxSteps}. Agrupe ferramentas no mesmo turno (run_steps, sheets batch) e conclua assim que o pedido estiver satisfeito.`);
      }
      if (budgetLeft === 5 && !used.has('five')) {
        used.add('five');
        notes.push('Restam 5 ações: conclua agora com o que já tem ou diga exatamente o que falta.');
      }
      return notes.length ? notes.join(' ') : null;
    }
  };
}

module.exports = { createProgressGuard, isReadOnly };
