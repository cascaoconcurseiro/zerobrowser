# Roteiro de execução — quadro vivo para qualquer IA

Este é o único lugar que diz **o que fazer agora, em que ordem e como saber que acabou**. Qualquer IA que abrir o projeto lê este arquivo depois de `docs/LEIA_ME_PRIMEIRO_IA.md`, executa a primeira tarefa aberta e **atualiza este arquivo antes de encerrar**, como o `CHECKLIST.md`.

Direção e motivos: `docs/ROTEIRO_DO_MENTOR.md` (vale sobre os planos). Histórico detalhado: `HANDOFF.md` e `CHECKLIST.md`. Aqui fica só o quadro.

**Última atualização:** 31/10/2026, versão `0.1.69-dev`, `npm test` 421/421 (rodado nesta sessão). Nada abaixo foi implementado ainda, salvo o que estiver marcado `[x]`.

## 1. Como atualizar (obrigatório, 6 regras)

1. Pegue a **primeira tarefa `[ ]` do quadro** (seção 4). Não pule etapas nem abra tarefa nova por conta própria.
2. Marque `[x]` **só com prova**: comando rodado e resultado real (ex.: `npm test` 420/420) ou teste manual descrito. Sem prova, deixe `[ ]` e escreva o que falta ao lado.
3. Ao concluir, preencha a linha da tarefa com data, versão e prova. Nunca apague tarefa feita nem a história.
4. Se o código contradisser este arquivo, **o código vale**: corrija o texto aqui e registre na seção 7.
5. Descobriu algo novo (bug, risco, dado simulado)? Crie a tarefa no fim da trilha certa, com arquivo e critério de pronto. Não resolva de passagem.
6. Ao encerrar: uma linha na seção 7, topo do `HANDOFF.md` (máx. 20 linhas) e `CHECKLIST.md`. Sem commit, push ou instalação sem pedido do Wesley.

## 2. Regras fixas do projeto

- **Núcleo intocável:** parar tudo, firewall + recibo, log de auditoria, aprovação financeira e de envio a terceiros, cofre de segredos, limites de gasto e tempo, atualização assinada. Nenhuma tarefa pode enfraquecê-lo.
- **Honestidade:** nada de número, estado ou serviço simulado apresentado como real. Dado de exemplo precisa estar rotulado "exemplo" na tela.
- **Simplicidade (usuário comum):** um nome só, "Bot". Palavras fixas: Bot, Rotina, Avisar, Recibo, Desfazer, Parar tudo. Uma pergunta por tela, no máximo 3 ações visíveis, sem jargão, sem emoji como ícone.
- **Segredos:** nunca abrir, ler ou imprimir chave de API, cookie ou conteúdo do Gmail. A IA não digita senha por ninguém.
- **Compatibilidade de dados:** manter `appId` `com.wesley.navegante`, arquivo `navegante-config` e partição `persist:navegante`.
- **Chamadas pagas de provedor** só com orçamento aprovado pelo Wesley.

## 3. Estado real (conferido no código em 31/10/2026)

| Peça | Estado | Onde |
|---|---|---|
| Agendador, mandato, gatilhos, execução perdida, bots parados | Existe, com teste. Sem relógio recorrente nem persistência | `src/bots/scheduler.js` |
| Ficha do bot, modelos, gravador, avatares (símbolo no anel desde a 0.1.67) | Existe | `src/bots/bot-store.js`, `templates.js`, `recorder.js`, `src/main/bot-avatar-catalog.js` |
| Parar tudo em menos de 1 s, cancelamento com `AbortSignal`, erro de ferramenta interrompe | Existe e testado (0.1.65) | `src/bots/runner.js` |
| Orquestrador do modo Delegar (preço, mercado, e-mail → perfil; resto → agente geral) | Existe (0.1.68) | `src/renderer/orchestrator-routing.js` |
| **Executor do bot** | **Ligado na 0.1.69:** passo de missão abre aba oculta e chama o agente; testado com sucesso, falha e cancelamento. Prova com site real ainda pendente (A7) | `src/bots/agent-executor.js` |
| `bots:run-now` | Aceita passos gravados ou, sem eles, usa a missão do Bot (0.1.69) | `src/main/main.js:1678` |
| Perfil isolado por tarefa, política de site aplicada a cada navegação | Não existe (usa a aba e o perfil atuais) | `CHECKLIST.md`, fatia 0.1.65 |
| Bandeja do sistema, dormir/acordar, abrir ao ligar o PC | Não existe | sem `Tray`/`powerMonitor` em `main.js` |
| Conectores (e-mail, agenda, Telegram) | Dados de exemplo | `src/connectors/index.js` |
| Rotas aprendidas, apps vivos, gêmeo local | Arquivos e testes; **sem uso real provado** | `LearnedRouteLibrary`, `LiveAppEngine` |
| Dados fixos exibidos como medição | Existem (tarefa E1) | `src/main/main.js` |
| Agente que roda pela conversa | Funciona | `src/automation/service/agent-runtime.js` (`runAgent`) |

## 4. Quadro de tarefas (ordem de execução)

`[ ]` aberta · `[x]` feita com prova. Cada tarefa tem **arquivo** e **pronto quando**.

### Trilha A — Marco 1: o bot roda de verdade, sozinho, 7 dias seguidos
- [x] **A1. Ligar o executor.** Feito em 31/10/2026 (`0.1.69-dev`): `src/bots/agent-executor.js` monta a missão, abre aba oculta sem trocar a aba do usuário, chama `automationService.runAgent` e fecha a aba no fim. Prova: `node --test test/bot-agent-executor.test.js` 7/7 e `npm test` 421/421 (sucesso, falha, cancelamento, passo desconhecido, missão vazia). A execução num site real fica em A7.
- [x] **A2. Missão vira execução.** Feito em 31/10/2026 (`0.1.69-dev`): sem passos gravados, `bots:run-now` (`main.js:1678`) e a agenda (`scheduler.js:203`) usam um passo `agent_task` com a missão do Bot. Prova: teste "a agenda usa a missão do Bot quando não há passos gravados" e os testes do executor, `npm test` 421/421.
- [ ] **A3. Perfil isolado e política de site por tarefa.** Pronto quando: teste prova que o bot não abre site fora da lista e não enxerga a sessão de outro perfil. **Parcial hoje:** o passo de missão não é bloqueado pelo modo somente leitura no `BotRunner`; o agente recebe a instrução de só ler e continua sujeito a aprovação e firewall, mas o bloqueio rígido por Bot ainda não existe.
- [ ] **A4. Relógio e persistência da agenda.** Sobrevive a fechar e abrir o Zero; execução perdida roda uma única vez ao abrir; fuso local, não UTC. Pronto quando: teste fecha e reabre o app e a rotina pendente roda uma só vez.
- [ ] **A5. Segundo plano de verdade.** Bandeja do sistema, "fechar mantém na bandeja", `powerMonitor` (suspender/retomar), aplicar "abrir ao ligar o PC". O agente já desliga o estrangulamento da aba que usa (`setBackgroundThrottling(false)` em `agent-runtime.js`); ainda falta medir a aba oculta com a janela minimizada no Electron em uso (`electron/electron#42140`, não verificado para a versão atual). Pronto quando: medição registrada aqui. Se falhar, plano B: Agendador de Tarefas do Windows chamando `--run-scheduled-bot` (já existe `buildWindowsScheduledTaskSpec` em `scheduler.js`).
- [ ] **A6. Avisar e recibo na tela.** Resultado chega como notificação (`bots:notification`) e vira recibo legível. Pronto quando: uma pessoa leiga diz, sem ajuda, o que o bot fez.
- [ ] **A7. Prova de 7 dias.** Zero na bandeja, um bot real, 7 dias seguidos, registro diário aqui. **Teste de sim ou não:** rodou os 7 dias sem intervenção?

### Trilha B — Marco 2: uma frase cria o bot
- [ ] **B1. Ficha em formato fixo.** A IA transforma a frase em ficha (nome, missão, sites, frequência, pode e não pode) com até 3 tentativas de validação. Arquivos: `src/bots/templates.js`, `bot-store.js`.
- [ ] **B2. A IA explica o que o bot fará** em frases curtas; o usuário só aprova ou ajusta. A IA nunca concede permissão.
- [ ] **B3. Medição.** 10 frases reais do Wesley. **Teste:** 8 de 10 geram o perfil correto.

### Trilha C — Marco 3: uma rotina real do Wesley
- [ ] **C0. Decisão do Wesley** (seção 6, item 1).
- [ ] **C1. Rodar a rotina** com recibo e botão **Desfazer** nas primeiras ações reversíveis (sugestão: agenda e rascunhos de e-mail).
- [ ] **C2. Teste de sim ou não:** rodou certa por 2 meses seguidos, ou pelo menos por 3 execuções comparadas à mão (o mesmo critério do `ROTEIRO_DO_MENTOR.md`).

### Trilha D — Marco 4: painel novo e demonstração
- [x] **D0. Decisão do Wesley:** sair do verde `#326f61` para a paleta clara com azul — registrada como aceita em `PLANO_DESIGN_UX.md` (31/10/2026). O verde só sai do código quando o visual novo for implementado.
- [x] **D1. Maquete** da criação de bot e do painel novo: `docs/prototipos/painel-bot-prototipo.html`, com comparação entre a paleta clara e o verde atual. Aguarda a leitura do Wesley antes de virar código.
- [ ] **D2. Implementar:** tirar o texto "GrokBot/Perfis/Especialistas", o emoji 🛒 e o menu de 9 itens; um nome só; criação em uma frase. Conferir antes: o texto pode já ter mudado nas versões .64 a .68.
- [ ] **D3. Vídeo de 1 minuto** e teste dos 5 segundos (4 de 5 pessoas entendem o que o produto faz).

### Trilha E — Honestidade dos dados (pequena; pode andar em paralelo)
- [ ] **E1. Tirar dado simulado que parece real** em `src/main/main.js`: status de segurança com `attacksTested: 50 / attacksBlocked: 50 / falsePositives: 0` fixos (`main.js:1667-1669`); rota "Buscar ofertas" semeada com `runs: 18`, `successRate: 1` e `lastVerifiedAt` de agora (`main.js:303-306`); `live-apps:generate` com valor "R$ 249,90" (`main.js:1702`). Pronto quando: cada valor vem de medição real ou aparece rotulado "exemplo". (Confirmado por leitura em 31/10. O botão de Telegram **não** entra mais nesta lista: desde a 0.1.65 ele aparece desabilitado como "Conexões indisponíveis", `app.js:2534-2539`.)
- [ ] **E2. Agenda ligada sem executor.** A A1 já existe, então os bots novos agora executam de verdade ao acordar — e podem gastar sem nunca terem passado por um teste bem-sucedido. Regra desejada: a agenda só liga depois de a rotina ter executado uma vez com sucesso. Pronto quando: teste cobre o bot criado com agenda desligada até a primeira execução aprovada.

### Trilha F — Documentação (mantém este quadro confiável)
- [ ] **F1.** `docs/arquivo/CHECKLIST_GERAL_PROJETO.md` ainda diz `0.1.63-dev`; atualizar cabeçalho e fatias .64 a .68.
- [x] **F2.** Documentos commitados na pasta principal em 31/10/2026 (commit `2dea0dc`: 9 arquivos sincronizados + `ROTEIRO_DO_MENTOR.md` + este quadro). Sem push.
- [ ] **F3.** `MASTER_BLUEPRINT.md` só muda se uma decisão de arquitetura mudar de fato (ex.: A5 plano B).

### Depois dos quatro marcos (só abrir com as trilhas A–D `[x]`)
E-mail ao vivo (avisar, perguntar, responder; assinatura "pull" do Gmail, renovada a cada 7 dias); equipe de bots; servidor próprio (bot com o PC desligado); conectores de verdade (Telegram primeiro); itens da comunidade (bots como arquivo e rotas primeiro; servidor MCP de terceiros por último e com aprovação); conector de desktop (tardio, desligado por padrão); Desfazer ampliado e autonomia conquistada. Detalhes em `ROTEIRO_DO_MENTOR.md`.

## 5. Como testar (comandos do `package.json`)

`npm test` (unitários) · `npm run test:ui` · `npm run test:bot-runtime` · `npm run test:delegation-layout` (6 viewports) · `npm run build` (instalador NSIS). Rodar o que se aplica antes de marcar `[x]` e relatar o resultado real, inclusive falhas. O que só se prova no app instalado ou no uso real não vira `[x]` por teste de unidade.

## 6. Decisões que só o Wesley pode tomar

1. Qual rotina real o primeiro bot faz? Resolvido: monitor de preço primeiro; depois a biblioteca de modelos (`docs/bots/CASOS_DE_USO_BOTS.md`).
2. Sair ou não do verde `#326f61` para a paleta clara estilo neo.
3. O PC fica ligado enquanto os bots trabalham? (decide se o servidor próprio entra cedo.)
4. Primeiras ações com Desfazer (sugestão: agenda e rascunhos de e-mail).
5. Qual pasta o bot pode ler para anexar arquivos (sugestão: só Downloads).
6. Ordem dos conectores (sugestão: Telegram primeiro).

## 7. Registro de atualizações (uma linha por sessão, mais nova no topo)

- 31/10/2026 — `0.1.69-dev`: A1 e A2 implementadas. Novo `src/bots/agent-executor.js` liga a missão do Bot ao `runAgent` em aba oculta, com cancelamento e fechamento da aba; `bots:run-now` e a agenda usam a missão quando não há passos. `npm test` 421/421 (7 testes novos). A3 anotada como parcial (bloqueio rígido de escrita por Bot ainda não existe). Maquete do painel e da criação de bot em `docs/prototipos/painel-bot-prototipo.html`; D0 registrada como aceita (paleta clara) e D1 pronta para leitura. Nenhum commit.
- 31/10/2026 — `0.1.68-dev`: conferência do quadro após o commit `2dea0dc`. `npm test` 414/414 rodado. Corrigido: C2 alinhado ao roteiro (2 meses ou 3 execuções, não 7 dias); E1 sem o botão de Telegram, que já está desabilitado desde a 0.1.65; F2 marcado como feito; referências de linha do executor e do `bots:run-now` ajustadas. Nenhum código alterado.
- 31/10/2026 — `0.1.68-dev`: quadro criado a partir da leitura do código da pasta principal. Confirmado que o executor continua casca (`main.js:269`) e que há dados fixos exibidos como medição (E1). Nenhum código alterado; testes não rodados nesta sessão.
