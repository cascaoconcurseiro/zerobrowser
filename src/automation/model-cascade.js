// Cascata de modelos: um modelo barato conduz a tarefa e o forte assume quando o caminho começa a falhar.
// Mesmo provedor e mesmo histórico; só muda o nome do modelo enviado em cada chamada.

function createModelCascade({ cheapModel, strongModel, failuresToEscalate = 2, successesToRelax = 3 } = {}) {
  const enabled = typeof cheapModel === 'string' && cheapModel.trim() !== '' && cheapModel !== strongModel;
  let escalated = false;
  let failures = 0;
  let successes = 0;
  const stats = { cheapCalls: 0, strongCalls: 0, escalations: 0 };

  return {
    enabled,
    stats,
    // Modelo para a próxima chamada; contabiliza o uso.
    pick() {
      if (!enabled) return strongModel;
      const strong = escalated;
      if (strong) stats.strongCalls++; else stats.cheapCalls++;
      return strong ? strongModel : cheapModel;
    },
    // Resultado de uma ferramenta: falha seguida ou repetição sobem para o forte; vários acertos seguidos voltam ao barato.
    record({ success, repeated = false }) {
      if (!enabled) return;
      if (success && !repeated) {
        failures = 0;
        if (escalated && ++successes >= successesToRelax) { escalated = false; successes = 0; }
        return;
      }
      successes = 0;
      failures++;
      if (!escalated && (repeated || failures >= failuresToEscalate)) {
        escalated = true;
        stats.escalations++;
      }
    },
    get escalated() { return escalated; }
  };
}

module.exports = { createModelCascade };
