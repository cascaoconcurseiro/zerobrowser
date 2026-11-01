# Handoff — Zero Browser

## Sessão de 01/11/2026 — painel de Bots

Pacote `0.1.78-dev` reconstruído e instalado via NSIS `/S` (código 0); registro do Windows e executável confirmaram versão/caminho. App reiniciado após a última instalação. Revisão visual real: nomes duplicados aparecem numerados e clicar em Bot na lista abriu cabeçalho, missão e conversa do Operador ERP correspondente. Nenhum Bot foi apagado/arquivado. Identidade `appId`, chave DeepSeek criptografada e partição persistente Gmail permanecem estáveis por teste automatizado. Prova de Bot com modelo real continua pendente (Ollama sem modelo).

Continuação: criação permite definir texto que deve estar visível ao fim; contrato validado é salvo no Bot e aplicado à missão salva e à agenda, sem aplicá-lo a pedidos avulsos. `agent-executor.js` passa o contrato ao verificador do host e falha se a condição falhar ou não for executada; `runner.js` registra `taskVerified` apenas na missão única que passou. Testes: `npm test` 462/462 e `npm run test:ui` PASS. A presença do texto comprova somente essa condição; o resultado real com site/provedor e condições numéricas continuam pendentes.

Continuação anterior: `src/bots/runner.js` falha para tarefa vazia ou executor ausente, sem usar dados simulados; não anuncia objetivo atingido sem resultado verificado. `src/bots/scheduler.js` deixa de anunciar sucesso em conclusão sem prova e só considera `taskVerified` para a pausa por falta de verificação. Testes focados de executor, falhas e agenda: 30/30 PASS.

Feito: reconstruí a lista, conversa, detalhes, rotina e memória usando os 40 mascotes existentes; preservei o backup em `backups/2026-11-01-painel-antes-redesenho/`. Conversas dos Bots e execuções agendadas passam pelo `BotRunner`; a execução retorna resumo/recibo e não conta como sucesso verificado sem pós-condição independente. Ollama local funciona sem chave.
Documentos vivos de Bots, UX, concorrência e roteiro foram conferidos; corrigi trechos que ainda descreviam o executor, o isolamento e o painel como inexistentes. O fluxo de Bot está conectado a um executor de navegador; isso não comprova paridade autônoma com GrokBot nem cobertura de todos os conectores.
Verificação: `npm test` 458/458; `npm run test:ui` PASS; `npm run test:delegation-layout` PASS; `node scripts/electron-bot-persistence.integration.js` PASS. Os testes de UI/layout exibem avisos de handlers simulados ausentes, embora os scripts concluam PASS.
Limites: sem provedor/site real ou app instalado; custo de chamadas de IA não é conhecido nem limitado pelo BotRunner. O hash registra a execução, não prova independente de que a página atingiu o objetivo.
Próximo passo: executar prova ponta a ponta em site de teste com modelo autorizado. Ollama está instalado, mas `/api/tags` retornou lista vazia; limite por execução em chamadas já existe, mas teto monetário, conectores reais e resultado independente para tarefas além de texto visível permanecem pendentes. App instalado está disponível para revisão.
Sem commit, push ou instalação.
## Registro anterior — 31/10/2026 (0.1.78-dev)

Feito: painel Bots reorganizado em uma entrega. Lateral com três seções fixas (Bots, Histórico, Configurações) e avatares dos bots criados; Central de Bots movida para Configurações > Bots; "Seus bots" com estado e "+ Criar bot"; "Parar tudo" sempre visível e desabilitado sem tarefa; catálogo antigo e cartões de exemplo removidos; textos abaixo de 11px aumentados; contraste de `--fg-secondary` ajustado (4,45:1 para 5,4:1 no azul claro).
Verificação local: `npm test` 451/451; `npm run test:ui` PASS; `npm run test:delegation-layout` PASS; `npm run build` OK.
Commit local `7491420` (não enviado ao GitHub). Instalado com `/S`; registro mostra `Zero Browser 0.1.78-dev`.
Não verificado: o painel visual no app instalado, em tela real (só os testes automatizados).
Não feito: F5 (menu contextual do bot, adiado); Sala da equipe (não construída); "Gêmeo Local" ainda aparece na ação de ensaio em `src/renderer/app.js` (~linhas 983 e 3415); badge numérico de 9px em `styles.css` (~linha 138).
Próximo passo: abrir o app instalado, conferir o painel Bots em 1584x966 e 700x800, e decidir se o ensaio "Gêmeo Local" sai do segundo nível.

## Estado anterior — 31/10/2026 (noite, 0.1.69-dev)

Quadro vivo: `docs/ROTEIRO_EXECUCAO_IA.md`. Verificação: `npm test` 450/450, `npm run test:background-bot` PASS, `npm run test:bot-runtime` PASS, `npm run test:delegation-layout` PASS, `npm run test:ui` PASS.
Concluído nesta sessão:
- **A1/A2:** Missão vira tarefa em aba oculta (`agent-executor.js`).
- **A3:** Perfil isolado por Bot (`persist:navegante-bot-<id>`), barreira de rede (`bot-site-guard.js`) e isolamento de abas (`isolatedTabs: true`).
- **A4:** Fuso local para rotinas, persistência em disco de `lastRunAt` (`bot-tasks.json`) e relógio recorrente com `unref()`.
- **A5:** Segundo plano com Tray nativo, fechar esconde na bandeja, `powerMonitor`, `loginItem` e medição com janela minimizada (10.0 ticks/s estável, sem estrangulamento).
- **A6:** Notificações de bot e bloqueio no preload, gerando recibos auditáveis na conversa e no histórico.
- **E1:** Limpeza de dados simulados em `main.js`.
- **Instalação:** Versão `0.1.69-dev` instalada no Windows (`ExitCode: 0`), backup da .68 preservado em `backups/2026-10-31-before-0.1.69-install/` e atalhos conferidos.

Próximos passos:
1. Aprovação do Wesley para a prova de 7 dias com modelo/chave (A7).
2. Marco 2: criação de Bot por frase fixa (B1–B3).
3. Leitura da maquete `docs/prototipos/painel-bot-prototipo.html`.
