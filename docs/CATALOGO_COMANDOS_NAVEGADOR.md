# Catálogo de Comandos do Navegador — Zero Browser

Data: `31/10/2026`
Módulo de referência: [`src/main/command-registry.js`](../src/main/command-registry.js)

Todo comando do navegador possui:
- `id`: identificador único (`categoria.acao`)
- `effect`: `leitura`, `escreve` ou `sistema`
- `reversibility`: `reversivel`, `parcial` ou `irreversivel` (obrigatório em toda ação de escrita)
- `compensate`: ação inversa gravada no momento da execução (quando `reversivel` ou `parcial`)

---

## 1. Abas e Navegação (`tabs.*`, `navigation.*`)

| ID | Título | Efeito | Reversibilidade | Ação Inversa (`Desfazer`) |
|---|---|---|---|---|
| `tabs.new` | Abrir nova aba | `escreve` | `reversivel` | Fecha a aba recém-criada (`tabs.close`) |
| `tabs.close` | Fechar aba | `escreve` | `reversivel` | Reabre a aba com a URL anterior (`tabs.reopenClosed`) |
| `tabs.closeDuplicates` | Fechar abas duplicadas | `escreve` | `reversivel` | Reabre todas as URLs duplicadas fechadas |
| `tabs.reopenClosed` | Reabrir aba fechada | `escreve` | `reversivel` | Fecha novamente a aba reaberta |
| `tabs.switch` | Alternar aba ativa | `escreve` | `reversivel` | Volta para a aba anteriormente ativa |
| `navigation.go` | Navegar para URL | `escreve` | `reversivel` | Executa `goBack` na mesma aba |
| `navigation.reload` | Recarregar página | `leitura` | `reversivel` | — |

## 2. Biblioteca (`library.*`)

| ID | Título | Efeito | Reversibilidade | Ação Inversa (`Desfazer`) |
|---|---|---|---|---|
| `library.openHistory` | Abrir Histórico | `leitura` | `reversivel` | — |
| `library.openBookmarks` | Abrir Favoritos | `leitura` | `reversivel` | — |
| `library.openDownloads` | Abrir Downloads | `leitura` | `reversivel` | — |
| `library.addBookmark` | Adicionar favorito | `escreve` | `reversivel` | Remove o favorito criado pelo `id` gerado |
| `library.removeBookmark` | Remover favorito | `escreve` | `reversivel` | Restaura o favorito com título, URL e pasta originais |
| `library.clearHistory` | Limpar histórico | `escreve` | `irreversivel` | Não reversível (exige confirmação) |

## 3. Interface, Tema e Layout (`ui.*`, `settings.*`)

| ID | Título | Efeito | Reversibilidade | Ação Inversa (`Desfazer`) |
|---|---|---|---|---|
| `ui.toggleTheme` | Alternar tema claro/escuro | `escreve` | `reversivel` | Restaura o tema anterior (`light` / `dark`) |
| `ui.setDelegationWidth` | Ajustar largura do painel Delegar | `escreve` | `reversivel` | Restaura a largura anterior em pixels |
| `ui.openDelegation` | Abrir modo Delegar | `escreve` | `reversivel` | Volta ao modo Navegar |
| `ui.closeDelegation` | Voltar ao modo Navegar | `escreve` | `reversivel` | Reabre o modo Delegar |
| `settings.set` | Alterar configuração | `escreve` | `reversivel` | Grava o valor anterior da chave em `store` |

## 4. Perfis e Bots (`bots.*`, `profiles.*`)

| ID | Título | Efeito | Reversibilidade | Ação Inversa (`Desfazer`) |
|---|---|---|---|---|
| `bots.openCentral` | Abrir Central de Bots | `leitura` | `reversivel` | — |
| `bots.archive` | Arquivar Bot | `escreve` | `reversivel` | Executa `restoreBot(profileId)` |
| `bots.restore` | Restaurar Bot | `escreve` | `reversivel` | Executa `archiveBot(profileId)` |
| `bots.create` | Criar novo Bot | `escreve` | `parcial` | Arquiva o Bot recém-criado |

## 5. Núcleo Intocável (`security.*` — Bloqueado para IA/MCP/Bots)

Nenhum chamador automatizado (`ai`, `mcp`, `bot`, `external`) pode desligar, ocultar ou alterar:
- `security.stopAll` / `ui.hideStopAll` (Botão e comando Parar tudo)
- `security.intentFirewall` / `ui.hideControlIndicator` (Firewall de intenção, recibo e indicador de aba controlada)
- `security.auditLog` (Apagar ou desativar o log de auditoria)
- `security.financialApproval` / `ui.hideApprovalCard` (Auto-aprovar ações financeiras/envio externo ou esconder cartão de aprovação)
- `security.secretVault` (Ler cofre de segredos em texto puro)
- `security.spendLimits` (Aumentar o próprio limite de gasto)
- `security.signedUpdates` (Instalar atualização sem verificação de assinatura)

