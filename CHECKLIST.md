# Checklist — Zero Browser

- [x] Impedir execução vazia ou sem executor de retornar sucesso simulado; retirar aviso de objetivo atingido sem verificação e corrigir aviso do agendador (01/11/2026; 30 testes focados PASS).
- [x] Ligar contrato explícito de verificação de página ao executor e à missão agendada; opção de texto visível na criação, validação no host e registro do resultado (01/11/2026; `npm test` 462/462 e `test:ui` PASS).
- [ ] Provar verificação em site/provedor real e ampliar condições para metas como preço numérico; a presença de texto só comprova essa condição, não toda a tarefa. Bots sem contrato verificado podem ser pausados 14 dias após criação.
- [x] Preservar cópia dos arquivos atuais do painel antes da reconstrução (01/11/2026, hashes SHA-256 conferidos em `backups/2026-11-01-painel-antes-redesenho/`).
- [x] Impedir criação fictícia quando o armazenamento falha e usar o mascote escolhido nas listas (01/11/2026; `npm run test:ui` PASS; suíte 451/451 na segunda execução).
- [x] Reconstruir o painel lateral solicitado em 01/11, integrar funcionalidades e mascotes, distinguir Bots com nomes repetidos sem alterar dados, instalar `0.1.78-dev` e conferir visualmente no app a abertura de conversa correspondente ao Bot selecionado (464/464, UI PASS).
- [x] Ligar estado de execuções do runner à lista e ao botão Parar tudo, inclusive tarefas agendadas (01/11/2026; testes do runner e `test:ui` com evento simulado).
- [x] Impedir criação automática de três bots agendados em perfil vazio, sem apagar bots existentes (01/11/2026; inicialização inspecionada e `npm test` 454/454).
- [x] Substituir agenda fictícia e memória desconectada por controles ligados ao bot selecionado (01/11/2026; `test:ui` com persistência simulada; processo principal e reinício real ainda pendentes).
- [x] Validar bot, mascote, memória e agenda através do processo principal e duas reinicializações em perfil temporário (`node scripts/electron-bot-persistence.integration.js`, PASS).
- [x] Manter indicação de parada enquanto executor não termina e falhar claramente se não conseguir fechar a aba (tentativa repetida coberta por `test/bot-agent-executor.test.js`; comportamento real em provedor ainda pendente).
- [x] Impor allowlist de ferramentas para missões do BotRunner em somente leitura (modelo simulado tenta escrita; `npm test` 456/456). Navegação e scripts do site têm efeitos próprios não cobertos.
- [x] Rotear conversa do Bot pelo BotRunner e aplicar a allowlist somente leitura; UI e testes do runner passaram. Limites de gasto reais continuam pendentes.
- [ ] Provar em site/provedor real de teste que cancelamento e limpeza encerram a execução isolada.

## Meta de evolução total — ativa

- [ ] Fechar os achados A01–A12 da auditoria integrada com implementação e evidência por item; manter explícitos os itens que dependem de provedor pago, contas de teste ou revisão humana.
- [ ] Concluir a evolução visual a partir da referência aprovada com acabamento profissional, fluxo claro e identidade própria; ainda há telas sem revisão visual integrada.
- [x] Tornar a Central mais clara e retirar dados/ações simulados que pareciam serviços ativos.
- [x] Concluir executor de Bot com isolamento, limites por tarefa, política de site aplicada no processo principal, cancelamento verificável e resultado independente (0.1.69-dev: A1, A2, A3).
- [x] Criar um orquestrador explícito no modo Delegar: classificar pedidos claros de preço, mercado e e-mail; pedidos comuns, mistos ou sem Bot salvo seguem para o agente geral; mostrar a rota e permitir corrigir a escolha. O perfil especialista é orientação local no agente geral, não um runtime autônomo isolado.
- [x] Conversas iniciadas dentro de um Bot usam o BotRunner com missão, política e recibo; não são uma caixa de mensagem encaminhada ao agente geral (0.1.78-dev, `npm run test:ui`).
- [x] Implementar agenda persistente e gatilhos reais, depois provar execução com Zero fechado e retomada (0.1.69-dev: A4, A5 com medição de 10 ticks/s minimizado e Tray).
- [ ] Conectar serviços externos e Apps a transportes/fontes reais; manter aprovação, recibo e estado verdadeiro.
- [ ] Fechar popup, cookies, banners e permissões por política explícita sem dispensar consentimento em nome do usuário.
- [x] Renderizar avatares como símbolo de traço individual dentro do anel, preservar identidade estável e medir centralização no app empacotado; comparação visual com a referência ainda pendente.
- [x] Preservar dados de usuário entre atualizações: `appId`, nome interno, arquivo de configuração e partição persistente continuam estáveis; instalação de QA usa diretório isolado.
- [ ] Finalizar hierarquia e fluxos de navegador, Bots, extensões, configurações, menus e diálogos nas referências aprovadas; revisar acessibilidade e telas compactas.
- [x] Corrigir a legibilidade visual dos dois cartões explicativos de envio no estado inicial do Bot; contraste AA é medido pela fixture Electron.
- [ ] Medir velocidade, acerto, tokens e custo por tarefa; comparar com concorrentes em conjunto pareado, sem chamadas pagas sem orçamento aprovado.
- [ ] Commit local e instalação verificada após cada fatia utilizável; sem push.
- [ ] Executar os marcos 1–4 de `docs/ROTEIRO_DO_MENTOR.md` (bot roda 7 dias; uma frase cria o bot; uma rotina real do Wesley; painel novo) e marcar cada um só com o teste de sim ou não. O roteiro vale sobre os planos. A ordem prática e o critério de pronto de cada tarefa estão em `docs/ROTEIRO_EXECUCAO_IA.md`; a primeira tarefa aberta é A1 (ligar o executor).

## Pendências ativas consolidadas (31/10/2026)

Código (bots e motor)
- [x] Trilha A do Marco 1 no código da 0.1.69: executor ligado (A1/A2), perfil isolado e política de site (A3), relógio e persistência da agenda com fuso local (A4), segundo plano com Tray nativo, powerMonitor e medição de janela minimizada (A5), avisos e recibos auditáveis (A6). Prova: 450/450 testes passam. A7 segue aberta aguardando aprovação/chave do Wesley.
- [ ] Corrigir N01 (checkbox travou 20 s no teste pareado) e demais N01–N06 de `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`.
- [ ] Implementar os 12 passos de `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md` (separar perfil de bot, notificações, Sala da equipe, grupos de abas por bot).

Decididos em 31/10, NÃO implementados (não afirmar como feitos)
- [ ] Paleta clara com azul de ação (mockup antes do código; o app ainda é verde).
- [ ] Perfis tipo Chrome em Configurações (`docs/bots/FLUXO_UX_BOTS.md` seção 12).
- [ ] Importar os 40 mascotes pixel art como ativos individuais (confirmado pelo Wesley em 31/10; seção 13; hoje o app usa símbolos de traço da 0.1.67).
- [ ] Notificações em 4 canais (seção 11; hoje só existe `bots:notification` e `flashFrame`).
- [ ] Seguir o caminho de 5 passos para igualar o neo (`docs/concorrencia/PLANO_SUPERAR_NEO.md`, seção "Caminho para igualar o neo").
- [ ] Tela "Agentes conectados" e superar o neo com medida (`docs/concorrencia/PLANO_SUPERAR_NEO.md`).

Aprovações do Wesley pendentes
- [ ] Aprovar `docs/bots/FLUXO_UX_BOTS.md` antes do mockup; revisar os 48 modelos de `docs/bots/CASOS_DE_USO_BOTS.md`.
- [ ] Revisão visual do app instalado e teste de uso (hoje 0.1.69-dev).

Qualidade e entrega
- [ ] Medir velocidade, acerto, tokens e custo em conjunto pareado (sem chamada paga sem orçamento aprovado).
- [ ] Fechar popups/cookies por política explícita; unificar configurações, extensões, menus e diálogos conforme a referência.
- [ ] Commit local e instalação verificada após cada fatia utilizável; push só com pedido do Wesley.

Histórico das fatias 0.1.51 a 0.1.68: `docs/arquivo/CHECKLIST_HISTORICO.md`.
