const { z } = require('zod');

// Política de uma tarefa de avaliação: 'local-fixture' só aceita páginas locais; { kind: 'public-sites', hosts } só HTTPS nesses sites (e subdomínios).
function taskPolicyAllows(policy, value) {
  if (policy === 'local-fixture') return isLoopbackUrl(value);
  if (policy?.kind !== 'public-sites') return false;
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === 'https:' && policy.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function isLoopbackUrl(value) {
  try {
    const { protocol, hostname } = new URL(value);
    return ['http:', 'https:'].includes(protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

// Typed text stays out of the trace (only its length), so a trace can be saved without the values the agent filled.
const HUMAN_CHECK_GUARDED_TOOLS = new Set(['click', 'type_text', 'cua_action', 'locator_action', 'navigate', 'click_text', 'hidden_action', 'run_steps']);

// Captura menor para o modelo: JPEG com no máximo 1280 px de largura. Fora do Electron (testes) devolve a original.
function compactScreenshot(dataUrl) {
  try {
    const { nativeImage } = require('electron');
    let image = nativeImage.createFromDataURL(dataUrl);
    if (image.getSize().width > 1280) image = image.resize({ width: 1280, quality: 'good' });
    return `data:image/jpeg;base64,${image.toJPEG(70).toString('base64')}`;
  } catch {
    return dataUrl;
  }
}

// Troca as imagens já enviadas por um texto curto; devolve se havia alguma.
function dropImages(messages, note) {
  let dropped = false;
  for (const message of messages) {
    if (!Array.isArray(message.content) || !message.content.some((part) => part.type === 'image_url')) continue;
    message.content = `[Zero Browser] ${note}`;
    dropped = true;
  }
  return dropped;
}

function traceToolCall(step, tool, args, output, startedAt) {
  const safeArgs = Object.fromEntries(Object.entries(args || {}).map(([key, value]) =>
    ['text', 'value'].includes(key) ? [key, `<${String(value ?? '').length} caracteres>`] : [key, value]));
  return {
    step,
    tool,
    args: safeArgs,
    success: output?.success !== false && output?.outcomeVerified !== false,
    ...(typeof output?.actionExecuted === 'boolean' ? { actionExecuted: output.actionExecuted } : {}),
    ...(typeof output?.outcomeVerified === 'boolean' ? { outcomeVerified: output.outcomeVerified } : {}),
    ...(tool === 'tabs' && args?.action === 'read_batch' && Array.isArray(output?.pages) ? {
      batchPagesRead: output.coverage?.pagesRead ?? output.pages.filter((page) => !page.error).length,
      ...(output.coverage ? {
        batchComplete: output.coverage.complete,
        batchPagesWithMatches: output.coverage.pagesWithMatches,
        batchPagesWithoutMatches: output.coverage.pagesWithoutMatches,
        batchPagesTruncated: output.coverage.pagesTruncated,
        batchTabsOmitted: output.coverage.tabsOmitted,
        ...(Number.isFinite(output.coverage.matchesFound) ? {
          batchMatchesFound: output.coverage.matchesFound,
          batchMatchesReturned: output.coverage.matchesReturned,
          batchMatchesOmitted: output.coverage.matchesOmitted
        } : {})
      } : {})
    } : {}),
    ...(output?.error ? { error: String(output.error).slice(0, 300) } : {}),
    ms: Date.now() - startedAt
  };
}

function selectOptionScript(targetId, requestedOption) {
  return `(async () => {
    const selector='a[href],button,input:not([type=hidden]),textarea,select,[role],[tabindex]:not([tabindex="-1"])';
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]')};
    const registry=window.__naveganteTargetRegistry;
    const targetId=${JSON.stringify(targetId)};
    const nodes=[...document.querySelectorAll(selector)].filter(visible);
    const matches=registry&&targetId?nodes.filter(e=>registry.ids.get(e)===targetId):[];
    if(matches.length!==1)return {success:false,error:'A lista inspecionada foi substituída ou deixou de ser única; inspecione o formulário de novo'};
    const node=matches[0];
    if(node.tagName!=='SELECT')return {success:false,error:'O controle inspecionado não é mais uma lista <select>'};
    const identity={id:node.id||'',name:node.getAttribute('name')||'',ariaLabel:node.getAttribute('aria-label')||'',placeholder:node.getAttribute('placeholder')||'',labels:[...(node.labels||[])].map(e=>String(e.innerText||e.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean),formId:node.form?.id||'',formName:node.form?.getAttribute('name')||''};
    const frameworkManaged=('_valueTracker' in node)||Object.keys(node).some(key=>key.startsWith('__reactProps$')||key.startsWith('__reactFiber$'));
    const norm=t=>String(t||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toLowerCase();
    const want=norm(${JSON.stringify(String(requestedOption ?? ''))});
    const all=[...node.options];
    const option=all.find(o=>norm(o.text)===want||norm(o.value)===want)||all.find(o=>norm(o.text).includes(want));
    if(!option)return {success:false,error:'Opção não encontrada',options:all.map(o=>o.text.trim()).slice(0,30)};
    const expected=String(option.value),selected=option.text.trim();
    node.focus();
    const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;
    if(setter)setter.call(node,expected);else node.value=expected;
    node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));
    await Promise.resolve();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(frameworkManaged)await new Promise(resolve=>setTimeout(resolve,160));
    let target=node,targetRemounted=false;
    if(!node.isConnected){
      const normalize=s=>String(s||'').replace(/\\s+/g,' ').trim();
      const replacements=nodes.filter(e=>e.isConnected&&e.tagName==='SELECT'
        &&(!identity.id||e.id===identity.id)&&(!identity.name||e.getAttribute('name')===identity.name)
        &&(!identity.ariaLabel||e.getAttribute('aria-label')===identity.ariaLabel)&&(!identity.placeholder||e.getAttribute('placeholder')===identity.placeholder)
        &&(!identity.labels.length||identity.labels.every(label=>[...(e.labels||[])].some(x=>normalize(x.innerText||x.textContent)===normalize(label))))
        &&(!identity.formId||e.form?.id===identity.formId)&&(!identity.formName||e.form?.getAttribute('name')===identity.formName));
      if(replacements.length!==1)return {success:true,actionExecuted:true,outcomeVerified:false,fieldState:replacements.length>1?'ambiguous-remount':'target-removed',targetRemounted:false,selected,error:'A seleção foi executada, mas o controle foi removido ou o substituto é ambíguo.'};
      target=replacements[0];targetRemounted=true;
    }
    const actual=String(target.value),outcomeVerified=actual===expected;
    return {success:true,actionExecuted:true,outcomeVerified,fieldState:targetRemounted?(outcomeVerified?'remounted-value-retained':'remounted-value-mismatch'):(outcomeVerified?'value-retained':frameworkManaged?'changed-after-framework-update':'value-mismatch'),targetRemounted,selected:target.selectedOptions[0]?.textContent?.trim()||selected,value:actual,...(outcomeVerified?{}:{error:'A seleção foi executada, mas não permaneceu após a atualização.'})};
  })()`;
}

const ActionSchema = z.object({
  kind: z.enum(['click', 'dblclick', 'drag', 'perform_secondary_action', 'press_key', 'scroll', 'select_text', 'set_value', 'type_text', 'paste']),
  elementIndex: z.number().nullable().optional(),
  targetId: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  force: z.boolean().optional(),
  timeout: z.number().optional(),
  key: z.string().optional(),
  duration: z.number().optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  pages: z.number().optional(),
  target: z.union([z.number(), z.tuple([z.number(), z.number()])]).optional(),
  fromIndex: z.number().optional(),
  toIndex: z.number().optional(),
  action: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  selectionType: z.string().optional(),
  value: z.string().optional(),
  text: z.string().optional()
});

const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.any(),
  annotations: z.object({
    readOnly: z.boolean().optional(),
    untrustedContent: z.boolean().optional(),
    consequential: z.boolean().optional()
  }).optional()
});

module.exports = {
  taskPolicyAllows, isLoopbackUrl, HUMAN_CHECK_GUARDED_TOOLS, compactScreenshot, dropImages,
  traceToolCall, selectOptionScript, ActionSchema, ToolSchema
};
