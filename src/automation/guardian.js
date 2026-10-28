// Guardian: revisor independente e determinístico de cada ação e da resposta final.
// Não chama modelo e não substitui a aprovação do usuário — recusa só o que a política proíbe sozinha.

const { isSameSite } = require('../main/browser-policy');
const { checkCode } = require('./sandbox');

const WEB_PROTOCOLS = new Set(['http:', 'https:']);
// Só efeito específico afirmado conta como promessa verificável; "tarefa concluída" genérico não é alegação de efeito.
const CLAIM = /(salvei|salvo com sucesso|enviei|gravei|apaguei|exclu[ií]|comprei|paguei|baixei|criei|atualizei|alterei|preenchi|publiquei|assinei)/i;

function parseHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return WEB_PROTOCOLS.has(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function sameOriginList(pageUrl, allowed) {
  if (!pageUrl) return true;
  return (allowed || []).some((origin) => {
    try {
      return new URL(String(origin)).origin === new URL(pageUrl).origin;
    } catch {
      return false;
    }
  });
}

// Revisa a ação antes de executar. deny bloqueia; flag só informa; allow segue o fluxo normal (com aprovação própria).
function reviewAction({ name, args = {}, pageUrl = '', taskOrigin = '', authenticationOrigins = [] } = {}) {
  const reasons = [];
  const flags = [];
  const deny = (reason) => reasons.push(reason);

  if (name === 'navigate' || (name === 'tabs' && args.action === 'new')) {
    const target = parseHttpUrl(args.url);
    if (!target) deny('navegação fora de HTTP/HTTPS');
    else if (target.username || target.password) deny('URL com usuário e senha embutidos');
  }

  if (name === 'upload_file') {
    // Arquivo local indo para outra origem é exfiltração: só a origem da tarefa (ou de login) pode receber.
    const allowed = [taskOrigin, ...(authenticationOrigins || [])].filter(Boolean);
    if (pageUrl && allowed.length && !sameOriginList(pageUrl, allowed)) {
      deny(`upload para origem diferente da tarefa (${pageUrl})`);
    } else if (!taskOrigin && pageUrl) {
      flags.push('upload sem origem de tarefa declarada');
    }
  }

  if (name === 'formAction' && args.url) {
    const target = parseHttpUrl(args.url);
    if (target && pageUrl && !isSameSite(pageUrl, target.href)) deny('formulário enviaria dados para outro site');
  }

  if (name === 'recipe' && args.action === 'save' && Array.isArray(args.steps)) {
    for (const [i, step] of args.steps.entries()) {
      if (step?.tool !== 'navigate') continue;
      if (!parseHttpUrl(step.args?.url)) deny(`passo ${i + 1} da receita navega fora de HTTP/HTTPS`);
    }
    if (args.authority === 'read' && args.steps.some((step) => step?.tool === 'sheets' && step.args?.action === 'write')) {
      deny('receita de leitura não pode gravar na planilha');
    }
  }

  if (name === 'transform') {
    const problem = checkCode(args.code);
    if (problem) deny(problem);
  }
  // Só valida o código quando ele veio na chamada; module run sem code usa o código já salvo.
  if (name === 'module' && (args.action === 'save' || args.action === 'run')) {
    const code = typeof args.code === 'string' ? args.code.trim() : '';
    if (code) {
      const problem = checkCode(code);
      if (problem) deny(problem);
    } else if (args.action === 'save') {
      deny('módulo sem código');
    }
  }

  if (name === 'clipboard' && args.action === 'write') flags.push('gravação na área de transferência');
  if (name === 'visual_click') flags.push('clique por coordenada (sem alvo semântico)');
  if (name === 'key_sequence' && Array.isArray(args.steps)) {
    const keys = args.steps.flatMap((step) => (Array.isArray(step?.keys) ? step.keys : []));
    if (keys.some((key) => /^(Enter|NumpadEnter)$/i.test(String(key)))) flags.push('sequência termina com Enter');
  }

  return {
    decision: reasons.length ? 'deny' : 'allow',
    reasons,
    flags,
    reviewedBy: 'guardian/1'
  };
}

// Revisa a resposta final: afirmação de efeito sem prova é no mínimo um aviso; contra o contrato, contradição.
function reviewFinal({ message = '', verification = null } = {}) {
  const claims = CLAIM.test(String(message));
  if (!claims) return { decision: 'ok', reasons: [], reviewedBy: 'guardian/1' };
  if (verification && verification.ok === false) {
    return {
      decision: 'contradiction',
      reasons: ['a resposta afirma conclusão, mas o contrato de verificação falhou'],
      reviewedBy: 'guardian/1'
    };
  }
  if (!verification) {
    return {
      decision: 'warn',
      reasons: ['a resposta afirma conclusão sem contrato de verificação'],
      reviewedBy: 'guardian/1'
    };
  }
  return { decision: 'ok', reasons: [], reviewedBy: 'guardian/1' };
}

module.exports = { reviewAction, reviewFinal };
