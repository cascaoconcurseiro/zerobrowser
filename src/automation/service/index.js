const { WebSocketServer } = require('ws');
const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('crypto');
const net = require('net');
const { z } = require('zod');
const { PROVIDERS, endpointFor, providerNetworkError, listModels } = require('../model-catalog');
const { Level } = require('level');
const fs = require('fs');
const path = require('path');
const { performCuaInput, performKeySequence } = require('../cua-input');
const { automationPipePath, pipeTokenPath } = require('../pipe-path');
const { publishProtectedToken } = require('../file-acl');
const { scrollSearchInPage } = require('../scroll-search');
const { summarizeBatchCoverage } = require('../batch-coverage');
const { getAgentTools } = require('../tools/agent-tool-registry');
const { guardToolOutput } = require('../injection-guard');
const { navigationLeakReason } = require('../exfiltration-guard');
const { calculate } = require('../calculator');
const { createRepeatGuard } = require('../repeat-guard');
const { cachedInputTokens, compactHref } = require('../usage-metrics');
const { cacheSeed, cacheRequestFields, cacheSummary } = require('../prompt-cache');
const { reviewAction, reviewFinal } = require('../guardian');
const { createProgressGuard } = require('../progress-guard');
const { mainContentScript } = require('../page-text');
const { TRANSFORM_TOOL, checkCode, runTransform } = require('../sandbox');
const { zeroEnv } = require('../../env');
const { approvalInstructionsFor, buildBasePrompt } = require('./prompt');
const { diffNodes } = require('../snapshot-diff');
const { createModelCascade } = require('../model-cascade');
const { readStreamedCompletion } = require('../stream-parser');
const { RUN_STEPS_TOOL, runSteps } = require('../action-script');
const { evaluateExpectation, needsPageText } = require('../expectation');
const { isConsequential, effectKey, normalizeUrl, planEffect, settleEffect } = require('../effect-journal');
const { classifyRisk, isAuthenticationIdentifier, approvalReasonForMode } = require('../risk');
const { validateChecks, evaluateChecks, CHECK_TASK_TOOL } = require('../task-verifier');
const { EXTRACT_TABLE_TOOL, validateRequest: validateTableRequest, shapeRows, buildTableScript } = require('../table-extractor');
const { JobStore } = require('../job-store');
const { MemoryStore, memoryPrompt, MEMORY_TOOL } = require('../memory-store');
const { ModuleStore, MODULE_TOOL, validateModule } = require('../module-store');
const { RecipeStore, RECIPE_TOOL, validateRecipe, applyRecipeInputs, missingRequiredInputs, normalizeOrigin } = require('../recipe-store');
const { validateOutput } = require('../output-schema');
const { CLIPBOARD_TOOL, validateClipboardRequest, shapeClipboardRead } = require('../clipboard');
const { KEY_SEQUENCE_TOOL, validateSequence, flattenKeys, needsFormApproval } = require('../key-sequence');
const { VISUAL_CLICK_TOOL, validateVisualClick, pointFromNormalized } = require('../visual-click');
const { SHEETS_ACCESSIBILITY_TOOL, isSheetsUrl, toggleSteps } = require('../sheets');
const { SHEETS_TOOL, validateSheetsRequest, valuesToTsv, readRangeSummary, focusNameBoxScript, readNameBoxScript, sheetsSnapshotScript } = require('../sheets-tool');
const { accessibleName } = require('../accessible-name');
const { waitForPostActionText } = require('../post-action-text');
const { runAgent } = require('./agent-runtime');
const {
  taskPolicyAllows, isLoopbackUrl, HUMAN_CHECK_GUARDED_TOOLS, compactScreenshot, dropImages,
  traceToolCall, selectOptionScript, ActionSchema, ToolSchema
} = require('./helpers');

function isCredentialTypingKey(keys = []) {
  const chords = Array.isArray(keys[0]) ? keys : [keys];
  return chords.some((chord) => {
    const normalized = chord.map((key) => String(key).toLowerCase());
    const hasControlModifier = normalized.some((key) => ['control', 'ctrl', 'meta', 'cmd', 'command', 'alt'].includes(key));
    const hasShiftInsert = normalized.includes('shift') && normalized.some((key) => ['insert', 'ins'].includes(key));
    if (hasShiftInsert || (hasControlModifier && normalized.includes('v'))) return true;
    if (hasControlModifier) return false;
    return normalized.some((key) => key === 'space' || (key.length === 1 && !/[\u0000-\u001f\u007f]/.test(key)));
  });
}

function isCredentialTypingAction(action) {
  return ['type_text', 'set_value', 'paste', 'select_option', 'cua_type'].includes(action.kind)
    || (action.kind === 'hidden_action' && ['fill', 'type', 'paste', 'select'].includes(action.action))
    || (action.kind === 'press_key' && isCredentialTypingKey([action.key]))
    || (action.kind === 'cua_keypress' && isCredentialTypingKey(action.keys));
}

const BOT_SAFE_CDP_COMMANDS = new Set(['Browser.getVersion', 'Page.getLayoutMetrics']);

function recordPostActionTextWait(trace, result) {
  if (!trace || !result) return;
  const metrics = trace.postActionTextWait || (trace.postActionTextWait = { count: 0, totalMs: 0, changed: 0, fallbacks: 0 });
  metrics.count += 1;
  metrics.totalMs += Math.max(0, Number(result.waitedMs) || 0);
  if (result.changed) metrics.changed += 1;
  if (result.fallback) metrics.fallbacks += 1;
}

class AutomationService {
  constructor({ fetchImpl = null } = {}) {
    this.fetchImpl = fetchImpl;
    this.postActionTextWait = waitForPostActionText;
    this.wss = null;
    this.wsToken = null;
    this.pipeServer = null;
    this.clients = new Map();
    this.tabs = new Map(); // tabId -> { webContents, browserId, state }
    this.tools = new Map();
    this.db = null;
    this.pipePath = null;
    this.effectJournal = null; // journal de efeitos consequentes (opt-in por tarefa); criado em start()
    this.recipeStore = null; // receitas determinísticas por origem (opt-in por tarefa); criado em start()
    this.jobStore = null; // tarefas pausadas que sobrevivem ao reinício (TTL 20 min); criado em start()
    this.memoryStore = null; // fatos por origem com TTL de 30 dias; criado em start()
    this.moduleStore = null; // modulos deterministicos escritos pelo agente; criado em start()
    this.clipboard = null; // implementação injetada pelo processo principal (electron.clipboard)
    this.browserControls = {};
    this.approvalHandler = null;
    this.settingsProvider = null;
    this.agentConfigProvider = null;
    this.taskApprovalPolicies = new Map(); // tabId -> 'local-fixture' | 'deny', only while run_task owns the tab
    this.taskAuthOrigins = new Map(); // tabId -> origens de login permitidas para credencial
    this.agentTabs = new Set(); // abas em que o agente está agindo agora (downloads delas não abrem a janela "Salvar")
    this.activeAgentRuns = new Map(); // root tab id -> AbortController da tarefa em andamento
    this.pausedAgentRuns = new Map(); // Histórico só em memória; nunca guarda chave API.
    this.interventionHandler = null;
    this.humanCheckPollMs = 1500;
    this.humanCheckTimeoutMs = 10 * 60 * 1000;
    this.running = false;
  }

  setBrowserControls(controls = {}) {
    this.browserControls = controls;
  }

  setApprovalHandler(handler) {
    this.approvalHandler = handler;
  }

  setSettingsProvider(provider) {
    this.settingsProvider = provider;
  }

  setInterventionHandler(handler) {
    this.interventionHandler = handler;
  }

  // Read-only look for a visible CAPTCHA or "verify you are human" page. The agent never solves these.
  async detectHumanCheck(tabId) {
    const wc = this.tabs.get(tabId)?.webContents;
    if (!wc || wc.isDestroyed()) return { detected: false };
    try {
      const found = await wc.executeJavaScript(`(() => {
        const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
        const frame=[...document.querySelectorAll('iframe[src]')].find(f=>visible(f)&&/recaptcha|hcaptcha\\.com|challenges\\.cloudflare\\.com|arkoselabs|funcaptcha|geetest/i.test(f.src));
        if(frame)return {kind:'iframe',hint:new URL(frame.src,location.href).hostname};
        const widget=[...document.querySelectorAll('.g-recaptcha,.h-captcha,.cf-turnstile,[data-sitekey],#challenge-form')].find(visible);
        if(widget)return {kind:'widget',hint:widget.className||widget.id||'data-sitekey'};
        if(/just a moment|attention required|verify you are human|um momento/i.test(document.title))return {kind:'challenge_page',hint:document.title.slice(0,80)};
        return null;
      })()`);
      return ['iframe', 'widget', 'challenge_page'].includes(found?.kind) ? { detected: true, kind: found.kind, hint: String(found.hint || '').slice(0, 120) } : { detected: false };
    } catch {
      return { detected: false };
    }
  }

  // Waits for the user to clear a human check. run_task (benchmark) and missing UI never wait.
  async pauseForHumanCheck(tabId, info, trace) {
    if (trace) trace.humanChecks = (trace.humanChecks || 0) + 1;
    if (this.taskApprovalPolicies.has(tabId) || typeof this.interventionHandler !== 'function') return { resumed: false };
    const tab = this.tabs.get(tabId);
    let origin = 'origem desconhecida';
    try { origin = new URL(tab?.webContents?.getURL?.() || tab?.state?.url || '').origin; } catch {}
    const controller = new AbortController();
    const id = `hc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let timer;
    let poller;
    try {
      const fromUser = Promise.resolve(this.interventionHandler({ id, tabId, kind: info?.kind || 'captcha', origin }, controller.signal))
        .then((action) => ({ resumed: action === 'continue' }))
        .catch(() => ({ resumed: false }));
      const cleared = new Promise((resolve) => {
        let clearChecks = 0;
        const check = async () => {
          if (controller.signal.aborted) return;
          clearChecks = (await this.detectHumanCheck(tabId)).detected ? 0 : clearChecks + 1;
          if (clearChecks >= 2) resolve({ resumed: true });
          else poller = setTimeout(check, this.humanCheckPollMs);
        };
        poller = setTimeout(check, this.humanCheckPollMs);
      });
      const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ resumed: false }), this.humanCheckTimeoutMs); });
      return await Promise.race([fromUser, cleared, timeout]);
    } finally {
      clearTimeout(timer);
      clearTimeout(poller);
      controller.abort();
    }
  }

  // Ativa ou desativa a moldura visual de Aurora Boreal na aba em que a IA está agindo.
  async setAuroraActive(tab, active = true, statusText = '') {
    const wc = tab?.webContents;
    if (!wc || typeof wc.insertCSS !== 'function' || typeof wc.executeJavaScript !== 'function' || (wc.isDestroyed && wc.isDestroyed())) return;
    try {
      if (active) {
        await wc.executeJavaScript(`(() => {
          try {
            let aurora = document.getElementById('__zero_aurora_frame__');
            if (!aurora) {
              const style = document.createElement('style');
              style.id = '__zero_aurora_style__';
              style.textContent = \`
                @keyframes zero-aurora-glow {
                  0% {
                    border-color: #10b981;
                    box-shadow: inset 0 0 25px rgba(16, 185, 129, 0.45), inset 0 0 50px rgba(6, 182, 212, 0.25);
                  }
                  33% {
                    border-color: #06b6d4;
                    box-shadow: inset 0 0 30px rgba(6, 182, 212, 0.5), inset 0 0 60px rgba(99, 102, 241, 0.3);
                  }
                  66% {
                    border-color: #8b5cf6;
                    box-shadow: inset 0 0 32px rgba(139, 92, 246, 0.45), inset 0 0 65px rgba(236, 72, 153, 0.25);
                  }
                  100% {
                    border-color: #10b981;
                    box-shadow: inset 0 0 25px rgba(16, 185, 129, 0.45), inset 0 0 50px rgba(6, 182, 212, 0.25);
                  }
                }
                #__zero_aurora_frame__ {
                  position: fixed !important;
                  inset: 0 !important;
                  pointer-events: none !important;
                  z-index: 2147483647 !important;
                  box-sizing: border-box !important;
                  border: 4px solid #10b981 !important;
                  border-image: linear-gradient(135deg, #10b981, #06b6d4, #6366f1, #a855f7, #ec4899, #10b981) 1 !important;
                  animation: zero-aurora-glow 4s ease-in-out infinite !important;
                  user-select: none !important;
                }
                #__zero_aurora_badge__ {
                  position: absolute !important;
                  top: 14px !important;
                  right: 18px !important;
                  display: flex !important;
                  align-items: center !important;
                  gap: 8px !important;
                  padding: 7px 14px !important;
                  background: rgba(18, 20, 24, 0.92) !important;
                  backdrop-filter: blur(10px) !important;
                  border: 1px solid rgba(255, 255, 255, 0.16) !important;
                  border-radius: 9999px !important;
                  color: #f1f5f9 !important;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                  font-size: 11px !important;
                  font-weight: 600 !important;
                  letter-spacing: 0.3px !important;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.55) !important;
                  pointer-events: none !important;
                }
                #__zero_aurora_dot__ {
                  width: 7px !important;
                  height: 7px !important;
                  border-radius: 50% !important;
                  background: #10b981 !important;
                  box-shadow: 0 0 8px #10b981 !important;
                }
              \`;
              (document.head || document.documentElement).appendChild(style);
              aurora = document.createElement('div');
              aurora.id = '__zero_aurora_frame__';
              const badge = document.createElement('div');
              badge.id = '__zero_aurora_badge__';
              badge.innerHTML = '<span id="__zero_aurora_dot__"></span><span id="__zero_aurora_text__">Chefe, IA no controle</span>';
              aurora.appendChild(badge);
              (document.body || document.documentElement).appendChild(aurora);
            }
            const textEl = document.getElementById('__zero_aurora_text__');
            if (textEl && ${JSON.stringify(statusText || '')}) {
              textEl.textContent = ${JSON.stringify(statusText || 'Chefe, IA no controle')};
            }
          } catch {}
        })()`);
      } else {
        await wc.executeJavaScript(`(() => {
          try {
            document.getElementById('__zero_aurora_frame__')?.remove();
            document.getElementById('__zero_aurora_style__')?.remove();
          } catch {}
        })()`);
      }
    } catch {}
  }

  setAgentConfigProvider(provider) {
    this.agentConfigProvider = provider;
  }

  setFetchImplementation(fetchImpl) {
    this.fetchImpl = fetchImpl;
  }

  // Injetado pelo processo principal: { readText(), writeText(text) }. Sem isso, as ferramentas de clipboard recusam.
  setClipboard(clipboard) {
    this.clipboard = clipboard || null;
  }

  cancelAgentRun(tabId) {
    const controller = this.activeAgentRuns.get(String(tabId));
    if (!controller) return { success: false, error: 'Não há tarefa ativa nesta aba.' };
    controller.abort();
    return { success: true };
  }

  fetch(url, options) {
    const fetchImpl = this.fetchImpl || globalThis.fetch;
    return fetchImpl(url, options);
  }

  async confirmConsequentialAction(tabId, action) {
    const tab = this.tabs.get(tabId);
    // A run_task policy replaces the user's mode for its own tab: low-risk checks, answered without a dialog.
    const taskPolicy = this.taskApprovalPolicies.get(tabId);
    const settings = this.settingsProvider?.() || {};
    const isBotProfile = settings.isBotProfile === true;
    const approvalMode = taskPolicy ? 'low-risk' : settings.automationApprovalMode || 'low-risk';
    const credentialInput = isCredentialTypingAction(action);
    const inspectCredentialTarget = isBotProfile && credentialInput;
    if (isBotProfile && action.kind === 'browser_evaluate') {
      return { approved: false, required: true, cancelled: true, error: 'JavaScript livre da página fica desativado em perfis de bot para proteger campos de credenciais.' };
    }
    if (isBotProfile && action.kind === 'browser_cdp_send' && !BOT_SAFE_CDP_COMMANDS.has(action.method)) {
      return { approved: false, required: true, cancelled: true, error: 'Comandos CDP que podem ler ou alterar a página ficam desativados em perfis de bot.' };
    }
    if (isBotProfile && action.kind === 'browser_cdp_events') {
      return { approved: false, required: true, cancelled: true, error: 'Eventos CDP ficam desativados em perfis de bot para evitar exposição de dados de formulário.' };
    }
    if (taskPolicy && action.kind === 'navigate' && !taskPolicyAllows(taskPolicy, action.url)) {
      return { approved: false, required: true, cancelled: true, error: 'Navegação bloqueada: esta tarefa de avaliação só pode abrir os sites liberados para ela' };
    }
    let sensitive = false;
    let inputTargetInspected = false;
    if ((!tab?.webContents || (typeof tab.webContents.isDestroyed === 'function' && tab.webContents.isDestroyed())) && action.kind !== 'browser_new_tab') return { approved: false, error: 'Aba indisponível' };
    if (isBotProfile && action.kind === 'browser_screenshot') {
      const error = await this.botScreenshotBlockReason(tabId);
      if (error) return { approved: false, required: true, cancelled: true, error };
    }
    const kind = action.kind || action.operation || 'ação';
    // Risco por capacidade: credencial > destrutivo > compromisso > escrita > nenhum.
    const riskOf = (context, node) => classifyRisk({ node, context });

    // Keep the existing fast path for ordinary actions; bot credential input still needs target classification.
    if (approvalMode === 'allow-all' && !inspectCredentialTarget) return { approved: true, required: false };

    let reason = approvalReasonForMode(approvalMode, { readOnly: action.readOnly === true });
    let targetName = '';
    if (!reason && action.kind === 'upload_file') {
      reason = 'Enviar um arquivo do computador para o site';
    } else if (!reason && action.kind === 'clipboard_write') {
      reason = 'Gravar na área de transferência do sistema';
    } else if (!reason && action.kind === 'sheets_write') {
      reason = 'Gravar um intervalo na planilha';
    } else if (!reason && action.kind === 'navigate' && !taskPolicy) {
      reason = navigationLeakReason(tab?.webContents?.getURL?.(), action.url);
    } else if (!reason && action.kind === 'browser_evaluate') {
      reason = 'Executar script arbitrário na página';
    } else if (!reason && action.kind === 'browser_cdp_send' && !action.readOnly) {
      reason = `Executar comando CDP ${action.method || ''}`;
    } else if ((!reason || inspectCredentialTarget) && action.kind === 'hidden_action' && (action.sensitiveInput || inspectCredentialTarget)) {
      inputTargetInspected = true;
      sensitive = action.sensitiveInput === true;
      targetName = String(action.targetName || '').slice(0, 160);
      if (sensitive) reason = 'Campo de senha, código de verificação ou pagamento';
    } else if ((!reason || inspectCredentialTarget) && String(action.kind || '').startsWith('cua_') && (!action.readOnly || inspectCredentialTarget)) {
      const point = action.path?.[0] || (Number.isFinite(action.x) && Number.isFinite(action.y) ? { x: action.x, y: action.y } : null);
      try {
        const node = await tab.webContents.executeJavaScript(`(() => {
          const p=${JSON.stringify(point)}; const el=p?document.elementFromPoint(p.x,p.y):document.activeElement; if(!el)return null;
          const root=el.getRootNode(); const inputTarget=(['INPUT','TEXTAREA'].includes(el.tagName)||el.isContentEditable)&&root===document&&!el.shadowRoot;
          const isAuthenticationIdentifier=${isAuthenticationIdentifier.toString()};
          const type=String(el.type||'').toLowerCase(), autocomplete=String(el.getAttribute('autocomplete')||'').toLowerCase();
          const form=el.form; const submitLabels=form?[...form.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' '):'';
          const authArgs={type,autocomplete,name:(el.name||'')+' '+el.id,label:(el.labels?[...el.labels].map(item=>item.innerText||'').join(' '):'')+' '+el.placeholder+' '+el.getAttribute('aria-label'),pageUrl:location.href,pageTitle:document.title};
          let authIdentifier=Boolean(form&&isAuthenticationIdentifier({...authArgs,formAction:form.action||'',formName:form.id+' '+form.getAttribute('name'),formLabel:form.getAttribute('aria-label')||'',formText:(form.innerText||'').slice(0,1200),submitLabels}));
          if(!form){let container=el.parentElement;for(let depth=0;container&&!authIdentifier&&depth<5;depth++,container=container.parentElement){const ctaLabels=[...container.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' '),containerName=[container.id,container.className,container.getAttribute('aria-label')].filter(Boolean).join(' ');authIdentifier=isAuthenticationIdentifier({...authArgs,nearbyText:(container.innerText||'').slice(0,1200),ctaLabels,containerName});}}
          const sensitiveInput=['password','one-time-code','cc-number','cc-csc','cc-exp'].includes(type)||/password|one-time-code|cc-number|cc-csc|cc-exp/.test(autocomplete)||/password|one-time-code|cc-number|cc-csc|cc-exp/i.test(el.name||'')||authIdentifier||Boolean(form&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName)&&[...form.elements].some(field=>field!==el&&String(field.type||'').toLowerCase()==='password'));
          const formAction=el.form?.action?(()=>{try{const u=new URL(el.form.action,location.href);return u.origin+u.pathname}catch{return ''}})():'';
          return {name:(el.getAttribute('aria-label')||el.labels?.[0]?.innerText||el.alt||el.title||el.placeholder||el.innerText||(!sensitiveInput?el.value:'')||el.tagName).trim().slice(0,160),role:el.getAttribute('role')||el.tagName.toLowerCase(),href:el.closest('a[href]')?.href||'',formAction,formMethod:el.form?.method||'',inForm:!!el.form,isSubmitControl:!!(el.form&&el.matches('input[type=submit],input[type=image],button:not([type]),button[type=submit]')),inputTarget,sensitiveInput};
        })()`);
        inputTargetInspected = credentialInput ? Boolean(node?.inputTarget) : Boolean(node);
        targetName = String(node?.name || '').slice(0,160);
        action.formAction = node?.formAction || '';
        const cuaRisk = riskOf([node?.name,node?.href,node?.formAction,node?.role].filter(Boolean).join(' '), node);
        sensitive = cuaRisk.level === 'credential';
        if (!inspectCredentialTarget || cuaRisk.level === 'credential') reason = cuaRisk.reason;
        if (!reason && ['cua_click','cua_double_click','cua_drag'].includes(action.kind) && !node) reason = 'Não foi possível verificar o controle no ponto informado';
        if (!reason && action.kind === 'cua_drag') reason = 'Arrastar pode alterar ou reorganizar conteúdo';
        if (!reason && action.kind === 'cua_keypress' && (action.keys||[]).some((key)=>['enter','return','space'].includes(String(key).toLowerCase())) && (!node||node.inForm||node.isSubmitControl)) reason = 'A tecla pode enviar um formulário ou ativar um controle';
        if (!reason && credentialInput && !node?.inputTarget) reason = 'Entrada bloqueada: não foi possível identificar com segurança o campo focado (frame, shadow DOM ou alvo desconhecido).';
        if (!reason && ['cua_type','cua_keypress'].includes(action.kind) && !node) reason = 'Não foi possível verificar o foco da página';
      } catch {
        if (['cua_click','cua_double_click','cua_drag','cua_type','cua_keypress'].includes(action.kind)) reason = 'Não foi possível verificar o alvo da entrada visual';
      }
    } else if ((!reason || inspectCredentialTarget) && ['click', 'dblclick', 'perform_secondary_action', 'drag', 'press_key', 'type_text', 'set_value', 'paste', 'select_option', 'select_text'].includes(action.kind)) {
      const snapshot = await this.getAccessibilityTree(tabId, { maxNodes: 250 });
      if (!snapshot.success) {
        if (['click', 'dblclick', 'perform_secondary_action', 'drag', 'press_key'].includes(action.kind)) reason = 'Não foi possível verificar o alvo da ação';
      } else {
        const index = Number.isInteger(action.elementIndex) ? action.elementIndex : null;
        const node = action.targetId
          ? snapshot.tree.nodes.find((item) => item.targetId === action.targetId)
          : index === null ? snapshot.tree.nodes.find((item) => item.focused) : snapshot.tree.nodes[index];
        if (credentialInput) inputTargetInspected = Boolean(node);
        targetName = String(node?.name || '').slice(0, 160);
        action.formAction = node?.formAction || '';
        const context = [node?.name, node?.href, node?.formAction, node?.role, action.action].filter(Boolean).join(' ');
        const axRisk = riskOf(context, node);
        sensitive = axRisk.level === 'credential';
        if (!inspectCredentialTarget || axRisk.level === 'credential') reason = axRisk.reason;
        if (!reason && ['click', 'dblclick', 'perform_secondary_action'].includes(action.kind) && !node) reason = 'Não foi possível verificar o controle que será acionado';
        if (!reason && action.kind === 'drag') reason = 'Arrastar pode alterar ou reorganizar conteúdo';
        if (!reason && action.kind === 'press_key' && (action.key === 'Enter' && (!node || (node.inForm && node.tag !== 'textarea')) || action.key === ' ' && (!node || node.isSubmitControl))) reason = 'A tecla pode enviar um formulário ou ativar um controle';
        if (!reason && ['type_text', 'set_value', 'paste'].includes(action.kind) && !node) reason = 'Não foi possível verificar o campo de destino';
        if (!reason && action.targetId && !node) reason = 'O campo inspecionado foi substituído; inspecione a página novamente';
      }
    }

    if (inspectCredentialTarget && (sensitive || !inputTargetInspected)) {
      return {
        approved: false,
        required: true,
        cancelled: true,
        error: sensitive
          ? 'Este bot não pode digitar credenciais. Faça login manualmente no navegador.'
          : 'Não foi possível verificar o campo. Para proteger credenciais, digite manualmente no navegador.'
      };
    }

    // Classify targets before this shortcut: bot profiles must never use allow-all to enter credentials.
    if (approvalMode === 'allow-all') return { approved: true, required: false };

    // Credencial: só na origem da página ou em origens de autenticação declaradas; formulário cross-origin é recusado.
    if (sensitive) {
      let pageOrigin = '';
      try { pageOrigin = new URL(tab?.webContents?.getURL?.() || tab?.state.url || '').origin; } catch {}
      let formOrigin = '';
      try { formOrigin = action.formAction ? new URL(action.formAction).origin : ''; } catch {}
      const allowed = new Set([pageOrigin, ...(this.taskAuthOrigins?.get(tabId) || [])].filter(Boolean));
      if (formOrigin && !allowed.has(formOrigin)) {
        return {
          approved: false, required: true, cancelled: true,
          error: `Campo sensível recusado: o formulário envia para ${formOrigin}, fora da origem da página${pageOrigin ? ` (${pageOrigin})` : ''} e das origens de autenticação declaradas.`
        };
      }
    }

    if (!reason) return { approved: true, required: false };
    if (taskPolicy) {
      const pageUrl = tab?.webContents?.getURL?.() || tab?.state.url || '';
      const allowedHost = taskPolicyAllows(taskPolicy, pageUrl);
      // Credencial só é liberada quando a tarefa declara isso E o host está na lista (demo/QA sob pedido do usuário).
      if ((!sensitive || taskPolicy.allowsCredentials === true) && allowedHost) return { approved: true, required: true };
      return {
        approved: false, required: true, cancelled: true,
        error: sensitive
          ? 'Ação recusada: campo de senha, código ou pagamento não é liberado para esta tarefa de avaliação'
          : 'Ação recusada pela política da tarefa de avaliação'
      };
    }
    if (typeof this.approvalHandler !== 'function') {
      return { approved: false, required: true, error: 'Ação bloqueada: a confirmação do usuário não está disponível' };
    }
    const url = tab?.state.url || tab?.webContents?.getURL?.() || '';
    let origin = 'origem desconhecida';
    try { origin = new URL(url).origin; } catch {}
    let approved = false;
    try {
      approved = await this.approvalHandler({ tabId, origin, kind, reason, targetName, method: action.method });
    } catch {}
    return approved
      ? { approved: true, required: true }
      : { approved: false, required: true, cancelled: true, error: 'Ação cancelada pelo usuário' };
  }

  async start() {
    if (this.running) return;
    this.wsToken = randomBytes(32).toString('hex');

    try {
      this.db = new Level(path.join(zeroEnv('DATA_DIR') || process.cwd(), 'automation'), { valueEncoding: 'json' });
      await this.db.open();
    } catch {
      this.db = null;
    }

    try {
      const { EffectJournal, createFileStore } = require('../effect-journal');
      this.effectJournal = new EffectJournal({
        store: createFileStore(path.join(zeroEnv('DATA_DIR') || process.cwd(), 'automation', 'efeitos.json'))
      });
    } catch {
      this.effectJournal = null;
    }

    try {
      this.recipeStore = new RecipeStore({
        filePath: path.join(zeroEnv('DATA_DIR') || process.cwd(), 'automation', 'receitas.json')
      });
    } catch {
      this.recipeStore = null;
    }

    try {
      this.moduleStore = new ModuleStore({
        filePath: path.join(zeroEnv('DATA_DIR') || process.cwd(), 'automation', 'modulos.json')
      });
    } catch {
      this.moduleStore = null;
    }

    try {
      this.memoryStore = new MemoryStore({
        filePath: path.join(zeroEnv('DATA_DIR') || process.cwd(), 'automation', 'memoria.json')
      });
      await this.memoryStore.prune();
    } catch {
      this.memoryStore = null;
    }

    try {
      this.jobStore = new JobStore({
        filePath: path.join(zeroEnv('DATA_DIR') || process.cwd(), 'automation', 'tarefas.json')
      });
      const restored = await this.jobStore.prune();
      for (const job of restored) this.pausedAgentRuns.set(job.id, job);
    } catch {
      this.jobStore = null;
    }

    if (process.platform === 'win32') {
      try {
        this.pipePath = automationPipePath();
        // Token por execução: cliente local precisa provar que tem acesso à pasta de dados do usuário.
        this.pipeToken = randomBytes(32).toString('hex');
        this.pipeServer = net.createServer((socket) => this.acceptMcpPipeClient(socket));
        await new Promise((resolve, reject) => {
          this.pipeServer.once('error', reject);
          this.pipeServer.listen(this.pipePath, () => {
            this.pipeServer.removeListener('error', reject);
            resolve();
          });
        });
        // Só depois de possuir o pipe: uma segunda instância no mesmo perfil não pode sobrescrever o token da primeira.
        const tokenFile = pipeTokenPath();
        this.pipeTokenAcl = await publishProtectedToken(tokenFile, this.pipeToken);
      } catch {
        if (this.pipeServer?.listening) await new Promise((resolve) => this.pipeServer.close(resolve));
        this.pipeServer = null;
      }
    }
    this.wss = new WebSocketServer({
      host: '127.0.0.1',
      port: 0,
      verifyClient: ({ req }, done) => {
        // Este transporte é para clientes locais de processo. Navegadores/websites não recebem token nem Origin autorizado.
        const authorization = req.headers.authorization || '';
        const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        const expectedBuffer = Buffer.from(this.wsToken);
        const suppliedBuffer = Buffer.from(supplied);
        const authenticated = suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
        done(authenticated && !req.headers.origin, authenticated ? 403 : 401, 'Unauthorized');
      }
    });
    await new Promise((resolve, reject) => {
      this.wss.once('listening', resolve);
      this.wss.once('error', reject);
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = randomUUID();
      this.clients.set(clientId, { ws, tabs: new Set() });

      ws.on('message', async (data) => {
        let message;
        try {
          message = JSON.parse(data.toString());
          const result = await this.handleMessage(clientId, message);
          if (message.requestId) {
            ws.send(JSON.stringify({ type: 'result', requestId: message.requestId, data: result }));
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', requestId: message?.requestId, error: err.message }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      ws.send(JSON.stringify({ type: 'connected', clientId }));
    });

    this.registerTools();
    this.running = true;
    console.log('[Automation] Local compatibility service started');
  }

  async stop() {
    for (const controller of this.activeAgentRuns.values()) controller.abort();
    if (this.pipeServer) {
      const server = this.pipeServer;
      this.pipeServer = null;
      await new Promise((resolve) => server.close(resolve));
      // O token vale só enquanto este processo vive; não deixa credencial parada no perfil.
      try { await fs.promises.unlink(pipeTokenPath()); } catch {}
    }
    if (this.wss) {
      const server = this.wss;
      this.wss = null;
      await new Promise((resolve) => server.close(resolve));
    }
    this.clients.clear();
    this.wsToken = null;
    this.pausedAgentRuns.clear();
    this.tabs.clear();
    if (this.db) {
      const db = this.db;
      this.db = null;
      try {
        await db.close();
      } catch {}
    }
    this.running = false;
  }

  acceptMcpPipeClient(socket) {
    let buffer = '';
    // Primeira linha é o token; sem ele o socket morre antes de qualquer JSON-RPC.
    let authenticated = false;
    socket.setEncoding('utf8');
    // destroy() sem listener de erro derrubaria o processo; conexão recusada é rotina, não exceção.
    socket.on('error', () => {});
    socket.on('data', async (chunk) => {
      buffer += chunk;
      if (buffer.length > 1024 * 1024) {
        socket.destroy();
        return;
      }
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        if (!authenticated) {
          const expected = Buffer.from(String(this.pipeToken || ''));
          const supplied = Buffer.from(line);
          if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
            socket.destroy();
            return;
          }
          authenticated = true;
          continue;
        }
        let request;
        try {
          request = JSON.parse(line);
          const result = await this.handleMcpRequest(request);
          if (request.id !== undefined) socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`);
        } catch (error) {
          if (request?.id !== undefined) socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: error.code || -32603, message: error.message } })}\n`);
        }
      }
    });
  }

  async handleMcpRequest(request) {
    if (request?.jsonrpc !== '2.0' || typeof request.method !== 'string') {
      const error = new Error('Invalid JSON-RPC 2.0 request');
      error.code = -32600;
      throw error;
    }
    switch (request.method) {
      case 'initialize':
        return { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'zero-browser', version: require('../../../package.json').version } };
      case 'notifications/initialized':
      case 'ping':
        return {};
      case 'tools/list':
        return { tools: this.listTools().tools };
      case 'tools/call': {
        const { name, arguments: args = {} } = request.params || {};
        const result = await this.callTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: result?.success === false };
      }
      default: {
        const error = new Error(`Method not found: ${request.method}`);
        error.code = -32601;
        throw error;
      }
    }
  }

  registerTab(tabId, webContents, browserId) {
    const tab = {
      webContents,
      browserId,
      state: { url: '', title: '', loading: false },
      axCache: null,
      cdpEvents: [],
      cdpSequence: 0,
      cdpMessageHandler: null
    };
    if (webContents?.debugger) {
      tab.cdpMessageHandler = (_event, method, params) => {
        tab.cdpEvents.push({ sequence: ++tab.cdpSequence, method, params, timestamp: Date.now() });
        if (tab.cdpEvents.length > 1000) tab.cdpEvents.shift();
      };
      webContents.debugger.on('message', tab.cdpMessageHandler);
    }
    this.tabs.set(tabId, tab);
  }

  // Pausa que precisa sobreviver ao reinício: grava no disco sem bloquear o fluxo da tarefa.
  // O id vai dentro do estado porque listJobs() e o botão "Continuar" leem dele, não da chave do Map.
  rememberPausedRun(id, state) {
    const entry = { ...state, id };
    this.pausedAgentRuns.set(id, entry);
    this.jobStore?.save(id, entry).catch(() => {});
  }

  forgetPausedRun(id) {
    this.pausedAgentRuns.delete(id);
    this.jobStore?.remove(id).catch(() => {});
  }

  // Biblioteca local: receita vira artefato JSON e volta sem depender de banco.
  async exportRecipe(origin, name) {
    if (!this.recipeStore) return { success: false, error: 'Armazenamento de receitas indisponível' };
    const recipe = await this.recipeStore.get(origin, name);
    if (!recipe) return { success: false, error: `Receita "${name}" não existe para ${origin}` };
    let normalized;
    try {
      normalized = new URL(String(origin)).origin;
    } catch {
      return { success: false, error: 'Origem inválida' };
    }
    return { success: true, artifact: { kind: 'zero-recipe', version: 1, origin: normalized, ...recipe } };
  }

  async importRecipe(artifact) {
    if (!this.recipeStore) return { success: false, error: 'Armazenamento de receitas indisponível' };
    if (!artifact || artifact.kind !== 'zero-recipe' || artifact.version !== 1) {
      return { success: false, error: 'Artefato inválido: espere kind "zero-recipe" e version 1.' };
    }
    const invalid = validateRecipe({ name: artifact.name, steps: artifact.steps, input: artifact.input, authority: artifact.authority, output: artifact.output });
    if (invalid) return { success: false, error: invalid };
    const saved = await this.recipeStore.save(artifact.origin, artifact.name, artifact.steps, artifact.input || null, artifact.authority || 'write', artifact.output || null);
    return { success: true, name: saved.name, origin: saved.origin, steps: saved.steps.length };
  }

  async listMemories(limit = 50) {
    if (!this.memoryStore) return [];
    try {
      return await this.memoryStore.list({ origin: null, limit });
    } catch {
      return [];
    }
  }

  async saveMemory({ origin = '', text, kind = 'fact', replaceId = null } = {}) {
    if (!this.memoryStore) return { success: false, error: 'Memória indisponível' };
    try {
      if (replaceId) await this.memoryStore.forget(String(replaceId));
      const entry = await this.memoryStore.add({ origin, text, kind });
      return { success: true, memory: entry };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async forgetMemory(id) {
    if (!this.memoryStore) return false;
    try {
      return await this.memoryStore.forget(id);
    } catch {
      return false;
    }
  }

  async dropJob(id) {
    if (!id) return false;
    this.forgetPausedRun(String(id));
    return true;
  }

  // Lista enxuta para a interface oferecer "Continuar" depois de reabrir o app.
  // Lê a memória (já restaurada do disco em start()), então não corre com a gravação assíncrona.
  async listJobs() {
    const now = Date.now();
    return [...this.pausedAgentRuns.values()]
      .filter((job) => (job.expiresAt || 0) > now)
      .sort((a, b) => (b.taskStartedAt || 0) - (a.taskStartedAt || 0))
      .map((job) => ({
        id: job.id || job.resumeId || '',
        tabId: job.tabId,
        model: job.model,
        provider: job.provider,
        messages: Array.isArray(job.messages) ? job.messages.length : 0,
        lastUrl: job.lastUrl || '',
        startedAt: job.taskStartedAt,
        expiresAt: job.expiresAt
      }));
  }

  unregisterTab(tabId) {
    for (const [id, state] of this.pausedAgentRuns) {
      if (state.tabId === tabId || state.rootTabId === tabId) this.forgetPausedRun(id);
    }
    const tab = this.tabs.get(tabId);
    if (tab?.cdpMessageHandler && tab.webContents?.debugger) {
      tab.webContents.debugger.removeListener('message', tab.cdpMessageHandler);
    }
    this.tabs.delete(tabId);
  }

  updateTabState(tabId, state) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.state = { ...tab.state, ...state };
    }
  }

  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) throw new Error('Client not found');
    const data = message.data ?? message;

    switch (message.type) {
      case 'registerTab':
        this.registerTab(data.tabId, null, data.browserId);
        client.tabs.add(data.tabId);
        return { success: true };

      case 'executeAction':
        return this.executeAction(data.action ?? data);

      case 'getTabState':
        return this.getTabState(data.tabId);

      case 'cdpCommand':
        return this.sendCdpCommand(data.tabId, data.method, data.params);

      case 'listTools':
        return this.listTools();

      case 'getAccessibilityTree':
        return this.getAccessibilityTree(data.tabId, data.options);

      case 'executeAXAction':
        return this.executeAXAction(data.tabId, data.action);

      default:
        throw new Error(`Unsupported message type: ${message.type}`);
    }
  }

  async executeAction(action) {
    try {
      const validated = ActionSchema.parse(action);
      return await this.executeAXAction(action.tabId, validated);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async executeOnTab(tab, action) {
    const { webContents } = tab;
    if (!webContents || webContents.isDestroyed()) {
      throw new Error('Tab webContents destroyed');
    }

    return new Promise((resolve, reject) => {
      const requestId = randomUUID();
      const timeout = setTimeout(() => reject(new Error('Action timeout')), 30000);

      const handler = (event, result) => {
        if (event.requestId === requestId) {
          clearTimeout(timeout);
          webContents.removeListener('ax-action-result', handler);
          resolve(result);
        }
      };

      webContents.on('ax-action-result', handler);
      webContents.send('ax-action-request', { requestId, action });
    });
  }

  async getTabState(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return { success: false, error: 'Tab not found' };

    return {
      success: true,
      state: {
        url: tab.state.url,
        title: tab.state.title,
        loading: tab.state.loading,
        canGoBack: tab.webContents?.canGoBack() || false,
        canGoForward: tab.webContents?.canGoForward() || false
      }
    };
  }

  async sendCdpCommand(tabId, method, params) {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.webContents || tab.webContents.isDestroyed()) {
      return { success: false, error: 'Tab not found' };
    }

    const safeReadOnlyCommands = BOT_SAFE_CDP_COMMANDS;
    if (this.settingsProvider && !this.settingsProvider().developerCdpEnabled) {
      return { success: false, error: 'Ative “CDP completo” nas configurações para executar comandos CDP avançados.' };
    }
    const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_cdp_send', method, readOnly: safeReadOnlyCommands.has(method) });
    if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };

    if (!tab.webContents.debugger.isAttached()) {
      await tab.webContents.debugger.attach('1.3');
    }

    try {
      const result = await tab.webContents.debugger.sendCommand(method, params);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  listTools() {
    const tools = Array.from(this.tools.values());
    return { success: true, tools: tools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema: this.zodToJsonSchema(inputSchema)
    })) };
  }

  zodToJsonSchema(schema) {
    const def = schema?._def;
    if (!def) return { type: 'object', properties: {} };
    const type = typeof def.type === 'string' ? def.type : String(def.typeName || '').replace(/^Zod/, '').toLowerCase();
    if (['optional', 'nullable', 'default', 'prefault'].includes(type)) return this.zodToJsonSchema(def.innerType);
    if (type === 'effects') return this.zodToJsonSchema(def.schema);
    if (type === 'string') return { type: 'string' };
    if (type === 'number') return { type: 'number' };
    if (type === 'boolean') return { type: 'boolean' };
    if (type === 'enum') return { type: 'string', enum: def.values || Object.values(def.entries || {}) };
    if (type === 'array') return { type: 'array', items: this.zodToJsonSchema(def.element || def.type) };
    if (type === 'record') return { type: 'object', additionalProperties: this.zodToJsonSchema(def.valueType) };
    if (type === 'tuple') return { type: 'array', prefixItems: def.items.map((item) => this.zodToJsonSchema(item)), minItems: def.items.length, maxItems: def.items.length };
    if (type === 'union') return { anyOf: def.options.map((item) => this.zodToJsonSchema(item)) };
    if (type === 'object') {
      const properties = {};
      const required = [];
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
      for (const [key, value] of Object.entries(shape || {})) {
        properties[key] = this.zodToJsonSchema(value);
        const childDef = value?._def || {};
        const childType = typeof childDef.type === 'string' ? childDef.type : String(childDef.typeName || '').replace(/^Zod/, '').toLowerCase();
        if (!['optional', 'default', 'prefault'].includes(childType)) required.push(key);
      }
      return { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false };
    }
    if (type === 'any' || type === 'unknown') return {};
    return {};
  }

  async callTool(name, args = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const input = tool.inputSchema.parse(args);
    return tool.handler(input);
  }

  async waitForBrowserCondition(tab, condition, timeout) {
    const wc = tab.webContents;
    if (!wc || wc.isDestroyed()) throw new Error('Tab not found');
    if (condition === 'load' && !wc.isLoading()) return { success: true };
    if (condition === 'domcontentloaded') {
      const state = await wc.executeJavaScript('document.readyState').catch(() => 'loading');
      if (state === 'interactive' || state === 'complete') return { success: true };
    }

    return new Promise(async (resolve, reject) => {
      let settled = false;
      let idleTimer = null;
      let attachedHere = false;
      const inflight = new Set();
      const cleanup = () => {
        clearTimeout(timeoutTimer);
        clearTimeout(idleTimer);
        wc.removeListener('did-stop-loading', onLoad);
        wc.removeListener('dom-ready', onDomReady);
        wc.debugger?.removeListener('message', onCdpMessage);
        if (attachedHere && wc.debugger?.isAttached()) {
          try { wc.debugger.detach(); } catch {}
        }
      };
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve(value);
      };
      const onLoad = () => { if (condition === 'load') finish(null, { success: true }); };
      const onDomReady = () => { if (condition === 'domcontentloaded') finish(null, { success: true }); };
      const maybeIdle = () => {
        if (condition !== 'networkidle') return;
        clearTimeout(idleTimer);
        if (inflight.size === 0) idleTimer = setTimeout(() => finish(null, { success: true }), 500);
      };
      const onCdpMessage = (_event, method, params) => {
        if (method === 'Network.requestWillBeSent' && params.type !== 'WebSocket' && params.type !== 'EventSource') inflight.add(params.requestId);
        else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') inflight.delete(params.requestId);
        maybeIdle();
      };
      const timeoutTimer = setTimeout(() => finish(new Error(`Wait timeout (${condition})`)), timeout);

      wc.on('did-stop-loading', onLoad);
      wc.on('dom-ready', onDomReady);
      if (condition === 'networkidle') {
        try {
          if (!wc.debugger.isAttached()) { wc.debugger.attach('1.3'); attachedHere = true; }
          wc.debugger.on('message', onCdpMessage);
          await wc.debugger.sendCommand('Network.enable');
          maybeIdle();
        } catch (error) {
          finish(new Error(`Could not observe network idle: ${error.message}`));
        }
      }
      if (condition === 'load' && !wc.isLoading()) finish(null, { success: true });
    });
  }

  // `trace`, when given, is filled in place with model calls, token usage and every tool call (used by run_task).
  async runAgent(tabId, prompt, apiKey, model, allowTools = true, provider = 'openrouter', requireToolCall = false, options = {}) {
    return runAgent.call(this, tabId, prompt, apiKey, model, allowTools, provider, requireToolCall, options);
  }

  async resolveUploadFile(file, taskDownloads) {
    const directory = this.browserControls.downloadDirectory?.();
    if (!directory) throw new Error('Pasta de downloads indisponível');
    const fromTask = taskDownloads.find((item) => (item.id === file || item.filename === path.basename(file)) && item.state === 'completed' && item.path);
    const candidate = fromTask ? fromTask.path : path.join(directory, path.basename(file));
    let real;
    try {
      real = await fs.promises.realpath(candidate);
    } catch {
      throw new Error(`Arquivo "${file}" não encontrado na pasta de downloads`);
    }
    const root = await fs.promises.realpath(directory);
    if (!fromTask && path.dirname(real).toLowerCase() !== root.toLowerCase()) throw new Error('Só arquivos da pasta de downloads podem ser enviados');
    const stats = await fs.promises.stat(real);
    if (!stats.isFile()) throw new Error('O caminho não é um arquivo');
    if (stats.size > 50 * 1024 * 1024) throw new Error('Arquivo maior que 50 MB');
    return real;
  }

  async setFileInput(tab, { index, label }, filePath) {
    const debuggerApi = tab.webContents.debugger;
    const attachedHere = !debuggerApi.isAttached();
    if (attachedHere) debuggerApi.attach('1.3');
    try {
      // Mesma contagem de índices do inspect_page; sem índice, procura entre todos os input[type=file], visíveis ou não.
      const { result, exceptionDetails } = await debuggerApi.sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const selector='a[href],button,input:not([type=hidden]),textarea,select,[role],[tabindex]:not([tabindex="-1"])';
          const index=${JSON.stringify(index)}, label=${JSON.stringify(label.toLowerCase())};
          if(index!==null){
            const node=[...document.querySelectorAll(selector)].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]')})[index];
            const input=node?.matches('input[type=file]')?node:node?.querySelector?.('input[type=file]')||(node?.htmlFor&&document.getElementById(node.htmlFor));
            if(input?.matches?.('input[type=file]'))return input;
          }
          const all=[...document.querySelectorAll('input[type=file]')];
          const text=e=>[e.labels?.[0]?.innerText,e.getAttribute('aria-label'),e.name,e.id,e.closest('label,div,section,form')?.innerText].filter(Boolean).join(' ').toLowerCase();
          if(label){const hit=all.find(e=>text(e).includes(label));if(hit)return hit;}
          return all.length===1?all[0]:null;
        })()`
      });
      if (exceptionDetails || !result?.objectId) {
        const count = await tab.webContents.executeJavaScript(`document.querySelectorAll('input[type=file]').length`).catch(() => 0);
        throw new Error(count ? `Há ${count} campos de arquivo; informe index ou label` : 'Não há campo de arquivo nesta página');
      }
      await debuggerApi.sendCommand('DOM.setFileInputFiles', { files: [filePath], objectId: result.objectId });
      await debuggerApi.sendCommand('Runtime.callFunctionOn', { objectId: result.objectId, functionDeclaration: 'function(){this.dispatchEvent(new Event("input",{bubbles:true}));this.dispatchEvent(new Event("change",{bubbles:true}));}' }).catch(() => null);
      return { success: true, file: path.basename(filePath) };
    } finally {
      if (attachedHere && debuggerApi.isAttached()) {
        try { debuggerApi.detach(); } catch {}
      }
    }
  }

  // Verificação final declarada pelo chamador: lê URL, texto visível e downloads da própria tarefa. Nada é alterado.
  async verifyTask(tab, checks, since = 0) {
    const invalid = validateChecks(checks);
    if (invalid) return { ok: false, error: invalid, results: [] };
    const wc = tab?.webContents;
    let url = '';
    let text = '';
    if (wc && !wc.isDestroyed?.()) {
      try { url = String(wc.getURL?.() || ''); } catch {}
      if (checks.some((check) => check.kind !== 'download')) {
        text = await wc.executeJavaScript(`(document.body?.innerText||'').slice(0,30000)`).catch(() => '');
      }
    }
    const priceChecks = checks.filter((check) => check.kind === 'currencyAtMost');
    const priceEvidence = [];
    if (wc && !wc.isDestroyed?.() && priceChecks.length) {
      const labels = priceChecks.map((check) => check.value);
      const script = `(() => { const labels=${JSON.stringify(labels)}; const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'}; const all=[...document.body.querySelectorAll('*')]; return labels.map(label=>{const q=label.toLocaleLowerCase(); const found=all.filter(e=>visible(e)&&typeof e.innerText==='string'&&e.innerText.toLocaleLowerCase().includes(q)&&e.innerText.includes('R$')).map(e=>({text:e.innerText.trim()})).filter(x=>x.text.length<=1200).sort((a,b)=>a.text.length-b.text.length); return {product:label,text:found[0]?.text||''};}); })()`;
      try { const result = await wc.executeJavaScript(script); if (Array.isArray(result)) priceEvidence.push(...result); } catch {}
    }
    const downloads = (this.browserControls.listDownloads?.() || []).filter((item) => (item.startedAt || 0) >= since);
    return evaluateChecks(checks, { url, text: String(text || ''), downloads, priceEvidence });
  }

  // Leitura/gravação determinística de intervalo A1; usada pela ferramenta sheets e por receitas.
  async sheetsAction(tabId, tab, args, trace = null, { writeApproved = false } = {}) {
    const pageUrl = tab?.webContents?.getURL?.() || '';
    if (!isSheetsUrl(pageUrl)) throw new Error('A ferramenta sheets só funciona em docs.google.com/spreadsheets');
    const invalid = validateSheetsRequest(args);
    if (invalid) throw new Error(invalid);
    if (this.settingsProvider?.().isBotProfile === true
      && (args.action === 'read' || (args.action === 'batch' && args.operations.some((operation) => operation.action === 'read')))) {
      throw new Error('Leitura de planilha pela área de transferência fica indisponível em perfis de bot.');
    }
    if (!this.clipboard) throw new Error('Área de transferência indisponível neste processo');
    const wc = tab.webContents;
    if (args.action === 'batch') {
      const operations = args.operations;
      const writes = operations.filter((operation) => operation.action === 'write');
      if (writes.length && !writeApproved) {
        const approval = await this.confirmConsequentialAction(tabId, {
          kind: 'sheets_write', readOnly: false,
          targetName: writes.map((operation) => String(operation.range).toUpperCase()).join(', ')
        });
        if (!approval.approved) throw denied(approval, 'A gravação na planilha foi cancelada');
      }
      const results = [];
      for (const [index, operation] of operations.entries()) {
        const output = await this.sheetsAction(tabId, tab, {
          ...operation,
          maxRows: args.maxRows,
          maxColumns: args.maxColumns
        }, trace, { writeApproved: true });
        results.push({ step: index + 1, action: operation.action, range: String(operation.range).toUpperCase(), ...output });
        if (!output.success) {
          if (trace) trace.sheetsBatchFailures = (trace.sheetsBatchFailures || 0) + 1;
          return {
            success: false, code: 'BATCH_FAILED', failedAt: index + 1, completed: index, total: operations.length, results,
            error: `Operação ${index + 1} (${operation.action} ${operation.range}) falhou: ${output.error || 'sem detalhe'}`
          };
        }
      }
      if (trace) trace.sheetsBatches = (trace.sheetsBatches || 0) + 1;
      return { success: true, completed: operations.length, total: operations.length, results, note: 'Operações executadas em ordem; leituras voltam em results[i].values.' };
    }
    const range = String(args.range).trim().toUpperCase();
    if (args.action === 'write') {
      if (!writeApproved) {
        const approval = await this.confirmConsequentialAction(tabId, { kind: 'sheets_write', readOnly: false, targetName: range });
        if (!approval.approved) throw denied(approval, 'A gravação na planilha foi cancelada');
      }
      this.clipboard.writeText(valuesToTsv(args.values));
    }
    const focus = await wc.executeJavaScript(focusNameBoxScript()).catch(() => null);
    if (!focus?.found) {
      return {
        success: false, code: 'NAME_BOX_NOT_FOUND', range,
        error: 'Caixa de nome não encontrada nesta planilha; tente sheets_accessibility ou visual_click.',
        diagnostics: { nameBoxFound: false, url: pageUrl }
      };
    }
    let typed = false;
    try {
      if (typeof wc.insertText === 'function') {
        await wc.insertText(range);
        typed = true;
      }
    } catch {}
    if (!typed) {
      typed = await wc.executeJavaScript(`(() => {
        const box = document.querySelector('#t-name-box, input.waffle-name-box') || document.activeElement;
        if (!box) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(box, ${JSON.stringify(range)});
        box.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`).catch(() => false);
    }
    await performKeySequence(wc, [{ keys: ['Enter'] }], { delayMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 350));
    tab.axCache = null;
    const selectionInfo = await wc.executeJavaScript(readNameBoxScript()).catch(() => null);
    const selection = String(selectionInfo?.value || '');
    const diagnostics = {
      nameBoxFound: true,
      selector: focus.selector || '',
      typed: typed === true,
      selection,
      rangeApplied: selection.replace(/\s+/g, '').toUpperCase() === range
    };
    if (args.action === 'goto') {
      if (trace) trace.sheetsGotos = (trace.sheetsGotos || 0) + 1;
      return {
        success: true, range, diagnostics,
        note: diagnostics.rangeApplied ? 'Intervalo selecionado.' : 'O Enter pode não ter aplicado o intervalo; confira diagnostics.selection.'
      };
    }
    if (args.action === 'write') {
      await performKeySequence(wc, [{ keys: ['Control', 'v'] }], { delayMs: 0 });
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (trace) trace.sheetsWrites = (trace.sheetsWrites || 0) + 1;
      const columns = args.values.reduce((max, row) => Math.max(max, row.length), 0);
      return { success: true, range, rows: args.values.length, columns, diagnostics, note: 'Intervalo colado. Use sheets read para confirmar se precisar.' };
    }
    await performKeySequence(wc, [{ keys: ['Control', 'c'] }], { delayMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const text = this.clipboard.readText?.() ?? '';
    if (!text) {
      return {
        success: false, code: 'CLIPBOARD_EMPTY', range, diagnostics,
        error: 'A cópia voltou vazia; confira diagnostics.selection e se a planilha está em foco.'
      };
    }
    const summary = readRangeSummary(text, { maxRows: args.maxRows, maxColumns: args.maxColumns });
    if (trace) {
      trace.sheetsReads = (trace.sheetsReads || 0) + 1;
      trace.sheetsCells = (trace.sheetsCells || 0) + summary.cells;
    }
    return {
      success: true, range, ...summary, diagnostics,
      note: summary.truncated
        ? 'Intervalo maior que o limite devolvido; reduza o range.'
        : diagnostics.rangeApplied ? 'Valores copiados e lidos pelo host.' : 'Valores lidos, mas a caixa de nome não confirmou o intervalo; confira diagnostics.selection.'
    };
  }

  // Pós-condição de uma receita: lê a aba e espera até o limite, como no run_steps.
  async expectationOnTab(tab, expect, timeoutMs = 3000) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let last = { ok: false, detail: 'sem leitura' };
    for (;;) {
      const wc = tab?.webContents;
      let url = '';
      let text = '';
      if (wc && !wc.isDestroyed?.()) {
        try { url = String(wc.getURL?.() || ''); } catch {}
        if (needsPageText(expect)) text = await wc.executeJavaScript(`(document.body?.innerText||'').slice(0,20000)`).catch(() => '');
      }
      last = evaluateExpectation(expect, { url, text: String(text || '') });
      if (last.ok || Date.now() >= deadline) return last;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  // Receita: passos estáveis, sem modelo. Cada passo passa por aprovação e tem pós-condição obrigatória.
  async runRecipe(tabId, tab, steps, trace = null, outputSchema = null) {
    const commitPossible = (step, output) => {
      if (step.tool === 'wait_for') return false;
      if (step.tool === 'sheets' && step.args.action !== 'write') return false;
      if (step.tool === 'click_text' && /não encontrado/i.test(String(output?.error || ''))) return false;
      return true;
    };
    const results = [];
    let lastRead = null;
    for (const [i, step] of steps.entries()) {
      let output;
      try {
        if (step.tool === 'navigate') {
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'navigate', readOnly: false, url: step.args.url });
          if (!approval.approved) {
            const error = new Error(approval.error || 'Navegação cancelada pela receita');
            if (approval.cancelled) error.code = 'USER_DENIED';
            throw error;
          }
          await tab.webContents.loadURL(step.args.url);
          output = { success: true, url: String(tab.webContents.getURL?.() || step.args.url) };
        } else if (step.tool === 'wait_for') {
          const want = String(step.args.text).toLowerCase();
          const deadline = Date.now() + 10000;
          let found = false;
          while (Date.now() <= deadline) {
            found = await tab.webContents.executeJavaScript(`(document.body?.innerText||'').toLowerCase().includes(${JSON.stringify(want)})`).catch(() => false);
            if (found) break;
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          output = { success: found, found, error: found ? undefined : `O texto "${step.args.text}" não apareceu em 10 s` };
        } else if (step.tool === 'click_text') {
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'click_text', readOnly: false, targetName: step.args.text });
          if (!approval.approved) {
            const error = new Error(approval.error || 'Clique cancelado pela receita');
            if (approval.cancelled) error.code = 'USER_DENIED';
            throw error;
          }
          const target = await tab.webContents.executeJavaScript(`(() => {
            const norm=t=>String(t||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toLowerCase();
            const want=norm(${JSON.stringify(String(step.args.text))});
            for(const e of document.body.querySelectorAll('*')){
              const r=e.getBoundingClientRect();
              if(r.width<=0||r.height<=0)continue;
              const s=getComputedStyle(e);
              if(s.visibility==='hidden'||s.display==='none')continue;
              const own=norm([...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join(' '));
              if(own===want)return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),label:(e.innerText||'').trim().slice(0,80)};
            }
            return null;
          })()`);
          if (!target) output = { success: false, error: `Texto "${step.args.text}" não encontrado` };
          else output = { ...(await performCuaInput(tab.webContents, { kind: 'cua_click', x: target.x, y: target.y })), target: target.label };
        } else if (step.tool === 'sheets') {
          output = await this.sheetsAction(tabId, tab, { ...step.args }, trace);
          const readFrom = (candidate) => (candidate?.success && Array.isArray(candidate.values) ? { grid: candidate.values, range: candidate.range } : null);
          if (step.args.action === 'read') {
            lastRead = readFrom(output) || lastRead;
          } else if (step.args.action === 'batch' && Array.isArray(output?.results)) {
            // O contrato de saída usa a última leitura do lote, não só um read isolado.
            for (const item of output.results) {
              const read = readFrom(item);
              if (read) lastRead = read;
            }
          }
        } else {
          output = { success: false, error: `Ferramenta não suportada em receita: ${step.tool}` };
        }
      } catch (error) {
        if (error.code === 'USER_DENIED') {
          if (trace) trace.recipeCancelled = true;
          return { success: false, cancelled: true, error: 'A receita foi cancelada pelo usuário.' };
        }
        output = { success: false, error: String(error.message || error) };
      }
      if (output?.success !== false && step.expect) {
        const verdict = await this.expectationOnTab(tab, step.expect);
        if (!verdict.ok) {
          results.push({ step: i + 1, tool: step.tool, ok: false, actionExecuted: true, error: `pós-condição não confirmada: ${verdict.detail}` });
          if (trace) trace.recipeFailures = (trace.recipeFailures || 0) + 1;
          return {
            success: false, failedAt: i + 1, completed: i, total: steps.length, results,
            possibleCommit: commitPossible(step, output),
            ...(commitPossible(step, output) ? { readBeforeRetry: 'A ação foi executada; leia a página e confirme o estado antes de repetir a receita.' } : {}),
            error: `O passo ${i + 1} (${step.tool}) executou, mas a pós-condição falhou: ${verdict.detail}.`
          };
        }
      }
      results.push({ step: i + 1, tool: step.tool, ok: output?.success !== false, ...(output?.error ? { error: String(output.error).slice(0, 200) } : {}) });
      if (output?.success === false) {
        return {
          success: false, failedAt: i + 1, completed: i, total: steps.length, results,
          possibleCommit: commitPossible(step, output),
          ...(commitPossible(step, output) ? { readBeforeRetry: 'A ação pode ter tido efeito; leia a página antes de repetir a receita.' } : {}),
          error: `O passo ${i + 1} (${step.tool}) falhou: ${output.error || 'sem detalhe'}.`
        };
      }
    }
    if (trace) trace.recipeSteps = (trace.recipeSteps || 0) + steps.length;
    if (!outputSchema) return { success: true, completed: steps.length, total: steps.length, results };
    const verdict = validateOutput(outputSchema, lastRead || {});
    if (!verdict.ok) {
      if (trace) trace.recipeOutputInvalid = (trace.recipeOutputInvalid || 0) + 1;
      return {
        success: false, code: 'OUTPUT_INVALID', completed: steps.length, total: steps.length, results,
        mayHaveReadButInvalid: true,
        problems: verdict.problems,
        output: verdict.output,
        error: `A receita executou, mas a saída não bateu com o contrato: ${verdict.problems.join('; ')}.`
      };
    }
    return { success: true, completed: steps.length, total: steps.length, results, output: verdict.output, outputValid: true };
  }

  async runTask({ startUrl, prompt, maxSteps = 20, approvalPolicy = 'ask', allowedHosts = [], allowCredentials = false, keepTab = false, captureInitialText = false, captureInitialChecks = [], engine = 'navegante', maxDurationSec, observeAfterActions = true, captureReadEvidence = false, preInspect = false, actionScripts = false, diffSnapshots = false, deduplicateSnapshots = false, cascadeModel = null, streaming = false, effectJournal = false, verify = null, requireVerification = false, correctionRounds = 0, structuredExtraction = false, recipes = false, advancedInput = 'auto', saveRecipe = null, authenticationOrigins = [], promptCache = false, transforms = false }) {
    if (diffSnapshots && deduplicateSnapshots) return { success: false, error: 'diffSnapshots e deduplicateSnapshots são modos de compactação mutuamente exclusivos.' };
    const maxDurationMs = maxDurationSec ? maxDurationSec * 1000 : undefined;
    if (approvalPolicy === 'public-sites' && engine === 'flame') return { success: false, error: 'A política public-sites ainda não vale para o Flame' };
    if (this.settingsProvider?.().isBotProfile === true && engine === 'flame') {
      return { success: false, error: 'O motor Flame fica indisponível em perfis de bot até aplicar a mesma proteção de credenciais.' };
    }
    if (engine === 'flame') return this.runFlameTask({ startUrl, prompt, maxSteps, approvalPolicy, keepTab, maxDurationMs });
    if (approvalPolicy === 'local-fixture' && !isLoopbackUrl(startUrl)) {
      return { success: false, error: 'A política local-fixture só aceita URL inicial em 127.0.0.1, localhost ou [::1]' };
    }
    const policy = approvalPolicy === 'public-sites'
      ? { kind: 'public-sites', hosts: allowedHosts.map((host) => String(host).toLowerCase()), allowsCredentials: allowCredentials === true }
      : approvalPolicy;
    if (approvalPolicy === 'public-sites' && !taskPolicyAllows(policy, startUrl)) {
      return { success: false, error: 'A política public-sites exige URL inicial HTTPS num dos allowedHosts' };
    }
    if (!this.browserControls.createTab) return { success: false, error: 'Criação de abas indisponível' };
    if (typeof this.agentConfigProvider !== 'function') return { success: false, error: 'Configuração do agente indisponível' };
    const { provider, model, apiKey } = await this.agentConfigProvider();
    if (!model) return { success: false, error: 'Sincronize os modelos e escolha um modelo antes de rodar tarefas' };
    const startedAt = Date.now();
    const openBefore = new Set(this.tabs.keys());
    const { tabId } = await this.browserControls.createTab(startUrl);
    if (approvalPolicy !== 'ask') this.taskApprovalPolicies.set(tabId, policy);
    const authOrigins = (Array.isArray(authenticationOrigins) ? authenticationOrigins : [])
      .map((value) => { try { return new URL(String(value)).origin; } catch { return ''; } })
      .filter(Boolean);
    if (authOrigins.length) this.taskAuthOrigins.set(tabId, authOrigins);
      const trace = { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: true, toolCalls: [], requestMetrics: [], stopReason: null, ...(captureReadEvidence ? { pageReads: [] } : {}) };
    try {
      const tab = this.tabs.get(tabId);
      if (!tab?.webContents) return { success: false, error: 'A aba da tarefa não foi registrada', tabId };
      await this.waitForBrowserCondition(tab, 'load', 30000).catch(() => null);
      const initialPageText = captureInitialText
        ? await tab.webContents.executeJavaScript(`(document.body?.innerText||'').slice(0,3000)`).then(String).catch(() => '')
        : undefined;
      const initialLocatorChecks = [];
      for (const check of captureInitialChecks) {
        const result = await this.executeLocatorAction(tabId, check, trace);
        initialLocatorChecks.push({
          strategy: check.strategy,
          query: check.query,
          action: check.action,
          success: result?.success === true,
          value: result?.value,
          error: result?.success === false ? String(result.error || 'Leitura inicial falhou') : ''
        });
      }
      const result = await this.runAgent(tabId, prompt, apiKey, model, true, provider, false, { maxSteps, trace, maxDurationMs, observeAfterActions, captureReadEvidence, preInspect, actionScripts, diffSnapshots, deduplicateSnapshots, cascadeModel, streaming, effectJournal, verify, correctionRounds, structuredExtraction, recipes, advancedInput, saveRecipe, promptCache, taskStartUrl: startUrl, transforms });
      const finalUrl = tab.webContents.isDestroyed() ? '' : tab.webContents.getURL();
      let verification = result.verification || null;
      if (!verification && Array.isArray(verify) && verify.length) {
        verification = await this.verifyTask(tab, verify, startedAt);
      }
      if (verification) {
        if (trace) {
          trace.verification = {
            ok: verification.ok === true,
            failed: (verification.results || []).filter((item) => !item.ok).map((item) => item.kind)
          };
        }
        if (verification.ok && effectJournal && this.effectJournal) {
          const proven = await this.effectJournal.confirmAttempted({ proof: 'task-verification' });
          if (trace && proven) trace.effectProofs = (trace.effectProofs || 0) + proven;
        }
        if (requireVerification && !verification.ok) {
          const failed = (verification.results || []).filter((item) => !item.ok).map((item) => item.detail).join('; ');
          return {
            ...result, success: false,
            error: `A verificação final não confirmou a tarefa: ${failed || verification.error || 'contrato inválido'}`,
            verification, tabId, provider, model, finalUrl,
            ...(captureInitialText ? { initialPageText } : {}),
            ...(captureInitialChecks.length ? { initialLocatorChecks } : {}),
            durationMs: Date.now() - startedAt, trace
          };
        }
      }
      return { ...result, tabId, provider, model, finalUrl, ...(verification ? { verification } : {}), ...(captureInitialText ? { initialPageText } : {}), ...(captureInitialChecks.length ? { initialLocatorChecks } : {}), durationMs: Date.now() - startedAt, trace };
    } finally {
      this.taskApprovalPolicies.delete(tabId);
      this.taskAuthOrigins.delete(tabId);
      if (!keepTab && this.browserControls.closeTab) {
        // Fecha também as abas que o agente abriu durante a tarefa.
        for (const id of [...this.tabs.keys()].filter((id) => id === tabId || !openBefore.has(id))) await this.browserControls.closeTab(id).catch(() => {});
      }
    }
  }

  // Mesma tarefa, mas quem age é o Flame (extensão carregada no Zero Browser). Sem contagem de tokens: o Flame não a expõe.
  async runFlameTask({ startUrl, prompt, maxSteps, approvalPolicy, keepTab, maxDurationMs }) {
    if (approvalPolicy === 'local-fixture' && !isLoopbackUrl(startUrl)) {
      return { success: false, error: 'A política local-fixture só aceita URL inicial em 127.0.0.1, localhost ou [::1]' };
    }
    if (!this.browserControls.runFlameTask) return { success: false, error: 'O Flame não está disponível neste Zero Browser' };
    const startedAt = Date.now();
    const { tabId } = await this.browserControls.createTab(startUrl);
    const trace = { modelCalls: 0, inputTokens: 0, outputTokens: 0, usageAvailable: false, toolCalls: [], stopReason: null };
    try {
      const tab = this.tabs.get(tabId);
      if (tab?.webContents) await this.waitForBrowserCondition(tab, 'load', 30000).catch(() => null);
      tab?.webContents?.setBackgroundThrottling?.(false);
      const result = await this.browserControls.runFlameTask({ tabId, prompt, timeoutMs: maxDurationMs || Math.max(60000, maxSteps * 20000), allowLocalFixture: approvalPolicy === 'local-fixture' });
      trace.stopReason = result.stopReason || (result.success ? 'final_answer' : 'error');
      const diag = result.diagnostics;
      if (diag) {
        trace.modelCalls = diag.modelCalls || 0;
        trace.flameRuns = diag.runs;
        trace.inputTokens = diag.runInputTokens ?? diag.promptTokens ?? 0;
        trace.outputTokens = diag.runOutputTokens ?? diag.completionTokens ?? 0;
        trace.usageAvailable = Boolean(trace.inputTokens);
        // "em" = segundos desde o início da tarefa; o vão entre um fim e o próximo início é tempo do modelo.
        trace.toolCalls = (diag.events || []).filter((event) => event.kind === 'step')
          .map((event) => ({ step: event.step, tool: event.name, success: event.outcome === 'completed', ...(event.outcome === 'started' ? { iniciou: true } : {}), ...(event.reasonCode ? { error: event.reasonCode } : {}), ms: event.durationMs, em: Math.round((event.at - startedAt) / 100) / 10 }));
      }
      const finalUrl = tab?.webContents && !tab.webContents.isDestroyed() ? tab.webContents.getURL() : '';
      return { success: result.success, message: result.finalAnswer || result.transcript || '', error: result.error, tabId, engine: 'flame', finalUrl, durationMs: Date.now() - startedAt, trace, deniedApprovals: result.deniedApprovals };
    } finally {
      if (!keepTab && this.browserControls.closeTab && this.tabs.has(tabId)) {
        await this.browserControls.closeTab(tabId).catch(() => {});
      }
    }
  }

  async getAccessibilityTree(tabId, options = {}) {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.webContents || tab.webContents.isDestroyed()) {
      return { success: false, error: 'Tab not found' };
    }
    try {
      const maxNodes = Math.max(1, Math.min(Number(options.maxNodes) || 250, 1000));
      const forcePierce = this.settingsProvider?.().isBotProfile === true
        && (options.pierce === true || options.mode === 'screenshot' || options.mode === 'both');
      const tree = await tab.webContents.executeJavaScript(`(() => {
        const selector='a[href],button,input:not([type=hidden]),textarea,select,[role],[tabindex]:not([tabindex="-1"])';
        const visibleNodes=[...document.querySelectorAll(selector)].filter(e=>{
          const s=getComputedStyle(e),r=e.getBoundingClientRect();
          return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]');
        });
        const nodes=visibleNodes.slice(0,${maxNodes});
        const roleOf=e=>e.getAttribute('role')||({A:'link',BUTTON:'button',INPUT:e.type==='checkbox'?'checkbox':e.type==='radio'?'radio':'textbox',TEXTAREA:'textbox',SELECT:'combobox'}[e.tagName]||'generic');
        const accName=${accessibleName.toString()};
        const isAuthenticationIdentifier=${isAuthenticationIdentifier.toString()};
        const needsPierce=${forcePierce}||!!document.querySelector('iframe')||[...document.body?.querySelectorAll('*')||[]].some(e=>e.tagName.includes('-')||!!e.shadowRoot);
        const credentialForms=new Set([...document.forms].filter(form=>[...form.elements].some(field=>['password','one-time-code','cc-number','cc-csc','cc-exp','current-password','new-password'].includes(String(field.type||'').toLowerCase())||/password|one-time-code|cc-number|cc-csc|cc-exp/i.test(String(field.getAttribute('autocomplete')||'')+' '+String(field.getAttribute('name')||'')))));
        const authIdentifierFields=new Set();
        for(const form of document.forms){
          const submitLabels=[...form.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' ');
          const formContext={formAction:form.action||'',formName:form.id+' '+form.getAttribute('name'),formLabel:form.getAttribute('aria-label')||'',formText:(form.innerText||'').slice(0,1200),submitLabels,pageUrl:location.href,pageTitle:document.title};
          for(const field of form.elements){const label=[...(field.labels||[])].map(item=>item.innerText||'').join(' ');if(isAuthenticationIdentifier({type:field.type,autocomplete:field.getAttribute('autocomplete')||'',name:field.name+' '+field.id,label:label+' '+field.placeholder+' '+field.getAttribute('aria-label'),...formContext}))authIdentifierFields.add(field);}
        }
        for(const field of visibleNodes.filter(item=>!item.form&&['INPUT','TEXTAREA'].includes(item.tagName))){
          const label=[...(field.labels||[])].map(item=>item.innerText||'').join(' ')+' '+field.placeholder+' '+field.getAttribute('aria-label');
          let container=field.parentElement;
          for(let depth=0;container&&depth<5;depth++,container=container.parentElement){
            const ctaLabels=[...container.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' ');
            const containerName=[container.id,container.className,container.getAttribute('aria-label')].filter(Boolean).join(' ');
            if(isAuthenticationIdentifier({type:field.type,autocomplete:field.getAttribute('autocomplete')||'',name:field.name+' '+field.id,label,pageUrl:location.href,pageTitle:document.title,nearbyText:(container.innerText||'').slice(0,1200),ctaLabels,containerName})){authIdentifierFields.add(field);break;}
          }
        }
        return {url:location.href,title:document.title,needsPierce,nodesTruncated:visibleNodes.length>nodes.length,nodes:nodes.map((e,index)=>{
          const r=e.getBoundingClientRect();
          const autocomplete=(e.getAttribute('autocomplete')||'').toLowerCase();
          const directCredentialField=['password','one-time-code','cc-number','cc-csc','cc-exp','current-password','new-password'].includes(e.type)||/password|one-time-code|cc-number|cc-csc|cc-exp/.test(autocomplete)||/password|one-time-code|cc-number|cc-csc|cc-exp/i.test(e.name||'');
          const authIdentifier=authIdentifierFields.has(e);
          const sensitiveInput=directCredentialField||authIdentifier||(!!e.form&&credentialForms.has(e.form)&&['INPUT','TEXTAREA','SELECT'].includes(e.tagName));
          let registry=window.__naveganteTargetRegistry;
          if(!registry){registry={pageId:(crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)),ids:new WeakMap(),next:0};Object.defineProperty(window,'__naveganteTargetRegistry',{value:registry,configurable:false});}
          let targetId=registry.ids.get(e);if(!targetId){targetId=registry.pageId+':'+(++registry.next);registry.ids.set(e,targetId);}
          const formAction=e.form?.action?(()=>{try{const u=new URL(e.form.action,location.href);return u.origin+u.pathname}catch{return undefined}})():undefined;
          const formSubmitLabels=e.form?[...e.form.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' '):'';
          return {index,targetId,role:roleOf(e),tag:e.tagName.toLowerCase(),name:accName(e,{sensitive:sensitiveInput}).slice(0,240),value:sensitiveInput?undefined:('value' in e?String(e.value).slice(0,500):undefined),type:e.type||undefined,fieldName:e.name||e.id||'',fieldLabel:[...(e.labels||[])].map(item=>item.innerText||'').join(' ')+' '+(e.placeholder||'')+' '+(e.getAttribute('aria-label')||''),formName:e.form?e.form.id+' '+e.form.getAttribute('name'):'',formLabel:e.form?.getAttribute('aria-label')||'',submitLabels:formSubmitLabels,disabled:!!e.disabled,checked:!!e.checked,expanded:e.getAttribute('aria-expanded'),selected:!!e.selected,options:e.tagName==='SELECT'?[...e.options].slice(0,30).map(o=>o.text.trim().slice(0,80)):undefined,href:e.href||undefined,focused:document.activeElement===e,inForm:!!e.form,formAction,formText:(e.form?.innerText||'').slice(0,1200),formMethod:e.form?.method||undefined,isSubmitControl:!!(e.form&&(e.matches('input[type=submit],input[type=image],button:not([type]),button[type=submit]'))),sensitiveInput,authIdentifier,rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
        })};
      })()`);
      for (const node of tree.nodes || []) {
        if (classifyRisk({ node }).level === 'credential') {
          node.sensitiveInput = true;
          node.authIdentifier = isAuthenticationIdentifier({ ...node, name: `${node.name || ''} ${node.fieldName || ''}`, label: node.fieldLabel || '' });
          node.value = undefined;
        }
      }
      if (tree.needsPierce && (options.pierce || options.mode === 'screenshot' || options.mode === 'both')) {
        try { tree.hiddenControls = await this.getPiercedControls(tab); }
        catch { tree.hiddenControls = []; tree.pierceInspectionFailed = true; }
        tree.hiddenControlsTruncated = tree.hiddenControls?.truncated === true;
      }
      delete tree.needsPierce;
      tab.axCache = tree;
      const displayUrl = (() => { try { const url = new URL(tree.url); if (url.protocol === 'data:') return 'data:'; url.search = ''; url.hash = ''; return url.href; } catch { return ''; } })();
      const publicTree = { ...tree, url: displayUrl };
      if (options.mode === 'screenshot' || options.mode === 'both') {
        const screenshotError = await this.botScreenshotBlockReason(tabId, { success: true, tree: publicTree });
        if (screenshotError) return { success: false, error: screenshotError, tree: publicTree };
        const screenshot = await this.captureTabScreenshot(tab);
        return { success: true, tree: publicTree, screenshot };
      }
      return { success: true, tree: publicTree };
    } catch (error) {
      return { success: false, error: `AX snapshot failed: ${error.message}` };
    }
  }

  // Controles que querySelectorAll não alcança (shadow DOM, inclusive fechado, e iframes), lidos pelo CDP com posição na tela.
  async getPiercedControls(tab) {
    const debuggerApi = tab.webContents.debugger;
    const attachedHere = !debuggerApi.isAttached();
    if (attachedHere) debuggerApi.attach('1.3');
    try {
      const { root } = await debuggerApi.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
      const pageUrl = tab.webContents.getURL?.() || '';
      const pageTitle = await tab.webContents.executeJavaScript('document.title').catch(() => '');
        const attr = (node, name) => {
        const list = node.attributes || [];
        for (let i = 0; i < list.length; i += 2) if (list[i] === name) return list[i + 1];
        return undefined;
      };
      const textOf = (node, depth = 0) => {
        if (node.nodeType === 3) return node.nodeValue || '';
        if (depth > 6 || ['SCRIPT', 'STYLE'].includes(node.nodeName)) return '';
        return (node.children || []).map((child) => textOf(child, depth + 1)).join(' ');
      };
      const formKeys = new Map();
      const formsById = new Map();
      const formAuthContext = new Map();
      const credentialForms = new Set();
      let formSequence = 0;
      const visitTree = (node, parentFormKey, visit) => {
        let formKey = formKeys.get(node) || parentFormKey || null;
        const explicitForm = attr(node, 'form');
        if (explicitForm && formsById.has(explicitForm)) formKey = formsById.get(explicitForm);
        visit(node, formKey);
        for (const child of node.children || []) visitTree(child, formKey, visit);
        for (const shadow of node.shadowRoots || []) visitTree(shadow, null, visit);
        if (node.contentDocument) visitTree(node.contentDocument, null, visit);
      };
      const collectForms = (node, parentFormKey = null) => {
        let formKey = parentFormKey;
        if (node.nodeName === 'FORM') {
          formKey = `credential-form-${++formSequence}`;
          formKeys.set(node, formKey);
          const id = attr(node, 'id');
          if (id) formsById.set(id, formKey);
          const submitLabels = [];
          const collectSubmitLabels = (child) => {
            if (['BUTTON', 'INPUT'].includes(child.nodeName) && (child.nodeName === 'BUTTON' || ['submit','image'].includes(String(attr(child, 'type') || '').toLowerCase()))) {
              submitLabels.push(attr(child, 'aria-label') || attr(child, 'value') || textOf(child));
            }
            for (const nested of child.children || []) collectSubmitLabels(nested);
          };
          collectSubmitLabels(node);
          formAuthContext.set(formKey, {
            formAction: attr(node, 'action') || '', formName: `${id || ''} ${attr(node, 'name') || ''}`,
            formLabel: attr(node, 'aria-label') || '', formText: textOf(node).slice(0, 1200), submitLabels: submitLabels.join(' ')
          });
        }
        for (const child of node.children || []) collectForms(child, formKey);
        for (const shadow of node.shadowRoots || []) collectForms(shadow, null);
        if (node.contentDocument) collectForms(node.contentDocument, null);
      };
      collectForms(root);
      visitTree(root, null, (node, formKey) => {
        const type = (attr(node, 'type') || '').toLowerCase();
        const autocomplete = (attr(node, 'autocomplete') || '').toLowerCase();
        const fieldName = (attr(node, 'name') || '').toLowerCase();
        if (formKey && (['password','one-time-code','cc-number','cc-csc','cc-exp','current-password','new-password'].includes(type)
          || /password|one-time-code|cc-number|cc-csc|cc-exp/.test(autocomplete)
          || /password|one-time-code|cc-number|cc-csc|cc-exp/.test(fieldName))) credentialForms.add(formKey);
      });
      const found = [];
      let foundTruncated = false;
      const walk = (node, hidden, label, parentFormKey = null, parentContext = {}) => {
        let formKey = formKeys.get(node) || parentFormKey || null;
        const explicitForm = attr(node, 'form');
        if (explicitForm && formsById.has(explicitForm)) formKey = formsById.get(explicitForm);
        const tag = node.nodeName;
        const nextLabel = tag === 'LABEL' ? textOf(node) : label;
        const ctaLabels = ['FORM','DIV','SECTION','MAIN','DIALOG'].includes(tag)
          ? (() => { const labels=[]; const scan=(item)=>{ if(['BUTTON','INPUT'].includes(item.nodeName)&& (item.nodeName==='BUTTON'||['submit','image'].includes(String(attr(item,'type')||'').toLowerCase()))) labels.push(attr(item,'aria-label')||attr(item,'value')||textOf(item)); for(const child of item.children||[])scan(child); }; scan(node); return labels.join(' '); })()
          : parentContext.ctaLabels || '';
        const localContext = ['FORM','DIV','SECTION','MAIN','DIALOG'].includes(tag) ? {
          nearbyText: `${parentContext.nearbyText || ''} ${textOf(node)}`.slice(0, 1200),
          ctaLabels: `${parentContext.ctaLabels || ''} ${ctaLabels}`.slice(0, 500),
          containerName: `${parentContext.containerName || ''} ${attr(node, 'id') || ''} ${attr(node, 'class') || ''} ${attr(node, 'aria-label') || ''}`.slice(0, 500)
        } : parentContext;
        const interactive = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag) || (tag === 'A' && attr(node, 'href') !== undefined);
        if (found.length >= 60 && hidden && interactive && attr(node, 'type') !== 'hidden') foundTruncated = true;
        if (found.length < 60 && hidden && interactive && attr(node, 'type') !== 'hidden') {
          const type = (attr(node, 'type') || '').toLowerCase();
          const autocomplete = (attr(node, 'autocomplete') || '').toLowerCase();
          const fieldName = (attr(node, 'name') || '').toLowerCase();
          const isAuthIdentifier = ['INPUT','TEXTAREA'].includes(tag) && isAuthenticationIdentifier({
            type, autocomplete, name: `${fieldName} ${attr(node, 'id') || ''}`,
            label: `${nextLabel || ''} ${attr(node, 'placeholder') || ''} ${attr(node, 'aria-label') || ''}`,
            pageUrl, pageTitle, ...localContext, ...(formAuthContext.get(formKey) || {})
          });
          const sensitiveInput = ['password','one-time-code','cc-number','cc-csc','cc-exp'].includes(type)
            || /password|one-time-code|cc-number|cc-csc|cc-exp/.test(autocomplete)
            || /password|one-time-code|cc-number|cc-csc|cc-exp/.test(fieldName)
            || isAuthIdentifier
            || (credentialForms.has(formKey) && ['INPUT','SELECT','TEXTAREA'].includes(tag));
          const name = attr(node, 'aria-label') || (tag === 'INPUT' ? nextLabel || attr(node, 'placeholder') || (!sensitiveInput && attr(node, 'value')) : textOf(node)) || attr(node, 'id') || '';
          found.push({ backendNodeId: node.backendNodeId, tag: tag.toLowerCase(), type, name: name.replace(/\s+/g, ' ').trim().slice(0, 160), sensitiveInput });
        }
        for (const child of node.children || []) walk(child, hidden, nextLabel, formKey, localContext);
        for (const shadow of node.shadowRoots || []) walk(shadow, true, nextLabel, formKey, localContext);
        if (node.contentDocument) walk(node.contentDocument, true, undefined, null, {});
      };
      walk(root, false, undefined);
      const controls = [];
      tab.hiddenNodes = new Map();
      for (const control of found) {
        const quads = await debuggerApi.sendCommand('DOM.getContentQuads', { backendNodeId: control.backendNodeId }).catch(() => null);
        const quad = quads?.quads?.[0];
        if (!quad) continue;
        const xs = [quad[0], quad[2], quad[4], quad[6]], ys = [quad[1], quad[3], quad[5], quad[7]];
        const x = Math.min(...xs), y = Math.min(...ys), width = Math.max(...xs) - x, height = Math.max(...ys) - y;
        if (width <= 0 || height <= 0) continue;
        let checked;
        // O atributo checked só diz o estado inicial; o estado atual vem da propriedade do elemento vivo.
        if (control.tag === 'input' && ['checkbox', 'radio'].includes(control.type)) {
          const resolved = await debuggerApi.sendCommand('DOM.resolveNode', { backendNodeId: control.backendNodeId }).catch(() => null);
          if (resolved?.object?.objectId) {
            const value = await debuggerApi.sendCommand('Runtime.callFunctionOn', { objectId: resolved.object.objectId, functionDeclaration: 'function(){return this.checked}', returnByValue: true }).catch(() => null);
            checked = value?.result?.value;
            await debuggerApi.sendCommand('Runtime.releaseObject', { objectId: resolved.object.objectId }).catch(() => {});
          }
        }
        tab.hiddenNodes.set(`h${controls.length}`, { backendNodeId: control.backendNodeId, type: control.type, sensitiveInput: control.sensitiveInput, name: control.name });
        controls.push({ id: `h${controls.length}`, tag: control.tag, type: control.type, name: control.name, sensitiveInput: control.sensitiveInput, checked, center: { x: Math.round(x + width / 2), y: Math.round(y + height / 2) } });
      }
      controls.truncated = foundTruncated;
      return controls;
    } finally {
      if (attachedHere && debuggerApi.isAttached()) {
        try { debuggerApi.detach(); } catch {}
      }
    }
  }

  // Executa a ação no elemento vivo pelo CDP, o que alcança shadow DOM fechado e iframes. Os eventos imitam os de uma pessoa.
  async runOnHiddenNode(tab, backendNodeId, action, value) {
    const debuggerApi = tab.webContents.debugger;
    const attachedHere = !debuggerApi.isAttached();
    if (attachedHere) debuggerApi.attach('1.3');
    try {
      const { object } = await debuggerApi.sendCommand('DOM.resolveNode', { backendNodeId });
      try {
        const { result, exceptionDetails } = await debuggerApi.sendCommand('Runtime.callFunctionOn', {
          objectId: object.objectId,
          returnByValue: true,
          arguments: [{ value: action }, { value }],
          functionDeclaration: `function(action, value) {
            const el = this, fire = (type) => el.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
            el.scrollIntoView({ block: 'center' });
            if (action === 'click') { el.click(); return { success: true }; }
            if (action === 'check' || action === 'uncheck') {
              const want = action === 'check';
              if (el.checked !== want) el.click();
              return { success: el.checked === want, checked: el.checked };
            }
            if (action === 'fill') {
              el.focus();
              const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
              fire('input'); fire('change');
              return { success: el.value === value, value: el.value };
            }
            if (action === 'select') {
              if (el.tagName !== 'SELECT') return { success: false, error: 'O controle não é uma lista <select>' };
              const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
              const all = [...el.options], want = norm(value);
              const option = all.find((o) => norm(o.text) === want || norm(o.value) === want) || all.find((o) => norm(o.text).includes(want));
              if (!option) return { success: false, error: 'Opção não encontrada: ' + all.map((o) => o.text.trim()).join(' | ') };
              el.focus(); el.value = option.value; fire('input'); fire('change');
              return { success: true, selected: option.text.trim() };
            }
            return { success: false, error: 'Ação desconhecida' };
          }`
        });
        if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'A ação falhou na página');
        if (!result.value?.success) throw new Error(result.value?.error || `A ação ${action} não teve efeito`);
        return result.value;
      } finally {
        await debuggerApi.sendCommand('Runtime.releaseObject', { objectId: object.objectId }).catch(() => {});
      }
    } finally {
      if (attachedHere && debuggerApi.isAttached()) {
        try { debuggerApi.detach(); } catch {}
      }
    }
  }

  async executeLocatorAction(tabId, request, trace = null) {
    const tab = this.tabs.get(tabId);
    if (!tab?.webContents || tab.webContents.isDestroyed()) return { success: false, error: 'Aba indisponível' };
    const { strategy, query, action, exact = false, name, attribute, value, timeout = 3000 } = request;
    if (this.settingsProvider?.().isBotProfile === true && action === 'attribute' && String(attribute).toLowerCase() === 'value') {
      return { success: false, error: 'Leitura de atributo value por locator fica indisponível em perfis de bot para evitar exposição ou troca de alvo em campos de credenciais.' };
    }
    const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_locator_read', readOnly: true });
    if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
    const deadline = Date.now() + Math.max(0, Math.min(Number(timeout) || 3000, 15000));
    let resolved;
    do {
      resolved = await tab.webContents.executeJavaScript(`(() => {
        const strategy=${JSON.stringify(strategy)},query=${JSON.stringify(query)},name=${JSON.stringify(name||'')},action=${JSON.stringify(action)},exact=${Boolean(exact)};
        const interactive='a[href],button,input:not([type=hidden]),textarea,select,[role],[tabindex]:not([tabindex="-1"])';
        const visible=(e)=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]')};
        const normalize=(s)=>String(s||'').replace(/\\s+/g,' ').trim();
        const accName=${accessibleName.toString()};
        const isAuthenticationIdentifier=${isAuthenticationIdentifier.toString()};
        const nameOf=(e)=>normalize(accName(e,{sensitive:sensitiveOf(e)}));
        const authSensitive=e=>{const f=e.form,label=[...(e.labels||[])].map(item=>item.innerText||'').join(' ')+' '+(e.placeholder||'')+' '+(e.getAttribute('aria-label')||''),base={type:e.type,autocomplete:e.getAttribute('autocomplete')||'',name:(e.name||'')+' '+e.id,label,pageUrl:location.href,pageTitle:document.title};if(f){const submitLabels=[...f.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' ');return isAuthenticationIdentifier({...base,formAction:f.action||'',formName:f.id+' '+f.getAttribute('name'),formLabel:f.getAttribute('aria-label')||'',formText:(f.innerText||'').slice(0,1200),submitLabels})}let c=e.parentElement;for(let depth=0;c&&depth<5;depth++,c=c.parentElement){const ctaLabels=[...c.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' '),containerName=[c.id,c.className,c.getAttribute('aria-label')].filter(Boolean).join(' ');if(isAuthenticationIdentifier({...base,nearbyText:(c.innerText||'').slice(0,1200),ctaLabels,containerName}))return true}return false};
        const sensitiveOf=(e)=>{const type=String(e.type||'').toLowerCase(),autocomplete=String(e.getAttribute('autocomplete')||'').toLowerCase(),fieldName=String(e.name||'').toLowerCase();return ['password','one-time-code','cc-number','cc-csc','cc-exp','current-password','new-password'].includes(type)||/password|one-time-code|cc-number|cc-csc|cc-exp/.test(autocomplete)||/password|one-time-code|cc-number|cc-csc|cc-exp/.test(fieldName)||authSensitive(e)};
        const roleOf=(e)=>e.getAttribute('role')||({A:'link',BUTTON:'button',INPUT:e.type==='checkbox'?'checkbox':e.type==='radio'?'radio':e.type==='button'||e.type==='submit'?'button':'textbox',TEXTAREA:'textbox',SELECT:'combobox'}[e.tagName]||'generic');
        const matches=(candidate)=>{const target=normalize(candidate),needle=normalize(query);const valueMatches=exact?target===needle:target.toLowerCase().includes(needle.toLowerCase());return valueMatches};
        let matched=[];
        try {
          if(strategy==='css') matched=[...document.querySelectorAll(query)];
          else if(strategy==='label') matched=[...document.querySelectorAll('label')].filter(e=>matches(e.innerText)).map(e=>e.control||e);
          else if(strategy==='placeholder') matched=[...document.querySelectorAll('input[placeholder],textarea[placeholder]')].filter(e=>matches(e.getAttribute('placeholder')));
          else if(strategy==='testid') matched=[...document.querySelectorAll('[data-testid]')].filter(e=>e.getAttribute('data-testid')===query);
          else if(strategy==='text') matched=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&matches(e.innerText));
          else if(strategy==='role') matched=[...document.querySelectorAll(interactive)].filter(e=>roleOf(e)===query&&(!name||(exact?nameOf(e)===name:nameOf(e).toLowerCase().includes(name.toLowerCase()))));
        } catch(error) { return {success:false,error:'Invalid locator: '+error.message,count:0,matches:[]}; }
        if(action==='hover'&&matched.length===1&&visible(matched[0]))matched[0].scrollIntoView({block:'center',inline:'nearest'});
        matched=matched.filter(visible);
        const axNodes=[...document.querySelectorAll(interactive)].filter(visible).slice(0,1000);
        let registry=window.__naveganteTargetRegistry;
        if(!registry){registry={pageId:(crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)),ids:new WeakMap(),next:0};Object.defineProperty(window,'__naveganteTargetRegistry',{value:registry,configurable:false});}
        return {success:true,count:matched.length,...(action==='hover'?{pageText:(document.body?.innerText||'').slice(0,3000)}:{}),matches:matched.slice(0,50).map((e)=>{const target=e.matches(interactive)?e:e.closest(interactive);const r=e.getBoundingClientRect();const sensitiveInput=sensitiveOf(e);let targetId=target&&registry.ids.get(target);if(target&&!targetId){targetId=registry.pageId+':'+(++registry.next);registry.ids.set(target,targetId);}return {index:target?axNodes.indexOf(target):-1,targetId,tag:e.tagName.toLowerCase(),role:roleOf(e),name:nameOf(e).slice(0,240),text:normalize(e.innerText||e.textContent).slice(0,1000),value:sensitiveInput?undefined:('value'in e?String(e.value).slice(0,500):undefined),fieldName:e.name||e.id||'',fieldLabel:[...(e.labels||[])].map(item=>item.innerText||'').join(' ')+' '+(e.placeholder||'')+' '+(e.getAttribute('aria-label')||''),formAction:e.form?.action||'',formName:e.form?e.form.id+' '+e.form.getAttribute('name'):'',formLabel:e.form?.getAttribute('aria-label')||'',submitLabels:e.form?[...e.form.querySelectorAll('button,input[type=submit],[role=button]')].map(button=>button.innerText||button.value||button.getAttribute('aria-label')||'').join(' '):'',formText:(e.form?.innerText||'').slice(0,1200),attributeNames:[...e.attributes].map(a=>a.name),visible:true,enabled:!e.disabled,checked:!!e.checked,sensitiveInput,rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}}})};
      })()`);
      if (!resolved.success || resolved.count > 0 || action !== 'waitFor' || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() <= deadline);

    if (!resolved.success) return resolved;
    if (action === 'waitFor') return { success: resolved.count > 0, count: resolved.count, error: resolved.count ? undefined : 'Locator wait timed out' };
    if (action === 'count') return { success: true, count: resolved.count };
    if (!resolved.count && action === 'isVisible') return { success: true, value: false };
    if (!resolved.count && action === 'isEnabled') return { success: true, value: false };
    if (!resolved.count && action === 'attribute') return { success: true, value: null };
    if (!resolved.count) return { success: false, error: 'Locator não encontrou elemento visível' };
    if (['click', 'dblclick', 'fill', 'type', 'press', 'scrollIntoView', 'hover'].includes(action) && resolved.count > 1) {
      return {
        success: false,
        count: resolved.count,
        error: `Locator ambíguo: encontrei ${resolved.count} controles visíveis. Refine o locator até corresponder a um único controle antes de executar esta ação.`,
      };
    }
    const first = resolved.matches[0];
    if (action === 'attribute' && String(attribute).toLowerCase() === 'value'
      && (first.sensitiveInput === true || classifyRisk({ node: first }).level === 'credential')) {
      return { success: false, error: 'Leitura do atributo value em campo de credencial bloqueada para proteger os dados de autenticação.' };
    }
    if (action === 'hover') {
      const moved = await performCuaInput(tab.webContents, {
        kind: 'cua_move',
        x: first.rect.x + Math.round(first.rect.width / 2),
        y: first.rect.y + Math.round(first.rect.height / 2)
      });
      tab.axCache = null;
      const after = await this.postActionTextWait(tab.webContents, resolved.pageText);
      recordPostActionTextWait(trace, after);
      return { ...moved, actionExecuted: true, hovered: first.name || first.text, textAfter: after.text };
    }
    if (action === 'fill' && first.tag === 'select') {
      const selectApproval = await this.confirmConsequentialAction(tabId, { kind: 'set_value', elementIndex: first.index, targetId: first.targetId, value: String(value ?? '') });
      if (!selectApproval.approved) return { success: false, cancelled: !!selectApproval.cancelled, error: selectApproval.error };
      const selected = await tab.webContents.executeJavaScript(`(async () => {
        const selector='a[href],button,input:not([type=hidden]),textarea,select,[role],[tabindex]:not([tabindex="-1"])';
        const registry=window.__naveganteTargetRegistry;
        const targetId=${JSON.stringify(first.targetId)};
        const nodes=[...document.querySelectorAll(selector)].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]')});
        const node=registry&&targetId?nodes.find(e=>registry.ids.get(e)===targetId):null;
        if(!node||node.tagName!=='SELECT')return {success:false,error:'A lista mudou; inspecione o formulário de novo'};
        const frameworkManaged=('_valueTracker' in node)||Object.keys(node).some(key=>key.startsWith('__reactProps$')||key.startsWith('__reactFiber$'));
        const norm=t=>String(t||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toLowerCase();
        const want=norm(${JSON.stringify(String(value ?? ''))});
        const all=[...node.options];
        const option=all.find(o=>norm(o.text)===want||norm(o.value)===want)||all.find(o=>norm(o.text).includes(want));
        if(!option)return {success:false,error:'Opção não encontrada',options:all.map(o=>o.text.trim()).slice(0,30)};
        node.focus();
        const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;
        if(setter)setter.call(node,option.value);else node.value=option.value;
        node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));
        await Promise.resolve();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(frameworkManaged)await new Promise(resolve=>setTimeout(resolve,160));
        const actual=String(node.value);
        const outcomeVerified=node.isConnected&&actual===String(option.value);
        return {success:true,actionExecuted:true,outcomeVerified,fieldState:outcomeVerified?'value-retained':frameworkManaged?'changed-after-framework-update':'value-mismatch',selected:node.selectedOptions[0]?.textContent?.trim()||option.text.trim(),value:actual,...(outcomeVerified?{}:{error:'A seleção foi executada, mas não permaneceu após a atualização.'})};
      })()`);
      tab.axCache = null;
      return selected;
    }
    if (action === 'text' || action === 'allTextContents') return { success: true, text: action === 'text' ? first.text : resolved.matches.map((item) => item.text) };
    if (action === 'attribute') {
      if (!attribute || !/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(attribute)) return { success: false, error: 'Nome de atributo inválido' };
      const result = await tab.webContents.executeJavaScript(`(() => {const s=${JSON.stringify(strategy)},q=${JSON.stringify(query)},n=${JSON.stringify(name||'')},exact=${Boolean(exact)},a=${JSON.stringify(attribute)};const visible=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'};const role=e=>e.getAttribute('role')||({BUTTON:'button',A:'link',INPUT:e.type==='checkbox'?'checkbox':'textbox',TEXTAREA:'textbox',SELECT:'combobox'}[e.tagName]||'generic');const normalize=v=>String(v||'').replace(/\\s+/g,' ').trim();let xs=[];try{if(s==='css')xs=[...document.querySelectorAll(q)];else if(s==='testid')xs=[...document.querySelectorAll('[data-testid]')].filter(e=>e.getAttribute('data-testid')===q);else if(s==='placeholder')xs=[...document.querySelectorAll('[placeholder]')].filter(e=>e.getAttribute('placeholder')===q);else if(s==='role')xs=[...document.querySelectorAll('a[href],button,input,textarea,select,[role],[tabindex]')].filter(e=>role(e)===q&&(!n||normalize(e.innerText||e.getAttribute('aria-label'))===n));else if(s==='label')xs=[...document.querySelectorAll('label')].filter(e=>normalize(e.innerText)===q).map(e=>e.control||e);else xs=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&normalize(e.innerText).includes(q));}catch{}return xs.filter(visible)[0]?.getAttribute(a)??null})()`);
      return { success: true, value: result };
    }
    if (action === 'isVisible') return { success: true, value: first.visible };
    if (action === 'isEnabled') return { success: true, value: first.enabled };
    if (first.index < 0) return { success: false, error: 'O elemento localizado não é um controle interativo acessível para esta ação.' };
    const actionMap = { click: 'click', dblclick: 'dblclick', fill: 'set_value', type: 'type_text', press: 'press_key', scrollIntoView: 'scroll' };
    const kind = actionMap[action];
    if (!kind) return { success: false, error: `Ação de locator não suportada: ${action}` };
    return this.executeAXAction(tabId, {
      kind,
      elementIndex: first.index,
      targetId: first.targetId,
      ...(kind === 'set_value' || kind === 'type_text' ? { value: String(value ?? ''), text: String(value ?? '') } : {}),
      ...(kind === 'press_key' ? { key: String(value ?? '') } : {}),
      ...(kind === 'scroll' ? { direction: 'down', pages: 1, target: first.index } : {})
    });
  }

  async botScreenshotBlockReason(tabId, snapshot = null) {
    if (this.settingsProvider?.().isBotProfile !== true) return null;
    const observed = snapshot || await this.getAccessibilityTree(tabId, { maxNodes: 1000, pierce: true });
    if (!observed?.success || !observed.tree || observed.tree.pierceInspectionFailed === true
      || observed.tree.nodesTruncated === true || observed.tree.hiddenControlsTruncated === true) {
      return 'Captura bloqueada: não foi possível verificar se a página mostra campos de credenciais.';
    }
    const controls = [...(observed.tree.nodes || []), ...(observed.tree.hiddenControls || [])];
    const hasSensitiveControl = controls.some((control) => control?.sensitiveInput === true
      || classifyRisk({ node: control }).level === 'credential');
    return hasSensitiveControl
      ? 'Captura bloqueada: a página contém campo de credencial, código de verificação ou pagamento.'
      : null;
  }

  async captureTabScreenshot(tab) {
    const webContents = tab?.webContents;
    if (!webContents || webContents.isDestroyed()) throw new Error('Tab not found');
    const debuggerApi = webContents.debugger;
    const attachedHere = !debuggerApi.isAttached();
    try {
      if (attachedHere) debuggerApi.attach('1.3');
      const shot = await debuggerApi.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true });
      if (!shot?.data) throw new Error('Screenshot returned no image data');
      return `data:image/png;base64,${shot.data}`;
    } finally {
      if (attachedHere && debuggerApi.isAttached()) debuggerApi.detach();
    }
  }

  async performCuaAction(tabId, action) {
    const tab = this.tabs.get(tabId);
    if (!tab?.webContents || tab.webContents.isDestroyed()) return { success: false, error: 'Aba indisponível' };
    const approval = await this.confirmConsequentialAction(tabId, { ...action, readOnly: ['cua_move','cua_scroll'].includes(action.kind) });
    if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
    try {
      const result = await performCuaInput(tab.webContents, action);
      tab.axCache = null;
      return result;
    } catch (error) {
      return { success: false, error: `Ação CUA falhou: ${error.message}` };
    }
  }

  async executeAXAction(tabId, action) {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.webContents || tab.webContents.isDestroyed()) {
      return { success: false, error: 'Tab not found' };
    }
    const parsed = ActionSchema.safeParse(action);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const approval = await this.confirmConsequentialAction(tabId, { ...parsed.data, readOnly: parsed.data.kind === 'scroll' });
      if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
      const script = `(async () => {
        const a=${JSON.stringify(parsed.data)};
        const selector='a[href],button,input:not([type=hidden]),textarea,select,[role],[tabindex]:not([tabindex="-1"])';
        const nodes=[...document.querySelectorAll(selector)].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]')}).slice(0,1000);
        const registry=window.__naveganteTargetRegistry;
        const node=a.targetId&&registry?nodes.find(e=>registry.ids.get(e)===a.targetId):Number.isInteger(a.elementIndex)?nodes[a.elementIndex]:document.activeElement;
        if(['click','dblclick','perform_secondary_action','set_value','type_text','paste','select_text'].includes(a.kind)&&!node)return {success:false,error:'Element not found'};
        const keyEvent=(type,key)=>new KeyboardEvent(type,{key,bubbles:true,cancelable:true,ctrlKey:a.modifiers?.includes('Control'),altKey:a.modifiers?.includes('Alt'),shiftKey:a.modifiers?.includes('Shift'),metaKey:a.modifiers?.includes('Meta')});
        const setText=(e,text)=>{e.focus();if(e.isContentEditable){document.execCommand('insertText',false,text)}else if('value' in e){const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value');if(d?.set)d.set.call(e,text);else e.value=text;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));e.dispatchEvent(new Event('change',{bubbles:true}))}else return false;return true};
        let ok=true, outcomeVerified, fieldState, targetRemounted=false;
        switch(a.kind){
          case 'click': if(a.button==='right')node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:node.getBoundingClientRect().x,clientY:node.getBoundingClientRect().y})); else node.click(); break;
          case 'dblclick': node.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,detail:2})); break;
          case 'perform_secondary_action': if(a.action==='click')node.click();else if(a.action==='contextmenu')node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}));else ok=false; break;
          case 'set_value': case 'type_text': case 'paste': {
            const expected=String(a.value??a.text??'');
            const identity={tag:node.tagName,type:String(node.type||'').toLowerCase(),id:node.id||'',name:node.getAttribute('name')||'',ariaLabel:node.getAttribute('aria-label')||'',placeholder:node.getAttribute('placeholder')||'',labels:[...(node.labels||[])].map(label=>String(label.innerText||label.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean),formId:node.form?.id||'',formName:node.form?.getAttribute('name')||''};
            const hasIdentity=!!(identity.id||identity.name||identity.ariaLabel||identity.placeholder||identity.labels.length);
            const frameworkManaged=('_valueTracker' in node)||Object.keys(node).some(key=>key.startsWith('__reactProps$')||key.startsWith('__reactFiber$'));
            ok=setText(node,expected);
            if(ok){
              await Promise.resolve();
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              // React-managed fields can reconcile after the first paint. Observe briefly only for those fields.
              if(frameworkManaged) await new Promise(resolve=>setTimeout(resolve,160));
              if(node.isConnected){
                const actual='value' in node?String(node.value):String(node.innerText??node.textContent??'');
                outcomeVerified=node.isContentEditable?actual.includes(expected):actual===expected;
                fieldState=outcomeVerified?'value-retained':frameworkManaged?'changed-after-framework-update':'value-mismatch';
              } else {
                const normalize=value=>String(value||'').replace(/\\s+/g,' ').trim();
                const controls=[...document.querySelectorAll(selector)].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[aria-hidden="true"]')});
                const sameIdentity=e=>e.tagName===identity.tag&&String(e.type||'').toLowerCase()===identity.type
                  &&(!identity.id||e.id===identity.id)&&(!identity.name||e.getAttribute('name')===identity.name)
                  &&(!identity.ariaLabel||e.getAttribute('aria-label')===identity.ariaLabel)&&(!identity.placeholder||e.getAttribute('placeholder')===identity.placeholder)
                  &&(!identity.labels.length||identity.labels.every(label=>[...(e.labels||[])].some(x=>normalize(x.innerText||x.textContent)===normalize(label))))
                  &&(!identity.formId||e.form?.id===identity.formId)&&(!identity.formName||e.form?.getAttribute('name')===identity.formName);
                const replacements=hasIdentity?controls.filter(sameIdentity):[];
                if(replacements.length===1){
                  targetRemounted=true;
                  const replacement=replacements[0];
                  const actual='value' in replacement?String(replacement.value):String(replacement.innerText??replacement.textContent??'');
                  outcomeVerified=replacement.isContentEditable?actual.includes(expected):actual===expected;
                  fieldState=outcomeVerified?'remounted-value-retained':'remounted-value-mismatch';
                } else { outcomeVerified=false;fieldState=replacements.length>1?'ambiguous-remount':'target-removed'; }
              }
            }
            break;
          }
          case 'press_key': { const target=node||document.activeElement;if(!target)return {success:false,error:'No focused element'};target.dispatchEvent(keyEvent('keydown',a.key));if(a.key==='Enter'&&target.form)target.form.requestSubmit();else if(a.key===' '&&target.matches('button,[role=button]'))target.click();target.dispatchEvent(keyEvent('keyup',a.key));break; }
          case 'scroll': { const target=typeof a.target==='number'?nodes[a.target]:Array.isArray(a.target)?document.elementFromPoint(a.target[0],a.target[1]):document.scrollingElement;if(!target)return {success:false,error:'Scroll target not found'};const amount=(a.pages||1)*Math.max(300,innerHeight*0.8)*(a.direction==='up'||a.direction==='left'?-1:1);target.scrollBy({top:a.direction==='up'||a.direction==='down'?amount:0,left:a.direction==='left'||a.direction==='right'?amount:0,behavior:'instant'});break; }
          case 'drag': { const from=nodes[a.fromIndex],to=nodes[a.toIndex];if(!from||!to)return {success:false,error:'Drag endpoint not found'};const fr=from.getBoundingClientRect(),tr=to.getBoundingClientRect();from.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:fr.x+fr.width/2,clientY:fr.y+fr.height/2,button:0}));to.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:tr.x+tr.width/2,clientY:tr.y+tr.height/2,buttons:1}));to.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:tr.x+tr.width/2,clientY:tr.y+tr.height/2,button:0}));break; }
          case 'select_text': { const text=node.value??node.innerText??'';let start=0,end=text.length;if(a.selectionType==='all'){}else{const p=a.prefix?text.indexOf(a.prefix):-1,s=a.suffix?text.indexOf(a.suffix,p<0?0:p+a.prefix.length):-1;if(p>=0)start=p+a.prefix.length;if(s>=0)end=s;}if(typeof node.setSelectionRange==='function')node.setSelectionRange(start,end);else{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}break; }
          default: ok=false;
        }
        return {success:ok,actionExecuted:ok,...(outcomeVerified===undefined?{}:{outcomeVerified,fieldState,targetRemounted}),...(outcomeVerified===false?{error:'A ação foi executada, mas o campo não manteve o valor após a atualização.'}:{}),kind:a.kind,url:location.href,activeElement:{tag:document.activeElement?.tagName?.toLowerCase(),name:document.activeElement?.getAttribute('aria-label')||document.activeElement?.placeholder||''}};
      })()`;
      const result = await tab.webContents.executeJavaScript(script);
      if (result?.success) tab.axCache = null;
      return result;
    } catch (error) {
      return { success: false, error: `AX action failed: ${error.message}` };
    }
  }

  registerTools() {
    const tools = [
      {
        name: 'browser_navigate',
        description: 'Navigate a tab to a URL',
        inputSchema: z.object({ tabId: z.string(), url: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP and HTTPS navigation is allowed') }),
        handler: async ({ tabId, url }) => {
          const tab = this.tabs.get(tabId);
          if (!tab) throw new Error('Tab not found');
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'navigate', readOnly: false, url });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          tab.webContents.loadURL(url);
          return { success: true };
        }
      },
      {
        name: 'browser_click',
        description: 'Click an element by accessibility index',
        inputSchema: z.object({ tabId: z.string(), elementIndex: z.number(), modifiers: z.array(z.string()).optional() }),
        handler: async ({ tabId, elementIndex, modifiers }) => {
          return await this.executeAXAction(tabId, { kind: 'click', elementIndex, modifiers });
        }
      },
      {
        name: 'browser_type',
        description: 'Type text into an element',
        inputSchema: z.object({ tabId: z.string(), elementIndex: z.number().nullable(), text: z.string() }),
        handler: async ({ tabId, elementIndex, text }) => {
          return await this.executeAXAction(tabId, { kind: 'type_text', elementIndex, text });
        }
      },
      {
        name: 'browser_scroll',
        description: 'Scroll a page or element',
        inputSchema: z.object({ tabId: z.string(), target: z.union([z.number(), z.tuple([z.number(), z.number()])]).optional(), direction: z.enum(['up', 'down', 'left', 'right']), pages: z.number().optional() }),
        handler: async ({ tabId, target, direction, pages }) => {
          return await this.executeAXAction(tabId, { kind: 'scroll', target, direction, pages });
        }
      },
      {
        name: 'browser_cua_action',
        description: 'Use mouse and keyboard input at viewport coordinates when accessibility actions are insufficient',
        inputSchema: z.object({
          tabId: z.string(),
          action: z.enum(['click','double_click','move','drag','scroll','keypress','type']),
          x: z.number().optional(), y: z.number().optional(),
          button: z.enum(['left','right','middle','back','forward']).optional(),
          clickCount: z.number().int().min(1).max(3).optional(),
          modifiers: z.array(z.string()).max(4).optional(),
          path: z.array(z.object({ x: z.number(), y: z.number() })).min(2).max(100).optional(),
          deltaX: z.number().optional(), deltaY: z.number().optional(),
          keys: z.array(z.string()).min(1).max(4).optional(),
          text: z.string().max(10000).optional()
        }),
        handler: async ({ tabId, action, ...parameters }) => this.performCuaAction(tabId, { ...parameters, kind: `cua_${action}` })
      },
      {
        name: 'browser_locator_action',
        description: 'Find visible elements using CSS, text, role, label, placeholder or test id, then inspect, hover or interact with one element',
        inputSchema: z.object({
          tabId: z.string(),
          strategy: z.enum(['css','text','role','label','placeholder','testid']),
          query: z.string().min(1).max(1000),
          action: z.enum(['count','text','allTextContents','attribute','isVisible','isEnabled','waitFor','hover','click','dblclick','fill','type','press','scrollIntoView']),
          exact: z.boolean().optional(), name: z.string().max(500).optional(), attribute: z.string().max(100).optional(),
          value: z.string().max(10000).optional(), timeout: z.number().min(0).max(15000).optional()
        }),
        handler: async (request) => this.executeLocatorAction(request.tabId, request)
      },
      {
        name: 'browser_screenshot',
        description: 'Capture a screenshot of the tab',
        inputSchema: z.object({ tabId: z.string(), fullPage: z.boolean().optional() }),
        handler: async ({ tabId, fullPage }) => {
          const tab = this.tabs.get(tabId);
          if (!tab) throw new Error('Tab not found');
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_screenshot', readOnly: true });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          if (fullPage) {
            let attachedHere = false;
            try {
              attachedHere = !tab.webContents.debugger.isAttached();
              if (attachedHere) tab.webContents.debugger.attach('1.3');
              const { contentSize } = await tab.webContents.debugger.sendCommand('Page.getLayoutMetrics');
              const shot = await tab.webContents.debugger.sendCommand('Page.captureScreenshot', {
                format: 'png', fromSurface: true, captureBeyondViewport: true,
                clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 }
              });
              if (attachedHere && tab.webContents.debugger.isAttached()) tab.webContents.debugger.detach();
              return { success: true, dataUrl: `data:image/png;base64,${shot.data}`, fullPage: true, width: contentSize.width, height: contentSize.height };
            } catch (error) {
              if (attachedHere && tab.webContents.debugger.isAttached()) { try { tab.webContents.debugger.detach(); } catch {} }
              return { success: false, error: `Full-page screenshot failed: ${error.message}` };
            }
          }
          try {
            const dataUrl = await this.captureTabScreenshot(tab);
            return { success: true, dataUrl, fullPage: false };
          } catch (error) {
            return { success: false, error: `Screenshot failed: ${error.message}` };
          }
        }
      },
      {
        name: 'browser_get_text',
        description: 'Extract text content from the page',
        inputSchema: z.object({ tabId: z.string(), selector: z.string().optional() }),
        handler: async ({ tabId, selector }) => {
          const tab = this.tabs.get(tabId);
          if (!tab) throw new Error('Tab not found');
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_get_text', readOnly: true });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          const script = selector
            ? `document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`
            : 'document.body.innerText';
          const text = await tab.webContents.executeJavaScript(script);
          return { success: true, text };
        }
      },
      {
        name: 'browser_wait',
        description: 'Wait for a condition',
        inputSchema: z.object({ tabId: z.string(), condition: z.enum(['load', 'domcontentloaded', 'networkidle']), timeout: z.number().optional() }),
        handler: async ({ tabId, condition, timeout = 30000 }) => {
          const tab = this.tabs.get(tabId);
          if (!tab) throw new Error('Tab not found');
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_wait', readOnly: true });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          return this.waitForBrowserCondition(tab, condition, Math.max(1, Math.min(timeout, 120000)));
        }
      },
      {
        name: 'browser_evaluate',
        description: 'Execute JavaScript in the page context',
        inputSchema: z.object({ tabId: z.string(), script: z.string() }),
        handler: async ({ tabId, script }) => {
          const tab = this.tabs.get(tabId);
          if (!tab) throw new Error('Tab not found');
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_evaluate' });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          const result = await tab.webContents.executeJavaScript(script);
          return { success: true, result };
        }
      },
      {
        name: 'browser_get_tabs',
        description: 'List all open tabs',
        inputSchema: z.object({}),
        handler: async () => {
          const approvalTabId = this.tabs.keys().next().value;
          if (approvalTabId) {
            const approval = await this.confirmConsequentialAction(approvalTabId, { kind: 'browser_get_tabs', readOnly: true });
            if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          }
          const tabs = [];
          this.tabs.forEach((tab, tabId) => {
            tabs.push({ tabId, browserId: tab.browserId, url: tab.state.url, title: tab.state.title });
          });
          return { success: true, tabs };
        }
      },
      {
        name: 'browser_new_tab',
        description: 'Create a new tab',
        inputSchema: z.object({ url: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP and HTTPS URLs are allowed').optional() }),
        handler: async ({ url }) => {
          const approvalTabId = this.tabs.keys().next().value;
          const approval = await this.confirmConsequentialAction(approvalTabId, { kind: 'browser_new_tab', readOnly: false });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          if (!this.browserControls.createTab) throw new Error('Tab creation is unavailable');
          return { success: true, ...(await this.browserControls.createTab(url)) };
        }
      },
      {
        name: 'browser_close_tab',
        description: 'Close a tab',
        inputSchema: z.object({ tabId: z.string() }),
        handler: async ({ tabId }) => {
          if (!this.tabs.has(tabId)) return { success: false, error: 'Tab not found' };
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_close_tab', readOnly: false });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          if (!this.browserControls.closeTab) throw new Error('Tab closure is unavailable');
          await this.browserControls.closeTab(tabId);
          return { success: !this.tabs.has(tabId), ...(this.tabs.has(tabId) ? { error: 'Tab remained open' } : {}) };
        }
      },
      {
        name: 'run_task',
        description: 'Abre uma aba nova na URL inicial, roda o agente do Zero Browser com o pedido e devolve resposta, passos e uso de tokens. Para benchmarks, captureInitialText devolve até 3000 caracteres visíveis, captureInitialChecks executa até 8 leituras locator isEnabled/isVisible e captureReadEvidence registra apenas chaves de rota de leituras do fixture local 44 no trace, sem conteúdo de página. approvalPolicy: "ask" usa o diálogo normal; "local-fixture" aprova sozinho ações em localhost e bloqueia sites externos; "public-sites" limita ações a HTTPS nos allowedHosts (e subdomínios), sem credenciais nem pagamento; "deny" recusa toda ação que pediria aprovação.',
        inputSchema: z.object({
          startUrl: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP and HTTPS URLs are allowed'),
          prompt: z.string().min(1).max(4000),
          maxSteps: z.number().int().min(1).max(40).optional(),
          approvalPolicy: z.enum(['ask', 'local-fixture', 'public-sites', 'deny']).optional(),
          allowedHosts: z.array(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, 'Use só o nome do site, como pt.wikipedia.org')).max(10).optional(),
          allowCredentials: z.boolean().optional(),
          keepTab: z.boolean().optional(),
          captureInitialText: z.boolean().optional(),
          captureReadEvidence: z.boolean().optional(),
          captureInitialChecks: z.array(z.object({
            strategy: z.enum(['css','text','role','label','placeholder','testid']),
            query: z.string().min(1).max(1000),
            action: z.enum(['isEnabled','isVisible']),
            exact: z.boolean().optional(),
            name: z.string().max(500).optional()
          })).max(8).optional(),
          engine: z.enum(['navegante', 'flame']).optional(),
          maxDurationSec: z.number().int().min(10).max(1800).optional(),
          observeAfterActions: z.boolean().optional(),
          preInspect: z.boolean().optional(),
          actionScripts: z.boolean().optional(),
          diffSnapshots: z.boolean().optional(),
          deduplicateSnapshots: z.boolean().optional(),
          cascadeModel: z.string().min(1).max(200).optional(),
          streaming: z.boolean().optional(),
          effectJournal: z.boolean().optional(),
          verify: z.array(z.object({
            kind: z.enum(['url', 'text', 'absent', 'textCount', 'download', 'currencyAtMost']),
            value: z.string().max(500).optional(),
            min: z.number().int().min(0).optional(),
            max: z.number().nonnegative().optional(),
            currency: z.enum(['BRL']).optional()
          })).max(20).optional(),
          requireVerification: z.boolean().optional(),
          correctionRounds: z.number().int().min(0).max(3).optional(),
          structuredExtraction: z.boolean().optional(),
          recipes: z.boolean().optional(),
          advancedInput: z.boolean().optional(),
          saveRecipe: z.string().min(1).max(41).optional(),
          promptCache: z.boolean().optional(),
          transforms: z.boolean().optional(),
          authenticationOrigins: z.array(z.string().url()).max(10).optional()
        }),
        handler: async (input) => this.runTask(input)
      },
      {
        name: 'module_list',
        description: 'Lista os módulos determinísticos gravados por origem (código escrito pelo agente para transformar dados).',
        inputSchema: z.object({ origin: z.string().url().optional() }),
        handler: async ({ origin }) => {
          if (!this.moduleStore) return { success: false, error: 'Armazenamento de módulos indisponível' };
          return { success: true, modules: await this.moduleStore.list(origin ? new URL(origin).origin : null) };
        }
      },
      {
        name: 'module_run',
        description: 'Execução de módulos temporariamente desativada por segurança.',
        inputSchema: z.object({ origin: z.string().url(), name: z.string().min(1).max(41), input: z.any().optional() }),
        handler: async ({ origin, name, input }) => {
          if (!this.moduleStore) return { success: false, error: 'Armazenamento de módulos indisponível' };
          const found = await this.moduleStore.get(new URL(origin).origin, name);
          if (!found) return { success: false, error: `Módulo "${name}" não existe para ${origin}` };
          const outcome = await runTransform(found.code, input ?? null);
          return outcome.ok ? { success: true, name: found.name, result: outcome.result } : { success: false, code: 'MODULE_DISABLED', error: outcome.error };
        }
      },
      {
        name: 'recipe_export',
        description: 'Exporta uma receita como artefato JSON (kind zero-recipe, version 1) para guardar ou levar a outro perfil.',
        inputSchema: z.object({ origin: z.string().url(), name: z.string().min(1).max(41) }),
        handler: async ({ origin, name }) => this.exportRecipe(new URL(origin).origin, name)
      },
      {
        name: 'recipe_import',
        description: 'Importa um artefato de receita exportado, recusando passos inválidos e saída fora do contrato.',
        inputSchema: z.object({ artifact: z.any() }),
        handler: async ({ artifact }) => this.importRecipe(artifact)
      },
      {
        name: 'recipe_list',
        description: 'Lista as receitas determinísticas guardadas (por origem), com entradas e campos de saída. Sem origin, lista todas as origens conhecidas.',
        inputSchema: z.object({ origin: z.string().url().optional() }),
        handler: async ({ origin }) => {
          if (!this.recipeStore) return { success: false, error: 'Armazenamento de receitas indisponível' };
          await this.recipeStore.load();
          const origins = origin ? [new URL(origin).origin] : Object.keys(this.recipeStore.data.recipes || {});
          const recipes = [];
          for (const key of origins) {
            for (const item of await this.recipeStore.list(key)) recipes.push({ origin: key, ...item });
          }
          return { success: true, recipes };
        }
      },
      {
        name: 'recipe_run',
        description: 'Executa uma receita salva sem chamar modelo: passos estáveis com pós-condição e, quando a receita declara output, valida o contrato sobre a leitura da planilha e devolve output/outputValid.',
        inputSchema: z.object({ origin: z.string().url(), name: z.string().min(1).max(41), values: z.record(z.any()).optional() }),
        handler: async ({ origin, name, values }) => {
          if (!this.recipeStore) return { success: false, error: 'Armazenamento de receitas indisponível' };
          const key = new URL(origin).origin;
          const recipe = await this.recipeStore.get(key, name);
          if (!recipe) return { success: false, error: `Receita "${name}" não existe para ${key}` };
          const tabEntry = [...this.tabs.entries()].find(([, tab]) => {
            try { return new URL(tab?.webContents?.getURL?.() || '').origin === key; } catch { return false; }
          });
          if (!tabEntry) return { success: false, error: `Abra uma aba em ${key} antes de rodar a receita` };
          const [tabId, tab] = tabEntry;
          if ((recipe.authority || 'write') === 'read' && recipe.steps.some((step) => step.tool === 'click_text')) {
            return { success: false, error: 'Receita de leitura não executa cliques; salve como write.' };
          }
          const missing = missingRequiredInputs(recipe.input, values);
          if (missing.length) return { success: false, error: `Faltam entradas obrigatórias: ${missing.join(', ')}` };
          let steps;
          try { steps = applyRecipeInputs(recipe.steps, values || {}); } catch (error) { return { success: false, error: error.message }; }
          const trace = { modelCalls: 0, toolCalls: [], stopReason: null };
          const result = await this.runRecipe(tabId, tab, steps, trace, recipe.output || null);
          return { ...result, name: recipe.name, origin: key, authority: recipe.authority || 'write' };
        }
      },
      {
        name: 'browser_cdp_send',
        description: 'Send raw CDP command',
        inputSchema: z.object({ tabId: z.string(), method: z.string(), params: z.record(z.any()).optional() }),
        handler: async ({ tabId, method, params }) => {
          return await this.sendCdpCommand(tabId, method, params);
        }
      },
      {
        name: 'browser_cdp_events',
        description: 'Read CDP events',
        inputSchema: z.object({ tabId: z.string(), afterSequence: z.number().optional(), limit: z.number().optional(), methods: z.array(z.string()).optional() }),
        handler: async ({ tabId, afterSequence, limit, methods }) => {
          if (this.settingsProvider && !this.settingsProvider().developerCdpEnabled) {
            return { success: false, error: 'Ative “CDP completo” nas configurações para ler eventos CDP.' };
          }
          const tab = this.tabs.get(tabId);
          if (!tab || !tab.webContents || tab.webContents.isDestroyed()) {
            return { success: false, error: 'Tab not found' };
          }
          const approval = await this.confirmConsequentialAction(tabId, { kind: 'browser_cdp_events', readOnly: true });
          if (!approval.approved) return { success: false, cancelled: !!approval.cancelled, error: approval.error };
          if (!tab.webContents.debugger.isAttached()) await tab.webContents.debugger.attach('1.3');
          const start = Math.max(0, afterSequence || 0);
          const count = Math.max(1, Math.min(500, limit || 100));
          const allowed = methods?.length ? new Set(methods) : null;
          const events = tab.cdpEvents.filter((event) => event.sequence > start && (!allowed || allowed.has(event.method))).slice(0, count);
          return { success: true, events, nextSequence: tab.cdpSequence };
        }
      }
    ];

    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  broadcast(event, data) {
    const message = JSON.stringify({ type: event, data });
    this.clients.forEach(({ ws }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }
}

module.exports = { AutomationService };
