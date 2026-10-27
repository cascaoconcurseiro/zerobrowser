// Snapshot por diferença: depois de uma ação, só os nodes que mudaram vão ao modelo; os iguais viram uma lista de faixas.
// A comparação é posicional (mesmo índice). Se a página deslocou índices (item inserido/removido), quase tudo difere e
// devolvemos null: o chamador manda o snapshot inteiro, que é sempre seguro.

const MAX_CHANGED_RATIO = 0.4;
const MIN_NODES = 12;

function ranges(indexes) {
  const out = [];
  let start = null;
  let prev = null;
  for (const index of indexes) {
    if (start === null) { start = prev = index; continue; }
    if (index === prev + 1) { prev = index; continue; }
    out.push(start === prev ? String(start) : `${start}-${prev}`);
    start = prev = index;
  }
  if (start !== null) out.push(start === prev ? String(start) : `${start}-${prev}`);
  return out.join(',');
}

function diffNodes(previous, next, { maxChangedRatio = MAX_CHANGED_RATIO, minNodes = MIN_NODES } = {}) {
  if (!Array.isArray(previous) || !Array.isArray(next)) return null;
  if (next.length < minNodes || previous.length < minNodes) return null;
  const same = [];
  const changed = [];
  next.forEach((node, index) => {
    if (index < previous.length && JSON.stringify(previous[index]) === JSON.stringify(node)) same.push(index);
    else changed.push({ index, ...node });
  });
  if (changed.length / next.length > maxChangedRatio) return null;
  return { iguais: ranges(same), nodes: changed, total: next.length };
}

module.exports = { diffNodes, MAX_CHANGED_RATIO, MIN_NODES };
