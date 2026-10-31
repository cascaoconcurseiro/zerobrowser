# Comparativo e Contrato de Ferramentas MCP — Zero Browser (`0.1.56-dev`)

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

