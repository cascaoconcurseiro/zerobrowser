# Handoff histórico até 0.1.50-dev

# Handoff — Zero Browser

## Candidato 0.1.50-dev — 31/10/2026

- Implementado cartão acessível de aprovação no chat: origem/ação/alvo com texto seguro, foco inicial em Cancelar, decisões só de uma vez ou recusa e limpeza de estado após resposta/timeout. Ao fechar Delegar ou trocar para Configurações/Biblioteca, pendências são recusadas; painel Configurações não é confundido com painel do agente pelo host.
- Configuração do painel adicionada em Configurações > Agente de IA · aprovações. O padrão continua desligado; com Delegar fechado, permanece o diálogo nativo. Não há decisão persistente “permitir este site”.
- Atualizado teste Bot para conferir `always-ask` no primeiro início, aceite obrigatório para subir autonomia, redução sem confirmação e bloqueios de credenciais/CDP mesmo em `allow-all`.
- Revisão independente: não encontrou bypass; host só aceita `allow`/`deny`, e mudanças de painel esperam a resposta. Risco residual baixo de ordenação visual durante transição assíncrona; a ação continua bloqueada até decisão.
- Validações na árvore: `npm test` 370/370, `npm run test:ui` PASS, `npm run test:bot-runtime` PASS; smoke do executável empacotado passou com permitir/cancelar via Enter, fechamento do painel e fallback nativo. Nenhuma chamada externa.
- Build: `dist/Zero Browser Setup 0.1.50-dev.exe` (130.431.885 bytes; SHA-256 `E25ADEDA06E204D188F1DAD2D8424A0B26E07F4DC268166759A48F65034E707A`); executável `0.1.50.0` SHA-256 `B510ECB080CE4667E8CB5AF2E3CA39FE0E127B0C2B265DEF48DD3570796D0131`; `app.asar` SHA-256 `F064B9D5199478D9BCC2E704766878ED99985B19F2FC6DB416878FB5305079B2`. Instalador sem assinatura Authenticode.
- Commit local `ddac732`; backup verificado da .49 em `backups/2026-10-31-before-0.1.50-install/`; instalador .50 executado com exit code 0. A instalação reporta `0.1.50.0`, exe `B510ECB080CE4667E8CB5AF2E3CA39FE0E127B0C2B265DEF48DD3570796D0131`, ASAR `F064B9D5199478D9BCC2E704766878ED99985B19F2FC6DB416878FB5305079B2`; atalhos conferidos.
- Smoke completo no executável instalado: PASS (perfil temporário, mock loopback; allow/cancel por Enter, fechamento do painel, fallback nativo, abas, AX/CUA, download e DNT). App 0.1.50 aberto e respondendo em `%LOCALAPPDATA%\ZeroBrowserQA\0.1.50-preview`, sem abrir o perfil pessoal.
- Próximo passo concreto: resolver lifecycle/exclusão de Bot em `src/main/profiles.js`, `src/main/main.js` e Central de Bots; bloquear remoção enquanto qualquer processo usa o perfil, definir confirmação/encerramento reversível e validar que dados/avatar sejam limpos.

## Histórico de 0.1.49-dev — 31/10/2026

- Corrigido o smoke instalado: ele salvava a chave e o modelo fora da sequência real da interface e a simulação de conexão repetia a ferramenta indefinidamente. O roteiro agora salva a chave, sincroniza, seleciona o modelo e exige a chamada ao endpoint mock. Também abre o painel de IA de forma idempotente.
- `npm run test:installed -- 'C:\Users\Wesley\AppData\Local\Programs\navegante\Zero Browser.exe'` passou contra 0.1.48-dev instalado: catálogo OpenRouter/DeepSeek, conexão mock, automação AX/CUA, abas, DNT, download e aprovações passaram em perfil temporário. Sem provedor real ou pago.
- `npm test`: 370/370. Build gerado: `dist/Zero Browser Setup 0.1.49-dev.exe` (130.430.072 bytes; SHA-256 `A578153B3F4106F894D19E6A401167A114E52E5FD6F32F3E64AF7BA26E87DB1B`); executável `0.1.49.0` SHA-256 `9A1B322F53D8178FBFE124663720E272AF992A4DD6BB7B308D75676BD02F9CD7`; `app.asar` SHA-256 `DB7FF6EF6AC8F1B39C5D3EF5B17D02605139416B1A04FEDBFCD3B7E0D9B9C542`. Instalador sem assinatura Authenticode.
- Commit local `fabe822`; instalador executado com exit code 0. Em QA, versão, hashes e atalhos confirmados. Smoke do próprio executável 0.1.49 passou; perfil temporário, provedor somente mock loopback. Backup 0.1.48: `backups/2026-10-31-before-0.1.49-install/`.
- Próximo passo concreto: aceitar aprovação/autonomia/ciclo de vida de Bots em `scripts/bot-runtime.integration.js` e no runtime MCP; não há chamada paga autorizada nesta fatia.

## Histórico de 0.1.48-dev — 31/10/2026

- A base instalada de QA continua em `0.1.47-dev`; a árvore está em `0.1.48-dev` e aguarda commit e instalação deste candidato. O NSIS já foi gerado.
- Motor: `advancedInput: 'auto'` pré-carrega o catálogo especializado quando encontra intenção explícita de planilha/canvas/interação visual em português ou inglês. Cues negadas são removidas sem apagar outras intenções positivas; `true` e `false` explícitos têm prioridade. Em fixture, uma tarefa comum manteve o primeiro request em 8.096 bytes contra 11.139 pré-carregado (27,3% menor); tarefa explícita de planilha eliminou uma chamada simulada ao seletor. Isso mede bytes de esquema e número de chamadas simuladas, não tokens cobrados, custo, latência real ou taxa geral de acerto.
- Bots/MCP: fixture de serviço comprova que navegação cross-site com query longa e clique em submissão POST pedem aprovação; a recusa impede `executeJavaScript`. O pipe MCP real da fixture continuou respondendo `ping` e `tools/list` depois de recusas e ferramenta desconhecida. Não houve envio efetivo, tráfego externo, diálogo nativo ou execução real de modelo.
- UX: a Central fica dentro das janelas de 700 e 400 px; botões Fechar/Criar têm 44 px; Escape fecha e devolve o foco. `npm run test:delegation-layout` usa Electron e IPC mockado, não o instalador.
- Validações no candidato: `npm test` 370/370, `npm run test:ui` PASS, `npm run test:bot-runtime` PASS, `npm run test:delegation-layout` PASS e revisão independente sem achados bloqueadores. `git diff --check` PASS, com avisos somente LF/CRLF.
- Nenhum provedor foi chamado; benchmark pago/pareado e aceitação de diálogos/autonomia de Bots continuam pendentes. O instalador 0.1.47 anterior não tem assinatura Authenticode.
- Build NSIS gerado: `dist/Zero Browser Setup 0.1.48-dev.exe` (130.429.999 bytes; SHA-256 `BC4F4E07F938A31ACF9FBC4C6495664D68FAB5185432BBBEF2B44B26BEF1663B`). Executável extraído: `0.1.48.0`, SHA-256 `19BAD1328AA1E0524A085DD0903F7A481A5BF7AC9F6D59B954A69B0B5D0A4143`; `app.asar`: 18.355.831 bytes, SHA-256 `F856E9EDCA9282A8EF698437E9C2B02247826BEFE66AB1CEAD217DED54D5936E`. NSIS sem assinatura Authenticode.
- Próximo passo concreto: fazer commit local, criar/verificar backup da instalação 0.1.47, instalar o NSIS novo em QA e comparar versão/hash/atalhos/tela. Depois registrar evidência e iniciar o aceite ampliado de Bots.

## Modo Delegar funcional e Bots — 31/10/2026

- Versão de desenvolvimento: `0.1.46-dev`. Esta entrega inclui um layout funcional: painel de conversa à esquerda, página ativa à direita, alternância Navegar/Delegar e acesso ao menu de perfis Bot. `Parar` interrompe a tarefa atual. Central e takeover completo seguem pendentes.
- `npm run test:ui` passou; `npm test` passou 362/362; `npm run build` gerou `dist/Zero Browser Setup 0.1.46-dev.exe` (124.491.015 bytes). O instalador foi executado depois do commit; Registro informa `0.1.46-dev` e os hashes do `Zero Browser.exe`/`app.asar` instalado coincidem com o pacote candidato. A tela Delegar foi aberta e conferida no app instalado.
- O app foi aberto com perfil QA novo em `%LOCALAPPDATA%\ZeroBrowserQA\0.1.46-dev`; o perfil principal não foi aberto nem alterado. Nenhum teste autenticado com provedor foi executado nesta fatia.
- O perfil QA da versão 0.1.45 estava isolado do perfil pessoal. A nova instalação usa outro perfil QA; não copiar dados pessoais.
- `npm run test:bot-runtime` abre o app Electron em perfil temporário reconhecido como `Bot Fixture`. Com `allow-all` pré-semeado somente no perfil temporário, o IPC principal recusou preencher um campo `password` e um campo de e-mail em página de login sem `<form>`; os dois valores ficaram vazios. Isso valida as barreiras técnicas no caminho IPC da interface, sem modelo ou provedor. O perfil e os dados do teste são removidos ao final.
- Verificações anteriores de Bots: `npm run test:bot-runtime` passou nos 2 cenários; revisão de código sem achados acionáveis.
- A pasta de perfis de teste pode ser isolada por `ZERO_TEST_PROFILES_ROOT` somente em build não empacotada; a versão empacotada continua usando o caminho normal do usuário.
- O conceito aprovado permanece em `docs/CONCEITO_VISUAL_MODO_DELEGAR.md` e `docs/conceitos/zero-browser-modo-delegar-0.1.45-dev.png`; a imagem proposta inclui controles que ainda não existem no produto (Central, takeover completo e Desfazer universal).
- Tentativa de smoke por `runAgent` com provedor mock ficou sem conclusão após a primeira resposta de ferramenta; isso não foi tomado como evidência de aprovação ou recusa. O teste está limitado ao IPC de ação direta. Falta diagnosticar esse caminho e validar o MCP real sob Bot.
- Revisão de código anterior não encontrou achados acionáveis. Limites pendentes: login sem sinais semânticos, ações de maior risco em runtime, takeover/aprovação, MCP, ciclo de vida/exclusão de Bots e teste de compreensão do mockup.
- Inventário MCP anterior: `tools/list` retornou 22 ferramentas; `module_run` declara estar desativado. O plano `docs/PLANO_CONTROLE_TOTAL_IA.md` não está presente na branch `main` para comparação.
- Próximo passo concreto: rodar um cliente de fixture contra a ponte MCP do perfil Bot e verificar as mesmas recusas e a escopagem ao perfil; depois diagnosticar por que o smoke `runAgent` travou após o primeiro tool call. Sem chave ou chamada paga.

## Provedor OpenAI e catálogo — 31/10/2026

- Commit das 29 alterações solicitado: `0c56c26` (`feat: improve automation engine and provider metrics`). Sem push.
- Após o commit, temperatura passou a ser omitida em modelos OpenAI das famílias de raciocínio incompatíveis com sampling explícito; demais provedores mantêm o valor atual. O catálogo OpenAI agora limita a seleção a modelos de chat e exclui IDs de áudio, realtime, transcrição, TTS, imagem, embedding, moderação, Codex e search-preview.
- Validação real no Zero Browser instalado 0.1.43-dev: configuração DeepSeek direto, modelo `deepseek-flash`, chave indicada como salva (dica mascarada); botão “Testar conexão” respondeu “Agente conectado: deepseek-flash”. A chave não foi aberta, copiada ou exibida.
- Em seguida, extraída a implementação de `runAgent` para `src/automation/service/agent-runtime.js`; `AutomationService.runAgent` mantém a assinatura e encaminha com o mesmo `this`. Chamadores em IPC, painel, `run_task` e scripts não mudaram. A divisão é estrutural; sem alegação de ganho de velocidade.
- Verificações: `npm test` passou 334/334 após a extração e limpeza de imports; `node --check`/parse de todos os JS passou na suíte; `git diff --check` será conferido no fechamento. O primeiro teste completo expôs dependências ausentes na extração; foram restauradas, e a segunda suíte completa passou.
- Próximo passo concreto: revisar a comparação final de `src/automation/service/index.js` e `src/automation/service/agent-runtime.js`; depois decidir separadamente sobre commit. Sem push.

## Motor: ferramentas avançadas sob demanda e custo — 31/10/2026

- O OpenRouter agora solicita `usage.include` e o trace/benchmark registra custo reportado quando a resposta o fornece; esse valor é atribuído pelo provedor e não substitui a fatura final.
- O catálogo avançado (clipboard, sequência de teclas, interação visual e planilhas) passa a ser ativado por `enable_advanced_tools` quando `advancedInput` não é explicitamente `true` ou `false`. A chamada padrão envia apenas o seletor compacto; `true` mantém pré-carregamento e `false` desativa. A medição estática anterior encontrou 3.325 bytes de definições avançadas, que deixam de ser enviados em cada chamada comum.
- Não foram executados testes após a instrução do usuário. Isso é implementação com revisão estática apenas; o fluxo dinâmico de ativação e os valores de custo ainda precisam de validação quando testes forem autorizados.
- Próximo passo concreto: revisar `runAgent`/`runTask` em `src/automation/service/index.js` e, quando autorizado, validar uma tarefa web comum e uma tarefa de planilha/canvas, comparando bytes/tokens, latência, acerto e custo reportado no mesmo provedor/modelo.
- Bloqueio/limite: sem benchmark de modelo real; o seletor acrescenta uma rodada para tarefas que precisem de ferramentas avançadas. Nenhum ganho de acerto/latência foi alegado.

## Motor: OpenAI direto e cache mensurável — 31/10/2026

- Adicionado OpenAI como provedor direto (catálogo oficial `/v1/models`, Chat Completions `/v1/chat/completions`), com chave separada e opção no painel. Não altera o padrão OpenRouter. A integração foi exercitada por mock; nenhuma chave foi acessada nem chamada real/paga foi feita.
- Benchmark aceita `--prompt-cache`; condição registrada no relatório e comparador exige `--variavel=promptCache` para permitir o A/B controlado. `run_task` encaminha o sinal para cada request. Cache continua opt-in.
- Testes focados 69/69, `npm test` 333/333 e `npm run test:ui` PASS com asserção da opção OpenAI no seletor; `git diff --check` passou, restando avisos LF/CRLF.
- Próximo passo concreto: no Zero empacotado e perfil de QA, configurar a chave no painel e usar “Testar conexão” sem ação de página; depois executar A/B `promptCache` desligado/ligado nas mesmas tarefas/modelo/provedor/repetições e comparar tokens de cache, acerto e latência.
- Bloqueios/limites: sem autenticação real ou benchmark do OpenAI; nenhum ganho de custo ou acerto foi medido. O A/B pago DeepSeek segue excluído pela orientação do usuário. Ações consequentes do agente continuam sob as políticas de aprovação; “controle total” significa cobertura ampla do navegador, não remover essas verificações.

## Motor: confirmação Electron da espera pós-hover — 29/10/2026

- Ajuste de deadline: o renderer observa os 250 ms completos; o processo host acrescenta 10 ms de tolerância e até 50 ms reservados para a leitura final se o renderer estiver pendurado. Isso corrige o caso sem texto que podia terminar antes da janela original.
- Último benchmark DOM em 20 pares: adaptativa mediana/P95 101/102 ms; fixa 253/265 ms; diferença pareada mediana/P95 152/164 ms. Artefato `bench/resultados/post-action-wait-electron-2026-10-29T20-27-06-417Z.json`.
- Tarefas `runAgent` pareadas em Electron: 5 pares por cenário, ordem alternada, duas respostas mockadas iguais e pós-condição independente no DOM. Mediana da melhoria de espera: texto rápido +96 ms; lento +16 ms; sem texto −4 ms. As 30 pós-condições passaram; nenhum fallback adaptativo nesta rodada. Dados: `bench/resultados/post-action-edge-tasks-electron-2026-10-29T20-32-57-742Z.json`. Durações totais tiveram outliers de ambiente; comparação deste helper usa `waitMs` pareado.
- `npm test`: 332/332. A primeira execução mostrou limites de tempo de teste frágeis sob concorrência do Windows; foram ajustados para tolerar atraso de agendador sem enfraquecer os limites funcionais. Nova execução passou.
- Integração oculta Electron executou hover CSS em perfil temporário: menu “Delete” apareceu e `trace.postActionTextWait` registrou `changed=1`. Observador do renderer terminou no fallback limitado, `totalMs=251`, `fallbacks=1`; desativar background throttling no fixture não evitou o timeout. O resultado verifica atualização da UI e fallback seguro, não ganho de velocidade da espera adaptativa.
- `runAgent` foi comparado no Electron em 20 pares com ordem alternada; janela deslocada fora da área do cursor físico, WebContents ativo, mesma fixture/política/ferramenta e fetch stub determinístico. Menu verificado em 20/20 execuções por condição e duas respostas simuladas em cada tarefa. Total adaptativo mediana/P95 73/82 ms; fixo 269/284 ms. Ganho pareado mediana/P95 195,5/208 ms (mín. 187 ms). Espera no trace: adaptativa 62 ms mediana; fixa 256,5 ms. Dados completos: `bench/resultados/post-action-task-electron-2026-10-29T18-45-28-937Z.json`. Não mede rede/modelo real, tokens faturáveis, custo ou taxa geral de acerto.
- O helper reserva prazo no host para a leitura final de fallback, então uma chamada de leitura pendurada permanece limitada. Testes cobrem mudança 10 ms antes do deadline, texto tardio, navegação e WebContents fechado. No Electron real, navegação durante a espera usou fallback e leu o novo documento em 275 ms. A suíte Electron completa passou com os 20 pares.
- A janela oculta provocou travamento do harness de tarefa; execução visível teve uma falha de hover intermitente. O ensaio válido desloca a janela para fora da área do cursor físico e deixa o WebContents ativo; o resultado foi reprodutível nos 20 pares desta rodada.
- `node --test test/post-action-text.test.js`: 11/11; `npm run test:electron` passou com navegação e 20 pares completos; `npm test`: 331/331; `git diff --check` sem erro. Não rodar benchmark pago DeepSeek: o usuário pediu para ignorá-lo.
- Corrigida a sequência do harness: casos ativos rodam antes de ocultar a janela; throttling é definido explicitamente ao ocultar/mostrar; timers de renderer atrasados no caso sem texto são tratados como resultado bounded e ficam registrados. `npm run test:electron` base passou. O modo `ZERO_POST_ACTION_EDGE_TASKS=1` grava os 15 pares e termina explicitamente após esse benchmark; não roda o restante da integração AX.
- Próximo passo concreto: ampliar o A/B do motor para tarefas além de hover e rodar benchmarks pareados com modelo real apenas quando autorizado. A/B pago DeepSeek permanece fora de escopo.

## Motor: linha de base de contexto e comparador — 29/10/2026

- Fixture de tarefa longa executa 8 leituras + resposta final e confirma retenção de todos os dados exclusivos. Na última chamada: leituras repetidas totalizaram 11.145 bytes de mensagens (22.361 request); leituras com pequenos dados únicos totalizaram 30.626 bytes (41.842 request). São bytes de fixture, não tokens, acerto de modelo, custo ou latência.
- Corrigido o comparador para exigir modelo, provedor e todos os metadados de condição presentes e iguais antes de atribuir “provável melhora/piora”; condições diferentes ou ausentes agora resultam em “incompatível”. A saída lista os campos divergentes. Relatórios alertam tarefas ausentes e repetições diferentes; o benchmark salva conjunto, flags e limites relevantes.
- Implementado `--deduplicate-snapshots` experimental, desligado por padrão. Só reutiliza um snapshot após uma chamada imediatamente anterior também `inspect_page`, se o JSON completo e já filtrado pelo guard for idêntico e a referência for menor que a representação que a compactação normal deixaria. Preserva cada resposta de ferramenta e `tool_call_id`, mantém uma âncora completa e invalida após qualquer outra ferramenta. Não pode ser combinado com `--diff`; relatórios registram a condição e os bytes de contexto estimados.
- Fixture com 8 leituras idênticas reduziu o request final de 22.361 para 21.440 bytes (−921; 4,1%) e a soma serializada dos 9 requests de 178.415 para 175.411 bytes (−3.004; 1,7%). O trace estima 987 bytes de contexto atual poupados frente à compactação normal. Com dados exclusivos, a opção não reutilizou nenhum snapshot e todas as evidências foram mantidas. Testes confirmam invalidação após ação e ao pausar/retomar: referências antigas são invalidadas e um snapshot fresco, protegido pelo guard, passa a ser a âncora. Esses números são bytes da fixture, não tokens.
- Cobertura extra: `preInspect` também pode fornecer a âncora quando a primeira leitura explícita do modelo é idêntica; teste confirma referência, âncora íntegra e contador de trace.
- Verificação: testes focados passaram 59/59; `npm test` passou 318/318; `git diff --check` sem erros. Bytes determinísticos de fixture não são tokens, acerto, custo ou latência de modelo.
- Preflight: não havia Zero Browser aberto; o Ollama estava instalado, mas sem modelo disponível. A consulta iniciou processos do Ollama; ambos foram encerrados. Nenhuma chave foi lida, perfil pessoal alterado, modelo baixado ou chamada a provedor de IA feita.
- Otimização pós-hover: a pausa fixa foi substituída por espera de texto visível estabilizado (60 ms quieto, teto de 250 ms) nos caminhos `hover`/`click_text`. O host reserva prazo para a leitura final no fallback e retorna vazio se o renderer continuar pendurado; trace expõe `postActionTextWait`. Há fixture VM/Electron, benchmark pareado de espera e `runAgent`; sem provedor/modelo real, token faturável ou custo medido.
- O A/B pago DeepSeek foi adiado por orientação do usuário. Nenhuma chamada paga foi feita. O perfil temporário `C:\Users\Wesley\AppData\Local\Temp\zero-browser-paid-bench-20261029` e a janela do Zero Browser permanecem disponíveis; não inspecionar nem ler campo de chave. Retomar o benchmark somente mediante nova instrução.
- Próximo passo concreto: cobrir mutações lentas/ausentes, navegação e fechamento no helper pós-ação; depois ampliar o A/B para tarefas diversas e modelo real quando autorizado.


## Motor: evidência de ação e observação — 29/10/2026

- Corrigida colisão entre campos da ação e do snapshot automático: valores diferentes da ação são preservados em `actionEvidence`, inclusive após snapshot posterior; URL preservada remove credenciais, query e fragmento e rejeita esquemas fora de HTTP(S). O detector de instruções suspeitas inspeciona esse campo. Revisão independente sem achado acionável no caminho avaliado.
- `node --test test/agent-continuation.test.js test/injection-guard.test.js` 23/23; `npm test` 312/312. Testes com fixture, sem medida de tokens, custo ou latência e sem benchmark de modelo real.
- Próximo passo: criar fixture de 8 ou mais leituras com dados repetidos e únicos para medir crescimento de `messageBytes`, `requestBytes` e preservar evidências; depois experimentar deduplicação de leituras idênticas com mesma ferramenta, argumentos, aba e estado, opt-in e com testes de retomada. Bytes não são tokens; executar benchmark pareado antes de alegar ganho ou ativar por padrão.


## Motor: medição de cache e evidência de ações — 29/10/2026

- O parser diferencia cache ausente/inválido de zero explícito; o trace marca disponibilidade incompleta quando uma resposta aceita não informa cache ou entrada válida. Métricas por tentativa não fabricam zero para entrada/saída ausentes. O resumo trata cache incompleto como desconhecido e o comparador exclui dados parciais/legados sem marcador explícito. Isso não demonstra economia real de custo ou latência.
- Compactação de snapshots mantém campos de resultados de ações observadas e dados de planilha, removendo nós antigos e deduplicando apenas texto literal completo. Testes locais cobrem ação, seleção de planilha e cache parcial; `npm test` passou 311/311. Históricos de tarefas longas ainda podem crescer; não se provou ganho de tokens.
- Próximo passo: investigar colisões na mesclagem de resultado de ação e snapshot em `src/automation/service/index.js` no bloco `autoObserved`; medir crescimento de contexto e implementar compactação segura com recuperação; depois rodar benchmark pareado com modelo real em perfil isolado. Não presumir uso pago autorizado.


## Motor: preservação de evidência e medição — 29/10/2026

- `src/automation/service/index.js` não corta mais silenciosamente texto exclusivo de snapshots após 2.500 caracteres nem respostas antigas de ferramentas após seis chamadas. Testes cobrem sufixo exclusivo em tarefa longa e saída não-snapshot. Isso pode aumentar tokens e exceder a janela do modelo; ainda falta orçamento de contexto com preservação/recuperação segura e benchmark pareado antes de concluir sobre custo ou velocidade.
- `bench/comparador.js` calcula acerto apenas sobre tarefas comuns, com média balanceada por tarefa, alerta para provedores diferentes/ausentes e não afirma ausência de regressão sem pares. Cache ausente ainda pode ser registrado como zero; o relatório agora avisa que tokens não cacheados exigem confirmação. Comparação ainda precisa conferir flags, cobertura, repetições e compatibilidade dos cenários.
- Próximo passo: diferenciar cache não informado de zero em `src/automation/usage-metrics.js` e toda a cadeia de trace/benchmark; criar política de contexto segura e medir bytes/tokens e acerto em tarefas longas. Benchmark com modelo real exige perfil isolado e autorização para consumo quando aplicável. Não há nova medição real nesta etapa.


## Plano de maturidade — 29/10/2026

- Criado `docs/PLANO_MATURIDADE_4.md` com critérios propostos, dependências, riscos e evidências para cada quesito. O plano não altera a avaliação atual nem prova paridade.
- Próximo passo: executar a etapa 0 do plano no pacote QA `dist-active-tab-qa-20261029` em perfil temporário, incluindo fixture e captura real; registrar falhas reproduzidas e corrigir por prioridade.

## Pacote QA activeTab — 29/10/2026

- Build unpacked concluído em `dist-active-tab-qa-20261029/win-unpacked/Zero Browser.exe` a partir do commit `0ee0014`. Ainda falta executar o pacote em perfil descartável e validar a extensão fixture e captura nativa; build não é aceite funcional. Não foi instalado.
- Próximo passo: usar `scripts/installed-agent.integration.js` com o executável QA e perfil temporário; depois exercitar a ação activeTab no app empacotado.

## Ação temporária de extensões activeTab — 29/10/2026

- Implementado botão “Executar” no gerenciador para extensões com `action`/`browser_action` sem popup. O gesto parte do botão nativo acessível; a UI exige evento confiável, e o IPC principal só aceita a janela principal autorizada. Eventos MV3 acordam o service worker e esperam `running`; MV2 recebe `browserAction.onClicked`.
- Grant limitado a extensão + aba + origem HTTP(S). URL/título e `captureVisibleTab` usam o grant; recarga/rota na mesma origem o preserva, navegação principal confirmada para outra origem, fechamento da aba e unload o revogam. Popups, `scripting.executeScript` e optional host permissions continuam não suportados.
- Revisão independente encontrou e corrigiu revogação prematura em qualquer navegação: agora revoga após commit de origem diferente. `npm test` 302/302; testes focados de extensão/IPC 16/16; `npm run test:ui` PASS; `npm run test:active-tab` PASS com service worker Electron MV3 real e perfil temporário. A captura de imagem do teste é fixture determinística; não prova captura nativa/visual. MV2 segue teste unitário, sem integração Electron real. Nenhum teste com Flame real.
- Estado competitivo permanece sem posição numérica confiável: essa etapa reduz uma lacuna de compatibilidade, mas o Zero continua atrás dos concorrentes em UX geral, ecossistema, distribuição e validação. Pacote QA/instalado não foi atualizado nesta etapa.
- Próximo passo concreto: gerar pacote unpacked QA a partir deste commit e validar o fluxo em perfil descartável com extensão fixture; depois exercício com Flame somente se o usuário fornecer/autorizar o pacote apropriado. Manter pendentes captura nativa, MV2 Electron, scripting/optional permissions, segurança adversarial e aceite visual amplo.
## Instalador sem abertura automática — 29/10/2026

- Corrigida a configuração `build.nsis.runAfterFinish: false` em `package.json`. Causa confirmada: o `electron-builder` 26.15.7 documenta `runAfterFinish` com default `true`; no alvo one-click ele só define `RUN_AFTER_FINISH` quando a opção não é `false`. O template NSIS só chama o app na conclusão normal quando essa macro está definida; `--force-run` continua sendo exceção explícita.
- Build isolado concluído: `dist-nsis-no-autolaunch-20261029/Zero Browser Setup 0.1.43-dev.exe`, SHA-256 `929b020b125b00b420638d4f84d86e111e5760b08e0badc84c71f3ee0653ebfa`. `builder-debug.yml` contém o script gerado e confirma que `RUN_AFTER_FINISH` está ausente. O instalador não foi executado; a configuração instalada e o perfil pessoal não foram tocados nesta etapa.
- Próximo gap de produto priorizado: grant temporário `activeTab` para extensão apenas após gesto confiável no host, vinculado a extensão/aba/origem e revogado ao navegar/fechar. Não aceitar IPC originado pela extensão como prova do gesto; ver testes e requisitos listados no `CHECKLIST.md`.

## Instalação 0.1.43-dev e status competitivo — 29/10/2026

- O usuário autorizou instalar a versão mais nova. O instalador NSIS local `dist-nsis-qa-20261028/Zero Browser Setup 0.1.43-dev.exe` terminou com código 0. Executável instalado em `%LOCALAPPDATA%/Programs/navegante/Zero Browser.exe`, versão confirmada `0.1.43-dev`; SHA-256 do exe `09500e83e556859e888679392d92e7f3ad4d1204854c8404ff052e4236d27e11` e do `resources/app.asar` `c04a29dd9e1159c8c242f36114571640509cb4ebbad34451b7b598dfee477c20`. Instalador SHA-256 `f6982bbcd351ed9b993a6c02f5ade038c844c3b3d0201393bfd42a28f18b4e56`; não assinado. Atalhos do Desktop e Menu Iniciar apontam para a instalação.
- Backup prévio verificado por hash em `C:/Users/Wesley/Documents/Navegante/backups/2026-10-28-before-0.1.43-install` (perfil e instalação completos; veja `manifest.json`). O NSIS iniciou o app automaticamente no perfil padrão apesar das variáveis de isolamento no processo instalador: houve mudanças em cache/sessão e `session.lastTabs`; as demais chaves da configuração comparada não mudaram. SQLite integrity_check passou no banco da biblioteca e em ambos os bancos de cookies. A contagem do banco de cookies principal caiu de 293 para 292; a linha removida não estava expirada, mas seu conteúdo/identidade não foi exposto e não foi possível determinar qual era. O backup pré-instalação continua preservado; nenhuma restauração foi feita.
- Regressão no executável instalado, usando somente perfis temporários: `installed-agent.integration.js --ux-only` 9 verificações PASS; integração completa PASS (provedores mockados, isolamento de segunda instância, configurações, download, agente, AX, entrada confiável, aprovar/cancelar); `library-restart.integration.js` PASS para histórico/favoritos/pesquisa após reiniciar. Isso prova esses fluxos no binário instalado, não aceite de produção amplo.
- Estado competitivo: protótipo avançado, mas abaixo de BrowserOS neo, Comet, Dia, Edge/Copilot, Chrome/Gemini e Opera em maturidade de UX, distribuição e ecossistema. Não existe base para posição numérica. Ollama não foi conectado a servidor real; autenticação real de provedor, benchmark pareado, validação visual ampla, auditoria adversarial e atualização assinada/sync continuam pendentes. Ver `docs/COMPARATIVO_CONCORRENTES_2026-10-28.md`.
- Próximo passo concreto: registrar e fechar a diferença de cookie com aceite do usuário se houver necessidade de recuperação; depois executar aceite visual/manual em perfil de QA isolado e continuar os gates e gaps listados no comparativo/checklist. Não restaurar o backup automaticamente, pois isso reverteria todo o perfil para o instante anterior à instalação.

## Ollama local e pacote isolado mais recente — 28/10/2026

- Provider Ollama opcional implementado com endpoints oficiais nativos `/api/tags` e `/api/chat`, fixos em `127.0.0.1:11434`. A UI não pede chave; antes de executar, o serviço confirma que o nome selecionado está instalado localmente. Sem override de endpoint, chamada cloud ou fallback automático. Não instalei Ollama/modelos nem conectei a um servidor real.
- Teste mockado Ollama/catalog 2/2; `npm test` 302/302; `npm run test:ui` PASS; smoke UX empacotado 9/9; integração completa empacotada PASS com provedores mockados (3 passos, aprovação/cancelamento e isolamento de segunda instância); histórico/favoritos e busca sem acento após reinício PASS em perfil temporário.
- Build candidato 0.1.43-dev: `dist-ollama-20261028/win-unpacked/Zero Browser.exe`; SHA-256 exe `D2AF83B1F36BD8EBAD919682EEDCE5797DADC7EB80C774BF10DF7452BD7CDF93`, ASAR `59AF380711051FEDFEE75F30E5551D7E69DB726FB6C8A6E3609FFFD14F4C7030`. É um diretório unpacked para QA, não instalador. Instalação 0.1.42-dev e perfil real seguem intactos.
- Permanecem pendentes: aceite visual/manual deste build (incluindo Enter/Espaço, tema claro e viewports menores), conexão local com um Ollama real já instalado, autenticação real DeepSeek/OpenRouter e benchmarks pareados. A posição numérica no mercado continua indeterminável sem dados comparáveis de adoção/avaliação e benchmarks.
- Próximo passo concreto: teste manual opcional em perfil novo com `NAVEGANTE_USER_DATA` apontando para outra pasta de QA; depois seguir os gates do `CHECKLIST.md`. O smoke local não prova chamadas reais nem paridade comercial.

## Pacote atualizado com segurança e acessibilidade — 28/10/2026

- Pacote isolado atual: `dist-security-a11y-20261028/win-unpacked/Zero Browser.exe` (0.1.43-dev). SHA-256 exe `3422C0302803465F799A1D3CB0BBBB09FA84B2D696AFF52067ACF9FC4A63324F`; ASAR `AA834A5F25C3D8635186FDFE7612A0ABF2E5C5032D2A1F1F9D95B160DF44ADB7`.
- Inclui validação da allowlist antes de navegação via APIs de extensão; navegações de `windows.create` validam o lote inteiro antes de criar abas. Inclui a Biblioteca como grupo de botões nativos com `aria-pressed` e preservação do foco ao trocar categoria; o rótulo da barra é “Agente IA”. 62 JS de `src` parseiam; seis arquivos críticos conferem byte a byte; ASAR confirma a semântica e o rótulo atuais.
- Validação atual: `npm test` 301/301; `npm run test:ui` PASS; `node --test test/extension-host.test.js` 12/12; `npm audit` e `npm audit --omit=dev`: 0 vulnerabilidades reportadas; smoke UX empacotado 9/9; integração empacotada completa PASS com providers de loopback; persistência/busca da biblioteca após reinício PASS em perfil temporário.
- Inspeção visual limitada ao tema escuro, 1400×900; ainda falta validar manualmente contraste/uso visual amplo, e Enter/Espaço não foram confirmados pelo harness de entrada. Teste unitário de navegação cobre esquemas maliciosos antes do dispatch, sem exercício com extensão Flame real.
- A instalação padrão 0.1.42-dev segue intacta; o candidato 0.1.43-dev não é instalador. Próximo passo: aceite manual do candidato isolado; fechar a validação de teclado e continuar benchmarks/integrações reais sem afirmar paridade ainda.

## Teclado e foco da biblioteca — 28/10/2026

- Completei regressão de teclado com entrada confiável de Tab/Shift+Tab no BrowserWindow focalizado: a sequência alcança Histórico, Favoritos e Downloads; Shift+Tab retorna a Favoritos. Com o modo já focado, ativar Favoritos ou Downloads atualiza `aria-pressed` e deixa exatamente um modo selecionado; o foco permanece no controle depois de trocar a categoria.
- A verificação também encontrou e corrigi perda de foco: `openLibrary()` focava sempre o campo de pesquisa, inclusive quando o painel já estava aberto e uma categoria era alternada. Agora o foco inicial vai para a pesquisa só na abertura do painel; trocas de categoria mantêm o foco no botão acionador.
- `npm run test:ui` PASS após a correção (`status: PASS`, `messages: 1`); `node --check` e `git diff --check` dos arquivos tocados PASS. Tentei ativação nativa Enter/Space pelo harness Electron; `sendInputEvent` gerou keydown confiável para o botão focado mas não ativou o clique nativo nem em sequência com keyup. Não registrei essa tentativa como cobertura de Enter/Space. Como a UI usa `<button>` nativo na ordem de tabulação, o comportamento é fornecido pelo navegador; aceite manual com teclado ainda é necessário para prova runtime.
- O harness mostra sua janela de fixture por poucos segundos para enviar Tab confiável e a destrói no cleanup. Nenhuma janela/perfil pessoal foi aberto. A correção está no build atual `dist-security-a11y-20261028`; o harness não comprovou clique nativo com Enter/Espaço, que segue para validação manual.

## Semântica acessível da biblioteca — 28/10/2026

- Revisão de segurança encontrou que `tabs.create`, `tabs.update` e `windows.create` chamavam `loadURL` sem aplicar a allowlist do navegador; Electron confirma que `will-navigate` não é emitido para navegações programáticas via `webContents.loadURL`. Agora `ExtensionHost` valida antes do load/criação, permite HTTP(S), páginas internas permitidas e páginas `chrome-extension://` somente da extensão chamadora; `windows.create` valida todos os URLs de um lote antes de abrir qualquer aba. Regressão cobre `file:`, `javascript:`, `data:`, `chrome:`, URL de outra extensão, HTTPS inválido e texto malformado, além de HTTPS/about:blank e parâmetros ausentes/vazios. `node --test test/extension-host.test.js` PASS 12/12; integração completa do pacote atual PASS, mas não incluiu uma extensão real. Fonte primária: https://www.electronjs.org/docs/latest/api/web-contents.
- Corrigida na árvore a semântica enganosa do seletor da biblioteca: os botões eram filhos de `role="tablist"`, sem serem tabs reais, sem navegação de setas e sem estado selecionado para leitor de tela. O contêiner agora é `role="group"` e cada botão nativo usa `aria-pressed`; `openLibrary()` sincroniza exatamente um estado pressionado com a categoria exibida.
- `scripts/electron-ui.integration.js` verifica grupo, seleção inicial de Histórico, três botões nativos na ordem de Tab e alternância dos três modos, confirmando que só um fica pressionado. `npm run test:ui` PASS (`messages: 1`); `node --check` e `git diff --check` dos arquivos tocados PASS.
- Naquele ponto da auditoria, a alteração ainda não estava no build. Foi incluída e conferida no pacote atual `dist-security-a11y-20261028` descrito acima. Não toquei instalação nem perfil real.
- Próximo passo nesta frente: aceite manual por teclado no candidato isolado, especialmente Enter/Espaço, e inspeção em tema claro/larguras menores.

## Pacote com correção de identidade e regressões reexecutadas — 28/10/2026

- Rótulo visível “Copilot” foi substituído por “Agente IA” em `src/renderer/index.html`. O harness agora verifica o rótulo. Build isolado `dist-visual-brand-20261028/win-unpacked/Zero Browser.exe`, versão 0.1.43-dev: SHA-256 exe `D3E8F2E0C024ABF9566FCB42BFB69ED5941465C431D4BCB8C79DB909E00ABE5D`; ASAR `A6209BB6B680A694355B14647007AE9FD355F36045A04B173FEBE23E8C8F1D0C`.
- Verificação do ASAR: 62 JavaScript de `src` parseiam; `index.html` empacotado contém “Agente IA” e não o rótulo visível “Copilot”. Smoke UX 9/9, integração completa com providers mock PASS, persistência/busca de histórico e favoritos após uma reinicialização PASS em perfil temporário.
- Reexecutei sequencialmente `npm run test:electron`, `npm run test:bench-store` e `npm run test:agent-download`: PASS. Uma tentativa anterior concorrente compartilhou cache global do Electron e causou timeout no campo “Buscar produtos”; descartei essa execução e repeti as integrações em sequência com APPDATA temporário. A execução sequencial da loja confirmou busca SPA, filtros, modal re-renderizado, quantidade e estado do carrinho independente.
- Após a correção do rótulo, `npm test` passou novamente: 300/300; `npm run test:ui` também passou e agora verifica “Agente IA”. `git diff --check` não reporta erro de whitespace; restam avisos de normalização LF/CRLF em arquivos modificados.
- Inspeção manual da janela escura em 1400×900 mostrou nova aba e Configurações sem overflow aparente. Não cobre tema claro, viewports menores, todas as páginas, nem substitui o aceite do usuário. Nenhuma instalação/perfil real foi aberto.
- Próximo passo: receber aceite visual do usuário no candidato isolado; continuar a reconciliação dos gates DeepSeek que exigem conta, do benchmark real e da release bridge/updater.

## Inspeção visual isolada e ajuste de marca — 28/10/2026

- Abri somente `dist-library-reopen-test-20261028/win-unpacked/Zero Browser.exe` com perfil de QA separado em `%TEMP%\zero-visual-audit-profile`; a janela foi fechada depois da inspeção. Nenhuma instalação ou perfil pessoal foi aberto.
- Captura observada em 1400×900, tema escuro: nova aba tem hierarquia clara, busca central, três cartões e atalhos sem transbordamento aparente. Painel Configurações abre, lista seções e mantém conteúdo acessível; o índice de navegação é horizontal e rola em tela estreita. Isto não cobre tema claro, resoluções menores ou avaliação visual pelo usuário.
- Defeito reproduzido na barra superior: o botão da IA mostrava “Copilot”, apesar do produto se chamar Zero Browser e do nome acessível indicar Agente de IA. Corrigido em `src/renderer/index.html` para “Agente IA”; acrescentada asserção em `scripts/electron-ui.integration.js`. `npm run test:ui` passou após a alteração (`status: PASS`, harness sem falhas; só aviso de API Electron depreciada).
- A correção foi empacotada e verificada no ASAR em `dist-visual-brand-20261028` (detalhes e hash na seção mais recente acima).

## Disponibilidade para teste e próximos gates — 28/10/2026

- Build compilado atual para teste manual: `dist-security-a11y-20261028/win-unpacked/Zero Browser.exe` (hashes e cobertura no início deste handoff). Use perfil isolado conforme a instrução abaixo. Isto não é instalador nem chamada autenticada a DeepSeek. O executável de produção segue 0.1.42-dev.
- Para teste manual sem reutilizar o perfil real, definir `NAVEGANTE_USER_DATA` para uma pasta nova e iniciar esse executável. O perfil de QA não inclui credenciais. Não copiar cookies nem dados do perfil atual.
- Extensões: `activeTab` continua negado. A interface não produz um evento de gesto confiável para o host; simular o grant a partir de IPC da própria extensão abriria escalada de privilégios. Próxima implementação exige evento privado do host ligado a extensão+aba e revogação em navegação/fechamento/unload.
- Atualizador: `docs/PLANO_ATUALIZACAO_ASSINADA.md` registra dependências verificadas. Não há feed; a versão publicada atual do electron-builder não oferece o manifesto Ed25519 documentado para v27; não introduzir updater sem assinatura nem inventar canal. A instalação 0.1.42 não tem chave confiável, portanto a migração inicial seguirá manual mesmo quando o updater estiver pronto.

## Erro de inicialização mostrado pelo usuário — 28/10/2026

- A imagem mostra uma exceção de sintaxe do processo principal (`Unexpected token '}'`) ao abrir `dist-ipc-guard-20261028`. Essa pasta é o primeiro build, já descartado: inspeção do `app.asar` confirma quatro arquivos `src` truncados (`sheets-tool.js`, `sheets.js`, `chrome-shim-preload.js`, `extension-host.js`). `sheets.js` começa com uma chave `}`, que corresponde ao erro visível. Não é falha do código-fonte atual.
- Confirmei parsing dos 62 JavaScript de `src` dentro dos pacotes: o build descartado falha nos quatro arquivos acima; `dist-ipc-guard-final-20261028` e o pacote mais recente `dist-extension-privacy-20261028` passam sem falhas. Reexecutei o smoke UX do pacote mais recente em perfil temporário: 9 verificações PASS.
- SHA-256 atual de `dist-extension-privacy-20261028/win-unpacked/resources/app.asar`: `35AC118312CF1F75EF178E40022725C4D1D170BD4E301C7D78D17147D61E048F`.
- Orientação para reproduzir com o candidato correto: abrir `dist-extension-privacy-20261028/win-unpacked/Zero Browser.exe`; não abrir o executável de `dist-ipc-guard-20261028`. A instalação padrão permanece intacta e não foi atualizada.

## Continuação — busca da biblioteca e isolamento de extensões — 28/10/2026

- Busca da biblioteca agora faz case-folding Unicode e remove acentos em Histórico, Favoritos e sugestões; consultas “sao”/“SÃO” encontram títulos como “SÃO PAULO”. Testes `test/library.test.js` 7/7 cobrem SQLite temporário, fechamento/reabertura do banco e busca acentuada. `scripts/library-restart.integration.js` passou no executável empacotado: histórico/favorito e busca da UI permaneceram corretos antes e depois de reiniciar, em perfil temporário; o pacote anterior falhou no controle de busca acentuada.
- Fronteira de extensão reforçada: IPC exige que frame, top frame e sessão correspondam à mesma extensão carregada; dispatch de APIs privilegiadas exige permissão manifesta; eventos com dados sensíveis são filtrados/projetados por destinatário; `tabs.get/query` e `windows.populate` ocultam URL/título/favicon sem permissão `tabs` ou host permission efetiva; filtros não revelam abas inacessíveis. `tabs.captureVisibleTab` exige host permission compatível com URL ativa; activeTab segue negado até existir fluxo de grant por gesto. `management.getSelf` não exige permissão `management`; uninstall permanece bloqueado.
- Suítes atuais: `npm test` 300/300, `npm run test:ui` PASS, `node --test test/extension-host.test.js` 11/11, `node --test test/library.test.js` 7/7, `git diff --check` sem erros (avisos apenas de normalização LF/CRLF). Testes não validam a extensão Flame real; o manifesto não existe no repositório e não foi lido de perfis pessoais.
- Pacote consolidado `dist-extension-privacy-20261028/win-unpacked/Zero Browser.exe`: SHA-256 exe `3BCCBBD393E5F5B4E81E4D986E9EC1632745640FF9D645F561D4B9566A84421D`; ASAR `35AC118312CF1F75EF178E40022725C4D1D170BD4E301C7D78D17147D61E048F`. Smoke UX 9/9 e integração completa PASS em perfil temporário, incluindo configurações, download fixture, provedores mock, aprovação/recusa e segunda instância. Arquivos extension-host/library/browser-policy/app no ASAR conferem byte a byte; guard presente, worker ausente; fuses verificadas e integridade ASAR validada no startup.
- Ainda não comprovado: compatibilidade Flame real, grants `activeTab`, optional host permission e atualização assinada; benchmark lado a lado; sites de produção; aceite visual amplo e instalação real. O executável instalado continua 0.1.42-dev e intacto.
- Próximo passo concreto: aceite manual do pacote em perfil temporário pelo usuário; em paralelo, projetar evento de gesto nativo e ciclo de grant/revogação para `activeTab` sem afrouxar o guard. Não usar perfis pessoais nem instalar o candidato sem backup verificável.

## Continuação — navegação segura e concorrência da biblioteca — 28/10/2026

- Aplicada a mesma allowlist da barra/pop-ups à navegação iniciada por páginas (`will-navigate`) e a redirecionamentos (`will-redirect`): HTTP(S) com hostname e páginas internas explícitas; bloqueia `file:`, `data:`, `javascript:` e esquemas desconhecidos. Testes da política em `test/startup.test.js` passaram 28/28 após a alteração de navegação. A referência do Electron documenta que `will-navigate` cobre somente o frame principal e que `will-redirect` é o evento cancelável para redirects: https://www.electronjs.org/docs/latest/api/web-contents.
- Corrigida corrida da biblioteca: resultado atrasado do Histórico não substitui Downloads após troca de categoria nem repinta painel fechado. Teste reproduz a corrida e a contraprova sem proteção falha; `npm run test:ui` PASS.
- Estado conjunto: `npm test` 293/293; `npm run test:ui` PASS; `git diff --check` sem erros. Pacote atualizado `dist-next-stage-20261028/win-unpacked/Zero Browser.exe`: SHA-256 exe `EF3D3353EEC3B5C95B39A7D6A6700229EABE039145CC60FAE07BAA7945EF8616`; ASAR `5E8D742ADAD108F1DD12A657F0B1F38483884305411110A8E3E8E4FA4C34D335`. Smoke UX 9/9; integração completa PASS (navegação HTTP fixture, configurações, downloads, provedores loopback mock, aprovação/cancelamento, segunda instância). `main.js`, `permissions.js`, `browser-policy.js`, `renderer/app.js` no ASAR conferem byte a byte; guard IPC presente, worker ausente; fuses conferidas: RunAsNode/NODE_OPTIONS/CLI inspect off, ASAR integrity/OnlyLoadAppFromAsar/cookie encryption on, V8 snapshot off, `file://` extra privileges on por compatibilidade comprovada.
- A integração usa fixture local e provedores simulados; não valida sites de produção, chamada DeepSeek autenticada, benchmark de concorrentes, persistência da biblioteca após reinício ou instalação real. Atualizador automático/assinado continua ausente; análise recomenda electron-builder/electron-updater + manifestos assinados, mas requer canal de publicação e chave privada segura em CI.
- Próximo passo concreto: continuar auditoria funcional das configurações/biblioteca (busca e persistência após reinício) e análise adversarial de redirects/extensões; então avaliar backup restaurável do perfil para migração do cookie encryption. O instalado continua 0.1.42-dev, intacto; não atualizar sem backup verificável.

## Continuação — permissões e downloads — 28/10/2026

- Corrigido um defeito da biblioteca: eventos de download recebidos enquanto a aba Downloads está aberta agora atualizam a lista com debounce (120 ms). Regressão em `scripts/electron-ui.integration.js` confirma que o arquivo concluído e a ação “Mostrar na pasta” aparecem. `npm test` passou 292/292; `npm run test:ui` PASS. A mensagem de fixture `ai:get-config` sem handler ocorreu durante o teste e não falhou a suíte.
- Removida a concessão automática de geolocalização a domínios `google.*`. Permissões suportadas exigem confirmação explícita e grants ficam em memória por origem/sessão; `setPermissionCheckHandler` consulta os mesmos grants. A solicitação exige `details.isMainFrame === true`, nega subframes/dados ausentes e nega se a janela for destruída enquanto o diálogo estiver aberto. Testes focados reportados: `node --test test/startup.test.js` 27/27. A suíte completa passou 292/292 antes do endurecimento final de `isMainFrame`; repetir a suíte completa após essa pequena alteração.
- Build atualizado `dist-current-audit-20261028/win-unpacked/Zero Browser.exe`: SHA-256 exe `CDCC99E4001CD4B394149C3403465933912FD45F18A86CB101527FE613C8CEC2`; ASAR `7E9C51DFA70CEEACEF084E3E592CA93670D59F73EB9802E50EEFBB5A9F983D89`. Smoke `--ux-only` PASS com 9 verificações e perfil temporário. Arquivos `main.js`, `permissions.js` e `renderer/app.js` no ASAR conferem byte a byte com a árvore; guard IPC existe e worker ausente. O build aplicou as fuses do `package.json`, incluindo integridade ASAR e criptografia de cookies; a instalação real não foi tocada.
- `npm test` 292/292 e `npm run test:ui` PASS após o endurecimento final de permissões. Limpeza posterior da fixture: stub de `ai:get-config` adicionado com configuração sem credenciais; a UI termina PASS sem mensagem de handler ausente. `git diff --check` sem erros (só avisos LF/CRLF); resta somente aviso de API Electron depreciada do harness.
- Atualização assinada continua sendo a maior lacuna de distribuição identificada; sync também não existe. O candidato ainda não está instalado: antes de qualquer instalação, criar e verificar backup restaurável do perfil devido à migração de cookies de mão única. A política segue o contrato documentado pela [API de sessão do Electron](https://www.electronjs.org/docs/latest/api/session).
- Próximo passo concreto: gerar pacote isolado a partir da árvore atual e confirmar arquivos no ASAR, fuses e smoke; depois auditar em runtime configurações/biblioteca e preparar backup restaurável do perfil antes de qualquer migração de cookies. Instalação real continua intacta.

## Auditoria do instalado e fuses — 28/10/2026

- Inspecionados sem executar nem modificar a instalação `C:\Users\Wesley\AppData\Local\Programs\navegante\Zero Browser.exe` e `resources/app.asar`. Versão 0.1.42-dev; SHA-256 exe `934CC8A06612702768C49FEFF37B27083F05D1D74018B33EBE76B1EC320F3412`, ASAR `4F8280C44B868EFBBB45CBCB723E4B6D37C0930FDB37C9A1E33B5F91E8F7420B`. Extração em pasta temporária apenas para leitura.
- Comparação com `dist-ipc-guard-final-20261028` (0.1.43-dev): o instalado contém 38 chamadas diretas `ipcMain.handle` em `src/main/main.js` e 24 em `src/ipc/index.js`, sem validação central de sender/frame/origem; também contém `sandbox-worker.js`, sem referências, enquanto `runTransform()` já falha fechado. O pacote 0.1.43 contém `trusted-ui.js`, cobre os handlers da UI, valida extensão/frame e omite o worker. Páginas de navegação não recebem o preload principal; não foi reproduzido exploit remoto, então a lacuna antiga é reportada como superfície sem guarda, não como comprometimento confirmado.
- Os fuses do instalado e do pacote 0.1.43 anterior estavam nos padrões: RunAsNode, NODE_OPTIONS, argumentos de inspeção e privilégios extras de `file://` habilitados; integridade ASAR e OnlyLoadAppFromAsar desabilitados. `package.json` agora aplica hardening: RunAsNode/NODE_OPTIONS/inspect off, integridade ASAR e OnlyLoadAppFromAsar on, criptografia de cookies on, V8 snapshot específico off. Cookie encryption é one-way; exigir backup verificável antes de instalar. `grantFileProtocolExtraPrivileges` ficou on porque o app usa `file://`; desligá-la falhou com `ERR_FILE_NOT_FOUND`, e reativá-la fez o smoke passar.
- Build isolado aceito: `dist-security-hardening-rebuild-20261028/win-unpacked/Zero Browser.exe` 0.1.43-dev, exe SHA-256 `5478832A3D62FE82BDBC8FB6BCEF1124F4B994ACB24ABF6C608C541A465A2303`, ASAR `EC52F9FF19ACE34B2829AAFA2774838D40F499D6B423ABFD94A30F322CB5BE3A`. Inspeção confirmou oito fuses configuradas, ASAR contém o guard e não contém o worker; smoke `node scripts/installed-agent.integration.js <exe> --ux-only` passou (9 verificações, perfil temporário). Após a build, comparei byte a byte os arquivos atuais e empacotados `renderer/app.js`, `index.html`, `styles.css`, `newtab.html`, `newtab.css`, `newtab.js`, além de `main.js`, `ipc/index.js` e `trusted-ui.js`; todos coincidem, então este artefato inclui as alterações UX compartilhadas. 19 testes focados IPC/extensão/sandbox/módulos passaram; `git diff --check` passou. Um build intermediário com integridade habilitada acusou mismatch; um rebuild limpo no diretório final passou. Sempre validar hash e smoke do artefato que se pretende instalar.
- Segurança estática adicional: janela principal e `WebContentsView` de navegação usam `contextIsolation`, `nodeIntegration:false`, `sandbox`, `webSecurity:true` e `allowRunningInsecureContent:false`; sessões remotas têm handler de permissões; popup tem filtro; preload expõe métodos específicos via `contextBridge`. Não houve mudança nessas áreas nesta sessão.
- Próximo passo concreto: antes de considerar instalação, preparar e validar backup restaurável do perfil real (incluindo cookies) e então executar os gates de release no artefato acima. Bloqueio pendente: nenhuma instalação autorizada nesta tarefa; a instalação 0.1.42-dev continua inalterada e sem guard IPC/fuses hardening.

## Continuação — concorrentes, UX e IPC — 28/10/2026

- Estado confirmado por leitura local: instalado `0.1.42-dev` (exe SHA-256 `934CC8A06612702768C49FEFF37B27083F05D1D74018B33EBE76B1EC320F3412`; `app.asar` `4F8280C44B868EFBBB45CBCB723E4B6D37C0930FDB37C9A1E33B5F91E8F7420B`); árvore `0.1.43-dev`, não empacotada. README atualizado para separar os dois estados. Versão/hash não equivalem a verificação de segurança ou funcionalidade do instalado.
- Proteção IPC concluída na árvore: 38 canais em `main.js` e 22 em `src/ipc/index.js` passam pelo guard; os 62 usos de `invoke` do preload foram mapeados. O guard exige `sender` esperado, frame principal exato, URL local exata e janela viva. `navegante-ext:call` exige sessão e frame/topo na mesma extensão carregada; service worker permanece via IPC scoped. Testes cobrem remetente/frame inválidos e aceitos.
- A primeira build `dist-ipc-guard-20261028` apresentou quatro JS truncados no `app.asar`; os arquivos de origem passavam `node --check`. Descartada como inválida. Rebuild sequencial em `dist-ipc-guard-final-20261028`: 62 JS de `src` parsearam, guard presente, worker órfão ausente, smoke `--ux-only` PASS (abas, teclado, tema e fechamento 2→1). SHA-256 do exe `71F2240C50870CDAA6EE698C8BDB7E27A9EF4D37E4075136E4A6C527A0C3B167`; `app.asar` `FDC6588B2EC1D818B54DF75E45EF5492A5F0C1CD4834852BFC89EE56595EE6D7`.
- Sandbox: removido `src/automation/sandbox-worker.js`, corrigidas alegações históricas de execução isolada em `sandbox.js`, `module-store.js`, `service/index.js` e `docs/NOVIDADES.md`; `runTransform` continua fail-closed. Testes focados passaram e o pacote confirma ausência do worker.
- Verificação completa da árvore atual: `npm test` 292/292; `npm run test:ui` PASS; `git diff --check` PASS. Nenhuma instalação real, perfil real, commit ou publicação foi alterada.
- `docs/COMPARATIVO_CONCORRENTES_2026-10-28.md` foi revisado com BrowserOS, Comet, Chrome/Gemini, Edge/Copilot, Dia, Opera e ChatGPT em categorias apropriadas. Atlas está aposentado e foi removido da lista ativa; o documento distingue fatos oficiais de avaliação qualitativa e não inventa ranking numérico. Benchmark lado a lado ainda não existe.
- Acessibilidade das abas foi corrigida em `src/renderer/app.js`, `index.html` e `styles.css`: botões nativos separados para selecionar/fechar, foco/seleção e navegação por setas/Home/End. A primeira falha de smoke 2→1 foi do roteiro: o renderer principal permaneceu responsivo; a página secundária `newtab.html` reutilizada pelo teste já havia sido fechada. Verificação de temas movida para antes dos fechamentos; pacote isolado atual passou, sem chamadas ao provedor.
- Auditoria documental conta 151 itens ainda abertos no checklist; há duplicações e pendências históricas. Esse número não equivale a defeitos atuais: reconciliação por fluxo continua pendente. README distingue a instalação 0.1.42-dev da árvore 0.1.43-dev e registra hashes conferidos.
- Atualização: a auditoria estática separada do instalado 0.1.42-dev está registrada na seção mais recente acima. Próximo passo de produto continua sendo o aceite visual do pacote isolado em shell, configurações e biblioteca e a reconciliação do checklist; qualquer instalação aguarda backup verificável do perfil devido à migração one-way de criptografia de cookies.
- Árvore compartilhada permanece suja; preservar tudo. Sem commit, instalação real, publicação ou benchmark pago.

## Continuação — auditoria, UX e concorrentes — 28/10/2026

- Build isolado `dist-ux-verification-20261028/win-unpacked/Zero Browser.exe` (0.1.43-dev; exe SHA-256 `1EBE6AD0860348681B0D384B59ED20DC628C99CF18F298C268AF543B83DFA3C3`; app.asar SHA-256 `3E7BED952133186027145F9ECAFD48FA90391F2535569C866EAA064C0F89E534`) passou `node scripts/installed-agent.integration.js <exe> --ux-only` com perfil temporário: botão + duas vezes, títulos das abas, eventos de seta esquerda e End disparados no renderer via CDP com foco/seleção sincronizados, só uma aba na ordem de foco, botão + fora da tablist, troca de tema claro/escuro nas duas abas e barra do agente sem overflow. Zero chamadas ao provedor. Nenhuma instalação/perfil real foi alterado.
- Verificações da árvore 0.1.43-dev: `npm test` 286/286; `npm run test:ui` PASS. O smoke encontrou expectativa de título desatualizada no próprio roteiro (`Nova aba` vs `Novo Separador`); ajustada e reexecutada com PASS.
- Comparação datada e limitada por evidência em `docs/COMPARATIVO_CONCORRENTES_2026-10-28.md`: Zero em estágio de protótipo, sem ranking quantitativo; inclui BrowserOS, Comet, Chrome/Gemini, Edge/Copilot, Dia e Opera. Atlas está aposentado e não conta como concorrente ativo. Recursos de concorrentes são descrições oficiais, sem teste prático independente.
- DeepSeek: automação, mocks e transporte sem credencial estão documentados no checklist; chamada autenticada e benchmarks pagos/reais continuam abertos e exigem a chave salva pelo próprio usuário e autorização de custo. Não solicitar, ler, copiar ou registrar segredo. Não chamar benchmark histórico de paridade.
- Próximo arquivo/ação: `CHECKLIST.md` — fechar inspeção visual da shell completa, painel, configurações e biblioteca em executável isolado; depois resolver isolamento do sandbox e testar pacote antes de qualquer instalação. Para benchmarking, aguardar conexão/custo autorizado, executar pares reproduzíveis e atualizar `docs/EVOLUCAO_MOTOR.md`.
- A árvore é compartilhada e continua suja com mudanças paralelas 0.1.43-dev; preservá-las. Sem commit, publicação ou instalação.

## Abas e integração empacotada — 28/10/2026

- O pacote isolado `dist-ux-verification/win-unpacked/Zero Browser.exe` passou teste `node scripts/installed-agent.integration.js <executável> --ux-only` com perfil temporário: dois cliques no botão +, título das duas novas abas, troca claro/escuro nas duas e barra do agente sem transbordamento. O pacote foi gerado antes da mudança de navegação de abas por teclado e não representa o estado final da árvore.
- Abas agora têm role/estado selecionado e navegação por setas, Home, End, Enter e Espaço; só a ativa integra a ordem de Tab. Teste Electron de interface passou; `npm test`: 286/286. O botão + permanece fora do tablist acessível.
- Próximo: gerar pacote isolado atualizado e testar teclado/aba e visual em janela real; inspecionar painel, biblioteca e configurações, prosseguir pendências do DeepSeek e medir desempenho competitivo. Não declarar paridade. Alterações paralelas em 0.1.43-dev permanecem sem commit; preservá-las e não instalar por cima da sessão em uso.


## Tema e revisão visual da nova aba — 28/10/2026

- A nova aba acompanha o tema do navegador ao carregar e quando a preferência muda. `src/main/newtab-theme.js` limita a aplicação ao arquivo interno exato; `src/main/main.js` aplica o tema às abas internas. `src/renderer/newtab.css` define paletas clara e escura.
- `npm test` 286/286; `npm run test:ui` PASS, incluindo troca de paleta e duas ativações do agente. Capturas da fixture Electron foram inspecionadas em 1024×768 claro/escuro e 500×800 escuro; foco duplicado corrigido. Isto não é aceite do aplicativo instalado completo.
- Próximo: validar com perfil isolado no app completo botão +, mudança de tema com múltiplas novas abas, painel, biblioteca e configurações; continuar redesign e pendências do DeepSeek e benchmark pareado. Trabalho paralelo deixou alterações de 0.1.42-dev; preservá-las.


## Nova aba e validação — 28/10/2026

- Nova aba redesenhada em `src/renderer/newtab.html` e `newtab.css`: hierarquia de pesquisa e atalhos, paleta alinhada à casca escura, controles de foco e layout estreito. Substituída afirmação de que o agente estava pronto por texto neutro. Atalhos de pesquisa e agente usam botões nativos; campo de pesquisa possui nome acessível.
- Corrigido `src/renderer/newtab.js`: após fechar o agente, um segundo clique no atalho volta a emitir a navegação interna de abertura. Teste Electron acompanha duas navegações e valida foco, controles e CSP. `npm run test:ui`: PASS; `npm test`: 285/285.
- A janela visível tinha atividade simultânea; não foi usada como fixture para ações. Falhou tentativa de captura visual isolada: a aparência nova ainda exige inspeção visual em janela de teste, temas e larguras reais. Nova aba ainda não acompanha explicitamente a preferência de tema do navegador.
- Próximo: preparar janela isolada identificável e conferir a nova aba, botão +, painel e configurações visualmente; depois continuar as pendências de UX, segurança e validação competitiva. A instalação atual não foi atualizada por esta sessão. Outra atividade tem mudanças pendentes 0.1.42-dev; preservar trabalho compartilhado.


## Continuação de design e pendências — 28/10/2026

- O usuário pediu redesign e UX de todo o Zero Browser, botão + de nova aba, melhoria dos pontos fracos frente ao mercado e conclusão/documentação do trabalho pendente do DeepSeek. O objetivo é amplo e continua aberto; equivalência com concorrentes ainda não foi medida.
- Aplicadas orientações da skill Impeccable do repositório pbakaus/impeccable: modo Operate, sem instalar hooks nem rodar binário externo. O launcher de contexto não estava instalado; código e documentos existentes foram lidos diretamente.
- No painel do agente, as ações secundárias foram agrupadas em Mais ações; Escape fecha e devolve o foco. Teste de UI confirmou que o botão + envia pedido de nova aba, menu não transborda e Escape funciona. `npm test`: 285/285; `npm run test:ui`: PASS. Captura visual ficou instável; não confundir teste de fixture com aceite visual.
- Próximo passo concreto: abrir o aplicativo em perfil isolado visível e examinar `src/renderer/index.html`, `styles.css` e `app.js` em larguras e temas reais; validar menu e botão + ao vivo; continuar redesign do navegador, nova aba, painel e configurações. Revisar pendências do CHECKLIST uma a uma e registrar evidências; planilhas e serviços autenticados requerem ambiente de teste adequado.
- Trabalho paralelo alterou a árvore para 0.1.41-dev antes desta sessão, com modificações pré-existentes em CSS, testes, versão e notas; preservá-las. Não instalar ou publicar sem validar o pacote final e coordenar com a atividade em andamento.



## Continuação da auditoria — 28/10/2026

- Corrigida a seleção das 200 receitas mais recentes em `src/automation/recipe-store.js`, com teste de retenção entre origens. O agente deixou de receber ferramentas e instruções de transformações indisponíveis; a interface não sugere executá-las. Corrigida a barra invertida do caminho de reserva Windows em `src/automation/file-acl.js`.
- `npm test`: 283/283; `npm run test:ui`: PASS; teste de integração do pacote separado `dist-audit-local/win-unpacked/Zero Browser.exe`: PASS com perfil isolado e provedor simulado. O pacote anterior foi substituído pela validação do build em `dist-audit-final`.
- A instalação mudou externamente para 0.1.39-dev, `app.asar` SHA-256 `ef1c4873f3bee5db723c82029163054176a4f28cf7ae8476e33eb60a59cbd74b`. Inspeção direta do `sandbox.js` no pacote instalado confirmou `spawn(process.execPath...)` e ausência do bloqueio: continua vulnerável, apesar de o commit local `0db18c6` já conter o bloqueio.
- Token do pipe corrigido: arquivo temporário vazio recebe ACL antes do segredo e é renomeado; falha de ACL fecha o pipe. Testes incluem ACL real no Windows. `npm test` 284/284 antes do último teste adicional; teste adicional passou isoladamente. `dist-audit-final/win-unpacked/Zero Browser.exe` passou integração em perfil isolado com provedor simulado. Próximo: coordenar atualização da instalação com a outra atividade em curso e verificar o `app.asar` instalado; continuar auditoria abrangente.
- Outra atividade alterou a versão para 0.1.40-dev e o checkout durante a sessão; preservar essas mudanças compartilhadas.


## Auditoria de 28/10/2026 — estado atual

- Confirmado escape do sandbox: `input.constructor.constructor` consegue alcançar o processo hospedeiro apesar da filtragem. A execução de `transform` e `module run` foi bloqueada em `src/automation/sandbox.js`; dados e módulos salvos são preservados. A configuração informa a indisponibilidade.
- A instalação 0.1.38-dev (`app.asar` SHA-256 `eef2f3191f391cf89c9da18cdb9981155b42b7281d94f4aec1d9abc430758c30`) ainda contém a falha; código local 0.1.39-dev não foi instalado. Alterações anteriores não commitadas foram preservadas.
- Próximo passo: validar os testes finais e o pacote isolado, substituir o isolamento por uma solução de sistema operacional com testes adversariais antes de reativar `runTransform`, e prosseguir a auditoria dos demais fluxos. Não alegar auditoria completa nem ranking sem benchmark pareado.
- Limites: sites autenticados e comparação quantitativa com concorrentes ainda não verificados. Consultar o histórico abaixo para as demais pendências.



## Estado em 2026-10-27 (integração 0.1.5-dev)

- Árvore única: `main` com a integração commitada (`68e51f7` → `be7677f` → registro deste build). A paginação do
  `read_batch` (que estava sem commit) foi commitada, a branch `claude/analise-projeto-atual-bf8fc8` foi rebaseada
  sobre o `main` — 2 conflitos resolvidos — e aplicada por fast-forward. Histórico linear, sem merge commit e sem push.
- Verificação desta integração: `npm test` **177/177**; `node --check` em todo `src/`, `scripts/`, `bench/`, `test/`;
  `git diff --check` limpo; `npm audit --omit=dev` zero. Integrações Electron na árvore instalada:
  `test:electron` exit 0, `test:bench-store` PASS, `test:agent-download` PASS. Benchmark real: 44 e 33 passaram,
  com 5×5 na 44 depois do ajuste do journal (ver abaixo).
- **Build e instalação (2026-10-27):** `dist\Zero Browser Setup 0.1.5-dev.exe` (124.430.162 bytes,
  SHA-256 `4769f4eb2905f7710a4cd426fd1d9121d49603a821596e289ab8bdc5ce82bcc4`) foi instalado em
  `%LOCALAPPDATA%\Programs\navegante` após validação do `win-unpacked` em perfil isolado. O `app.asar` do build e
  da instalação coincidem: `3658148c12a1335a1ebf6988ae5f557c8d9ac3d3d226ebe182105acd4f606401`. O executável
  instalado informa `FileVersion 0.1.5-dev` (`ProductVersion 0.1.5.0`) e passou `scripts/installed-agent.integration.js`
  com `status: PASS` (AX, CUA, configurações, downloads, provedores mockados, aprovação/cancelamento, segunda instância).
  A instalação ANTERIOR (0.1.4, `app.asar` `b14007...`) está preservada em `backups/2026-10-27-before-0.1.5-dev/`
  (app 184 arquivos/374 MB, perfil 7.776 arquivos/763 MB, atalhos e instalador 0.1.4), com instruções de restauração
  em `LEIA-ME.md` da mesma pasta.
- **Produção agora roda um build `-dev`.** Ele não passou pelos gates de release (integrações Electron restantes,
  benchmark pareado, inspeção visual). Reverter é instalar o 0.1.4 do backup; o perfil não foi migrado.
- O instalador NSIS abre o app ao terminar: há processos `Zero Browser.exe` do perfil real desde 15:01. Isso não
  afeta o hash nem o backup (feito com o app fechado).
- Correção aplicada: `coverage.complete` voltou a significar "não falta mais nada". O último trecho de uma leitura
  paginada agora é `complete` (antes era sempre falso), e uma leitura por `tabId` não conta as outras abas como
  omitidas. Regra em `src/automation/batch-coverage.js`; detalhe, conflitos e reversão em
  `docs/REGISTRO_INTEGRACAO_0.1.5.md`.
- Versão: `package.json` e `package-lock.json` em 0.1.23-dev (o lock acompanha; teste `test/whats-new.test.js`).
- **Motor, salto 1 (2026-10-27):** `run_steps` aceita `expect {url,text,absent}` conferido pelo host (espera de até
  3 s, texto normalizado, parada quando a pós-condição não vem). Opt-in: só com `actionScripts`/`--scripts`.
  `npm test` 133/133; regra em `docs/EVOLUCAO_MOTOR.md`; restauração em `docs/PONTOS_DE_RESTAURACAO.md`
  (tag `motor-pre-leaps-2026-10-27`). Sem benchmark e AUSENTE do app instalado até um novo build.
- **Motor, salto 2 (2026-10-27):** journal de efeitos (`effectJournal` / `--journal`). Ação consequente é registrada
  antes de despachar; repetir depois de falha/timeout exige leitura da página; sucesso vira `alreadyDone`; entradas
  expiram em 30 min e persistem entre reinícios. `npm test` 141/141; limites e desenho em `docs/EVOLUCAO_MOTOR.md`.
  Opt-in, sem benchmark e ausente do app instalado.
- **Motor, salto 3 (2026-10-27):** risco por capacidade (`src/automation/risk.js`) substitui a regex única de
  aprovação. Níveis credential/destructive/commitment/write/none, precedência e motivo específico no diálogo;
  "Minha conta" e "Meus pedidos" deixaram de pedir aprovação. `npm test` 148/148; `--journal` e demais flags seguem
  opt-in e ausentes do app instalado.
- **Motor, salto 4 (2026-10-27):** verificação final por contrato (`verify` no `run_task`): url/text/absent/
  textCount/download conferidos pelo host, `requireVerification` recusa "concluído" sem prova e o trace guarda só
  booleanos. `npm test` 153/153; detalhe e limites em `docs/EVOLUCAO_MOTOR.md`. Não está no app instalado.
- **Motor, salto 5 (2026-10-27):** correção após verificação (`correctionRounds` 0–3): a falha volta ao agente com o
  motivo (sem texto da página) e gasta uma rodada; `requireVerification` agora recusa também quando o laço já
  verificou. `npm test` 155/155; sem benchmark e ausente do app instalado.
- **Motor, salto 6 (2026-10-27):** a verificação aprovada vira prova de efeito: confirma tentativas pendentes do
  journal (`proof: task-verification`); contrato falho mantém `attempted`. `npm test` 157/157.
- **Motor, salto 7 (2026-10-27):** gate do journal dentro de `run_steps` (`beforeStep`/`afterStep`): passo já
  confirmado é pulado, efeito desconhecido bloqueia o lote sem despachar, e falha/exceção liquidam a tentativa.
  `npm test` 161/161. Lacuna do salto 6 fechada.
- **Motor, salto 8 (2026-10-27):** extração estruturada (`extract_table`, opt-in): tabela por selector/índice,
  colunas por cabeçalho, deduplicação, limite e proveniência; trace só com contagens. `npm test` 168/168.
- **Motor, salto 9 (2026-10-27):** `check_task` consulta o contrato no meio da tarefa (somente leitura, `ok:false`
  como resultado normal, catálogo só com contrato). `npm test` 170/170.
- **Motor, salto 10 (2026-10-27):** ETL paralelo entre abas: `read_batch` com `extract` devolve linhas estruturadas
  por aba, com proveniência, `missingColumns`/`truncationReasons` e agregados; catálogo em 7.815 bytes.
  `npm test` 173/173.
- **Motor, salto 11 (2026-10-27):** receitas por site (`recipe`, opt-in): passos estáveis com `expect` obrigatório,
  armazenamento por origem e execução sem modelo. `npm test` 177/177. Sem captura automática e sem journal nos
  passos da receita.
- **Motor, salto 12 (2026-10-27):** canal alternativo para canvas: `clipboard` (read/write TSV, write com aprovação)
  e `key_sequence` (setas/Tab/F2/Ctrl com repetição; Enter/espaço com aprovação). `advancedInput` ligado por padrão,
  +1.020 bytes de catálogo. `npm test` 181/181; fluxo em `docs/PLANILHAS_E_SITES_DIFICEIS.md`.
- **Checkpoint 2 instalado (2026-10-27):** `dist\Zero Browser Setup 0.1.5-dev.exe` (124.443.992 bytes,
  SHA-256 `e57c20cc…580632`), `app.asar` `2658b925…06088b` igual em build/produção, integração do instalado
  `status: PASS`. Backup do checkpoint anterior em `backups/2026-10-27-before-clipboard/` (`ae7a6564…0ae96a`).
  `npm test` 181/181. Perfil intacto.
- **Checkpoint 3 instalado (2026-10-27):** build com `visual_click` e `sheets_accessibility`
  (instalador `a2339c55…ad151c`, `app.asar` `39cb96e1…7494f8`, integração `status: PASS`); backup em
  `backups/2026-10-27-before-visual/`. `npm test` 185/185.
- **Checkpoint 4 instalado (2026-10-28):** journal estreitado a efeito crítico (instalador `36104023…effaff`,
  `app.asar` `92940a8c…02b720`, `status: PASS`); backup em `backups/2026-10-27-before-journal-fix/`.
  Medição 5×5 na tarefa 44: 5/5 das duas condições, journal com −16,1% passos, −15,1% chamadas e −10,1% tokens;
  regressão do journal removida (prova estatística ainda requer 14 tarefas e outro modelo).
- **Checkpoint 5 instalado (2026-10-28):** versão **0.1.6-dev** (instalador `Zero Browser Setup 0.1.6-dev.exe`,
  SHA-256 `d493c626…2165df`, 124.447.459 bytes; `app.asar` `40f5be10…9257dd` igual em build/produção; integração
  `status: PASS`). Backup do estado anterior em `backups/2026-10-28-before-recipe-v2/`. Perfil intacto.
- **Checkpoint 6 instalado (2026-10-28):** versão **0.1.7-dev** com **mint automático** (`saveRecipe`), ferramenta
  **`sheets`** (read/write/goto A1 sem clicar em célula) e receitas v2 (schema de entrada + `possibleCommit`).
  Instalador `Zero Browser Setup 0.1.7-dev.exe` (SHA-256 `6740ee31…903f19`, 124.449.277 bytes); `app.asar`
  `a977bf32…8a59b2` igual em build/produção; integração `status: PASS`; `npm test` 194/194. Backup do 0.1.6-dev em
  `backups/2026-10-28-before-mint/` (`40f5be10…`).
- **Checkpoint 7 instalado (2026-10-28):** versão **0.1.8-dev** com **credencial com escopo de origem**
  (`authenticationOrigins`) e **autoridade de receita** (`read`/`write`). Instalador
  `Zero Browser Setup 0.1.8-dev.exe` (SHA-256 `3b76846c…f80278b`, 124.450.032 bytes); `app.asar`
  `55a0f841…33c52` igual em build/produção; integração `status: PASS`; `npm test` 198/198. Backup do 0.1.7-dev em
  `backups/2026-10-28-before-credential/` (`a977bf32…`).
- **Checkpoint 8 instalado (2026-10-28):** versão **0.1.9-dev** com **diagnóstico do `sheets`** (`diagnostics` e
  códigos `NAME_BOX_NOT_FOUND`/`CLIPBOARD_EMPTY`). Instalador `Zero Browser Setup 0.1.9-dev.exe` (SHA-256
  `fd752acc…1b09e`, 124.450.036 bytes); `app.asar` `1a769d28…c3033` igual em build/produção; integração
  `status: PASS`; `npm test` 199/199. Backup do 0.1.8-dev em `backups/2026-10-28-before-diagnostics/`.
- **Checkpoint 9 instalado (2026-10-28):** versão **0.1.10-dev** com **nome acessível padrão (accname W3C)** no
  snapshot e no locator. Instalador `Zero Browser Setup 0.1.10-dev.exe` (SHA-256 `e2f06273…2d27c6c`, 124.451.280
  bytes); `app.asar` `bf495150…5e045` igual em build/produção; integração `status: PASS`; `npm test` 202/202.
  Backup do 0.1.9-dev em `backups/2026-10-28-before-accname/`.
- **Checkpoint 10 instalado (2026-10-28):** versão **0.1.11-dev** com **contrato de saída por receita**: campos
  tipados por célula A1, validação sobre a grade realmente lida, `output`/`outputValid` ou `OUTPUT_INVALID` com
  problemas por campo; `sheets` (read/write/goto) passou a ser passo de receita. Regra em
  `src/automation/output-schema.js` e `src/automation/recipe-store.js`; teste `test/output-schema.test.js`.
  Instalador `Zero Browser Setup 0.1.11-dev.exe` (SHA-256 `229ee406…a901e2`, 124.454.153 bytes); `app.asar`
  `0d46e9db…b043a` igual em build/produção; integração `status: PASS`; `npm test` 208/208. Backup do 0.1.10-dev em
  `backups/2026-10-28-before-output-schema/`.
- **Checkpoint 11 instalado (2026-10-28):** versão **0.1.12-dev** com **Guardian determinístico** (recusa
  navegação não-HTTP, upload para origem estranha, formulário cross-site, receita de leitura que grava; revisa
  afirmação de efeito sem prova) e **cache de prefixo opt-in** (`promptCache`, `promptCache.cacheHitRate`).
  Instalador `Zero Browser Setup 0.1.12-dev.exe` (SHA-256 `cf33b29d…c53f3f`, 124.456.756 bytes); `app.asar`
  `aee7ee6e…ae91e21` igual em build/produção; integração `status: PASS`; `npm test` 218/218. Backup do 0.1.11-dev
  em `backups/2026-10-28-before-guardian/`.
- **Checkpoint 12 instalado (2026-10-28):** versão **0.1.13-dev** com **tarefa durável** (`JobStore` em disco, TTL
  20 min, aba recriada na retomada, `automation:jobs`), **receitas via MCP** (`recipe_list`/`recipe_run`) e
  **transformação isolada** (`transform` em processo filho com lista negra estática e timeout de 2 s). Instalador
  `Zero Browser Setup 0.1.13-dev.exe` (SHA-256 `0d2ae9b6…6fc03`, 124.459.785 bytes); `app.asar` `3e88f32c…bf6d0e`
  igual em build/produção; integração `status: PASS`; `npm test` 233/233. Backup do 0.1.12-dev em
  `backups/2026-10-28-before-durable-jobs/`.
- **Checkpoint 13 instalado (2026-10-28):** versão **0.1.14-dev** corrigindo o alcance do Guardian: a recusa de
  upload para outra origem vale só quando a tarefa declara URL inicial (run_task/MCP); no uso interativo o upload
  volta a depender apenas da aprovação no diálogo. Instalador `Zero Browser Setup 0.1.14-dev.exe` (SHA-256
  `f0ad77fa…a2467`, 124.459.919 bytes); `app.asar` `24fb5659…570d81f` igual em build/produção; integração
  `status: PASS`; `npm test` 233/233. Backup do 0.1.13-dev em `backups/2026-10-28-before-guardian-upload/`.
- **Checkpoint 14 instalado (2026-10-28):** versão **0.1.15-dev** com painel de conversas (histórico local por
  conversa, seletor, nova conversa, cartão de retomada e memória com TTL de 30 dias), texto do modelo em
  parágrafos/listas/código, módulos de operação (`module save/run/list/forget` no sandbox) e
  `recipe_export`/`recipe_import`. Corrigidos dois bugs reais: `transform` não era oferecido ao modelo e o prompt de
  memória era montado antes de `messages` existir (quebrava toda tarefa com fato guardado). Instalador
  `Zero Browser Setup 0.1.15-dev.exe` (SHA-256 `c9477125…bed1b`, 124.466.370 bytes); `app.asar` `c6909e1a…df33`
  igual em build/produção; integração `status: PASS`; `npm test` 249/249; benchmark difícil **14/14** com o build
  instalado. Backup do 0.1.14-dev em `backups/2026-10-28-before-panel-history/`.
- **Checkpoint 15 instalado (2026-10-28):** versão **0.1.16-dev** atacando “Planilhas lento / 30 ações”:
  `sheets` com `action: "batch"` (até 12 operações, uma única aprovação de escrita), `inspect_page` compacto em
  planilha (título, seleção, abas — sem AX nem innerText) e teto padrão do painel de 30 → 40. Instalador
  `Zero Browser Setup 0.1.16-dev.exe` (SHA-256 `ff3e6aae…bf7b8`, 124.467.439 bytes); `app.asar` `b72f59d3…a411`
  igual em build/produção; integração `status: PASS`; `npm test` 253/253; benchmark 44 e 33 passaram no build
  instalado. Backup do 0.1.15-dev em `backups/2026-10-28-before-sheets-batch/`.
- **Checkpoint 16 instalado (2026-10-28):** versão **0.1.17-dev** após auditoria geral. Corrigidos: pipe MCP sem
  autenticação (token por execução em `<dados>/automation/pipe-token`; `mcp-stdio.js` e bench atualizados),
  `destroy(Error)` que derrubava o processo, retomada sem `id` (botão “Continuar” não agia), Guardian recusando
  `module run` sem `code`, contrato de saída com leitura dentro de `sheets batch` e recursos do agente que nunca
  chegavam ao painel (agora em Configurações → Agente · recursos). Relatório: `docs/AUDITORIA_2026-10-28.md`.
  Instalador `Zero Browser Setup 0.1.17-dev.exe` (SHA-256 `61a9ef50…d61eb`, 124.468.721 bytes); `app.asar`
  `389b4f7c…c36868` igual em build/produção; integração `status: PASS`; `npm test` **260/260**; benchmark 33 e 44
  passaram no build instalado. Backup em `backups/2026-10-28-before-audit/`.
- **Checkpoint 17 instalado (2026-10-28):** versão **0.1.18-dev** fechando os riscos da auditoria: **CSP** em
  `index.html` e `newtab.html`, com o estilo/script da nova aba extraídos para `newtab.css`/`newtab.js` e cores dos
  atalhos em classes; `npm run test:ui` carrega as duas páginas no Electron e falha em qualquer violação de CSP.
  Também: `management.getAll`/`setEnabled` reais nas extensões, cliente WebSocket rejeitando pendências no
  disconnect e remoção do IPC morto `automation:list-tools`. Instalador `Zero Browser Setup 0.1.18-dev.exe`
  (SHA-256 `c659c7a3…36da8`, 124.469.373 bytes); `app.asar` `ab0b381c…1b9f1` igual em build/produção; integração
  `status: PASS`; `npm test` 261/261; benchmark 44 passou. Backup em `backups/2026-10-28-before-csp/`.
- **Checkpoint 18 instalado (2026-10-28):** versão **0.1.19-dev** atacando “para depois de 40 rodadas”: guardião de
  progresso (`src/automation/progress-guard.js`) injeta aviso após 3 rodadas só de leitura, na 5ª manda parar de
  inspecionar e lembra o orçamento no meio/fim; pré-inspeção ligada por padrão no painel (economiza uma rodada por
  tarefa); limite de ações configurável (20/40/60); pausa devolve `toolUse` + último erro na mensagem. Instalador
  `Zero Browser Setup 0.1.19-dev.exe` (SHA-256 `618f6d3d…b9f7`, 124.471.111 bytes); `app.asar` `439fe807…3749`
  igual em build/produção; integração `status: PASS`; `npm test` **269/269**; `test:ui` PASS; benchmark 44 passou.
  Backup em `backups/2026-10-28-before-progress/`.
- **Checkpoint 19 instalado (2026-10-28):** versão **0.1.20-dev** ligando `run_steps` no painel (até 12 passos
  numa rodada, cada um com pós-condição conferida pelo host). Instalador `Zero Browser Setup 0.1.20-dev.exe`
  (SHA-256 `72648c4a…e8680`, 124.471.257 bytes); `app.asar` `6f318904…6d92d` igual em build/produção; integração
  `status: PASS`; `npm test` 269/269; `test:ui` PASS; benchmark 33 e 44 passaram. Backup em
  `backups/2026-10-28-before-runsteps/`.
- **Checkpoint 20 instalado (2026-10-28):** versão **0.1.21-dev** fechando o último risco da auditoria. O
  `pipe-token` no Windows recebe ACL explícita (`icacls /inheritance:r`, `*<SID>:(F)` + SYSTEM) usando
  `System32\whoami.exe`/`icacls.exe`; é gravado só depois que a instância possui o pipe e apagado no `stop()`.
  Instalador `Zero Browser Setup 0.1.21-dev.exe` (SHA-256 `bd606f71…27209c`, 124.472.667 bytes); `app.asar`
  `ba103cba…c0878` igual em build/produção; integração `status: PASS`; `npm test` **273/273**. Conferido no app
  instalado: `icacls` mostra apenas `NT AUTHORITY\SYSTEM` e o usuário. Backup em
  `backups/2026-10-28-before-pipe-acl/`.
- **Publicação (2026-10-28):** `main` em `c13447e` enviado a `origin/main` (26 commits desde 0.1.4); tag
  `motor-pre-leaps-2026-10-27` publicada. Nenhum build/instalador foi anexado a release no GitHub.
- **Primeiras execuções reais (deepseek-flash, 1 por condição):** tarefa 44 padrão 13 passos/13,0 s/47.456 tokens;
  44 `--journal` 18/28,5 s/117.753 (piorou — não promover sem 5 repetições); 33 padrão 12/13,7 s/52.871;
  33 `--scripts` 5/10,3 s/33.065. Todas 1/1. Detalhe e ressalvas em `docs/EVOLUCAO_MOTOR.md`.
- **Checkpoint instalado (2026-10-27):** build com os 11 saltos, `dist\Zero Browser Setup 0.1.5-dev.exe`
  (124.441.875 bytes, SHA-256 `9df4ed8b…a8545f`), instalado sobre o build anterior após `win-unpacked` passar.
  `app.asar` build/instalado: `ae7a6564…0ae96a`; integração do instalado `status: PASS`; `npm test` 177/177 na
  árvore. Backup do estado anterior em `backups/2026-10-27-before-motor-leaps/` (`3658148c…f606401`, 184 arquivos)
  com `LEIA-ME.md`. Perfil não foi tocado. Roteiro de teste em `docs/COMO_TESTAR.md`.
- Continua SEM verificação no app: perfis (menu ⋮), menu de contexto de abas, histórico persistente de downloads,
  atalhos com foco na página e todas as flags opt-in do motor (`--preinspect`, `--scripts`, `--diff`,
  `--cascade=`, `--stream`, `--journal`, `structuredExtraction`, `recipes`).
- Os registros de 2026-10-27 abaixo foram escritos ANTES desta integração e dizem "não commitado / suíte não
  rodada"; o estado vigente é o desta seção.

## Histórico (2026-10-26 e anteriores)

- 2026-10-27 (não commitado, SEM testes a pedido): perfis (menu ⋮ > Perfis: abrir/criar/excluir; processo separado por `ZERO_USER_DATA`; sem renomear), aliases `ZERO_*` (`src/env.js`) e prompt de sistema extraído para `src/automation/service/prompt.js`. Só `node --check` e conferência do texto do prompt foram feitos; `npm test`, `test:electron` e o app NÃO foram rodados. Fase B do nome, `appId`, pipe e o resto da divisão do `AutomationService` seguem pendentes. PRÓXIMO: `npm install` (se faltar) + `npm test`; abrir 2 perfis no app e conferir; depois os A/B das flags.

- 2026-10-27 (commit): histórico de downloads persistente, menu de contexto das abas, clique do meio fecha aba, plano de nome/perfis (`docs/PLANO_NOME_E_PERFIS.md`). Verificação: `npm test` 124/124 (3 execuções seguidas, sem repetir a falha 84/86 antiga), `test:electron` exit 0, `npm audit --omit=dev` zero. NÃO conferido no app: menu de aba, histórico de downloads após reiniciar. NÃO feito: perfis, migração do nome, divisão do `AutomationService`, A/B das flags novas.

- 2026-10-27: implementados opt-in e SEM benchmark: `run_steps` (`--scripts`), snapshot por diferença (`--diff`), cascata (`--cascade=modelo`), streaming (`--stream`, sem execução antecipada). Detalhes e riscos em `docs/EVOLUCAO_MOTOR.md` ("Próximos níveis implementados"). `npm test` 121/121. PRÓXIMO: A/B de cada flag contra a base (difícil, 3 rep, A B B A, `--comparar`); os caminhos dentro de `runAgent` ainda não rodaram no app.

- A/B `--preinspect` RODADO (difícil, 3 rep, A B B A, deepseek-flash): acerto 99% → 100%, chamadas −18%, tempo −21%, tokens não cacheados −14%, passos inconclusivo. Detalhe e ressalvas em `docs/EVOLUCAO_MOTOR.md` ("A/B `--preinspect`"). PRÓXIMO: repetir no conjunto básico, em `reais` e com outro modelo; depois decidir ligar por padrão. A/B de `calculate`/repeat-guard/href/retry contra 0.1.4 segue pendente.

- Sessão de análise (não commitada, testes adiados a pedido): permissão de localização Google só em HTTPS pela origem do pedido; `src/automation/injection-guard.js` (aviso de prompt injection nos resultados de ferramentas, ligado em `service/index.js`); helpers/schemas movidos para `src/automation/service/helpers.js`. Só `node --check` e `test/injection-guard.test.js` foram rodados; `npm test` completo, `test:electron` e benchmark NÃO foram rodados após essas mudanças. Esta cópia não tem `node_modules` (rodar `npm install` antes).
- Também feito (sem rodar a suíte): `src/automation/exfiltration-guard.js` (aprovação para navegação a outro site com dados na URL) e atalhos novos em `src/main/browser-shortcuts.js` + `handleBrowserShortcut` no renderer. Testes novos: `test/exfiltration-guard.test.js` (exige tldts instalado). Não feito: persistir histórico de downloads (hoje só da sessão), menu de contexto de abas, perfis; exigem o app rodando para validar.
- Motor (hipóteses, sem benchmark): retry em 429/5xx, ferramenta `calculate`, `repeat-guard`, href curto no snapshot, métrica `cachedInputTokens`. Detalhes e riscos em `docs/EVOLUCAO_MOTOR.md` (seção "Revisão do motor"). ATENÇÃO: o catálogo mudou de 6.747 para 7.148 bytes (teste atualizado, não rodado). Antes de promover a "seleção contextual de schemas" medir cache: ela pode piorar. Primeiro benchmark pareado: 0.1.4 vs esta versão, comparando `inputTokens - cachedInputTokens`.
- `preInspect` (opt-in, `src/automation/service/index.js` perto do bloco de retomada) e comparador pareado `bench/comparador.js` (`--comparar`). Testes novos escritos e rodados isoladamente: `test/comparador.test.js`, `test/engine-helpers.test.js` (11 passam). VERIFICAÇÃO (2026-10-26, após `npm install`): `npm test` 114/114 em 5 execuções seguidas; `npm audit --omit=dev` zero vulnerabilidades; `npm run test:electron` exit 0 (sem saída, igual ao 0.1.4). Uma primeira execução logo após o install deu 84/86 com 2 falhas que não reapareceram em 5 rodadas (causa não identificada; provável instabilidade de primeira execução, vigiar). Sem teste específico de `preInspect` (o caminho exige aba Electron real). PRÓXIMO PASSO: A/B do CHECKLIST (base x `--preinspect`); exige o app aberto com chave de provedor e gasta tokens reais, por isso aguarda autorização.
- Nome: os usos internos de "navegante" (partição `persist:navegante`, pasta de dados, pipe, `appId`) foram mantidos de propósito; renomear apagaria logins/perfil e quebraria a atualização. Só mudar com plano de migração.
- Próximo: `npm install` + `npm test`; depois os A/B do CHECKLIST (motor). Lacunas de navegador ainda abertas: menu de contexto de abas, histórico de downloads persistente, perfis (precisam do app rodando).

- Revisadas mudanças Antigravity e corrigidos bloqueio de `zero://newtab`, corrida de freeze/unfreeze, allowlist de pop-ups e permissões de extensão truncadas; release 0.1.3 foi publicado anteriormente.
- Para avançar o motor, `tabs.read_batch` agora relata páginas truncadas, falhas, abas omitidas e correspondências encontradas/devolvidas/omitidas. O trace inclui apenas contadores; nenhuma leitura textual foi adicionada às métricas. O prompt orienta o agente a continuar se `coverage.complete` for falso.
- Verificação 0.1.4: `npm test` 94/94; `npm audit --omit=dev` zero vulnerabilidades; `npm run test:electron` exit code 0; build Windows concluído; integração final do executável de produção passou (AX, CUA, configurações, downloads, aprovação/cancelamento e providers mockados).
- Instalação de produção em `%LOCALAPPDATA%\Programs\navegante` informa 0.1.4. SHA-256 final de `app.asar` no build e produção: `B14007B409DFC0ACB2F88F5873C9A9828F3970A264B0DAA8AE249F9464B6ACB9`. Desktop e menu Iniciar apontam para o executável de produção.
- Backup `backups/2026-10-26-before-0.1.4` preserva o executável anterior 0.1.3, atalhos, instalador 0.1.4 e perfil. Perfil e cópia: 7.571 arquivos e 762.275.248 bytes.
- O instalador temporário de validação, por compartilhar o `appId`, substituiu/removeu a instalação anterior; o caminho original foi restaurado instalando o 0.1.4 já validado. Evitar novas instalações isoladas do NSIS antes de planejar esse efeito colateral.
- A alteração do catálogo reduziu o JSON serializado de 6.764 para 6.747 bytes; não equivale a tokens reais e não prova ganho útil. Não há nova medição A/B de acerto, tokens ou latência nesta sessão.
- Release 0.1.4 commitado e enviado a `origin/main` como `e500667`.

## Próximo passo concreto

- Rodar `npm run test:electron` e abrir o app em perfil temporário para conferir o que só existe em teste unitário:
  perfis (abrir/criar/excluir), menu de contexto de abas, histórico de downloads após reiniciar e atalhos com foco
  na página.
- Benchmark pareado 0.1.4 vs 0.1.5-dev no conjunto difícil + básico, medindo `inputTokens - cachedInputTokens`,
  chamadas, passos e tempo com `bench/comparador.js`. A correção de `coverage.complete` precisa ser confirmada no
  modelo: a tarefa 44 deve parar de paginar quando o último trecho vier `complete`.
- A/B isolado de `--scripts` e de `--diff` (um por vez); só promover com acerto igual e custo menor.
- Repetir `--preinspect` no conjunto `reais` e com outro modelo antes de cogitar ligá-lo por padrão.
- Só depois de tudo isso: build, instalador isolado com backup restaurável e, com pedido explícito, push/publicação.

## Limites e bloqueios

- A integração empacotada usa fixtures locais e provider mock; não valida Google Planilhas autenticado, Amazon com conta ou todos os sites complexos.
- Memória persistente entre tarefas continua sem evidência de benefício; o teste de notas anterior aumentou tokens e tempo sem elevar acerto.
- O objetivo de navegador próprio, maior cobertura real e desempenho comprovado segue aberto. Não declarar paridade geral com base em fixtures ou no catálogo compacto.
