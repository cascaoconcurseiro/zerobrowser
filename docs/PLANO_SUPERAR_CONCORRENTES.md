# Plano real — como o Zero Browser pode ser o melhor em algo

Data: 31/10/2026. Substitui a primeira versão (que era uma lista de tudo). Este plano parte de uma escolha: não competir com Chrome/Edge como navegador geral, e sim ser o melhor navegador-agente para quem quer controle.

## 1. Posicionamento (decisão que o plano exige)

**Para quem:** desenvolvedores e usuários técnicos que querem um agente dentro do navegador e não aceitam uma caixa-preta presa a uma assinatura.

**Promessa:** (1) usa o modelo que você escolher, com chave própria ou local; (2) toda ação do agente é visível, aprovável e auditável; (3) qualquer cliente MCP pode controlar o navegador.

**Não vamos competir em:** loja de extensões, sincronização na nuvem, integração com Google/Microsoft, usuário comum que só quer navegar. Quem precisa disso continua no Chrome/Edge, e tudo bem.

## 2. As três afirmações que o plano precisa provar

O Zero só pode dizer "melhor" no que um teste público sustentar. Hoje nenhuma das três está provada.

| # | Afirmação | Como provar | Vale como prova se |
|---|---|---|---|
| A | Acerta tanto quanto os concorrentes | 30 tarefas fixas, mesmo modelo, ordem A B B A, 3 repetições, pós-condição verificada por código | Acerto do Zero ≥ 90% do melhor rival |
| B | Gasta igual ou menos | Mesmas execuções: tokens não cacheados, chamadas, tempo p50/p90 | Tokens ≤ 1,2× o do rival |
| C | É mais seguro | Suíte de ataques (prompt injection em página, exfiltração por URL, ação consequente sem aprovação) rodada no Zero e nos rivais acessíveis | Zero bloqueia todos; rival falha em pelo menos um |

Rivais para comparar (acessíveis e diretos): BrowserOS neo (gratuito, agentes por MCP) e um segundo, Comet ou Edge/Copilot conforme o acesso que você tiver. Limite honesto: cada produto traz seu próprio agente; onde o modelo não puder ser igualado, o resultado é reportado separado e não como empate.

## 3. Sequência, com portões de decisão

Sem calendário: o tempo depende de orçamento de API e da sua disponibilidade. Tamanhos são estimativa de esforço (P/M/G).

### Etapa 1 — Higiene (P)
Eu faço, na pasta principal:
- Commitar as 29 alterações (suíte já está 333/333).
- Corrigir `temperature` enviada a modelos que a rejeitam e filtrar a lista de modelos da OpenAI para chat (`src/automation/service/index.js:2042`, `src/automation/model-catalog.js:53`), com testes.
- Fazer backup do perfil antes de qualquer teste no pacote instalado.

### Etapa 2 — Benchmark real (M) → **Portão 1**
- Montar as 30 tarefas a partir do que já existe em `bench/` (conjunto difícil, tarefa 44, planilhas), separando fixtures e sites reais autorizados.
- Você: salvar a chave no app, definir o teto de gasto e liberar o benchmark pago (hoje o A/B pago está excluído por sua orientação).
- Rodar Zero e rivais; fechar o que está pendente do motor (`--preinspect` em outros modelos, `promptCache`) e ligar por padrão só o que ganhou.
- **Portão 1:** se A e B passam, segue para a Etapa 3. Se não passam, a única tarefa do projeto passa a ser o motor (reduzir passos, tokens e erros) até passar. Não se investe em UX nem distribuição enquanto o motor perde.

### Etapa 3 — Segurança comprovada (M) → **Portão 2**
- Escrever a suíte de ataques como testes automáticos (páginas hostis em fixture) e rodar nos rivais acessíveis.
- Revisão independente do que mexe com privilégio: IPC, extensões, CDP, downloads, ações do agente.
- Log de ações do agente exportável, sem segredos.
- **Portão 2:** afirmação C só entra na divulgação se o Zero bloquear tudo e houver resultado dos rivais para comparar. Se o Zero falhar em algo, corrige antes de qualquer divulgação.

### Etapa 4 — Uso diário mínimo (G) → **Portão 3**
Só o que impede o público técnico de usar de verdade:
- Atualização automática assinada com volta atrás (`docs/PLANO_ATUALIZACAO_ASSINADA.md`). Sem isso ninguém recebe as correções.
- Abas e downloads sem falhas nos fluxos que você usa; perfis conferidos no app instalado (dois ao mesmo tempo).
- Replay da execução do agente (ver o que ele fez, passo a passo): é o ponto forte de BrowserOS neo e Edge.
- **Portão 3:** você usa o Zero como navegador principal por 7 dias e registra cada falha. Zero falhas que bloqueiem o uso, e as demais corrigidas, antes de convidar mais gente.

### Etapa 5 — Modo local e MCP (M)
- Ollama real com 2 modelos validados; publicar requisitos de hardware. Isso sustenta a promessa de custo zero e privacidade.
- Testar o MCP com clientes reais (Claude Desktop/Code e mais um) e documentar erros e limites.

### Etapa 6 — Publicar e ouvir (P)
- Publicar relatório de benchmark e de segurança, com resultados ruins incluídos, e a página de limites.
- Convidar 5 a 10 usuários técnicos; medir quantos usam por 2 semanas e o que os faz parar.
- Só aqui decidir se vale investir em sincronização e extensões.

## 4. O que ficou de fora de propósito
Matriz ampla de extensões, Chrome Web Store, sincronização, migração do nome interno (Fase B), divisão completa do `service/index.js` fora do que a Etapa 2 exigir, e qualquer polimento visual que não afete as Etapas 4 e 5. Entram depois, se a Etapa 6 mostrar demanda.

## 5. Como o plano pode falhar (e o que fazer)
- **O motor perde no Portão 1.** É a pior notícia e a mais útil: mostra onde está o problema. Resposta: parar o resto e corrigir o motor.
- **Rivais não comparáveis (modelo ou plano diferentes).** Reportar separado e não alegar vitória.
- **Benchmark caro.** Definir o teto antes; começar por 10 tarefas e 1 repetição para estimar custo, depois ampliar.
- **Você usar e achar o Zero inferior ao Chrome no dia a dia.** Aceitável se o nicho é o agente; ruim se faltar atualização ou estabilidade. O Portão 3 existe para descobrir isso cedo.

## 6. Critério de sucesso do plano
Em vez de nota 4/5: pelo menos uma afirmação (A, B ou C) provada com dados públicos, mais 5 usuários técnicos usando por 2 semanas. Se nenhuma afirmação for provada, o plano termina com um diagnóstico claro do que falta, não com uma promessa.
