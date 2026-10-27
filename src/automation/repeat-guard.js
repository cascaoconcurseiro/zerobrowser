// Detecta o agente repetindo a mesma chamada que já falhou. O prompt manda trocar de abordagem após 2 falhas, mas
// modelos fracos insistem; o aviso no resultado economiza passos (cada passo é uma chamada ao modelo).
const NOTE = 'Esta mesma chamada, com os mesmos argumentos, já falhou 2 vezes. Não repita: inspecione a página de novo, use outro controle ou ferramenta, ou encerre explicando o que bloqueou.';

function createRepeatGuard() {
  const failures = new Map();
  return {
    // Chame depois de cada ferramenta. Devolve o aviso quando a 2ª falha idêntica acontece (e nas seguintes).
    record(name, args, output) {
      const key = `${name}:${JSON.stringify(args ?? {})}`;
      const failed = output?.success === false || output?.outcomeVerified === false;
      if (!failed) { failures.delete(key); return null; }
      const count = (failures.get(key) || 0) + 1;
      failures.set(key, count);
      return count >= 2 ? NOTE : null;
    }
  };
}

module.exports = { createRepeatGuard };
