# Evolução do motor — evidências e critérios

## Objetivo

Melhorar o motor geral para tarefas com JavaScript, SPA, controles recriados, múltiplas abas, arquivos, planilhas e editores. Reduzir tokens e tempo preservando ou ampliando a taxa de acerto. Amazon e Google Planilhas foram exemplos do usuário, não fronteiras do produto.

## Evidências de 2026-10-25

Todos os relatórios abaixo usam deepseek-flash/DeepSeek. Tempos variam com o provedor; uma rodada isolada não estabelece ganho estável.

| Rodada em `bench/resultados` | Acerto | Entrada | Tempo médio | Decisão |
|---|---:|---:|---:|---|
| `codex-base__2026-10-26T01-00-54-214Z` | 14/14 | 480958 | 11,3 s | Referência |
| `codex-after__2026-10-26T01-04-38-198Z` | 14/14 | 492980 | 11,8 s | Vetores/deduplicação sem ganho; removidos |
| `codex-packed__2026-10-26T01-09-02-757Z` | 14/14 | 526798 | 13,4 s | Colunas pioraram métricas; removidas |
| `codex-final__2026-10-26T01-12-56-210Z` | 13/14 | parcial | 54,4 s | Timeout no43; investigado |
| `codex-upload-diagnostico__2026-10-26T01-26-54-224Z` | 2/3 | conferir JSON | conferir JSON | Falha reproduzida na ferramenta de abas |
| `codex-abas-arquivos-fix__2026-10-26T01-30-37-675Z` | 6/6 | 259726 | 14,2 s | 41/43/44, duas repetições após fix |
| `codex-concise__2026-10-26T01-32-39-716Z` | 14/14 | 465521 | 12,1 s | Descrições menores, ~3,2% menos entrada; sem ganho de velocidade |
| `codex-spa-stress__2026-10-26T01-35-51-621Z` | 2/2 | conferir JSON | conferir JSON | Fixture45 com estado independente |

## Evidências de 2026-10-26

Todos os pares abaixo usaram deepseek-flash no perfil dev, em sequência. Na época dessas rodadas, `observeAfterActions` estava desligado por padrão. São amostras pequenas; justificam ampliar a avaliação, não uma alegação de desempenho geral.

| Rodada em `bench/resultados` | Acerto | Entrada | Passos médios | Tempo médio | Resultado |
|---|---:|---:|---:|---:|---|
| `codex-concise-reais-26__2026-10-26T09-32-13-590Z` | 8/8 | 310982 | 4,3 | 10,2 s | Smoke público sem observação |
| `codex-observe-reais-26__2026-10-26T09-33-37-068Z` | 8/8 | 249488 | 3,8 | 8,4 s | Mesmo conjunto; -19,8% entrada e -17,6% tempo nesta rodada |
| `codex-stress-baseline-45-46__2026-10-26T09-35-19-122Z` | 4/4 | 195045 | 11,5 | 17,9 s | Duas repetições de cada SPA, estado registrado independentemente |
| `codex-stress-observe-45-46__2026-10-26T09-36-33-100Z` | 4/4 | 135419 | 8,0 | 12,9 s | Mesmo conjunto; -30,6% entrada, -30,4% passos e -27,9% tempo nesta amostra |
| `codex-dificeis-final-base-26__2026-10-26T09-39-22-667Z` | 14/14 | 491496 | 8,6 | 13,4 s | Conjunto difícil completo, sem observação |
| `codex-dificeis-final-observe-26__2026-10-26T09-42-31-792Z` | 13/14 | 416556 | 7,1 | 11,4 s | Uma falha de soma no CSV (659,95 em vez de 660,00); não promover ainda |
| `codex-task42-baseline-repeat__2026-10-26T09-45-33-324Z` | 3/3 | 43590 | 4,0 | 7,3 s | A mesma soma passou nas três repetições sem observação |
| `codex-task42-observe-repeat__2026-10-26T09-45-57-091Z` | 3/3 | 44623 | 4,0 | 7,7 s | A mesma soma passou nas três repetições com observação |

Cada conjunto público foi rodado uma vez, sem randomização; latência e respostas do provedor variam. Na comparação difícil completa, o modo com observação foi 14,6% mais rápido e usou 15,2% menos tokens de entrada, mas falhou numa soma que passou 3/3 vezes em repetições isoladas dos dois modos. O caso indica variabilidade de precisão do modelo e mantém a promoção bloqueada até repetição de todo o conjunto. A fixture46 exercita busca com debounce, respostas fora de ordem, filtros, rerender e aprovação. Fixtures 45 e 46 medem classes genéricas de SPA, mas não equivalem a sites públicos ou frameworks de produção.

A deduplicação do texto histórico só remove texto quando a string inteira aparece literalmente no snapshot atual; texto exclusivo permanece. O ganho incremental dessa mudança ainda não foi isolado.

## Correções mantidas

- Continuação no limite com histórico em memória; chaves não são guardadas na sessão. O browser é lido novamente na retomada. Limites: 30min e 8 sessões; reiniciar o aplicativo perde a sessão.
- Propriedade de abas: a execução pode revisitar abas que já adotou, mantendo bloqueio sobre abas de outra execução.
- Anexos em nova aba: a aba nasce vazia, recebe a política e propriedade do agente e então navega. `loadURL` pode falhar antes de `will-download`; essa ordem é tratada. Downloads com redirecionamento também são cobertos. A tarefa volta à origem, sem ler documento inexistente.
- Descrições das 17 ferramentas reduzidas de 2486 para 1482 caracteres, mantendo schemas, controles e regras.
- Diagnóstico opcional `NAVEGANTE_AGENT_DIAGNOSTICS`: somente tarefas `local-fixture`; registra nomes de etapas, número do passo, tabId e horário, sem página, texto digitado ou chave. `trace.stage` mostra a última etapa concluída/iniciada.

## Observação pós-ação

`observeAfterActions` agora é padrão. O benchmark desliga com `--no-observe`; `--observe` permanece como forma explícita de habilitar.

Depois da última ação de um lote, uma leitura pode devolver `nodes` e `text` atualizados na mesma resposta. Não inspeciona entre ações do lote, nem depois de hover/digitação, nem em always-ask. Novas abas, pedidos de arquivo e downloads pulam a observação. A leitura usa o mesmo gate de `inspect_page`; falha de leitura preserva evidência da ação; recusa explícita interrompe.

Critério: comparar por tarefa, provedor e conjunto, conferindo acerto, chamadas de modelo, tokens e tempo. A amostra atual (28 difíceis, 8 públicas e 3 da loja SPA por modo) passou de 37/39 para 39/39, com redução agregada de 21,0% nos tokens de entrada, 19,5% nos passos e 18,1% no tempo. O ganho é promissor, mas ainda precisa de repetição no conjunto básico e em outros modelos.

## Revisão do motor em 2026-10-26 (leitura de código, sem benchmark novo)

Mudanças feitas, todas SEM medição pareada; tratar como hipóteses até rodar o benchmark:

- Nova tentativa em 429/500/502/503/504 (até 3 chamadas, espera de `Retry-After` ou 1,5 s × tentativa). Antes, um erro passageiro do provedor encerrava a tarefa. Corpo HTML de erro não quebra mais a leitura. Ganho esperado: acerto em horários de limite de taxa; nenhum em condições normais.
- Ferramenta `calculate` (`src/automation/calculator.js`): aritmética exata com BigInt, sem `eval`, para somas e totais. Alvo: o erro de soma 659,95 vs 660,00 da rodada difícil. Custo: +401 bytes de schema por chamada (6.747 para 7.148). Se o benchmark não mostrar ganho de acerto, remover.
- `src/automation/repeat-guard.js`: na 2ª falha idêntica (mesma ferramenta e argumentos) o resultado leva `avisoRepeticao`. Alvo: laços de tentativa repetida que consomem passos.
- `href` acima de 160 caracteres vai para o modelo só com origem+caminho (`hrefTruncated`). Alvo: páginas de loja com links de rastreamento. Os nodes completos continuam no host, então aprovações não mudam. Risco: o modelo precisar de um parâmetro de consulta do link.
- Métrica nova `cachedInputTokens` (trace e `requestMetrics`), lida de `prompt_cache_hit_tokens`, `prompt_tokens_details.cached_tokens` ou `cache_read_input_tokens`.

Achados sem mudança de código:

- Os tokens de entrada contam o prompt inteiro a cada passo. Sistema + 17 schemas somam ~2,3 mil tokens fixos por passo, mais da metade de uma tarefa curta. Eles formam o prefixo estável e, com cache de prefixo no provedor, custam uma fração. Por isso a "seleção contextual de schemas" do próximo passo do HANDOFF pode PIORAR custo e latência: trocar o conjunto de ferramentas muda o prefixo e invalida o cache. Só promover se `cachedInputTokens` mostrar que o provedor usado não faz cache.
- Medir antes: comparar `inputTokens - cachedInputTokens` (e não só `inputTokens`) nas rodadas de benchmark. A tabela acima usa tokens brutos e pode subestimar ganhos de cache e superestimar ganhos de compactação.
- O tempo é dominado pelas chamadas ao modelo (~3 a 10 s cada). Esperas fixas de 150 a 250 ms após ações somam ~1 s por tarefa (cerca de 8%). Trocar por espera de estabilidade do DOM é possível, mas arrisca flakiness em SPA; só com a fixture 45/46 rodando.
- Cada ação protegida executa `detectHumanCheck` (um `executeJavaScript`) e `setAuroraActive` (outro). São milissegundos, irrelevantes frente ao modelo.
- `rect` de cada nó (4 números × até 250 nós) segue indo ao modelo; só ajuda `cua_action`. Rodada anterior com colunas compactadas piorou, então não mexi. Candidato a teste A/B: enviar `rect` só quando a tarefa usar coordenadas.

## Snapshot inicial e comparador pareado (2026-10-26)

Feito, ainda sem benchmark:

- `preInspect` (opção de `runAgent` e de `run_task`; `--preinspect` no benchmark). Antes da primeira chamada ao modelo o host executa `inspect_page` e entrega o resultado como se o modelo tivesse pedido, no mesmo formato da retomada de tarefa pausada. Hipótese: poupa 1 de cada 4 a 8 chamadas ao modelo (~20% de tempo e de tokens em tarefas curtas). Desligado por padrão (os testes atuais e o fluxo do painel ficam como estão) até haver A/B.
  - Só roda com página http(s) já aberta, `allowTools` verdadeiro, fora de `always-ask` (a leitura geraria diálogo) e sem `captureReadEvidence` (a tarefa 44 conta leituras do modelo). Se a leitura falhar, o fluxo normal segue.
  - Passa pelo mesmo detector de prompt injection; entra no trace como `preInspected: true` e como uma chamada `inspect_page` no passo 0.
  - Risco: perde pouco quando o modelo precisaria navegar antes (página inicial irrelevante). Nesses casos o snapshot extra custa tokens sem poupar chamada. Medir a taxa de tarefas que começam com `navigate`.
  - Para promover a padrão: A/B com `--preinspect` contra a base, mesmo modelo, 3 repetições do conjunto difícil, acerto sem piora e "chamadas ao modelo" com leitura "B menor".
- `bench/comparador.js` + `--comparar`: comparação pareada com intervalo de confiança, incluindo tokens não cacheados. Testes em `test/comparador.test.js`. Uso e leitura em `bench/README.md`.

### Roteiro das próximas evoluções (ordem por retorno esperado)

Nenhuma implementada. Cada uma só vira padrão após A/B com o comparador.

1. Roteiro de várias ações verificado pelo host. O modelo devolve uma lista de ações com pós-condições (texto esperado, valor do campo); o host executa tudo e só volta ao modelo se alguma falhar. Ganho esperado: 2x a 3x menos chamadas em formulários e fluxos repetitivos. Riscos: ações dependentes de índices que mudam; SPA que recria controles (usar seletores por texto/rótulo, não índice); aprovações `confirmConsequentialAction` continuam por ação. Validar com as fixtures 45 a 47.
2. Cascata de modelos: modelo barato e rápido por padrão; escala para o melhor quando `repeat-guard` dispara, houver falha de verificação ou ambiguidade. Medir custo e acerto por tarefa antes.
3. Snapshot só com diferenças e índices estáveis (item aberto do CHECKLIST). Diferente da deduplicação de texto que não ajudou: aqui o alvo são os nodes, o maior bloco do snapshot. Exige id estável por elemento entre leituras.
4. Executar ferramentas enquanto o modelo ainda gera (streaming). Ganho menor, depende do provedor.
5. Não priorizar: memória de receitas por site (o teste de notas aumentou tokens e tempo sem ganho de acerto); só reconsiderar para sequências já verificadas e repetidas.

Pré-requisito comum: rodadas A/B repetidas, em mais de um modelo, com ordem alternada. Sem isso as decisões acima seguem sendo hipóteses.

## A/B `--preinspect` (2026-10-26)

Base (A) contra `--preinspect` (B), conjunto difícil (14 tarefas), 3 repetições por rodada, ordem A1, B1, B2, A2, modelo `deepseek-flash`, app iniciado do worktree com o perfil padrão. Relatórios em `bench/resultados/` (A1-base, B1-preinspect, B2-preinspect, A2-base). A1+A2 e B1+B2 foram juntadas (6 repetições por tarefa) e comparadas com `--comparar`.

Acerto: A 83/84 (99%), B 84/84 (100%). Nenhuma tarefa piorou; a 36-menu-hover foi de 5/6 para 6/6 (uma falha isolada na A1, provavelmente variação do modelo, não efeito do preinspect). Em B, o snapshot foi entregue em 39 de 42 execuções por rodada (a tarefa 44 não usa, por capturar evidência de leitura).

| Métrica (média por tarefa) | A | B | Variação | IC 95% (B−A) | Leitura |
|---|---:|---:|---:|---|---|
| Passos | 6,86 | 6,51 | −5,0% | −0,87 a 0,18 | inconclusivo |
| Tempo (s) | 12,04 | 9,46 | −21,4% | −4,06 a −1,09 | B menor |
| Chamadas ao modelo | 6,77 | 5,55 | −18,1% | −1,74 a −0,72 | B menor |
| Tokens de entrada brutos | 29.864 | 24.790 | −17,0% | −8.143 a −2.006 | B menor |
| Tokens de entrada não cacheados | 5.221 | 4.490 | −14,0% | −1.289 a −173 | B menor |
| Tokens de saída | 688 | 523 | −24,0% | −283 a −48 | B menor |

Consistência entre rodadas: tempo médio por execução A1 12,6 s e A2 11,4 s; B1 9,4 s e B2 9,5 s. A ordem A B B A não mostrou deriva grande, e as duas rodadas B ficaram praticamente iguais entre si.

Leitura honesta: o ganho de uma volta ao modelo (a que só pediria `inspect_page`) apareceu em chamadas, tempo e tokens, com acerto igual ou melhor. Ressalvas: 14 tarefas pareadas, intervalo por aproximação normal (otimista), um único modelo e provedor, só páginas locais; o ganho de tokens não cacheados (−14%) é menor que o dos brutos porque parte da economia já era cache. Passos ficou inconclusivo, como esperado (a ação inicial é do host, não do modelo). Não foi testado em sites públicos (`--conjunto=reais`) nem no conjunto básico.

Decisão: candidato forte a ligar por padrão, mas ainda não promovido. Falta repetir no conjunto básico e em `reais` e com outro modelo. Antes de promover, revisar o risco de página que muda após o carregamento (o snapshot pode ficar velho) e o custo quando a página inicial é grande.

## Próximos níveis implementados, sem medição (2026-10-27)

Quatro mecanismos, todos opt-in e desligados por padrão (o caminho padrão não muda). Cada um tem flag no benchmark e campo em `run_task`. Verificação até aqui: `node --check`, `test/engine-evolution.test.js` (7 testes dos módulos puros) e `npm test` 121/121. NÃO houve benchmark: ganho de acerto, tokens ou tempo de qualquer um deles é hipótese.

| Mecanismo | Flag do bench / campo | Módulo | O que faz |
|---|---|---|---|
| Script de ações | `--scripts` / `actionScripts` | `src/automation/action-script.js` | Ferramenta `run_steps`: até 12 passos (click, type_text, select_option, click_text, hidden_action, hover, wait_for) numa chamada. O host executa em ordem, cada passo passa pela aprovação normal, e para na primeira falha, aba nova, download ou página que mudou os índices. Depois a observação automática traz o snapshot. |
| Snapshot por diferença | `--diff` / `diffSnapshots` | `src/automation/snapshot-diff.js` | Após uma ação, manda só os nodes que mudaram (comparação por índice) e as faixas iguais. Se mudou mais de 40% dos nodes, houve deslocamento de índices ou a lista é pequena (<12), manda o snapshot inteiro. Base inteira fica no histórico e no máximo 3 diffs a seguem. |
| Cascata de modelos | `--cascade=MODELO_BARATO` / `cascadeModel` | `src/automation/model-cascade.js` | Modelo barato conduz; sobe para o modelo escolhido após 2 falhas seguidas ou 1 repetição detectada; volta ao barato após 3 acertos. Mesmo provedor e histórico. `trace.cascade` e `requestMetrics[].model` mostram o uso. |
| Streaming | `--stream` / `streaming` | `src/automation/stream-parser.js` | Lê a resposta em SSE e remonta o mesmo formato da não-streaming; registra `firstTokenMs` e usa limite de 45 s sem dados em vez de cortar tudo em 60 s. |

Limites honestos:
- Streaming: a execução antecipada das ferramentas (começar a agir enquanto o modelo ainda escreve) NÃO foi implementada. O leitor já avisa quando cada chamada fecha (`onToolCall`), mas o corpo do loop precisa ser extraído para uma função antes de usar isso, e o ganho só existe em turnos com várias chamadas. Hoje o streaming só dá `firstTokenMs` e tolerância a gerações lentas, não velocidade.
- Diff: o modelo precisa juntar base e diffs de cabeça; é o ponto de risco de acerto. O fallback para snapshot inteiro e o limite de 3 diffs reduzem, não eliminam. Só vale se o A/B mostrar acerto igual.
- Cascata: depende de o modelo barato falhar de forma visível (erro de ferramenta ou repetição). Erro silencioso (agir errado com sucesso) não escala. Medir acerto antes de confiar.
- `run_steps`: índices dentro do lote valem como no último snapshot; passos após um clique que muda a DOM sem navegar podem agir em alvo errado (a checagem por nome/identidade AX de `click`/`type_text` ainda protege cada passo).
- Testes novos cobrem só os módulos puros; os caminhos dentro de `runAgent` (diff, cascata, `run_steps`, streaming) exigem o app e ainda não foram exercitados.

Plano de medição (cada um contra a base, conjunto difícil, 3 repetições, A B B A, `--comparar`): `--scripts`, `--diff`, `--cascade=<modelo barato>`, `--stream`; depois combinações com `--preinspect`.

## Cobertura ainda necessária

### Memória e preenchimento repetido

O experimento `memoria-antes__2026-10-26T00-40-06-409Z` usou a tarefa44 sem notas: 3/3, 13 passos em média, 130692 tokens de entrada e 12,7 s. Com notas de tarefa, `memoria-depois__2026-10-26T00-42-57-221Z`: 3/3, 21 passos, 241411 tokens e 20,3 s. A taxa de acerto não mudou; as notas custaram 84,8% mais tokens de entrada e 59,8% mais tempo nessa amostra. `memoria-b__2026-10-26T00-47-42-531Z` também não mostrou vantagem consistente. A ferramenta foi removida.

O código atual mantém o contexto da mesma tarefa quando o usuário clica em Continuar e resume respostas antigas grandes. Não há memória persistente de perfil entre tarefas. Esse teste de notas não mede uma memória pessoal pequena e seletiva, então não prova que toda memória seja ruim.

Uma futura memória de perfil deve salvar fatos confirmados, registrar origem/escopo/data, recuperar apenas itens relevantes e permitir edição/exclusão. Não deve memorizar índices antigos da página nem credenciais/pagamento. Deve orientar o preenchimento, seguido de reinspeção do formulário atual e verificação do valor preenchido. Retrieval local seletivo não precisa de uma chamada extra ao modelo; o texto recuperado ainda consome tokens quando enviado ao provedor.

### Preenchimento de formulários: falha reproduzida e correção

Nos relatórios, `02-formulario-contato` falhou em `duelo-navegante__2026-10-25T16-52-51-105Z`: os valores de nome/e-mail/mensagem já estavam no pedido, mas o agente entrou num ciclo de consultas e não selecionou o assunto `<select>` antes do limite de ações. Uma tentativa anterior (`primeira__2026-10-25T15-17-07-888Z`) passou. É falha de interação com o controle, não esquecimento dos dados.

Corrigido `locator_action` com `action: fill` em `<select>`: agora procura opção pelo texto visível ou pelo `value`, seleciona com setter nativo e eventos `input`/`change`, identifica o controle por ID interno estável durante a ação e verifica o valor selecionado. A identidade não é enviada ao modelo, evitando tokens extras. A tarefa de contato passou **3/3** em `codex-contato-select-fix-26__2026-10-26T09-53-57-918Z` (7 passos, 8,8 s em média). O cadastro com CPF, data e telefone passou **3/3** em `codex-cadastro-validacao-fill-26__2026-10-26T09-54-35-588Z` (16 passos, 22,9 s). Esses resultados validam as fixtures locais, não os mesmos formulários em sites de produção.

Na revisão de privacidade, uma senha sem rótulo não aparecia no campo `value`, mas o snapshot ainda incluía o HTML inteiro por `formAction` resolvido ao URL `data:`. O snapshot agora oculta o conteúdo de URLs `data:` e remove query/hash da URL exposta ao modelo; `formAction` só é enviado como origem+caminho de um formulário real. O URL interno completo continua sendo usado para invalidar snapshots após navegação. A fixture Electron verifica senha rotulada e não rotulada, identidade estável após reordenação e seleção nativa. `npm run test:electron` passou; `npm test` passou 71/71; `npm run test:agent-download` passou.

Também foi corrigido o direcionamento de `click`/`type_text` quando controles com rótulos idênticos mudam de ordem; a ação usa identidade do nó inspecionado e falha se o elemento foi substituído. Campos ocultos em iframe/shadow DOM classificam códigos e dados de pagamento por `type`, `autocomplete` e `name`; tarefas locais não podem preencher automaticamente esses campos. O snapshot agora omite valores sensíveis e mantém a identidade do alvo interna.

As falhas passadas em `33-validacao-erros` estavam concentradas em execuções Flame/timeout; as execuções mais recentes do Zero Browser e as 3 repetições atuais passaram com os valores exatos do gabarito. Memória de perfil não é correção para os problemas de `<select>`, campo duplicado ou timeout.

### Regressões de locators, preenchimento e loja SPA 47

Uma auditoria independente encontrou que um locator de mutação podia selecionar silenciosamente o primeiro entre vários campos e que `type_text` reportava sucesso apenas por disparar eventos. Agora ações mutáveis (`click`, `dblclick`, `fill`, `type`, `press`, `scrollIntoView`) falham com a contagem quando há múltiplos matches; consultas como `count` continuam retornando todos. O `type_text` de AX devolve `actionExecuted` e `outcomeVerified`; espera dois frames para detectar um campo controlado que reverte o valor, sem expor o valor lido. O resolver `role` também foi corrigido: comparava uma string como se fosse elemento DOM e lançava exceção.

A tarefa 47 acrescenta uma loja SPA determinística em localhost: busca com debounce e respostas fora de ordem, filtros de categoria/marca/preço, modal de variante e quantidade e carrinho persistido num endpoint de estado separado. O verificador exige SKU, variante, quantidade, preço/subtotal e todas as etapas; mensagem de sucesso sem carrinho válido reprova. A integração Electron percorre o fluxo por locators sem chamar um modelo. É uma aproximação controlada de e-commerce, não uma afirmação sobre a Amazon.

No benchmark do modelo (DeepSeek Flash), tarefa 47 sem observação: **2/3**, média 25,7 passos, 42,3 s, 365315 tokens de entrada; com observação: **3/3**, média 17,3 passos, 26,9 s, 207947 tokens. A falha sem observação atingiu limite de passos após índices de controles ficarem obsoletos em rerenders. A observação usou 43 chamadas ao modelo em vez de 65, e 748903 bytes de request contra 1953680. Tokens de entrada caíram 43,1%, passos 32,7% e tempo 36,4% nesta amostra.

Comparação pareada agregada das execuções atuais (mesmo conjunto e contagem por modo: 28 difíceis locais em 2 repetições, 8 smoke públicos em 1 repetição, 3 repetições da tarefa 47): sem observação **37/39**, 1617740 tokens de entrada, 344 passos e 560752 ms; com observação **39/39**, 1278337 tokens, 277 passos e 459197 ms. Reduções ponderadas observadas: 21,0% entrada, 19,5% passos e 18,1% tempo. Nos difíceis, o único erro sem observação foi soma de extrato (R$ 659,72 em vez de R$ 660,00); com observação o conjunto passou 28/28. No smoke público, ambos passaram 8/8. São resultados de amostra pequena, sequencial e de um provedor/modelo; não garantem outras contas ou sites.

Com essa evidência, a observação automática foi habilitada por padrão nas ações suportadas. O benchmark aceita `--no-observe` para controle experimental. Continuar medindo em todo o conjunto básico e noutros modelos antes de declarar ganho geral.

As métricas de request agora registram apenas bytes (request total, mensagens, schemas de ferramentas e snapshot atual), sem guardar texto. Num formulário 02, schema de ferramentas ocupou 6403 bytes em cada uma das seis chamadas. Isso é um indicador, não contagem de tokens do schema; próximo experimento deve medir efeito de schemas reduzidos antes de alterar catálogo.

As oito tarefas de sites públicos atuais são smoke externo, com verificadores que em alguns casos dependem da resposta/URL final. Não comprovam comportamento geral em sites complexos. As fixtures próprias têm verificação por estado, mas não substituem sites externos.

Próximas provas precisam cobrir sites públicos com scripts, editores/planilhas, listas virtualizadas e resultado conferido independentemente do texto do agente. As tarefas públicas atuais são smoke simples e em geral verificam a resposta/URL, não uma alteração persistida num sistema complexo. Autenticação/CAPTCHA são condições distintas de falha do motor. Nenhuma compra ou publicação deve servir de teste.

Ainda pendentes: pausa manual/takeover, recuperação de resultado incerto sem duplicar ações, aprovação por risco e aceitação do instalador atual. O objetivo amplo permanece aberto.

### Busca direcional com despertar por mutação DOM

O caminho `scroll` foi separado em `src/automation/scroll-search.js`. Depois de cada movimento, ele observa mutações na página e procura o alvo após um intervalo curto; se a página não o carregar, mantém o fallback de 850 ms por etapa, os limites de 12 etapas/12 s e a detecção de fim de lista. Não adiciona chamadas ao modelo nem texto ao prompt.

Na integração Electron, uma fixture com resultado inserido depois de 320 ms encontrou em **480 ms**, na primeira etapa; o caso com resultado inserido depois de 1.100 ms passou pelo limite de espera e encontrou na etapa seguinte. `npm run test:electron` e `npm test` (85/85) passaram.

O teste real do agente na tarefa 48, com DeepSeek Flash, passou **5/5**, média 12,4 passos, 28,13 s e 103.462 tokens de entrada. A amostra anterior registrada passou 3/3, média 12,3 passos, 26,5 s e 102.027 tokens. Portanto, não há ganho geral demonstrado: a rodada atual ficou 6,2% mais lenta e usou 1,4% mais tokens, dentro de uma amostra pequena sujeita à latência do provedor. A melhoria só reduz espera quando a página revela o alvo antes do teto; precisa de comparação pareada por cenário antes de ser promovida como ganho global.

### Sites públicos reais e regressão difícil — 2026-10-26

`public-sites-progressive__2026-10-26T17-58-06-182Z` passou **12/12** numa rodada com DeepSeek Flash: busca e leitura na Wikipédia, catálogo/paginação de livros, carregamento lento, nova janela, POST de demonstração, carrinho JS, TodoMVC React, tabela paginada e controle assíncrono. Média de 4,4 passos, 12,7 s e 484.987 tokens de entrada. Os casos que alteraram estado de demonstração confirmaram a limpeza externa. São sites públicos e demos sem conta; não cobrem Planilhas autenticadas nem compras.

`hard-regression-current-scroll__2026-10-26T18-00-50-708Z` passou **27/28** em duas rodadas (736.833 tokens, 6,3 passos, 11,3 s). A falha não foi de rolagem: a tarefa 44 registrou corretamente a transferência, mas numa das duas execuções deixou de ler Centro. Repetida isoladamente três vezes, a tarefa 44 passou 3/3 e confirmou as seis filiais, em média 12 passos, 12,1 s e 115.945 tokens. A falha continua relevante porque prova variabilidade; a reprodução curta não substitui a repetição da suíte toda.

O trace provou que o modelo abriu cinco filiais e confundiu a página inicial (um índice sem resultado) com a sexta fonte. `tabs.read_batch` agora devolve cobertura de páginas com/sem correspondências e o trace distingue páginas lidas de páginas com correspondências; testes unitários cobrem índice + cinco resultados e seis resultados. Uma instrução global mais estrita foi testada e revertida após 2/3, sem benefício demonstrado. O benchmark posterior também ficou 2/3 e, na falha, não chamou `read_batch`; portanto o novo resumo ainda precisa de validação real no modelo. Resultados: `stock-multitab-readbatch__2026-10-26T18-08-26-469Z.md` e `stock-multitab-coverage-hint__2026-10-26T18-12-17-329Z.md`.

Na revisão seguinte, foi identificado que o lote ainda podia parecer completo apesar de limites silenciosos: até seis abas, 12.000 caracteres de fonte, oito linhas de correspondência, 240 caracteres por linha e 600 caracteres retornados. Em 0.1.4, cada página informa `truncated`/`truncationReasons`; `coverage` resume falhas, abas omitidas e correspondências encontradas/devolvidas/omitidas, e o trace mantém esses contadores sem registrar texto da página. O agente recebe uma instrução curta para continuar a leitura quando `coverage.complete` é falso. Testes cobrem truncamento de fonte, falha, linhas omitidas e abas não lidas. A execução anterior observou o tamanho serializado do catálogo em 6.764 bytes e a revisão compactou a descrição em 17 bytes (6.747); isso é apenas bytes do JSON, não tokens faturados nem evidência de redução relevante. Ainda falta um A/B com modelo real para demonstrar efeito em acerto, tokens e latência.

### Registry de ferramentas inspirado no Browsentic — 2026-10-26

O catálogo estático enviado pelo agente foi extraído para `src/automation/tools/agent-tool-registry.js`, seguindo a ideia de registry único do Browsentic. A mudança mantém as 17 ferramentas, schemas e descrições sem alteração; o JSON serializado continua com 6.764 bytes por request. Teste de contrato fixa a lista, esse tamanho e o isolamento entre execuções. A extração facilita experimentar schemas compactos ou exposição sob demanda, mas por si só não economiza tokens.

O registro MCP permanece separado: tem nomes, schemas Zod, handlers e gates de aprovação próprios. Fundi-lo mecanicamente com o catálogo do modelo poderia mudar validação e permissões. Próximo passo é A/B pareado de schemas compactos/exposição seletiva com catálogo completo como fallback, cobrindo formulários/SPA, rolagem/grades, visual, arquivos e múltiplas abas. Promover apenas se a taxa de acerto não cair e tokens reais/latência melhorarem de forma repetível.

Browsentic `main` consultado declara Apache-2.0 no v0.9.0 e informa no README que versões até 0.7.15 eram MIT. Esta alteração não copia código e não muda a licença MIT do Zero. Se arquivos Apache forem portados no futuro, fixar o commit e manter avisos de copyright, licença e NOTICE aplicáveis, além de indicar os arquivos modificados.

### Cobertura de leitura em lote: correção de semântica — 2026-10-27

Contexto: a paginação do `read_batch` (offsets para abas e para texto) entrou com um defeito de sinal. Toda
continuação era marcada como truncada porque começava num offset maior que zero, e uma leitura pedida por `tabId`
contava as outras abas da tarefa como omitidas. Com isso `coverage.complete` era sempre falso, inclusive no último
trecho — o prompt mandava continuar e a resposta nunca confirmava o fim.

Regra adotada:

- `truncated` (por página) descreve **o que ainda falta**: texto depois da janela de 600 caracteres ou
  correspondências ainda não alcançadas;
- `matchesOmitted` soma apenas o que resta **depois** da janela atual, não o que já foi entregue em trechos
  anteriores;
- `tabsOmitted` existe só no modo lista; `tabId` não omite as outras abas;
- `complete` mantém a definição estrita (sem falha, sem página truncada, sem aba omitida, sem correspondência
  omitida) e agora fica `true` no fim de uma paginação bem-sucedida.

Evidência desta sessão: 3 testes novos em `test/batch-coverage.test.js` e 4 asserções em
`test/batch-pagination.test.js` (último trecho `complete`, `nextContentOffset` ausente, intermediários incompletos,
`tabsOmitted` zero). `npm test` 127/127 após a integração.

O que isso NÃO prova: que o modelo para de paginar quando recebe `complete: true`, ou que o número de chamadas
cai. É uma correção de sinal, não um ganho medido. A confirmação exige a tarefa 44 (seis filiais) com o comparador
pareado, registrando passos, chamadas e tokens — pendente porque depende do app aberto e de chave de provedor.

Relação com o histórico acima: as rodadas de 0.1.4 registraram cobertura incompleta como sinal de "leia o resto",
o que era correto na intenção e falso na prática. O trace continua guardando só contadores, sem texto de página.

### Pós-condições em `run_steps` — 2026-10-27

Primeiro salto do motor depois da integração 0.1.5-dev, ainda **opt-in** (`actionScripts` / `--scripts`). Antes,
`run_steps` considerava um passo bem-sucedido quando a ferramenta respondia sem erro: clicar num botão desabilitado
ou num controle que re-renderiza sem efeito passava como sucesso. Agora o modelo pode declarar o **efeito esperado**
e o host confirma antes de seguir.

Formato do passo:

```json
{ "tool": "click", "args": { "index": 12 },
  "expect": { "text": "Pedido salvo", "absent": "Salvando…" } }
```

- `url`: prefixo que a URL deve ter depois do passo (cobre navegação e redirect).
- `text`: texto que deve aparecer no texto visível, comparado sem acento, sem caixa e com espaços normalizados.
- `absent`: texto que não pode mais estar na página.

Semântica:

- a verificação é feita **pelo host**, lendo a aba atual, a cada 120 ms por até 3 s;
- se a pós-condição não vier, a resposta marca `actionExecuted: true` e `outcomeVerified: false`, registra
  `failedExpectation` com o motivo e **não executa os passos seguintes**;
- passo com `expect` e sem verificador disponível é recusado **antes** de qualquer ação;
- o trace ganha `scriptExpectationFailures` (contador), sem guardar texto da página.

Arquivos: `src/automation/expectation.js` (avaliação pura), `src/automation/action-script.js` (espera e parada),
`src/automation/service/index.js` (verificador na aba atual + prompt). Testes: `test/action-script-expectations.test.js`
(6 casos: normalização, prefixo de URL, texto ausente, validação, polling até passar e falha que interrompe).
`npm test` 133/133.

O que **não** foi feito: nenhum A/B, nenhuma medição de chamadas economizadas, e nenhum reparo automático. Se a
pós-condição falhar, o roteiro para e devolve o motivo; quem decide o próximo passo ainda é o modelo. A próxima
evolução natural é o journal de efeitos: registrar a intenção consequente, verificar se ela já aconteceu e impedir
envio duplicado após falha ou reinício.

### Journal de efeitos e idempotência — 2026-10-27

Segundo salto, também **opt-in** (`effectJournal` em `run_task`, `--journal` no benchmark). O problema: uma ação
consequente (enviar, comprar, publicar, navegar) podia ser repetida depois de timeout, falha ou reinício, porque o
agente não tinha como saber se o efeito já tinha acontecido.

Como funciona:

- antes de despachar uma ação consequente, o host grava `attempted` no journal (arquivo
  `<dados>/automation/efeitos.json`, escrita atômica) — se o processo cair, a tentativa fica registrada;
- sucesso confirma a entrada (`confirmed`): repetir a mesma ação devolve `alreadyDone` e **não** despacha;
- falha de efeito desconhecido (timeout, erro do site) mantém `attempted`: a próxima repetição devolve
  `needsVerification` e **não** despacha até o modelo reler a página;
- leitura bem-sucedida (`inspect_page`, `see_page`, `wait_for`, `tabs` de leitura) marca as tentativas como
  `retryable` — repetir passa a ser permitido, uma vez, com evidência nova;
- erro claramente anterior ao efeito ("Element not found", índice inexistente, página mudou) descarta a tentativa;
- entradas expiram em **30 minutos** e o arquivo guarda no máximo 300; reiniciar não herda confirmação antiga.

Chave: `sha256(ferramenta + alvo + origem+caminho)`, sem texto digitado e sem query string. Alvo é `targetId` do
snapshot, texto do `click_text`, nome do controle oculto, URL de navegação ou nome do arquivo.

Arquivos: `src/automation/effect-journal.js` (journal, armazenamento, plano e liquidação), `service/index.js`
(integração no laço de ferramentas + prompt) e `bench/avaliar.js` (`--journal`). Testes: `test/effect-journal.test.js`
(8 casos, incluindo persistência entre instâncias, arquivo corrompido, expiração e um `run_task` completo com
bloqueio → leitura → repetição → `alreadyDone`). `npm test` 141/141.

Limites honestos:

- `confirmed` também bloqueia uma repetição **legítima** da mesma ação em 30 min (adicionar o mesmo item duas vezes).
  O resultado avisa para conferir a página; é o preço de não duplicar envio, e o recurso é opt-in.
- `hidden_action` usa o nome do controle como alvo; dois controles homônimos na mesma página colidem.
- A prova de efeito é a resposta da ferramenta, não a rede. Um POST que falha silenciosamente e devolve sucesso
  ainda seria confirmado.
- Sem benchmark: nenhuma medição de quantas duplicações evita ou de quanto custa.

Próximo passo natural: usar a pós-condição do `run_steps` como prova de efeito para confirmar o journal — hoje são
dois mecanismos separados.

### Risco por capacidade — 2026-10-27

Terceiro salto. A decisão de pedir aprovação saiu de uma regex única no serviço e virou classificação em módulo
(`src/automation/risk.js`), com nível e motivo:

| Nível | Exemplos | Efeito |
|---|---|---|
| `credential` | `type=password`, `autocomplete=cc-number`, `name=otp`, rótulo "Senha" | sempre pede aprovação; nunca é aprovado por política de tarefa |
| `destructive` | excluir, apagar, remover, cancelar, revogar, sair | pede aprovação |
| `commitment` | comprar, pagar, finalizar compra, enviar, publicar, assinar | pede aprovação |
| `write` | salvar, atualizar, confirmar, cadastrar | pede aprovação |
| `none` | "Ver detalhes", "Voltar", "Meus pedidos", "Minha conta" | segue o modo do usuário |

Precedência: credencial > destrutivo > compromisso > escrita. `isSubmitControl` e `formMethod=post` viram
`commitment` com o motivo "Envio de formulário" quando nenhum termo casa.

Mudanças de comportamento deliberadas:

- **menos falso positivo**: "conta" e "pedido" sozinhos deixaram de pedir aprovação (antes "Minha conta" e
  "Meus pedidos" pediam); "cancelar" continua destrutivo, porque cancelar pedido/assinatura é irreversível;
- **motivo mais útil no diálogo**: "Ação destrutiva: excluir", "Ação de compromisso: finalizar compra",
  "Alteração de dados: salvar" em vez do genérico "Ação consequente identificada pelo controle da página";
- limites de palavra passaram a valer ("ExcluirItem" não casa com "excluir");
- o motivo do modo ("Sempre perguntar", "Permitir leitura") saiu para `approvalReasonForMode`.

Arquivos: `src/automation/risk.js`, uso em `src/automation/service/index.js` (CUA, AX e teclado).
Testes: `test/risk-classification.test.js` (7 casos) e o contrato de aprovação em `test/startup.test.js` atualizado.
`npm test` 148/148.

Limites honestos: continua sendo classificação **lexical** de nome/href/action, não semântica; um botão "Prosseguir"
num checkout não é reconhecido, e "Atualizar" num filtro ainda pede aprovação. Não há medição de falso
positivo/negativo em matriz de controles reais, e o nível ainda não muda a política além de exigir ou não aprovação
— o próximo uso natural do nível é permitir, no modo "Permitir leitura", leituras e escritas reversíveis sem abrir
diálogo.

### Verificação final por contrato — 2026-10-27

Quarto salto. Até aqui, "concluído" era o que o modelo dizia (ou o verificador do benchmark, fora do app). Agora o
chamador declara o que deve ser verdade ao terminar e o **host** confere:

```json
"verify": [
  { "kind": "url",       "value": "https://loja.test/pedido/ok" },
  { "kind": "text",      "value": "Pedido confirmado" },
  { "kind": "absent",    "value": "Erro" },
  { "kind": "textCount", "value": "Filial", "min": 6, "max": 6 },
  { "kind": "download",  "value": "relatorio.csv" }
],
"requireVerification": true
```

- `url` compara por prefixo; `text`/`absent` e `textCount` usam texto visível normalizado (sem acento/caixa);
  `textCount` aceita `min`/`max`; `download` exige arquivo concluído **da própria tarefa**, por nome base.
- O resultado ganha `verification: {ok, results[]}` com o motivo de cada checagem — sem texto de página no trace,
  só `trace.verification = {ok, failed:[kinds]}`.
- Com `requireVerification: true`, contrato não satisfeito devolve `success: false` com o motivo. Sem a flag, a
  verificação só informa e o resultado do agente continua valendo.
- Contrato inválido é recusado antes de ler a página.

Arquivos: `src/automation/task-verifier.js` (avaliação pura), `service/index.js` (`verifyTask` + opções do
`run_task`) e schema do MCP. Testes: `test/task-verifier.test.js` (5 casos, incluindo um `run_task` que aprova,
recusa e apenas informa). `npm test` 153/153.

Limites honestos:

- A verificação roda **no fim** da tarefa; o modelo não tem ferramenta para consultá-la durante a execução e não
  recebe a falha para corrigir sozinho — quem decide repetir é o chamador.
- Prova é textual/estrutural: um "Pedido confirmado" na tela não prova que o servidor persistiu. Prova de rede
  (resposta observada) continua fora.
- `textCount` depende do texto renderizado; listas virtualizadas contam só o que está no DOM.
- Sem benchmark: nenhuma medição de acerto ou de falsos "concluído" evitados.

Próximo passo natural: devolver a falha ao agente com direito a uma rodada de correção, e usar o mesmo contrato
para confirmar efeitos do journal (hoje a prova de efeito é só a resposta da ferramenta).
