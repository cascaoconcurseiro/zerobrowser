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

Todos os pares abaixo usaram deepseek-flash no perfil dev, em sequência. `observeAfterActions` ficou opcional e desligado por padrão. São amostras pequenas; justificam ampliar a avaliação, não uma alegação de desempenho geral.

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

As falhas passadas em `33-validacao-erros` estavam concentradas em execuções Flame/timeout; as execuções Navegante mais recentes e as 3 repetições atuais passaram com os valores exatos do gabarito. Memória de perfil não é correção para os problemas de `<select>`, campo duplicado ou timeout.

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
