# Plano do motor — velocidade, tokens e custo

Data: 31/10/2026. **Status: Decomposição de tempo e orçamento de bytes implementados (`0.1.60-dev` em `src/automation/service/time-decomposition.js`); benchmarks externos em provedor pago dependem de autorização de gasto.** Base: `docs/EVOLUCAO_MOTOR.md`.

## 1. Diagnóstico

O motor tem muitas ideias implementadas e pouca prova. O que existe de evidência real:

| Mecanismo | Resultado medido | Força da prova |
|---|---|---|
| `--preinspect` | acerto 99%→100%, chamadas −18%, tempo −21%, tokens não cacheados −14% | A/B pareado, difícil, 3 repetições, só deepseek-flash |
| `--scripts` (run_steps) | passos −58%, tokens de entrada −37%, chamadas −40%, tempo −25% | 1 execução, 1 tarefa de formulário |
| Espera pós-hover adaptativa | 101 ms contra 253 ms por ação | 20 pares, mas só espera de DOM, resposta do modelo simulada |
| Deduplicar snapshots | −1,7% de bytes no total | Fixture, sem modelo real |
| `--journal` | piorou (+2,5× tokens, +2,2× tempo na tarefa 44) | 1 execução; já estreitado depois, sem nova medição |
| Seletor de ferramentas avançadas (−3.325 bytes), `cascade`, `diff`, `stream`, `promptCache`, custo OpenRouter | nenhuma medição com modelo real | só testes de código |

Dois fatos que orientam o plano:
- **Onde o tempo vai.** A tarefa 44 levou ~13 s em 7 chamadas ao modelo (cerca de 1,8 s por chamada) e 13 passos. A espera pós-ação poupa ~150 ms por ação. Ou seja, o ganho de milissegundos no DOM é pequeno perto do custo de cada chamada. As alavancas grandes são **menos chamadas**, **menos tokens por chamada** e **modelo mais rápido/barato**, nessa ordem. Esta é uma leitura dos números acima, não uma medição por componente; a Etapa 2 confirma.
- **Ruído do modelo.** A tarefa 44 já variou entre 12 e 16 passos entre rodadas. Conclusão com 1 execução não vale; o mínimo é 3 repetições pareadas (A B B A).

## 2. Métrica principal e regras

**Métrica-guia: custo por tarefa resolvida** (tokens não cacheados e, quando a API informa, `usage.cost`, divididos pelas tarefas com pós-condição verificada). Acompanham: acerto, chamadas, passos, tempo p50 e p90.

Regras para qualquer mudança:
- Promover a padrão só se o acerto não cair e tokens ou tempo melhorarem pelo menos 10% em A/B pareado com 3 repetições. Entre 5% e 10%, manter opt-in. Abaixo de 5%, descartar e remover o código.
- Uma variável por A/B (o comparador já exige `--variavel=`). Depois de promover várias, um A/B final do conjunto combinado contra a base, porque ganhos isolados podem não se somar.
- Bytes não são tokens e mock não é modelo real: só tokens reportados pelo provedor valem como resultado.
- Congelar um orçamento de bytes por pedido (catálogo de ferramentas hoje 7.148 bytes na cópia antiga; ver a versão atual) como teste, para a regressão aparecer na suíte e não em produção.

## 3. Etapas

### Etapa 0 — Linha de base confiável (P)
- Commitar a árvore atual e registrar o hash que será a base.
- Fixar o conjunto de tarefas: o difícil existente mais a 44, a 33 e uma de planilha, e uma tarefa de pesquisa multiaba.
- Rodar a base 3 vezes e registrar acerto, passos, chamadas, tokens (cacheados e não), p50 e p90, custo.
- Orçar: rodar 10 tarefas com 1 repetição para estimar o custo do plano inteiro. Você decide o teto antes de ampliar.
- Quem paga: precisa de provedor com chave (OpenRouter ou OpenAI). O A/B pago DeepSeek continua fora, por sua orientação.

### Etapa 1 — Fechar as ideias já escritas (M)
Ordem por retorno esperado, cada uma como A/B pareado:
1. `--scripts`: o maior sinal, mas de 1 execução. Repetir nas tarefas de formulário e planilha.
2. `--preinspect`: provado em um modelo. Repetir no conjunto básico, em `reais` e em um segundo modelo; depois ligar por padrão.
3. `promptCache` (OpenAI e OpenRouter): ligado contra desligado, comparando tokens cacheados, custo e latência. Provavelmente o maior corte de custo sem mudar comportamento.
4. Seletor de ferramentas avançadas: confirmar que não piora o acerto nem cria rodada extra em tarefas comuns.
5. `cascade` (modelo barato para passos simples): ver Etapa 5.
6. `diff`, `stream`: só se sobrar orçamento. Deduplicar snapshots (−1,7%) fica abaixo do corte e deve ser descartado.
- Saída: um perfil padrão (`--scripts --preinspect --prompt-cache` e o que mais ganhar) e A/B final contra a base.

### Etapa 2 — Onde o tempo realmente vai (P)
Usar `trace.requestMetrics` para separar, por tarefa: tempo do modelo (primeiro token e geração), execução da ferramenta, espera pós-ação e leitura de snapshot. Se o modelo dominar (como indicam os números), parar de otimizar o DOM e concentrar as Etapas 3 a 5. Se uma ferramenta específica dominar (por exemplo snapshots grandes), ela vira prioridade.

### Etapa 3 — Menos chamadas ao modelo (M) — maior alavanca
- Tornar `run_steps` o caminho padrão para formulários e sequências previsíveis, com pós-condição por passo e volta ao modo passo a passo se falhar.
- Várias ferramentas independentes por resposta (leituras paralelas) quando o provedor suportar.
- Receitas verificadas por site: medir a taxa de acerto e quantas chamadas elas eliminam em tarefas repetidas.
- Execução antecipada de ferramenta durante o streaming (hoje o `stream` não executa antes de terminar a resposta): só depois de provar que streaming ajuda.
- Meta de partida: reduzir chamadas por tarefa em pelo menos 30% contra a base mantendo acerto. O valor final sai da Etapa 0, não é promessa.

### Etapa 4 — Menos tokens por chamada (M)
- Prefixo estável para o cache funcionar: ordem das mensagens, catálogo de ferramentas e prompt de sistema sem partes que mudam a cada passo.
- Snapshots menores: o que mais pesa em `requestBytes` por tarefa; avaliar `diff` aqui.
- Compactação do histórico: medir o ponto em que ela começa a perder informação e fazer o acerto cair.
- Teste de orçamento: falhar se o catálogo ou o pedido médio da fixture crescer mais que uma margem.

### Etapa 5 — Modelo certo para cada passo (M)
- Rodar a mesma suíte com três modelos: o atual (deepseek-flash), um modelo pequeno da OpenAI ou do OpenRouter e um local via Ollama.
- Tabela final: acerto, tempo, custo por tarefa resolvida. A decisão do modelo padrão e do `cascade` sai daqui.
- Ollama serve para medir passos e chamadas sem gasto, mas o acerto depende do modelo local; não generalizar.

### Etapa 6 — Comparação com rivais (M)
Só depois das etapas 1 a 5: levar o perfil padrão ao benchmark do plano geral (`PLANO_SUPERAR_CONCORRENTES.md`) contra BrowserOS neo e mais um rival.

## 4. Portões
- **Fim da Etapa 1:** o perfil padrão reduz custo por tarefa resolvida em pelo menos 20% contra a base, sem perder acerto. Se não reduzir, o problema não está nas flags; ir direto para a Etapa 5 (modelo).
- **Fim da Etapa 3:** chamadas por tarefa caíram o suficiente para o tempo p50 cair. Se não, investigar a Etapa 2 de novo.
- Qualquer queda de acerto bloqueia a promoção, mesmo com ganho de custo.

## 5. O que não fazer
- Novas funcionalidades de motor antes das Etapas 0 e 1. Há mais de dez opções implementadas e sem medição; cada nova piora a combinatória.
- Otimizar milissegundos de espera de DOM antes da Etapa 2 confirmar que importam.
- Concluir qualquer coisa a partir de uma execução ou de bytes.

## 6. Dependências suas
Teto de gasto com API; qual provedor usar para o benchmark (OpenRouter ou OpenAI); chave salva por você no app; Ollama com modelos instalados, se quiser a Etapa 5 local.
