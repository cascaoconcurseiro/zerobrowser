# Plano — Zero Browser controlável por qualquer IA (inclusive console)

Data: 31/10/2026. **Status: Fases 1 a 7 implementadas (`0.1.56-dev` a `0.1.60-dev` em `src/automation/mcp-diagnostics.js`, `src/automation/mcp-http-server.js`, `docs/COMO_CONECTAR_IA_EXTERNA.md` e `docs/COMO_CONECTAR_IA_EXTERNA.md`).**

## 1. O que existe hoje

Pelo MCP (pipe local autenticado por token, conector `scripts/mcp-stdio.js`):
- Navegação e página: `browser_navigate`, `browser_click`, `browser_type`, `browser_scroll`, `browser_cua_action`, `browser_locator_action`, `browser_wait`, `browser_screenshot`, `browser_get_text`.
- Abas: `browser_get_tabs`, `browser_new_tab`, `browser_close_tab`.
- Código na página: `browser_evaluate` (JavaScript), com aprovação do usuário a cada chamada.
- Console e DevTools: `browser_cdp_send` (qualquer comando CDP) e `browser_cdp_events` (eventos CDP). Só funcionam com "CDP completo" ligado nas configurações **e** com aprovação do usuário a cada chamada.
- Agente: `run_task`, receitas por site (listar, rodar, salvar, exportar/importar).

## 2. Problemas para "qualquer IA controlar tudo"

1. **Console e rede só existem de forma bruta.** Para ler o console ou as requisições a IA precisa saber habilitar `Runtime`, `Log` e `Network` por CDP e montar os eventos sozinha. Outras ferramentas de referência (Playwright MCP, Chrome DevTools MCP) entregam `console_messages`, lista de requisições com corpo, etc. prontos.
2. **Aprovação por chamada inviabiliza controle autônomo.** Cada comando CDP ou `evaluate` abre um pedido ao usuário. Serve como proteção, mas uma IA externa trabalhando por horas não funciona assim.
3. **Um token só para todos os clientes.** Não dá para dar permissão diferente a Claude, a outro agente e a um script, nem revogar um sem derrubar os outros.
4. **Faltam ferramentas de alto nível** (pelo que li; confirmar com `tools/list`): cookies e armazenamento, emulação de dispositivo e rede, diálogos (alert/confirm), seletor de arquivos e upload via MCP, PDF, árvore de acessibilidade, arrastar e soltar, teclas, quadros (iframes), captura de elemento, traço de desempenho.
5. **O navegador em si não é controlável** (histórico, favoritos, downloads, configurações, perfis, extensões): não vi essas ferramentas no MCP.
6. **Só um conector (stdio).** Falta uma porta compatível com CDP (para Playwright e Puppeteer se conectarem) e um modo HTTP local.

## 3. Modelo de permissão (a decisão central)

Controle total de um navegador logado em banco, e-mail e trabalho é o maior risco do produto. A solução não é limitar o poder, e sim dar poder por **concessão explícita por cliente**:

- Cada IA ou script se registra como **cliente** com identificador e token próprios (pareamento aprovado por você na interface). Pode ser revogado individualmente.
- Cada cliente recebe um **nível**: *observar* (ler página, console, rede, capturas), *interagir* (clicar, digitar, navegar), *desenvolvedor* (evaluate, CDP bruto, cookies, emulação), *total* (inclui histórico, favoritos, downloads, configurações, perfis, extensões).
- A concessão tem **validade** e **escopo** (perfil e, se quiser, sites). Aprovar uma vez por sessão, e não por chamada.
- **Ações destrutivas ou de saída** (enviar formulário com efeito, pagar, apagar dados, ler cookies/senhas) continuam pedindo aprovação, mesmo no nível *total*, a menos que você marque outra coisa por cliente.
- **Segredos redigidos por padrão** em respostas (campos de senha, cookies de sessão, tokens), com opt-in para ver.
- **Auditoria:** log de cada chamada por cliente, indicador visível na janela ("controlado por X") e botão de parar tudo.
- Escuta só em loopback; nenhuma porta de depuração aberta sem token.

## 4. Fases

1. **Inventário real.** Rodar `tools/list`, gravar o resultado como contrato, comparar com Playwright MCP e Chrome DevTools MCP e listar o que falta. Aceite: documento com a lista completa e as lacunas confirmadas.
2. **Modelo de permissão e clientes.** Pareamento, níveis, validade, log, indicador, parar tudo. Aceite: testes de contrato (cliente sem permissão é recusado; revogado deixa de funcionar; log registra).
3. **Console e rede de alto nível.** `console_messages`, `page_errors`, `network_requests` (com corpo, filtro por URL/status), `performance_trace`. Aceite: página fixture com erro de console e requisição falha; a IA lê os dois.
4. **Ferramentas faltantes de página.** Cookies/armazenamento (com redação), emulação, diálogos, upload, PDF, árvore de acessibilidade, arrastar, teclas, iframes. Aceite: uma fixture por ferramenta.
5. **Controle do navegador.** Histórico, favoritos, downloads, configurações, perfis, extensões, abas e grupos, cada um atrás do nível *total*. Aceite: testes negativos para cliente de nível inferior.
6. **Compatibilidade.** Servidor HTTP local para MCP e uma porta CDP com token (para conexões de Playwright/Puppeteer). Aceite: Claude Code, Codex e um script Playwright controlam uma página fixture.
7. **Documentação** de como conectar cada cliente e o que cada nível permite.

## 5. Riscos
- Um nível *total* concedido a um cliente comprometido equivale a controle do navegador logado. Mitigação: validade curta, escopo por perfil, log e parar tudo.
- Prompt injection: página ou e-mail instruindo a IA conectada. Isso é responsabilidade também do cliente, mas o Zero mantém aprovação em saídas e redige segredos.
- Superfície grande de API: cada ferramenta nova precisa de teste negativo e revisão de segurança antes de ser liberada.
- As regras do próprio assistente continuam valendo no cliente (por exemplo, o Claude não digita senhas nem faz login em nome do usuário).

## 6. Decisões suas
- Quais níveis oferecer ao liberar para uma IA (os quatro acima, ou menos).
- Se o nível *total* pode existir, e com qual validade máxima.
- Se quer a porta CDP compatível com Playwright já nesta etapa ou depois.
