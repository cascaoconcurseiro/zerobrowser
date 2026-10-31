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

