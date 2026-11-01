# Análise estática REA - ChatGPT In-App Browser

> Inventário técnico de uma versão específica do ChatGPT Desktop para Windows, feito com REA e análise estática do `app.asar`.
> **Este documento não comprova engenharia reversa completa nem equivalência funcional.** Os limites e lacunas estão registrados na seção 15.

---

## 1. Visão Geral do Alvo

| Item | Detalhe |
|------|---------|
| **Aplicativo** | ChatGPT Desktop (Windows) |
| **Pacote** | `OpenAI.Codex_26.1013.4894.0_x64__2p2nqsd0c76g0` |
| **Executável** | `ChatGPT.exe` (4.7 MB) + `chrome.dll` (329 MB, Chromium 155) |
| **Framework** | Electron custom (Chromium embed) |
| **Localização** | `C:\Program Files\WindowsApps\OpenAI.Codex_...\app\` |

---

## 2. Arquitetura do Processo Principal

### 2.1 Estrutura de Arquivos (extraída do `app.asar` - 582 MB)

```
app/
├── ChatGPT.exe              # Entry point (Electron main)
├── chrome.dll               # Chromium 155 embed
├── resources/
│   ├── app.asar             # Bundle JS principal (582 MB)
│   ├── app.asar.unpacked/   # Native modules (leveldb, node-pty, etc.)
│   ├── codex                # Agent binary ELF (296 MB)
│   ├── codex.exe            # Agent binary Windows PE (341 MB)
│   ├── plugins/
│   │   └── openai-bundled/
│   │       └── plugins/
│   │           ├── browser/         # ← CORE AUTOMATION
│   │           ├── chrome/
│   │           ├── code-review/
│   │           ├── computer-use/
│   │           └── ...
│   └── ...
```

### 2.2 Processo Principal (`main-C4DYk222.js` - 4 MB minificado)

**Componentes chave descobertos via REA:**

| Componente | Função |
|------------|--------|
| `sDe` class | Download manager via `WebContentsView` |
| `Mz`/`Nz` functions | CDP multiplexer (attach, sendCommand, autoAttach) |
| `browserPagePreloadPath` | Preload injetado em cada aba (`browser-page-preload.js`) |
| `setWindowOpenHandler` | Controle de popups/novas abas → `admitBrowserTab()` |
| `session.fromPartition` | Isolamento por aba: `persist:codex-browser-app-route:<conv>\0<tab>` |
| `browserSessionService` / `browserSessionRegistry` | Gerencia sessões e backends |
| `automationService` | Native pipe `CODEX_APP_TOOLS_PIPE_PATH` |

### 2.3 Partições de Sessão (Isolamento por Aba)

```javascript
// Cada aba tem sua própria sessão persistente
persist:codex-browser-app-route:<conversationId>\0<browserTabId>

// Outras partições identificadas:
persist:codex-browser-app-route:     // browser tabs
:codex-browser-                     // browser data
thread-browser-tabs-v1:             // localStorage tabs
data-browser-sidebar-page-restore   // page restore
codex-workspace-settings-           // workspace settings
```

---

## 3. Plugin de Automação: `@oai/browser-desktop`

**Localização:** `resources/plugins/openai-bundled/plugins/browser/`

### 3.1 Arquivos Principais

| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `browser-service.mjs` | 1.46 MB | MCP server implementação (WebSocket) |
| `browser-client.mjs` | 169 KB | Cliente para conectar ao serviço |
| `browser-accessibility.wasm.br` | 4 MB | Engine acessibilidade (WASM) |
| `zxing_reader.wasm` | 1 MB | QR code reader |
| `docs/api.json` | 66 KB | **API reference completa** |
| `skills/control-in-app-browser/SKILL.md` | 13 KB | Instruções para o agente |

### 3.2 Scripts Auxiliares
- `chromium-browser-diagnostics.mjs` - Diagnóstico Chromium
- `installed-browsers.js` - Detecção browsers instalados
- `open-chrome-window.js` - Abrir janela Chrome
- `check-extension-installed.js` - Verificar extensão ChatGPT
- `check-native-host-manifest.js` - Native messaging host

---

## 4. APIs documentadas (de `docs/api.json`)

### 4.1 Interfaces Principais

```
Agent
  └── browsers: Browsers
  └── documentation: Documentation

Browsers
  ├── get(id)
  ├── getDefault()
  ├── getForUrl(url)
  └── list()

Browser
  ├── browserId
  ├── capabilities: BrowserCapabilityCollection
  ├── tabs: Tabs
  ├── user: BrowserUser
  ├── documentation()
  ├── history()
  └── nameSession()

Tabs
  ├── content()
  ├── get(id)
  ├── list()
  ├── new()
  └── selected()

Tab
  ├── ax: AXAPI                    ← PRIMARY (accessibility-first)
  ├── capabilities
  ├── clipboard: TabClipboardAPI
  ├── content: ContentAPI
  ├── cua: CUAAPI                  ← Computer Use API
  ├── dev: TabDevAPI
  ├── dom_cua: DomCUAAPI
  ├── id
  ├── playwright: PlaywrightAPI    ← Long/repetitive tasks
  ├── back(), close(), forward()
  ├── getJsDialog(), goto()
  ├── markDeliverable(), markHandoff()
  ├── reload(), requestManualHandoff()
  ├── requestUserTakeover()
  ├── screenshot(), title(), url()
```

### 4.2 AXAPI (Accessibility-First - Primária)

```javascript
Tab.ax:
  ├── click(elementIndex, options)
  ├── dblclick(elementIndex, options)
  ├── drag(fromIndex, toIndex)
  ├── performSecondaryAction(elementIndex, action)
  ├── pressKey(elementIndex, key, duration)
  ├── scroll(target, direction, pages)
  ├── selectText(elementIndex, prefix, suffix, selectionType)
  ├── setValue(elementIndex, value)
  ├── typeText(elementIndex, text)
  ├── paste(elementIndex, text)
  ├── write(mode, options)        // "state" | "screenshot" | "both"
  └── get(options)
```

**Fluxo recomendado:**
```javascript
await tab.ax.write();                    // Get accessibility tree (diff-based)
await tab.ax.click(42);                  // Click by element_index
await tab.ax.typeText(42, "texto");      // Type into element
await tab.ax.pressKey(null, "Return");   // Press key
await tab.ax.scroll(42, "down", 1);      // Scroll element
await tab.ax.write();                    // Get updated state
```

### 4.3 Outras APIs
- **PlaywrightAPI** - Locators, frames, downloads, expectations
- **CUAAPI** / **DomCUAAPI** - Computer Use (click, type, scroll via coords)
- **ContentAPI** - Export (html, text, gsuite, youtube transcript)
- **TabClipboardAPI** - read/write clipboard
- **TabDevAPI** - logs

### 4.4 Capabilities (Opcionais, por Tab/Browser)

| Capability | Descrição |
|------------|-----------|
| `cdp` | Raw CDP: `readEvents()`, `send(method, params)` |
| `ax` | Accessibility API (padrão) |
| `botDetection` | Report bot detection blocks |
| `browserAuth` | Auth handling |
| `webmcp` | WebMCP tools |
| `pageAssets` | Page assets |
| `visibility` | Tab visibility |
| `management` | Windows/tabs/bookmarks management |

---

## 5. Protocolo de Comunicação

### 5.1 Native Pipe (Agent ↔ Browser)

```
Environment Variable: CODEX_APP_TOOLS_PIPE_PATH
Protocol: JSON-RPC 2.0 over named pipe / WebSocket
```

**Message Types:**
- `ire` - Request (JSON-RPC 2.0)
- `ure` - Response
- `dre` - Error
- `fre` - Notification

### 5.2 CDP Multiplexer (Mz/Nz)

```javascript
// Mz - cria debugger attach com autoAttach
await e.debugger.sendCommand('Target.setAutoAttach', {
  autoAttach: true,
  waitForDebuggerOnStart: false,
  flatten: true,
  filter: [{type: 'page'}, {type: 'iframe'}]
});

// Nz - wrapper com timeout
await Promise.race([
  e.debugger.sendCommand(method, params),
  timeout(1000)
]);
```

**CDP Domains Usados:**
- `Target.*` (attach/detach/autoAttach/closeTarget/getTargetInfo)
- `Page.*` (enable, captureScreenshot, navigate, getFrameTree, addScriptToEvaluateOnNewDocument)
- `Network.*` (enable, requestWillBeSent, responseReceived, getRequestPostData)
- `Runtime.*` (evaluate, callFunctionOn, addBinding, bindingCalled)
- `Input.*` (dispatchMouseEvent, dispatchKeyEvent, insertText)
- `DOM.*` (getDocument, querySelector, describeNode, resolveNode)
- `Emulation.*` (setDeviceMetricsOverride, setEmulatedMedia)
- `Fetch.*` (disable)
- `Overlay.*`, `Accessibility.*`, `Target.*`

### 5.3 Action DSL (Schema Zod)

```javascript
const ActionSchema = z.object({
  kind: z.enum([
    'click', 'dblclick', 'drag', 'perform_secondary_action',
    'press_key', 'scroll', 'select_text', 'set_value',
    'type_text', 'paste'
  ]),
  elementIndex: z.number().nullable().optional(),
  // ... params específicos por kind
});
```

**Actions:**
| Kind | Params |
|------|--------|
| `click` | elementIndex?, modifiers?, button?, force?, timeout? |
| `dblclick` | elementIndex? |
| `drag` | from, to |
| `perform_secondary_action` | elementIndex, action |
| `press_key` | elementIndex?, key, duration? |
| `scroll` | target, direction (up/down/left/right), pages? |
| `select_text` | elementIndex, prefix?, suffix?, selectionType? |
| `set_value` | elementIndex, value |
| `type_text` | elementIndex?, text |
| `paste` | elementIndex?, text |

---

## 6. MCP Services

### 6.1 Browser Service
```
@oai/browser-desktop/service
```
Implementado em `browser-service.mjs` - expõe ferramentas via MCP:
- `browser_navigate`, `browser_click`, `browser_type`, `browser_scroll`
- `browser_screenshot`, `browser_get_text`, `browser_wait`
- `browser_evaluate`, `browser_get_tabs`, `browser_cdp_send`
- `browser_cdp_events`, `browser_new_tab`, `browser_close_tab`

### 6.2 Computer Use Service
```
@oai/sky/service
```
Para automação de desktop (computer-use).

### 6.3 Configuração `.mcp.json`
```json
{
  "mcpServers": {
    "cua_repl": {
      "command": "...",
      "args": [...],
      "env": { "CODEX_APP_TOOLS_PIPE_PATH": "..." }
    }
  }
}
```

---

## 7. Skill do Agente: `control-in-app-browser`

**Arquivo:** `skills/control-in-app-browser/SKILL.md`

### 7.1 Fluxo de Seleção de Browser (ordem de prioridade)

1. **Explícito `@Browser`** → `agent.browsers.get("iab")`
2. **Explícito `@Chrome`** → `agent.browsers.get("chrome")`
3. **Explícito `@Edge`** → `agent.browsers.get("edge")`
4. **Explícito external browser** → `agent.browsers.get("extension")`
5. **URL fornecida** → `agent.browsers.getForUrl(url)`
6. **Default** → `agent.browsers.getDefault()` (prefere IAB)

### 7.2 Regras Críticas
- **Documentação obrigatória**: `await browser.documentation()` ANTES de qualquer ação
- **Node REPL `js` tool** obrigatório para controle
- **Reutilizar binding** do browser entre turns
- **Não substituir** browser explícito por outro
- **Bootstrap troubleshooting** se falhar: `await agent.documentation.get("bootstrap-troubleshooting")`

### 7.3 Setup Inicial
```javascript
const { setupBrowserRuntime } = await import("<plugin>/scripts/browser-client.mjs");
const agent = await setupBrowserRuntime();
const iab = await agent.browsers.get("iab");
nodeRepl.write(await iab.documentation());
const tab = await browser.tabs.new();
```

---

## 8. Configuração Persistida

**Arquivo JSON** (local não documentado, mas inferido):
```json
{
  "full_cdp_access_enabled": true,
  "webmcp_enabled": true,
  "approval_mode": "always_ask",
  "history_approval_mode": "always_ask",
  "iab_history_approval_mode": "always_ask",
  "download_approval_mode": "always_ask"
}
```

**Per-origin state** (`BrowserUseOriginState`):
```javascript
{
  origin: string,
  download: "allowed" | "denied" | "approval_required",
  upload: "allowed" | "denied" | "approval_required",
  fullCdp: boolean,
  webMcp: boolean
}
```

---

## 9. Segurança & Isolamento

| Camada | Implementação |
|--------|---------------|
| **Process Isolation** | WebContentsView por aba, sandbox=true |
| **Session Isolation** | `session.fromPartition('persist:...')` por aba |
| **Context Isolation** | `contextIsolation: true`, `nodeIntegration: false` |
| **CSP** | Restritivo no renderer |
| **SafeStorage** | DPAPI (Windows) para API keys |
| **Permissões** | Por origem, via `session.setPermissionRequestHandler` |
| **CDP Access** | Gateado por `full_cdp_access_enabled` + user approval |
| **Single Instance Lock** | `app.requestSingleInstanceLock()` |

---

## 10. Descobertas via REA Tools

### 10.1 `rea_analyze_javascript_application` no plugin browser
- **Input:** `browser-service.mjs` + `browser-client.mjs`
- **Resultado:** 2 arquivos, 331.158 AST nodes, 118 findings
- **Limitações:** Heap exhausted during semantic analysis (1.46 MB file)

### 10.2 `rea_open_binary` + `rea_analyze_function` (potencial)
- Alvos: `codex.exe` (341 MB), `codex-command-runner.exe` (8 MB), `codex` ELF (296 MB)
- Não executado - binários grandes, requer Ghidra headless

---

## 11. Problemas Encontrados Durante Reconstrução

| Problema | Causa | Correção |
|----------|-------|----------|
| `Cannot find module 'level-supports'` | Dependência transitiva não declarada | Adicionado `level-supports`, `abstract-level`, `level-transcoder`, `classic-level` ao `package.json` |
| `SyntaxError: Identifier 'app' already declared` | Import duplicada no `main.js` | Removido bloco duplicado linhas 1-16 |
| `Cannot find module 'electron-store'` | ESM vs CommonJS | Migração para `dynamic import()` |
| Janela não aparece no atalho | Falta `requestSingleInstanceLock` | Adicionado `app.requestSingleInstanceLock()` + `second-instance` handler |
| Janela não carrega | `loadFile` sem error handling | Adicionado logging + `did-fail-load` handler |

---

## 12. Como Reproduzir a Análise

### 12.1 Extrair `app.asar`
```bash
npx asar extract "C:\Program Files\WindowsApps\OpenAI.Codex_...\app\resources\app.asar" ./extracted
```

### 12.2 Analisar Plugin Browser
```bash
cd extracted/resources/plugins/openai-bundled/plugins/browser
# Ler: scripts/browser-service.mjs, scripts/browser-client.mjs
# Ler: docs/api.json, docs/capabilities/tab/*.md
# Ler: skills/control-in-app-browser/SKILL.md
```

### 12.3 Rodar REA JS Analyzer
```bash
# Criar diretório focado
mkdir browser-plugin && cp scripts/*.mjs browser-plugin/
rea_analyze_javascript_application --input_path=browser-plugin --format=directory --detail=summary
```

---

## 13. Referências de Arquivos Originais (ChatGPT App)

| Caminho no `app.asar` | Descrição |
|----------------------|-----------|
| `.vite/build/main-C4DYk222.js` | Main process (4 MB) |
| `.vite/build/browser-page-preload.js` | Preload injetado nas abas (530 KB) |
| `.vite/build/browser-background-switches-DmHa3bqb.js` | Background switches (146 KB) |
| `webview/` | Renderer UI (index.html + assets) |
| `resources/plugins/openai-bundled/plugins/browser/` | Plugin automação completo |

---

## 14. Licença & Uso

> **IMPORTANTE:** Esta análise é para fins educacionais e de engenharia reversa defensiva. O código do ChatGPT é propriedade da OpenAI. Esta documentação serve como referência para construir implementação **original** (clean room) sem copiar código, strings, assets ou marcas da OpenAI.

---

*Gerado em 2026 via análise REA + inspeção estática do ChatGPT Desktop v26.1013.4894.0*

---

## 15. Auditoria de completude e limites

**Revisão:** 2026-10-21. Esta seção separa o que o inventário não demonstra do que falta na implementação local do Navegante. Os achados sobre o código local foram conferidos em `src/`; não são evidência nova sobre o pacote da OpenAI.

### 15.1 O que falta para a análise do alvo ser reproduzível

- Hashes SHA-256 do instalador, `app.asar` e arquivos analisados; data e procedimento de aquisição; versões exatas das ferramentas REA e do `asar`.
- Saídas relevantes do REA e referências precisas para cada descoberta. Sem isso, nomes como `Mz`, `Nz`, `sDe`, `ire/ure/dre/fre` e os caminhos de configuração não podem ser auditados independentemente.
- Marcação de cada afirmação como **observada**, **inferida** ou **não verificada**. A seção 8 chama o caminho/configuração de “inferido”, mas apresenta chaves específicas sem apontar a evidência que as revelou.
- Envelopes reais de mensagens, negociação de conexão, descoberta do endpoint, autenticação, códigos de erro, timeout, eventos e reconexão do protocolo. “JSON-RPC 2.0” junto de prefixos `ire/ure/dre/fre` não define por si só um protocolo reproduzível.
- Contratos completos de entradas, saídas, erros e capacidades para AX, Playwright, CUA, DOM-CUA, clipboard, downloads, diálogos, handoff e gestão de abas/janelas. O resumo dos métodos e o recorte do `ActionSchema` não equivalem à API completa citada na seção 4.
- Evidência dinâmica para os comportamentos afirmados: criação/fechamento de abas, persistência e restauração de sessões, popups, permissões, downloads, takeover, confirmação, WebMCP e CDP. A própria seção 10 registra que a análise semântica esgotou memória e que a análise de binários não foi executada.
- Reprodutibilidade do ambiente: comando de extração com caminhos concretos, pré-requisitos, estrutura de diretórios esperada e resultados de cada etapa. Os comandos atuais usam caminhos com `...` e mistura de convenções Bash/Windows.

### 15.2 Inconsistências editoriais corrigidas nesta revisão

- A palavra “completa” foi removida do título descritivo porque a documentação declara análise semântica incompleta e não documenta todos os contratos.
- A numeração duplicada `6.2` e os subtítulos `10.1`–`10.3` dentro da seção 12 foram corrigidos.
- A seção 9 deve ser lida como **requisitos/observações do alvo**, não como prova de que o Navegante implementa as mesmas proteções. A comparação com a implementação local está na seção seguinte.

### 15.3 Lacunas verificadas no Navegante frente às capacidades descritas

O Navegante atual **não tem paridade funcional** com a referência descrita neste arquivo. A documentação do alvo cita APIs mais amplas; o código local ainda tem estas lacunas concretas:

| Área | Estado verificado no Navegante | Trabalho que falta |
|------|-------------------------------|-------------------|
| Agente de IA | `runAgent` conversa com OpenRouter e tem ferramentas básicas: inspecionar texto/controles, navegar, clicar, preencher e rolar. Ações consequentes passam por confirmação no processo principal; recusa interrompe o loop do modelo. Testes unitários cobrem recusa, ausência de execução, bloqueio de workaround, `browser_evaluate` e esquemas de URL. O instalador foi validado com provider local: uma fixture enviou após “Permitir uma vez”; outra não enviou após “Cancelar” e o agente parou sem chamada adicional. | Não há screenshot/visão visual, teclas completas, seleção robusta, arrastar por coordenadas, progresso por ação, pausa/takeover/retomada nem validação em sites reais. O provider real continua sem validação. |
| API de acessibilidade (AX) | O `AutomationService` extrai um snapshot DOM e executa operações básicas por índice. Uma fixture Electron real passou em snapshot, digitação, clique, mutação da página e screenshot. | A API separada de `browser-preload.js` continua sem receptor. Ainda faltam as demais ações/estados, índices estáveis/diff e aceitação em páginas reais; eventos DOM sintéticos podem não ser aceitos por todos os sites. Isso ainda não é a AXAPI da referência. |
| Serviço de automação/MCP | Há WebSocket local e pipe Windows com JSON-RPC 2.0/MCP (`initialize`, `tools/list`, `tools/call`); callbacks de abas executam criar/fechar; eventos CDP usam buffer sequenciado. Há schemas JSON para ferramentas. | A interoperabilidade ainda precisa ser validada com cliente MCP independente. O WebSocket segue protocolo próprio, a porta é dinâmica e não há autenticação de cliente. Testes cobrem callbacks e eventos simulados, não navegação multiaba real nem detach/reconexão. |
| Configurações | Tema, URL completa, DNT, pasta configurada e download sem diálogo foram exercitados no instalador com fixture local. CDP tem gate unitário e WebMCP aparece desabilitado. | Limpeza ao sair, bloqueio efetivo de cookies de terceiros, seletor nativo de pasta, download com diálogo e CDP ainda precisam de aceite instalado. O gerenciador de extensões permanece indisponível. |
| Provedor e modelos | O painel aceita uma chave OpenRouter e conecta enviando uma chamada real no formato de chat completions; a chave é guardada pelo store cifrado. | A lista tem só três opções fixas. Não busca `/api/v1/models`, não testa capacidade de tool calling, não oferece chave direta DeepSeek nem seleção de provedor. Conexão real nunca foi validada; o teste instalado usa endpoint mock local. |
| Navegador | Abas, navegação, voltar/avançar, recarregar e tela de permissões estão ligados ao processo principal. | Não há gerenciador de extensões, histórico/favoritos, gerenciador de downloads, restauração de sessão, permissões persistidas por origem, seleção de destino de popup ou transferência de controle protegida. |
| Segurança e confiança | Context isolation, sandbox e chave cifrada existem; localização é liberada para domínios Google reconhecidos. O processo principal pede confirmação em ações classificadas como consequentes e em execução de script/comando CDP; recusa interrompe o agente. Fixture instalada comprovou permitir/cancelar antes de enviar formulário. | A classificação ainda precisa de cobertura contra falsos positivos/negativos, prompt injection, exfiltração e instruções conflitantes da página. Não há takeover seguro nem validação em sites externos/autenticados. |

Esses pontos foram verificados em `src/automation/service/index.js`, `src/preload/browser-preload.js`, `src/main/main.js`, `src/renderer/app.js` e `src/renderer/index.html`. A validação de snapshot e ações AX inclui agora uma fixture local em `WebContentsView`; não valida ainda sites reais nem uma chamada faturável à OpenRouter.

### 15.4 Referência de produto e data

Este inventário descreve o bundle identificado como ChatGPT Desktop `26.1013.4894.0`; não deve ser tratado como especificação completa de todas as versões ou superfícies atuais da OpenAI. Em 2026-10-21, a documentação oficial descreve ferramentas de site no aplicativo desktop que usam WebMCP, mostram ferramentas recentes e pedem confirmação para operações sensíveis ([Site tools no aplicativo desktop](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app)). A documentação oficial também registra que Atlas foi aposentado e que o produto chamado ChatGPT agent foi substituído por outras experiências ([aposentadoria do Atlas](https://help.openai.com/en/articles/20001371-chatgpt-atlas-retirement), [ChatGPT agent](https://help.openai.com/en/articles/11752874-chatgpt-agent)). Portanto, qualquer meta de “igual ao da OpenAI” precisa nomear a superfície e a data da referência; este arquivo, sozinho, não define essa meta.

### 15.5 Critério para declarar paridade funcional

Não declarar o Navegante equivalente com base em build, UI, testes unitários ou lista de ferramentas. Cada fluxo deve ter teste automatizado, percurso real em uma página controlada e validação no instalador Windows. Ações que enviam dados, publicam, compram, excluem ou alteram conta precisam de confirmação aplicada pelo processo principal e resultado observado antes de serem marcadas como concluídas.

### 15.6 O que ainda falta documentar e validar

- Uma matriz requisito → implementação → teste → evidência para cada capacidade das seções 4–9. A seção 15.3 resume diferenças, mas não rastreia cada método/capability.
- Contratos completos de erro, capabilities opcionais, downloads, file chooser, clipboard, frames, seletores Playwright, CUA por coordenadas e exportações ContentAPI. O inventário atual é resumo, não especificação suficiente para compatibilidade.
- Validação dinâmica do runtime original: análise REA estática parcial e leitura da documentação não provam comportamento do ChatGPT Desktop.
- Aceite com provider real autorizado e sites externos controlados. O teste instalado cobre o diálogo em formulário local, mas não prova a classificação em todos os controles nem a eficácia em ações externas reais.
- Rastreabilidade do instalador testado por hash/versão e resultado detalhado por fluxo. O teste de executável com provider local vale apenas para a fixture local.
