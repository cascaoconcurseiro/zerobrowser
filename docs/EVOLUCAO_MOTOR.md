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

### Correção após verificação — 2026-10-27

Quinto salto: fecha o ciclo **agir → provar → corrigir**. Antes, a verificação final só informava (ou recusava) no
fim; agora, com `correctionRounds` (0–3), a falha volta ao agente ainda dentro da tarefa.

Como funciona:

- ao receber uma resposta final, o host confere o contrato (`verify`) na aba atual;
- se falhar e ainda houver rodada, o agente recebe uma mensagem de usuário com **apenas o motivo de cada checagem**
  ("texto ausente: Pedido confirmado", "URL atual … não começa com …") — nunca o texto da página — e continua;
- o laço gasta uma chamada de modelo por rodada e respeita `maxSteps`, tempo máximo e aprovações normais;
- esgotadas as rodadas, o resultado carrega `verification.ok=false`; com `requireVerification`, a tarefa é recusada;
- `trace.verificationRetries` conta as rodadas usadas; `trace.verification` guarda só `{ok, failed:[kinds]}`;
- sem `correctionRounds` (padrão 0) nada muda: verifica no fim e informa.

Correção de um defeito da versão anterior: a recusa por `requireVerification` só era aplicada quando a verificação
acontecia **depois** do laço. Agora ela vale também quando o próprio laço já verificou e devolveu o veredito — teste
cobre os dois caminhos.

Arquivos: `src/automation/service/index.js` (`runAgent` verifica na resposta final, injeta a correção e devolve
`verification`; `runTask` reaproveita o veredito e aplica `requireVerification`). Testes:
`test/task-verifier.test.js` (7 casos, incluindo rodada de correção que muda a página e esgotamento). `npm test`
155/155.

Limites honestos:

- O agente só descobre a falha **ao tentar concluir**; não existe ferramenta para consultar o contrato no meio da
  tarefa.
- Cada rodada custa uma chamada inteira ao modelo; `correctionRounds` acima de 1 raramente compensa sem medir.
- A mensagem de correção expõe o valor esperado da checagem (parte do contrato), não o conteúdo lido da página.
- Sem benchmark: não há medição de quantos "concluído" falsos foram corrigidos nem do custo em tokens.

### Verificação como prova de efeito — 2026-10-27

Sexto salto: liga o journal ao contrato de verificação. Antes, uma ação que falhava no meio do caminho ficava
`attempted` para sempre (até expirar), mesmo quando a tarefa terminava com o estado correto. Agora:

- quando o contrato final **passa**, o host confirma todas as tentativas pendentes da tarefa
  (`journal.confirmAttempted({proof:'task-verification'})`) — o estado final é a prova de que os efeitos
  aconteceram;
- quando o contrato **falha** (ou não existe), as tentativas continuam `attempted`: repetir exige leitura da página;
- cada entrada confirmada por prova ganha `proof: 'task-verification'`; o trace registra `effectProofs` (contagem);
- sem `effectJournal` nada muda.

Também corrigido: a recusa por `requireVerification` valia só no caminho em que a verificação acontecia depois do
laço; agora vale também quando o próprio laço verifica — os dois caminhos têm teste.

Arquivos: `src/automation/effect-journal.js` (`confirmAttempted`), `service/index.js` (confirmação no fim do laço e
no `runTask`). Testes: `test/effect-journal.test.js` (10 casos; o novo prova com contrato satisfeito e deixa
`attempted` com contrato falho). `npm test` 157/157.

Lacuna conhecida e registrada: **ações consequentes dentro de `run_steps` ainda não passam pelo journal** — o laço
do agente journaliza a chamada `run_steps`, não cada passo interno. Enquanto os dois estiverem ligados, um envio
duplicado dentro de um roteiro não é bloqueado. O próximo salto é injetar o gate por passo (`beforeStep`/`afterStep`
no `runSteps`) reutilizando a mesma chave de efeito.

### Gate do journal dentro de `run_steps` — 2026-10-27

Sétimo salto e fechamento da lacuna registrada no salto 6: ações consequentes dentro de um roteiro `run_steps` não
passavam pelo journal, então um envio duplicado em lote não era bloqueado. Agora cada passo consulta o mesmo gate.

- `runSteps` aceita `beforeStep(step, i)` e `afterStep(handle, step, output)`;
- `beforeStep` devolve `{skip}` (ação já confirmada), `{block}` (efeito desconhecido) ou `{handle}` para o journal;
- `skip` mantém o roteiro andando e o resultado do passo vem `alreadyDone: true`;
- `block` **não despacha nada** e interrompe o roteiro com `blockedEffect: true` e o motivo;
- `afterStep` recebe o handle e o resultado — inclusive falha devolvida e exceção (inclusive `USER_DENIED`);
- o serviço usa a mesma chave de efeito do laço principal (ferramenta + alvo + origem/caminho) e registra
  `scriptEffectSkips` / `scriptEffectBlocks` no trace.

Arquivos: `src/automation/action-script.js` (hooks e semântica), `src/automation/service/index.js` (ligação com
`planEffect`/`settleEffect`). Testes: 3 novos em `test/action-script-expectations.test.js` (skip, block, settle de
falha/erro) e 1 de integração em `test/effect-journal.test.js` (dois cliques idênticos no lote → um despacho e um
`alreadyDone`). `npm test` 161/161.

Limites honestos:

- `skip` conta como passo concluído para o roteiro; se o efeito já confirmado era o último passo, a tarefa segue.
- O `block` interrompe o lote inteiro, mesmo que os passos seguintes fossem independentes — é conservador de
  propósito, para não executar nada depois de um efeito incerto.
- `hidden_action` continua identificado pelo nome do controle (homônimos colidem).
- Sem benchmark: nenhuma medição de duplicações evitadas em lote real.

### Extração estruturada (agente como ETL) — 2026-10-27

Oitavo salto e a primeira capacidade de **produto** além de automação: em vez de copiar texto da tabela para o
modelo reformatar (e errar), o host extrai a grade e o modelo só declara o schema.

Ferramenta `extract_table` (opt-in, `structuredExtraction`; só aparece no catálogo quando ligada):

```json
{ "selector": "#estoque", "tableIndex": 0, "columns": ["produto", "estoque"], "maxRows": 100 }
```

- escolhe a tabela por `selector` ou `tableIndex` (padrão 0, entre as `<table>` com linhas);
- cabeçalho vem de `thead` ou da primeira linha; `columns` é casado por nome normalizado (sem acento/caixa);
  coluna pedida e ausente vira campo vazio e entra em `missingColumns` — sem deslocar as outras;
- células são aparadas, linhas vazias e duplicadas são descartadas (`duplicatesSkipped`);
- devolve `{url, columns, rows, returned, totalRows, duplicatesSkipped, missingColumns, truncated, tableCount}` — a
  URL é a proveniência; `totalRows`/`truncated` dizem se falta ler mais;
- o trace guarda só `tableCalls` e `tableRows` (contagem), nunca célula.

Arquivos: `src/automation/table-extractor.js` (validação, mapeamento, formatação e script), uso em
`service/index.js` (ferramenta condicional + prompt). Testes: `test/table-extractor.test.js` (7 casos, incluindo a
ferramenta desligada recusando e um `run_task` que extrai duas linhas reais). `npm test` 168/168.

Limites honestos:

- Uma tabela por chamada e **sem paginação automática**: quem decide ler a próxima página é o modelo, com
  `totalRows`/`truncated` em mãos.
- `rowspan`/`colspan` não são resolvidos; a grade é lida célula a célula.
- Só `<table>`: listas de cards, grades virtualizadas e `div` com `role=table` ainda exigem `read_batch`/texto.
- Sem benchmark: nenhuma medição de acerto linha a linha contra extração por texto.

### Consulta do contrato no meio da tarefa — 2026-10-27

Nono salto e fechamento do limite do salto 5: o agente só descobria a falha ao tentar concluir. Agora, quando a
tarefa tem contrato (`verify`), o catálogo inclui `check_task`:

- sem argumentos, lê a aba atual e devolve `{ok, results[]}` com o motivo de cada checagem;
- é somente leitura; não altera página, journal nem aprovações;
- `ok: false` volta como **resultado normal** (não como erro), para o modelo corrigir antes de encerrar;
- sem contrato, a ferramenta não aparece no catálogo e a chamada é recusada com motivo;
- `trace.verifyChecks` conta as consultas; nenhum texto de página entra no trace.

Arquivos: `src/automation/task-verifier.js` (`CHECK_TASK_TOOL`), `service/index.js` (catálogo condicional, handler e
prompt). Testes: 2 novos em `test/task-verifier.test.js` (consulta com contrato satisfeito/falho e recusa sem
contrato). `npm test` 170/170.

Limites honestos:

- A consulta gasta uma chamada de modelo (a do turno em que o modelo a pede) e uma leitura de página; em páginas
  grandes isso tem custo.
- O contrato continua sendo o do chamador; o modelo não pode inventar critérios novos em tempo de execução.
- A prova segue textual/estrutural, não de rede.

### Extração estruturada em paralelo entre abas — 2026-10-27

Décimo salto. `tabs read_batch` passou a aceitar `extract` e vira ETL paralelo: uma chamada lê a mesma tabela nas
abas da tarefa (mesma origem), com uma linha por aba e proveniência.

```json
{ "action": "read_batch",
  "extract": { "columns": ["produto", "estoque"], "maxRows": 100 } }
```

- por aba: tabela escolhida por `selector`/`tableIndex`, colunas casadas por cabeçalho, células aparadas, linhas
  vazias/duplicadas descartadas (`duplicatesSkipped`);
- resposta por aba: `{tabId, url, columns, rows, returned, totalRows, duplicatesSkipped, missingColumns, truncated}`;
- agregados da chamada: `rowsReturned`, `rowsTotal`; `coverage.complete` já considera aba omitida e `truncated`;
- motivos de truncamento por aba: `remaining_rows` (limite de linhas) e `missing_columns` (coluna pedida ausente);
- trace ganha `batchTables` e `batchRows` (contagens, sem célula);
- continua valendo o limite de 6 abas por chamada, com `nextTabOffset`/`tabVersion` para as demais;
- `contentOffset` é recusado no modo estruturado (não há texto para paginar).

Arquivos: `src/automation/service/index.js` (modo `extract` dentro de `read_batch`), catálogo em
`src/automation/tools/agent-tool-registry.js` (schema `extract`; JSON passou de 7.329 para 7.815 bytes) e prompt.
Testes: `test/batch-extract.test.js` (3 casos: duas abas, coluna ausente e argumento de texto recusado).
`npm test` 173/173.

Limites honestos:

- Só tabelas `<table>` e só abas da mesma origem já adotadas pela tarefa; listas de cards ficam de fora.
- Sem deduplicação entre abas: a mesma linha em duas filiais aparece duas vezes, com `tabId`/`url` diferentes.
- Sem benchmark de acerto/custo; o catálogo maior custa bytes em toda chamada mesmo quando ninguém extrai tabela.

### Receitas verificadas por site — 2026-10-27

Décimo primeiro salto, último item de código da fila do motor: uma sequência estável pode ser gravada e repetida
**sem modelo**, com pós-condição obrigatória em cada passo.

Ferramenta `recipe` (opt-in `recipes`; só aparece com a flag):

```json
{ "action": "save", "name": "finalizar-pedido", "steps": [
  { "tool": "navigate",   "args": { "url": "https://loja.test/carrinho" },
    "expect": { "url": "https://loja.test/carrinho" } },
  { "tool": "click_text", "args": { "text": "Finalizar compra" },
    "expect": { "text": "Pedido confirmado" } }
] }
```

- `list` mostra as receitas da origem atual; `save` valida e grava; `run` executa na aba atual.
- Só passos **estáveis**: `navigate`, `click_text`, `wait_for` — nada de índice de snapshot, que muda a cada leitura.
- `expect` é obrigatório em todo passo; a execução para no primeiro que não confirmar e informa qual.
- Cada passo passa por `confirmConsequentialAction` (navegação e clique) e nada é gravado sem origem HTTP/HTTPS.
- Armazenamento atômico em `<dados>/automation/receitas.json`, por origem, no máximo 50 por origem e 200 no total.
- `trace.recipeSteps` conta passos executados; `recipeFailures`/`recipeRuns` registram falha e uso.

Arquivos: `src/automation/recipe-store.js` (validação, armazenamento e schema), `service/index.js`
(`runRecipe`, ferramenta condicional e prompt). Testes: `test/recipe-store.test.js` (4 casos: validação, persistência,
origem e execução com falha de pós-condição). `npm test` 177/177.

Limites honestos:

- Não há captura automática: quem grava é o modelo (ou o chamador), então uma receita ruim pode ser salva se a
  tarefa não tiver sido verificada antes.
- Sem preenchimento de campo (digitação exige índice/identidade de snapshot); receitas cobrem navegação, clique por
  texto e espera.
- Os passos da receita **não passam pelo journal de efeitos**; um clique repetido numa receita não é bloqueado.
- Sem versão nem expiração: a receita quebra quando o site muda e falha na pós-condição, sem reparo automático.
- Sem benchmark de tempo/tokens economizados.

### Canal alternativo: clipboard e teclado — 2026-10-27

Décimo segundo salto, atacando a classe de sites que o snapshot não enxerga (canvas). Duas ferramentas novas:

- **`clipboard`** (`read`/`write`): lê e grava texto no clipboard do sistema; `write` exige aprovação, `read` é
  limitado a 200 mil caracteres e volta marcado como conteúdo não confiável. Implementação injetada pelo processo
  principal (`electron.clipboard`); sem ela, a ferramenta recusa.
- **`key_sequence`**: combinações com repetição (setas ×N, Tab, Ctrl+seta, F2, Enter), até 50 passos/200 combinações,
  via CDP, com keydown/keyup e modificadores corretos. Enter/espaço passam pelo gate de aprovação; navegação não.

Opt-in por tarefa (`advancedInput`, padrão **ligado**). Quando ligado, o catálogo cresce de 7.815 para 8.835 bytes
(~+250 tokens por chamada) — o custo fixo é o preço de resolver planilha sem 60 cliques; pode ser desligado em
`run_task`/`runAgent`.

O prompt ganhou a instrução de fluxo: caixa de nome → intervalo → `clipboard write` TSV → `key_sequence Ctrl+V`;
leitura por seleção + `Ctrl+C` + `clipboard read`.

Arquivos: `src/automation/clipboard.js`, `src/automation/key-sequence.js`, `cua-input.js` (`performKeySequence`),
`service/index.js` e `main.js` (injeção do clipboard). Testes: `test/clipboard-keysequence.test.js` (4 casos,
incluindo um `run_task` que grava TSV, lê de volta e executa 3 combinações). `npm test` 181/181.

Limites honestos:

- Clipboard é texto: fórmulas, formatação e comentários não sobrevivem.
- Células mescladas podem desalinhar o TSV; conferir depois de colar.
- A caixa de nome é localizada por texto/label; idioma da interface muda o alvo.
- Ler o clipboard pode trazer segredo copiado antes — é dado sensível, não instrução.
- Sem benchmark: o ganho de 10–50× em ações é estimativa até medir numa planilha de teste.

### Grounding visual e acessibilidade da planilha — 2026-10-27

Décimo terceiro salto, fechando o que faltava do canal para canvas sem depender de API.

- **`visual_click`**: clica em coordenadas **normalizadas 0–1000** do viewport, estimadas pelo modelo a partir da
  última `see_page`. O host converte para pixels com o tamanho atual do viewport (imune a DPR), executa o clique real
  e pode conferir `expect {url,text,absent}` com espera de até 3 s. Pede aprovação (é clique cego por definição) e
  registra `visualClicks`/`visualExpectationFailures` no trace.
- **`sheets_accessibility`**: alterna o modo de acessibilidade do Planilhas (Ctrl+Alt+Z) para tentar expor células
  no snapshot; só funciona em `docs.google.com/spreadsheets` e devolve instrução para inspecionar depois. Se não
  expuser, o fluxo cai para clipboard/teclado.

Ambos entram com `advancedInput` (padrão ligado) e o prompt explica quando usar.

Arquivos: `src/automation/visual-click.js`, `src/automation/sheets.js`, `service/index.js`. Testes:
`test/visual-sheets.test.js` (4 casos: validação/mapa, restrição de domínio, clique convertido e verificado,
teclas do Planilhas). `npm test` 185/185.

Limites honestos:

- `visual_click` depende de o modelo **enxergar** a captura; sem visão, ele chuta. A precisão é a da estimativa, não
  há detecção automática de elemento na imagem.
- O modo de acessibilidade do Planilhas **não foi verificado numa conta real**: pode não expor a grade, depender de
  versão/idioma ou alterar o layout. Por isso ele só sugere, nunca assume.
- Coordenadas são do viewport visível; elemento fora da tela exige rolar antes.

### Primeiras execuções reais depois dos saltos — 2026-10-27

Primeira vez que a árvore com todos os saltos rodou com modelo real (deepseek-flash, provedor configurado pelo
usuário) no benchmark local. **Uma execução por condição**, sem pareamento nem repetição: serve para detectar
regressão grosseira, não para concluir ganho.

| Execução | Acerto | Passos | Tempo | Tokens entrada | Chamadas |
|---|---:|---:|---:|---:|---:|
| 44-estoque-filiais, padrão | 1/1 | 13 | 13,0 s | 47.456 | 7 |
| 44-estoque-filiais, `--journal` | 1/1 | 18 | 28,5 s | 117.753 | 18 |
| 33-validacao-erros, padrão | 1/1 | 12 | 13,7 s | 52.871 | 10 |
| 33-validacao-erros, `--scripts` | 1/1 | 5 | 10,3 s | 33.065 | 6 |

Leitura:

- **`--scripts` (run_steps + pós-condições) mostrou o maior sinal**: −58% passos, −37% tokens de entrada,
  −40% chamadas e −25% tempo na tarefa de formulário, mantendo 1/1. É exatamente o mecanismo esperado (uma chamada
  executa vários campos e cada passo é conferido).
- **`--journal` piorou nesta execução**: +5 passos, +2,2× tempo e +2,5× tokens na tarefa 44, ainda passando. Hipótese
  principal: o bloqueio por efeito desconhecido forçou releitura/retentativa; hipótese alternativa: variação do
  modelo (a tarefa 44 já alternou entre 12 e 16 passos em rodadas anteriores). **Não promover o journal como padrão**
  antes de 5 repetições pareadas; se o custo se repetir, restringir o journal a ações de envio/compra e não a
  qualquer clique.
- O clique visual e o modo de acessibilidade não foram exercitados nestas execuções (não há tarefa de planilha no
  corpus local); continuam sem validação real.

Arquivos de evidência em `bench/resultados/`: `visual-check__*`, `journal-check__*`, `scripts-base__*`,
`scripts-check__*`.

### Journal estreitado a efeito crítico — 2026-10-27

A execução real de 44 com `--journal` (18 passos, 28,5 s, 117.753 tokens contra 13/13,0 s/47.456) mostrou que o
journal estava caro demais: ele cobria **todo** clique, inclusive abrir aba, filtrar e navegar. Bloqueio por "efeito
desconhecido" nesses cliques força releitura sem proteger nada.

Correção:

- `isConsequential` agora exige **nível de risco crítico** (`commitment`, `destructive` ou `credential`) para clique,
  `click_text` e `hidden_action`; upload e tecla Enter continuam cobertos;
- **navegação saiu do journal** — visitar de novo não duplica efeito;
- o nível vem de `classifyRisk` com o nó do snapshot (nome/href/tipo), então "Enviar pedido" entra e "Filtrar" não;
- `classifyRisk` passou a aceitar nó nulo sem lançar.

Isso preserva a proteção onde importa (envio/compra/exclusão/credencial) e remove o custo de ações comuns. A medição
pareada 5×5 está registrada abaixo (ou pendente, se o build ainda não tiver rodado).

#### Medição 5×5 depois do estreitamento (2026-10-28)

Tarefa 44, deepseek-flash, 5 repetições por condição, mesma máquina e mesmo app instalado
(`bench/resultados/par-base-5__*` e `par-journal-5__*`):

| Métrica | Base | Journal | Variação |
|---|---:|---:|---:|
| Acerto | 5/5 | 5/5 | 0 |
| Passos | 17,4 | 14,6 | **−16,1%** |
| Tempo | 17,1 s | 16,5 s | −3,1% |
| Chamadas ao modelo | 10,6 | 9,0 | **−15,1%** |
| Tokens de entrada | 371.023 | 333.574 | **−10,1%** |
| Tokens não cacheados | 11.766 | 10.523 | −10,6% |

O comparador marca "inconclusivo" porque há **uma tarefa** pareada (o IC é degenerado), então isto não é prova
estatística. O que a medição mostra com clareza é que a regressão desapareceu: antes o journal custava +5 passos e
+2,5× tokens; agora ele acompanha ou melhora a base, mantendo 100%.

Conclusão prática: o journal pode continuar **opt-in** sem medo de custo, e a decisão de ligá-lo por padrão ainda
exige o conjunto difícil completo (14 tarefas) e outro modelo.

### Receitas v2: entradas, placeholders e `possibleCommit` — 2026-10-28

Inspirado no que o Pomerado chama de integração (“mint”): uma operação determinística com schema de entrada e
semântica explícita de falha. Não copiamos código, só o desenho.

- `recipe save` aceita `input` (schema com `properties` de tipo string/number/boolean e `required`);
- passos e pós-condições podem usar `{{campo}}`; `recipe run` recebe `values`, valida obrigatórios e substitui sem
  alterar a receita guardada;
- falha **depois** de um passo despachado (navegação, clique) devolve `possibleCommit: true` e
  `readBeforeRetry`, mandando ler a página antes de repetir; `wait_for` e clique cujo texto não foi encontrado
  devolvem `possibleCommit: false`;
- `list` mostra quantas entradas cada receita exige.

Exemplo:

```json
{ "action": "save", "name": "buscar", "input": {
    "properties": { "termo": { "type": "string" } }, "required": ["termo"] },
  "steps": [
    { "tool": "navigate", "args": { "url": "https://site.test/busca" },
      "expect": { "text": "Buscar" } },
    { "tool": "click_text", "args": { "text": "{{termo}}" },
      "expect": { "url": "https://site.test/resultado" } }
  ] }
```

Rodar: `{ "action": "run", "name": "buscar", "values": { "termo": "cadeira" } }` — sem modelo.

Arquivos: `src/automation/recipe-store.js` (schema, substituição, metadados), `service/index.js` (save/run e
`possibleCommit` em `runRecipe`). Testes: `test/recipe-store.test.js` (5 casos; schema inválido, obrigatório
ausente, substituição sem mutar a receita, commit possível). `npm test` 186/186.

Limites honestos:

- Continua sem **captura automática** (o mint do Pomerado escreve módulos sozinho); aqui quem salva é o modelo.
- Não gera código por site: a receita é uma lista de passos estáveis, não um módulo com lógica.
- Sem autenticação própria: login continua sendo sessão da aba, e credencial só é digitada quando o modelo pede.
- `possibleCommit` é conservador (navegação/clique contam como possível), não prova de efeito.

### Mint automático e módulo de Planilhas — 2026-10-28

Fechando o que faltava do modelo do Pomerado sem copiar a stack deles.

**Mint automático (`saveRecipe` no `run_task`):** quando a tarefa termina com contrato de verificação aprovado e usou
`run_steps` só com passos estáveis (`navigate`, `click_text`, `wait_for`) e `expect` em todos, o host grava a receita
sozinho na origem atual. O resultado devolve `minted: {name, steps, origin}` ou `mintSkipped` com o motivo (sem
contrato, sem run_steps estável, nome inválido, origem inválida). O modelo não precisa chamar `recipe save`.

**Ferramenta `sheets`:** módulo determinístico do Planilhas. `read`, `write` e `goto` por intervalo A1, usando a
caixa de nome (DOM), `insertText`, Enter e clipboard — sem clicar em célula. `write` pede aprovação e cola TSV;
`read` seleciona, copia (Ctrl+C) e devolve `values/rows/columns/cells/truncated`; `goto` só seleciona. Se a caixa de
nome não existir na página, devolve erro orientando `sheets_accessibility`/`visual_click`.

Arquivos: `src/automation/sheets-tool.js`, `service/index.js` (ferramenta e mint). Testes: `test/sheets-tool.test.js`
(5 casos, incluindo escrita+leitura de TSV com clipboard e teclado reais simulados) e `test/mint.test.js` (2 casos).
`npm test` 194/194.

Limites honestos:

- O mint só grava o que já é estável; tarefa que usou clique por índice não vira receita (fica `mintSkipped`).
- A ferramenta `sheets` depende do DOM da caixa de nome; idioma/layout diferente pode exigir o fallback visual.
- Continua sem Guardian (revisor de ação), sem credencial com escopo de origem e sem nome acessível do Playwright —
  os três próximos itens do Pomerado que ainda não estão aqui.

### Credencial com escopo de origem e autoridade de receita — 2026-10-28

Dois P0 inspirados no Pomerado, implementados sem copiar código.

**Credencial com escopo de origem.** O host passa a comparar a origem da página com a origem de envio do formulário
(`formAction`) quando o alvo é campo sensível (senha/OTP/cartão). Regra:

- envio para a **mesma origem** da página: permitido, com a aprovação normal;
- envio para **outra origem**: recusado **antes de digitar**, mesmo com aprovação automática;
- exceção explícita: origens listadas em `authenticationOrigins` no `run_task` (ex.: `https://login.provedor.com`),
  copiadas para as abas que a tarefa adotar;
- campo não sensível não é afetado.

O `formAction` vem do snapshot AX (type_text/set_value/paste) e da inspeção por ponto (CUA). **Lacuna conhecida:**
`hidden_action` em campo sensível não expõe formulário; continua só com aprovação.

**Autoridade de receita.** `authority: read|write` no `recipe save`:

- `read` aceita apenas `navigate` e `wait_for`; `click_text` é recusado no save **e** na execução;
- `write` permite clique;
- `list` mostra a autoridade de cada receita.

Arquivos: `src/automation/service/index.js` (checagem de origem e mapa `taskAuthOrigins`, autoridade no save/run) e
`src/automation/recipe-store.js`. Testes: `test/credential-origin.test.js` (3 casos: cross-origin recusado sem
dispatch, mesma origem/allowlist liberados, campo comum intacto) e autoridade em `test/recipe-store.test.js`.
`npm test` 198/198.

Limites: a verificação depende de `formAction` estar no snapshot; um formulário montado por script que envia para
outro host depois do preenchimento não é detectado por esta regra (só a de exfiltração por URL cobre parte). O
Pomerado também revisa o código final; isso continua pendente (Guardian).

### Diagnóstico da ferramenta `sheets` — 2026-10-28

Antes de continuar adivinhando o que falha no Planilhas, a ferramenta passou a devolver `diagnostics` em toda
chamada: `nameBoxFound`, `selector`, `typed`, `selection` (valor lido da caixa de nome depois do Enter) e
`rangeApplied`. Falhas ganham código: `NAME_BOX_NOT_FOUND` (seletor não casou) e `CLIPBOARD_EMPTY` (Ctrl+C não
trouxe nada). Se `insertText` não existir ou falhar, há fallback pelo setter nativo.

O objetivo é que o próximo teste numa planilha real diga **onde** parou, em vez de “horrível”. Testes: 6 em
`test/sheets-tool.test.js`. `npm test` 199/199.

### Nome acessível padrão (accname) — 2026-10-28

Primeiro item da fase de precisão. O snapshot AX e o `locator_action` deixaram de usar a heurística
(aria-label/labels/alt/title/placeholder/innerText) e passaram a calcular o nome na ordem do algoritmo W3C:

1. `aria-labelledby` (ids em ordem, ignorando alvo oculto, com proteção contra ciclo);
2. `aria-label`;
3. rótulo nativo (labels de input, `alt` de imagem, `value` de input button/submit/reset);
4. `title`;
5. `placeholder`;
6. conteúdo (para button, link, heading, tab, option etc.);
7. valor de campo de texto (nunca em campo sensível).

Implementação própria inspirada na especificação (`src/automation/accessible-name.js`), **sem copiar** o arquivo do
Playwright; por isso não há obrigação de NOTICE Apache. O nome é injetado nos scripts de página como função
autocontida. Testes: `test/accessible-name.test.js` (3 casos: precedência, fallbacks e ciclo/oculto). `npm test`
202/202.

Limites: não implementa o cálculo completo de “name from content” com exclusão de descendentes ocultos nem
`aria-describedby`; cobre a maioria dos controles reais. CSS `display:none` só é considerado quando há
`defaultView` (no navegador, sim).

### Contrato de saída por receita — 2026-10-28 (0.1.11-dev)

Segundo item da fase de precisão, e o que ataca o “devolve texto solto, às vezes errado”. A receita passa a poder
declarar `output`: cada campo aponta para **uma célula A1** e um tipo (`string`, `number`, `boolean`, `array`).
No `recipe run`, o host guarda a última leitura feita por um passo `sheets read` (grade TSV + intervalo) e valida
os campos sobre essa grade — nunca sobre o que o modelo diz ter lido.

- Conversão numérica no padrão brasileiro: `R$ 1.234,56` → `1234.56`, `1.234` → `1234`, `1,5` → `1.5`, `(12)` → `-12`.
- Booleano: `sim/não`, `true/false`, `1/0`, `verdadeiro/falso`; lista: quebra de linha, `;` ou `,`.
- Célula vazia não vira `0`: campo `number` obrigatório falha; `string`/`array` viram `''`/`[]`.
- Contrato quebrado → `success: false`, `code: OUTPUT_INVALID`, `problems` por campo. Não há valor inventado.
- `sheets` entrou como passo determinístico (`read`/`write`/`goto`), então uma receita pode “abrir a planilha,
  ler A1:C3 e devolver 3 campos” sem nenhum modelo no caminho.
- Autoridade continua valendo: receita `read` recusa `sheets write` (assim como recusa `click_text`).

Arquivos: `src/automation/output-schema.js`, `src/automation/recipe-store.js`, `src/automation/service/index.js`
(método `sheetsAction` extraído para ser reutilizado pela ferramenta e pelo runner). Testes:
`test/output-schema.test.js` (6 casos, incluindo `runRecipe` com leitura stub e contrato inválido). `npm test`
208/208.

Limites: o contrato só vale para o que veio de `sheets read`; para HTML genérico ainda não existe schema de saída
(próximo passo é validar sobre `extract_table`). Não há tipagem de data nem de moeda separada de número.

### Guardian determinístico e cache de prefixo opt-in — 2026-10-28 (0.1.12-dev)

**Guardian** (`src/automation/guardian.js`) é um revisor independente, sem modelo, que roda **antes** de cada
ferramenta e no fim da tarefa. Ele não substitui a aprovação do usuário: só recusa o que a política proíbe sozinha.

Recusa (deny):
- navegação (ou aba nova) fora de HTTP/HTTPS e URL com usuário/senha;
- `upload_file` quando a página não é a origem da tarefa nem uma origem de login declarada — arquivo local indo
  para outra origem é exfiltração;
- `formAction` para outro site;
- receita que navega fora de HTTP/HTTPS ou que grava em planilha com autoridade `read`.

Sinaliza sem bloquear (`flags` no trace): gravação na área de transferência, clique por coordenada, sequência que
termina em Enter. Saída negada vira `{ success: false, code: 'GUARDIAN_DENIED', error }` e o agente recebe o motivo.

Revisão final: afirmação **específica** de efeito (“salvei”, “enviei”, “apaguei”, “comprei”, “baixei”…) sem contrato
de verificação vira `guardian: { decision: 'warn' }`; contra contrato reprovado, `contradiction`. Frases genéricas
(“tarefa concluída”) não contam — evita ruído.

**Cache de prefixo** (`src/automation/prompt-cache.js`, opt-in `promptCache`): envia `prompt_cache_key` só para
OpenAI/OpenRouter (chave estável por origem + prompt + modelo) e injeta `cache_control: ephemeral` no system quando
o modelo é Claude. DeepSeek não recebe campo nenhum — ele já cacheia sozinho. O resultado traz
`promptCache: { cachedInputTokens, cacheHitRate, cacheUseful, note }`; com zero cache o próprio texto manda desligar.
Sem a flag, o corpo da requisição é idêntico ao anterior.

Testes: `test/guardian.test.js` (5) e `test/prompt-cache.test.js` (5). `npm test` 218/218.

Limites: o Guardian não lê o código gerado (ainda não há codegen) nem julga semântica de página; a política é
estática e conservadora. O cache depende de o provedor devolver `usage` com tokens cacheados; não foi medido ainda
num provedor real.

### Tarefa durável, receitas via MCP e transformação isolada — 2026-10-28 (0.1.13-dev)

**Tarefa durável** (`src/automation/job-store.js`): o mecanismo de “Continuar” que já existia em memória passou a
ser gravado em `<dados>/automation/tarefas.json`, com TTL de 20 min, no máximo 8 tarefas e 2 MB no arquivo. O
registro guarda histórico de mensagens, modelo/provedor, abas conhecidas, última URL e expiração — nunca a chave
de API. Ao subir, o serviço restaura os registros vivos; se a aba original não existir mais (app reiniciado), a
retomada recria a aba na última URL antes de continuar. `automation:jobs` / `preload.automation.jobs()` expõem a
lista para a interface.

**Receitas via MCP** (`recipe_list`, `recipe_run`): qualquer cliente MCP pode listar as receitas por origem e
executá-las sem modelo. `recipe_run` exige uma aba na origem da receita (não age na página errada), valida as
entradas obrigatórias, respeita a autoridade `read` e devolve `output`/`outputValid` quando a receita declara
contrato.

**Transformação isolada** (`src/automation/sandbox.js` + `sandbox-worker.js`, ferramenta `transform`): o modelo
escreve o corpo de uma função que recebe `input` e devolve JSON. O código roda em **processo filho** com contexto
`vm` sem `require`, `process`, `fetch` ou timers, limite de 4.000 caracteres, 256 KB de entrada/saída e timeout de
2 s (processo morto ao estourar). A checagem estática recusa `require`, `import()`, `process`, `globalThis`,
`Function(`, `eval(`, `fetch(`, `XMLHttpRequest`, `WebSocket` e `child_process`; o Guardian repete a checagem antes
de executar. Isso cobre o caso real de “somar uma coluna”, “normalizar datas” e “reescrever rótulos” sem gastar
tokens nem abrir uma segunda chamada ao modelo.

Testes: `test/job-store.test.js` (5), `test/recipe-mcp.test.js` (4), `test/sandbox.test.js` (6). `npm test` 233/233.

Limites honestos: **não é** o minter com codegen do Pomerado — não há agente escrevendo módulo, executando no
navegador e iterando, nem Playwright. `vm` + processo filho reduz o risco, mas não é uma fronteira de segurança
contra código nativo; por isso a política é de lista negra estática e o código não recebe nada além do `input`.
O sandbox não tem DOM: operações de página continuam vindo das ferramentas existentes.

### Correção de escopo do Guardian — 0.1.14-dev

A primeira versão recusava upload quando a página não era a origem onde o agente começou — mas, no uso interativo,
o agente começa na aba atual e pode navegar para outro site antes de enviar o arquivo (fluxo comum). A recusa
passou a valer só quando a tarefa declara URL inicial (`run_task`/MCP); no painel, o upload continua exigindo a
aprovação do usuário no diálogo, que é a fronteira real ali. Regra em `src/automation/service/index.js`
(`taskOrigin = normalizeOrigin(taskStartUrl || '')`), coberta pelo teste do Guardian.

### Painel: conversas, texto legível e memória — 0.1.15-dev

Três problemas de uso, não de motor, e um de motor que eles expuseram.

**Texto do modelo.** O painel fazia `textContent = resposta` e o CSS não tinha `pre-wrap`, então parágrafos e
listas viravam um bloco único. Agora existe `src/renderer/markdown.js` (parser sem DOM, testável) que devolve
blocos `p`/`ul`/`ol`/`heading`/`code` com trechos `text`/`strong`/`code`, e o renderer monta nós — **nunca**
`innerHTML` com texto do modelo. Listas no meio de um parágrafo (rótulo seguido de bullets) também são separadas.

**Conversas.** `localStorage` guarda até 50 conversas (título pela primeira mensagem, data, 200 mensagens por
conversa); o seletor no topo alterna, **Nova** cria, e ao reabrir o app a última conversa volta renderizada.

**Retomada.** `automation.jobs()` alimenta um cartão no topo do chat com modelo, hora, endereço e o botão
**Continuar tarefa**; o botão chama o fluxo de `resumeId` que já existia. Se a tarefa veio de antes do reinício, o
serviço recria a aba na última URL (ver 0.1.13).

**Memória** (`src/automation/memory-store.js`): fatos curtos por origem e preferências globais, TTL de 30 dias,
200 entradas/128 KB, deduplicados por hash. Recusa texto com cara de segredo (senha, token, cartão). Entra no
system prompt como lista limitada a 8 itens, marcada como dado não confiável. A ferramenta `memory`
(save/list/forget) deixa o agente gravar descobertas do site; tarefa verificada também registra uma linha de ação.
Botão **Memória** lista e apaga.

**Módulos de operação** (`src/automation/module-store.js`): codegen pequeno e real — o agente escreve o corpo de
uma função, salva por origem (`module save`), executa no sandbox (`module run`) e pode reexecutar com um `code`
corrigido antes de salvar de novo (iteração). Guardado em `<dados>/automation/modulos.json`, exposto por
`module_list`/`module_run` no MCP. Não executa código na página; é cálculo determinístico sobre dados já lidos.

**Receitas como artefato**: `recipe_export` devolve `{kind:"zero-recipe",version:1,...}` e `recipe_import` valida e
grava de novo — a “biblioteca local” sem banco.

Dois bugs antigos corrigidos no caminho: `transform` tinha handler mas nunca era oferecida ao modelo; e o bloco de
memória era montado **antes** de `const messages`, o que quebraria qualquer tarefa com fato guardado (TDZ).

Evidência: `npm test` 249/249; benchmark difícil 14/14 no build instalado; integração `status: PASS`.
Limites: histórico é local ao perfil (não sincroniza), memória não é semântica (é lista recente), e módulos não
têm DOM, então não substituem ferramentas de página.

### Planilhas com menos ações — 0.1.16-dev

O sintoma (“lento e diz toda hora 30 ações”) tinha duas causas medidas no código, não no modelo.

1. **Uma ação por intervalo.** `sheets` só fazia read/write/goto isolados; ler, calcular e gravar custava três
   rodadas de modelo, cada uma com o histórico inteiro. Agora existe `action: "batch"`: até 12 operações
   (`read`/`write`/`goto`) executadas em ordem pelo host, com **uma** aprovação para todas as escritas, parando na
   primeira falha e devolvendo `results[i]` (as leituras voltam com `values`). O modelo gasta uma rodada para o
   trabalho todo.
2. **Inspeção caríssima.** Em `docs.google.com/spreadsheets`, `inspect_page` gerava árvore AX + até 7.000
   caracteres de `innerText` — e nenhum dos dois contém célula. O modelo então “procurava” a planilha, gastando
   rodadas e tokens, e acabava no teto. Agora o host detecta a planilha e devolve só `{title, sheet:{selection,
   tabs}}` (script `sheetsSnapshotScript`), com nota explícita: célula não está no DOM, use `sheets` com `batch`,
   não clique em célula. Nenhum snapshot AX é calculado nesse caminho.

Também: o prompt do agente passou a dizer “não chame inspect_page antes numa planilha” e a recomendação de
`batch`; o teto padrão do painel subiu de 30 para 40 apenas como folga — com batch o caso normal cabe em 4–6.

Testes: `test/sheets-mode.test.js` (4) cobrindo validação do batch, execução read→write→read com uma aprovação,
parada na primeira falha e o snapshot compacto sem chamar `getAccessibilityTree`. `npm test` 253/253; benchmark 44
e 33 passaram no build instalado.

Limites: `batch` não cria aba, não altera formatação e não lê intervalo protegido; cada operação ainda passa pela
caixa de nome, então planilha com a caixa de nome quebrada continua exigindo `sheets_accessibility`/visual.

### Auditoria geral — 0.1.17-dev

Varredura completa (57 arquivos, ~12.200 linhas em `src/`) com checagem de sintaxe, suíte, comparação automática de
IPC × preload, comparação de ids do DOM × renderer e leitura dirigida dos fluxos críticos. Relatório completo:
`docs/AUDITORIA_2026-10-28.md`.

Correções com impacto real:

- **Pipe MCP autenticado.** O canal local aceitava JSON-RPC de qualquer processo. Agora cada início gera um token
  (32 bytes) em `<dados>/automation/pipe-token`, e a primeira linha da conexão precisa ser esse token; sem ele o
  socket é derrubado. `scripts/mcp-stdio.js` e `bench/avaliar.js` leem o arquivo e autenticam antes do handshake.
- **`socket.destroy(error)` sem listener** derrubava o processo no primeiro cliente não autenticado; agora há
  handler de erro e o descarte é silencioso (rotina, não exceção).
- **Retomada sem id.** `rememberPausedRun` guardava o estado sem `id`; `listJobs()` devolvia `id: ''` e o botão
  “Continuar tarefa” chamava `sendAiMessage('')`, que retornava sem fazer nada. O estado passou a carregar o id.
- **Guardian × módulos.** `module run` sem `code` (usa o salvo) era recusado porque `checkCode(undefined)` retorna
  “código obrigatório”. A validação agora só roda quando há código na chamada; `save` sem código continua recusado.
- **Contrato de saída × batch.** Receita com `sheets batch` contendo `read` não preenchia `lastRead`; o contrato
  falhava com “nenhuma leitura”. O runner percorre `results` e usa a última leitura do lote.
- **Recursos invisíveis no painel.** `recipes`, `transforms` e `promptCache` existiam no serviço, mas o IPC do
  painel chamava `runAgent` só com `resumable`/`resumeId`. Há três opções em Configurações → Agente · recursos
  (receitas e módulos ligados por padrão), persistidas no store e repassadas na chamada.

Verificado sem defeito: sintaxe 57/57; 57 handlers IPC sem `invoke` órfão; 74 ids de DOM todos existentes;
`contextIsolation`/`sandbox`/`nodeIntegration:false`; credenciais em AES-256-GCM com chave via `safeStorage`;
SQL com prepared statements e rollback. Riscos deixados abertos e conscientes: sem CSP nas páginas locais (testar
antes de aplicar em `file://`), script inline no `newtab.html`, token do pipe protegido pela ACL da pasta no
Windows, `automation:list-tools` sem consumidor e cliente WS sem rejeição imediata no disconnect.

### CSP e fechamento da auditoria — 0.1.18-dev

O risco “sem CSP nas páginas locais” foi fechado com teste real, não com suposição.

- **`index.html`**: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https: http:;
  connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'`. A casca não tem
  formulário, não faz `fetch`/WebSocket (tudo passa por IPC) e não usa `style=""`.
- **`newtab.html`**: o bloco `<style>` virou `newtab.css` e o `<script>` virou `newtab.js`; as seis cores inline dos
  atalhos viraram classes `.icon-google` … `.icon-wiki`. CSP própria: `default-src 'self'; script-src 'self';
  style-src 'self'; img-src 'self' data: https:; form-action https://www.google.com; connect-src 'none';
  object-src 'none'; base-uri 'none'`.
- **Prova**: `scripts/electron-ui.integration.js` (`npm run test:ui`) abre as duas páginas num BrowserWindow com o
  preload real e `sandbox`, coleta `console-message`, falha em qualquer “Content Security Policy/Refused to…” e
  exige `window.app`, `window.ZeroMarkdown`, seletor de conversas, três opções de recursos, CSS aplicado e relógio
  da nova aba preenchido. Resultado: `{"status":"PASS","messages":0}`.

Também nesta rodada: `management.getAll` lista as extensões carregadas e `setEnabled(id,false)` descarrega uma
extensão de terceiros (reativar é pelo menu; `uninstall` orienta o menu em vez de apagar arquivos); o cliente
WebSocket rejeita promessas pendentes no `close`/`disconnect`; o IPC morto `automation:list-tools` foi removido.

Limite remanescente: o token do pipe depende da ACL da pasta do perfil no Windows (`0600` é POSIX).

### Menos rodadas: guardião de progresso e pré-inspeção — 0.1.19-dev

O sintoma “parei após 40 rodadas” tem três causas, e as três foram atacadas no host (não no prompt do modelo).

1. **Rodadas gastas só lendo.** Modelos fracos alternam `inspect_page`/`see_page`/`scroll` sem alterar nada.
   `src/automation/progress-guard.js` conta rodadas consecutivas sem ação que mude estado (mutação real, não falha):
   na 3ª injeta “aja com o que já sabe ou conclua”; na 5ª “pare de inspecionar”. No meio do orçamento e a 5 ações do
   fim, lembra quantas restam e pede para agrupar ferramentas no mesmo turno. A mensagem entra como `user` com
   prefixo `[Zero Browser]`, então não vira ferramenta nem gasta chamada extra.
2. **Uma rodada perdida no começo.** Toda tarefa começava com o modelo pedindo `inspect_page`. O painel agora liga
   `preInspect`: o host lê a página e entrega o snapshot no mesmo formato de uma chamada de ferramenta, antes do
   primeiro turno. Em planilha, essa leitura é o snapshot compacto.
3. **Limite fixo sem diagnóstico.** O teto agora é 20/40/60 (Configurações → Agente · recursos) e, ao pausar, a
   resposta traz `Ferramentas usadas: inspect_page×12, sheets×3…` e o último erro, para saber o que consumiu as
   rodadas em vez de só “parei”.

Para planilhas, além do `sheets batch` da 0.1.16, o prompt passou a trazer o exemplo concreto (ler A1:C50 e gravar o
total em E1) e a proibição de `inspect_page` antes.

Testes: `test/progress-guard.test.js` (5), `test/agent-budget.test.js` (3 — pré-inspeção entrega o snapshot no
primeiro request; aviso aparece após leituras repetidas; pausa reporta uso). `npm test` 269/269; `test:ui` PASS.

Limites: o guardião conta rodadas, não qualidade — se o modelo alterna leitura e ação inútil, ele não detecta; e
`preInspect` não roda quando a tarefa captura evidência de leitura nem no modo “sempre perguntar”.

### `run_steps` no painel — 0.1.20-dev

A ferramenta que mais reduz rodadas já existia, mas só era oferecida com `actionScripts` (opt-in que o IPC não
passava). Agora o painel a liga por padrão: até 12 passos (clicar, digitar, escolher opção, hover, esperar) numa
**única** chamada, com `expect` verificado pelo host em cada passo e parada no primeiro problema. Cada passo
consequente continua passando pela aprovação normal — o que muda é o número de idas ao modelo, não a política.

Efeito esperado: formulário de 6 campos passa de ~7 rodadas para 1–2; junto com a pré-inspeção e o guardião de
progresso, o teto de 40 deixa de ser atingido em tarefas normais.

### ACL do token do pipe — 0.1.21-dev

Último risco da auditoria: no Windows a proteção do `pipe-token` era só a ACL herdada de `%APPDATA%`. Agora
`src/automation/file-acl.js` aplica `icacls <arquivo> /inheritance:r /grant:r *<SID>:(F)
/grant:r *S-1-5-18:(F)` usando o SID do usuário (não `DOMÍNIO\usuário`), o que sobrevive a perfil roaming ou
redirecionado.

Dois detalhes que só aparecem testando de verdade:

- o `whoami` do PATH pode ser o do Git/MSYS, que não entende `/user`; o módulo usa sempre
  `%SystemRoot%\System32\whoami.exe` e `icacls.exe`;
- uma segunda instância no mesmo perfil sobrescrevia o token antes de tentar o pipe: agora o arquivo só é escrito
  **depois** que o `listen` do pipe dá certo, e o token é removido no `stop()`.

Falha de `icacls` nunca impede o app de subir (`{ ok:false, reason }` e segue). Evidência no app instalado:
`icacls` mostra apenas `NT AUTHORITY\SYSTEM` e `WESLEY\Wesley`, sem entradas `(I)`. Testes: `test/file-acl.test.js`
(4, incluindo ACL real no Windows). `npm test` 273/273.
