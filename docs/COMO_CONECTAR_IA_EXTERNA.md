# Como Conectar uma IA Externa ao Zero Browser (`0.1.59-dev`)

O Zero Browser expõe seu servidor MCP local por pipe nomeado autenticado (`scripts/mcp-stdio.js`) e registro de permissões por cliente (`src/automation/mcp-diagnostics.js`).

## 1. Conectar Claude Code / Clientes MCP (stdio)

Execute no terminal:

```powershell
claude mcp add navegante -- node C:\Users\Wesley\Documents\Navegante\scripts\mcp-stdio.js
```

## 2. Níveis de Concessão por Cliente

| Nível | O que permite | O que nunca permite |
|---|---|---|
| `observar` | Ler texto da página, abas, capturas de tela, `console_messages`, `page_errors` e `network_requests` (com segredos redigidos). | Clicar, digitar, executar JS ou alterar configurações. |
| `interagir` | Tudo de `observar` + clicar, digitar, rolar, navegar, criar/fechar abas e rodar receitas. | `browser_evaluate`, CDP bruto ou alterar configurações do navegador. |
| `desenvolvedor` | Tudo de `interagir` + `browser_evaluate`, `browser_cdp_send`, `browser_cdp_events` e `performance_trace`. | Desativar o núcleo intocável ou aprovar pagamentos sem confirmação humana. |
| `total` | Tudo de `desenvolvedor` + consultar/gerenciar biblioteca, perfis e extensões. | Desligar o botão Parar tudo, desligar o Firewall de Intenção, apagar log de auditoria ou ler senhas em texto puro. |

## 3. Revogação e Parada Imediata

- Qualquer cliente pareado pode ser revogado individualmente em 1 clique (`revokeClient(clientId)`), invalidando seu token `zbmcp_*` na hora sem afetar outros clientes.
- O botão **Parar tarefa** / **Parar todos os Bots** interrompe qualquer execução em menos de 1 segundo.



---

## Contrato e inventário das ferramentas MCP (antes em COMO_CONECTAR_IA_EXTERNA.md, 0.1.56-dev)


Este documento registra o inventário real das ferramentas MCP do Zero Browser (`scripts/mcp-stdio.js` e `src/automation/mcp-diagnostics.js`), comparando com **Playwright MCP** e **Chrome DevTools MCP**, e define o nível mínimo de permissão por cliente.

## 1. Níveis de Concessão por Cliente (`McpClientRegistry`)

1. **`observar` (nível 1):** leitura de página, abas, capturas de tela, mensagens de console (`console_messages`), erros de página (`page_errors`) e requisições de rede (`network_requests`) com segredos redigidos por padrão.
2. **`interagir` (nível 2):** inclui `observar` + clicar, digitar, rolar, aguardar, navegar e abrir/fechar abas.
3. **`desenvolvedor` (nível 3):** inclui `interagir` + `browser_evaluate`, `browser_cdp_send`, `browser_cdp_events` e `performance_trace`.
4. **`total` (nível 4):** inclui `desenvolvedor` + controle de histórico, favoritos, downloads, configurações, perfis e extensões (nunca desativa o **núcleo intocável** nem aprova pagamentos/envios externos sem confirmação humana).

---

## 2. Comparativo de Ferramentas

| Capacidade | Zero Browser MCP | Playwright MCP | Chrome DevTools MCP | Nível Mínimo no Zero |
|---|---|---|---|---|
| Navegar / Recarregar / Voltar | `browser_navigate` | `browser_navigate` | `navigate_page` | `interagir` |
| Árvore / Texto da página | `browser_get_text` | `browser_snapshot` | `take_snapshot` | `observar` |
| Clique / Digitação / Rolagem | `browser_click`, `browser_type`, `browser_scroll`, `browser_locator_action` | `browser_click`, `browser_type` | `click`, `fill` | `interagir` |
| Captura de tela | `browser_screenshot` | `browser_take_screenshot` | `take_screenshot` | `observar` |
| Abas abertas | `browser_get_tabs`, `browser_new_tab`, `browser_close_tab` | `browser_tab_list`, `browser_tab_new` | `list_pages`, `new_page`, `close_page` | `observar` / `interagir` |
| Mensagens de Console (alto nível) | `console_messages` | `browser_console_messages` | `list_console_messages` | `observar` |
| Erros de página (exceções JS) | `page_errors` | Incluído no console | Incluído no console | `observar` |
| Requisições de Rede (com redação) | `network_requests` | `browser_network_requests` | `list_network_requests`, `get_network_request` | `observar` |
| Execução JS / CDP | `browser_evaluate`, `browser_cdp_send`, `browser_cdp_events` | `browser_evaluate` | `evaluate_script` | `desenvolvedor` |
| Receitas por site e Agente | `run_task`, `recipe_list`, `recipe_run`, `recipe_save` | Não possui | Não possui | `interagir` |
| Biblioteca / Perfis / Extensões | `library_*`, `profiles_manage`, `extensions_manage` | Não possui | Não possui | `total` |

