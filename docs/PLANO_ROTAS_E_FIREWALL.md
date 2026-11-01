# Plano — Rotas aprendidas e firewall de intenção

Data: 31/10/2026. **Status: Implementado (`0.1.55-dev` e `0.1.58-dev` em `src/automation/learned-routes.js`, `src/automation/service/intent-firewall.js`, `test/intent-firewall-attacks.test.js` com 50/50 ataques bloqueados e `docs/RELATORIO_FIREWALL_ATAQUES.md`).**

## 1. Rotas aprendidas (o Zero faz engenharia reversa dos sites que você usa)

### Ideia
Por trás de quase todo site existe uma API interna que a página chama. Hoje o agente olha a tela e clica (lento, caro em tokens). O Zero passa a observar as chamadas de rede enquanto você ou um bot usa o site, entender o que cada uma faz ("buscar preço", "listar pedidos"), guardar como **rota** e, nas próximas vezes, chamar a rota direto. Se a rota falhar, volta ao modo clicar e aprende de novo.

### Estado da arte (pesquisado em 31/10/2026, sem benchmark independente)
- Preprint de abril de 2026 defende APIs internas contra agentes que só usam navegador: arxiv.org/abs/2604.00694.
- Browser Use descreve como próxima etapa "habilidades HTTP" (observar tráfego, guardar a requisição): browser-use.com/posts/web-agents-that-actually-learn.
- Craft Agents inspeciona a rede para achar APIs: agents.craft.do/docs/browser/examples.
- WebMCP (Google e Microsoft, fevereiro de 2026): sites declaram suas próprias ferramentas via `navigator.modelContext` / `document.modelContext`; suporte nativo nos navegadores não verificado: specification.website/spec/agent-readiness/webmcp/.
- Não é ideia inédita. O espaço aberto é fazer isso no navegador de uso diário, local, com permissões, prova por ação e biblioteca de rotas do usuário.

### Ordem de preferência de execução (por ação)
1. Ferramenta declarada pelo site (WebMCP), se existir.
2. Rota aprendida válida (chamada direta).
3. Receita por site (já existe no projeto).
4. Agente olhando e clicando (último recurso).

### Ficha de uma rota
Site e perfil; nome em português; parâmetros tipados com nome, tipo e **origem** (você, bot, página); efeito (`leitura` ou `escreve`: pagar, enviar, apagar); como renovar a sessão; versão e data da última verificação; evidência da observação (pedido e resposta, com segredos redigidos); taxa de acerto nas últimas execuções.

### Fases e portões
- **Fase 0 — Teste barato (decide tudo).** 5 sites que você usa; uma tarefa de leitura em cada; comparar modo clicar × rota aprendida em tempo, tokens e custo, com o mesmo resultado correto. **Portão:** pelo menos 3 das 5 tarefas com redução de tempo ≥ 70% e de tokens ≥ 80% (meta, não promessa). Se não passar, para aqui.
- **Fase 1 — Observador.** Capturar chamadas de rede de uma execução (via eventos CDP já existentes, com o CDP completo ligado), filtrar ruído (analytics, imagens), agrupar e nomear. Aceite: lista legível de candidatas a rota por tarefa.
- **Fase 2 — Compilador de rota.** Gerar a rota a partir de uma execução, identificando quais valores variam (parâmetros) e quais são fixos. Aceite: reexecutar com outro valor devolve o resultado correto.
- **Fase 3 — Executor com queda automática.** Chamar a rota; se falhar (mudança do site, sessão vencida), cair para o modo clicar e sinalizar "rota precisa ser reaprendida". Aceite: simular mudança de resposta e ver a queda sem erro ao usuário.
- **Fase 4 — Biblioteca.** Lista de rotas por site e perfil, ligar/desligar, apagar, exportar sem segredos. Rotas de escrita ficam desligadas até você ligar.
- **Fase 5 — WebMCP.** Detectar ferramentas declaradas pelo site e usá-las antes das rotas aprendidas.
- **Fase 6 — Ensaio (opcional).** Capturar um site num "gêmeo" local para testar bots sem tocar no site real e detectar mudança antes de quebrar.

### Riscos
- Rotas quebram quando o site muda (mitigação: queda automática, taxa de acerto, reaprender).
- Termos de uso de alguns sites podem proibir; o Zero só usa a sessão do próprio usuário, no ritmo humano, e mostra um aviso por site.
- Tokens de sessão em requisições: nunca em logs, exportações ou memória do bot; redigidos por padrão.
- Rotas de escrita (pagar, enviar) começam sempre com aprovação.
- Chamadas fora do contexto da página podem faltar cabeçalhos anti-robô; executar a chamada dentro da própria aba quando preciso.

## 2. Firewall de intenção

### Ideia
Cada informação recebe uma etiqueta de origem: `você` (confiável) ou `externo` (conteúdo de página, e-mail, arquivo, resposta de site). Regra fixa, aplicada pelo Zero e não pela IA: **dado `externo` pode ser lido e resumido, mas não pode decidir destino, valor ou ação com efeito** (para quem enviar, quanto pagar, o que apagar, qual endereço). Quando uma ação com efeito tem um parâmetro de origem `externo`, ela é bloqueada ou vira cartão de aprovação mostrando o parâmetro e de onde veio.

### Por que depende das rotas
A etiqueta só funciona com ação estruturada ("enviar para X, valor Y"), onde cada parâmetro tem nome e origem. Em clique de tela não dá para saber de onde veio cada pedaço.

### Referência
Informação de fluxo e rastreio de origem em agentes: FIDES, Microsoft Research (arXiv 2505.23643), que bloqueou os ataques do teste AgentDojo. Não encontrei produto de navegador com isso; busca limitada, não confirma ausência.

### Recibo antes de executar
Antes de qualquer ação com efeito, mostrar em português o que será enviado de verdade (destino, campos, valor) e a origem de cada dado. O usuário aprova o fato real, não a descrição da IA. Referências próximas: biblioteca aberta `foreguard` (prévia de ações), aprovação por ação no Cursor e por site no OpenAI computer use; nenhuma mostra o conteúdo real do envio, pelo que li.

### Limite que precisa ficar explícito no produto
O firewall protege **destino, valor e ação**. Texto livre copiado de uma fonte externa para um campo livre (descrição de evento, corpo de mensagem) ainda pode carregar instrução hostil para o próximo leitor. Para isso: marcar o campo como "contém texto externo" e exigir revisão quando o destino é outra pessoa.

### Fases e portões
- **Fase A — Suíte de ataques primeiro.** Pelo menos 50 casos em cinco famílias: e-mail pedindo encaminhar, página pedindo enviar dados, texto oculto, pedido de pagamento falso, instrução em arquivo/PDF. Rodar contra o Zero atual para ter a linha de base.
- **Fase B — Etiquetas de origem** em tudo que entra no contexto do agente e nos parâmetros das rotas e ferramentas. Aceite: teste unitário por origem.
- **Fase C — Política de efeitos:** tabela de ações com efeito e regra por origem; bloqueio e cartão de aprovação. Aceite: a suíte passa.
- **Fase D — Recibo antes:** cartão com a requisição real, redigida, e origem de cada campo. Aceite: aprovar exatamente o que sai (teste de igualdade entre recibo e requisição enviada).
- **Fase E — Publicar resultado:** "N de N ataques sem efeito indevido" com a suíte aberta.
- **Portões:** zero efeitos indevidos na suíte; tarefas legítimas completam em ≥ 90% sem aprovação extra (meta); falsos bloqueios medidos e publicados.

### Riscos
- Excesso de bloqueio irrita: medir falsos positivos e deixar o usuário liberar por bot e por destino.
- Etiqueta perdida em algum caminho (cópia, memória, resumo) vira buraco: testar o caminho de dados de ponta a ponta; memória do bot nunca grava conteúdo externo como instrução.
- Não substitui as aprovações atuais para ações financeiras; soma a elas.

## 3. Relação com os outros planos
- `docs/bots/PLANO_BOTS.md`: bots usam rotas e passam pelo firewall; mandato e comprovante usam o recibo e a evidência.
- `PLANO_CONTROLE_TOTAL_IA.md`: clientes externos também passam pelo firewall; o nível "total" não desliga o bloqueio de origem externa em ações com efeito.
- `PLANO_MOTOR.md`: a Fase 0 de rotas entra na medição de custo por tarefa resolvida.
- `PLANO_DESIGN_UX.md`: cartão de aprovação e comprovante mostram origem e requisição real.
