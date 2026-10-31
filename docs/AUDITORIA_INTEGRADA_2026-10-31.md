# Auditoria integrada do Zero Browser — 31/10/2026

## Escopo e conclusão

Base: código 0.1.64-dev, main, HEAD observado 46aef6d na leitura anterior; branch agora 27 commits à frente de origin/main. A versão do executável instalado foi consultada por metadados e informa 0.1.64-dev. Isso não prova equivalência de conteúdo entre instalação e checkout.

A afirmação de que todas as fases estão concluídas não é sustentada pelos fluxos de produção encontrados. Há implementações úteis de navegador e motor, mas Bots agendados, conectores e telas conceituais ainda contêm simulações. Não declarar paridade com Grok Bot.

Esta auditoria cobre rastreamento estático e verificações locais listadas abaixo. Não é certificação de segurança, teste de todas as contas/sites nem validação da instalação em uso. Lacunas externas permanecem explícitas.

## Verificações executadas

| Verificação | Resultado | Limite |
|---|---|---|
| npm test | 405 testes; 404 passaram; 1 falhou | whats-new.test.js: novidades não citam versão atual |
| npm run test:bot-runtime | PASS | Fixture; não demonstra rotina com provedor/site real |
| npm run test:ui | FAIL | estado vazio precisa de exemplos acionáveis |
| npm run test:delegation-layout | PASS em seis tamanhos | Folha de avatar mockada como null; mede caixas, não conteúdo visível do retrato |
| Metadados do EXE instalado | 0.1.64-dev | Sem comparação de hash do ASAR nesta rodada |

Logs: audit-test-output.txt, audit-bot-runtime.txt, audit-ui.txt e audit-layout.txt na raiz. Contêm somente execução local de testes.

## Achados confirmados e prioridade

### A01 — Alta: execução de Bot pode concluir sem executar a tarefa

src/bots/runner.js:75 usa executor alternativo que retorna ok:true com mockData. src/main/main.js:267 instancia BotRunner sem executor. O IPC bots:run-now passa steps, mas não um executor. Plano vazio também termina completed. Corrigir: executor real obrigatório em produção; simulação somente em fixture explícita; lista vazia não prova conclusão. Aceite: tarefa altera/lê fixture real e resultado é verificado de forma independente.

### A02 — Alta: resultado de ferramenta com erro pode virar completed

O loop de runner.js aguarda stepResult, mas não interrompe quando stepResult.ok é false ou success é false. Acumula output e termina completed. Corrigir contrato de resultado e falha terminal, incluindo evidência da meta.

### A03 — Alta: parar e limite de tempo não cancelam o executor subjacente

runner.js resolve a Promise intermediária ao parar, mas não entrega AbortSignal ao executeFn. Uma operação em andamento pode continuar depois de a execução aparecer parada. O tempo é conferido antes de cada passo; um passo pendurado excede maxDurationMs. Aceite: executor recebe sinal e prazo; parada verifica que efeitos cessaram, além de retirar o item da lista.

### A04 — Alta: agendamento e eventos não equivalem a automação contínua

scheduler.js usa snapshot com mockData como plano padrão. main.js chama runMissedSchedulesOnce no início e por IPC; não foi encontrado relógio recorrente ligando o agendador ao trabalho real. fireEvent tem testes, mas a busca de callers em src não encontrou alimentação por e-mail/webhook. Gatilhos e mandatos ficam em Maps, perdidos ao reiniciar. Corrigir persistência, fonte real de eventos e execução com deduplicação.

### A05 — Média: horários e integração com Windows incompletos

scheduler.js usa setUTCHours/getUTCDate, sem fuso explícito do Bot. buildWindowsScheduledTaskSpec somente produz uma string; contém --headless- close-when-done. Não foi encontrado consumidor em src de --run-scheduled-bot. configureLoginItem conserva um objeto e não prova configuração do Windows. Aceite: execução instalada em horário America/Sao_Paulo, reinício, atraso e retomada verificados.

### A06 — Alta: conectores declaram execução sem transporte externo

src/connectors/index.js: readServiceData retorna mockItems; executeApprovedDraft verifica recibo, muda status para executed e retorna, sem efetuar requisição. ExternalMcpClient registra servidores em Map sem transporte demonstrado nessa classe. Não anunciar conectores conectados por essa evidência. Implementar adaptador real, autenticação local, erro e recibo após confirmação do serviço.

### A07 — Alta: Apps Vivos recebem fonte artificial na integração

main.js, IPC live-apps:generate, injeta painel.local, preço R$249,90 e status Atualizado agora. Isso não comprova leitura de sessões ou fontes reais. Remover afirmação de atualização real até existir proveniência, timestamp observado e caminho de coleta.

### A08 — Média: dados e recibos da interface precisam de proveniência

app.js contém métricas fixas 410ms e -27,3%. Na versão atual o botão de aprovação do cartão conceitual traz a aba para frente e afirma recibo SHA-256 verificado sem verificar recibo nesse handler. A afirmação anterior de envio de e-mail não corresponde ao handler atual: foi substituída; o problema atual é a comprovação do recibo. Conectar UI a eventos reais; identificar exemplos.

### A09 — Média: avatares não atendem à entrega solicitada

bot-avatar-catalog.js armazena duas folhas 10x10, com 200 retratos estáticos. styles.css anima translação/escala da imagem inteira. Faltam ativos individuais e quadros próprios de personagem por estado. O teste de layout retorna null para a folha, logo centro geométrico delta=0 não comprova centro óptico, recorte, fundo nem uniformidade dos retratos. Aceite: catálogo real renderizado; cada personagem individual; estados animados; pixel nítido; redução de movimento; conferência visual em todos os tamanhos.

### A10 — Média: UI e documentação regressaram

test:ui falha e npm test falha. HANDOFF/CHECKLIST citam .63 e próximas etapas .53/.52, apesar de .64 instalada. Corrigir documentos por evidência, preservar histórico e reabrir entregas apenas simuladas. Layout passou na fixture, mas não prova correspondência às imagens de referência nem ausência de sobreposição em todas as telas.

### A11 — Média: mandatos precisam de validação de origem e aplicação real

scheduler.evaluateMandate aceita site por includes, o que permite correspondência com nome de domínio dentro de URL alheia; omitir site/action evita as comparações condicionais. O método consome uso durante avaliação. Não há prova de aplicação obrigatória no executor real. Exigir origem normalizada e campos completos; reservar/consumir uso com semântica explícita. Não usar essa função como autorização financeira suficiente.

### A12 — Lacuna: gerenciamento dedicado de obstáculos

main.js:471 permite pop-ups com URL autorizada e os converte em abas preservando opener. Isso atende parte do login, mas não classifica propaganda vs janela necessária. Não foi comprovado gerenciador dedicado de consentimentos/banner. Criar política por site: rejeitar cookies opcionais por preferência; fechar promoção com seletor semântico; preservar OAuth; pedir decisão para permissões; verificar desbloqueio. CAPTCHA continua humano. Não remover overlays por CSS como prova de consentimento.

## Motor: o que existe e o que falta medir

Confirmado estaticamente: model-catalog filtra OpenAI com isOpenAIChatModel; agent-runtime condiciona temperature a modelSupportsTemperature. Não repetir esses dois itens como defeitos antigos sem novo caso reproduzível. Há AbortController, retries com retry-after, contabilização de usage e cached tokens no runtime do agente. Isso não corrige automaticamente o executor independente dos Bots.

Os testes locais relatam redução de bytes de esquema e mensagens. Bytes não são tokens faturados, e sucesso em fixture não mede taxa de acerto em sites reais. A tela não deve transformar essas medições em indicadores universais.

Ordem de melhoria: unificar executor real de Bot com motor; medir sucesso por pós-condição; limitar observação à região necessária; reutilizar observações válidas; invalidar referências após navegação; executar receitas conhecidas com verificação entre passos; recuperar falhas sem repetir envios; usar modelo menor apenas em subtarefas avaliadas; manter screenshots sob demanda. Medir latência mediana/p95, sucesso, chamadas, tokens de entrada/saída/cache e custo disponível. Benchmark pago precisa de orçamento.

## Comparação com Grok Bot

Fontes oficiais consultadas: https://docs.x.ai/grok-bot/overview ; https://docs.x.ai/grok-bot/skills-routines-and-automations ; https://x.ai/bot/guides/grok-bot-101 . Recursos documentados pelo fornecedor, sem benchmark autenticado nesta auditoria.

| Capacidade | Grok documentado | Zero auditado |
|---|---|---|
| Bot persistente com função/contexto | Sim | Cadastro/persistência existem; execução agendada real incompleta |
| Ensinar e reutilizar habilidade | Sim | Recorder transforma eventos recebidos em passos; captura e reprodução completa precisam de validação |
| Rotinas por agenda/eventos | Sim | Estrutura local com simulação e integração incompleta |
| Computador persistente na nuvem | Sim | Execução local; não há paridade de disponibilidade com PC desligado |
| Comunicação entre Bots | Documentada no guia | Não comprovada de ponta a ponta nesta rodada |
| Login compartilhado entre Bots | Documentado no guia | Zero adota isolamento por perfil; decisão deliberada, não equivalência |
| Acerto, velocidade e custo | Sem medição comparável obtida | Sem benchmark pareado; nenhuma nota numérica defensável |
| Reversibilidade verificável | Não avaliada integralmente | Há estrutura de recibos; não presumir reversão de ação externa |

## Cobertura restante para fechar auditoria operacional

- [ ] Inventário tools/list do processo instalado e teste por nível/cliente, revogação e expiração.
- [ ] Comparar hashes do código empacotado e instalação; auditar atualização assinada e rollback.
- [ ] Execução instalada com avatar real e todas as telas, escalas/DPI, teclado e sobreposições.
- [ ] Gravação humana real, salvar habilidade, reiniciar e reproduzir com pós-condição.
- [ ] Teste de login/OAuth/cookies/pop-up em sites autorizados, sem enviar mensagens nem comprar.
- [ ] Provedor real com orçamento; medir qualidade e tokens. Sem ler/expor chaves.
- [ ] Validação de isolamento entre processos, parada global, gasto concorrente e histórico de longa duração.
- [ ] Comparação autenticada com Grok Bot; documentação do fornecedor não é resultado experimental.

## Ordem de correção proposta

1. A01–A04: executor real, erro, cancelamento e agendador.
2. A06–A08: retirar sucesso artificial e ligar conectores/Apps Vivos/UI a resultados reais.
3. A10–A11: gates, documentos, autorização e persistência.
4. A12: obstáculos e política de consentimento.
5. A09: ativos individuais animados e revisão visual real.
6. Benchmark e otimizações do motor; depois comparar com concorrente.

Auditoria registrada; correções de código não executadas nesta rodada. Nenhum commit, push, instalação ou chamada paga.

## Atualização da fatia 0.1.65-dev — 31/10/2026

Esta atualização registra mudanças locais posteriores ao diagnóstico acima; não altera os achados que seguem abertos.

- `npm test`: 407 testes passaram, 0 falharam.
- `npm run test:ui`: PASS com sessão temporária isolada; a fixture confirma resposta do motor, ausência de passos/aprovações inventados, contagem real de perfis, ausência de Apps/Telegram simulados e ausência de métricas fixas na gaveta.
- `npm run test:bot-runtime`: PASS em perfil de fixture e sites loopback. Não testa tarefa de Bots especialistas no perfil principal nem provedor real.
- `npm run test:delegation-layout`: PASS em seis viewports. O avatar segue mockado; o resultado não valida identidade dos sprites ou comparação pixel a pixel com o conceito.
- A Central identifica que as tarefas especialistas usam o perfil atual, esconde registros de demonstração de Apps e mostra conectores como indisponíveis. Atualizações assíncronas antigas são descartadas.
- A parada mostra quando foi pedida; a UI distingue pausa por limite, cancelamento confirmado e fim do motor. O fim do motor não é chamado de resultado verificado.
- O painel de detalhes informa os limites de métricas disponíveis e deixou de exibir 410 ms, -27,3% e 50/50 como fatos atuais da execução.

Continuam abertos A01 e A04–A12: executor de agenda, isolamento e allowlist aplicados em runtime, fontes/transporte de Apps e conectores, gestão de pop-ups/consentimentos, identidade visual e avatares, comparação visual instalada, métricas reais do motor e benchmark pareado. Nesta atualização, o instalador foi compilado e o executável `win-unpacked` foi aberto usando dados de QA separados; isso não equivale à instalação NSIS. Nenhuma chamada paga foi feita. Commit e instalação NSIS continuam pendentes.

Direção de design registrada para as próximas fatias: acabamento de produto profissional, hierarquia e fluxo fáceis de entender, precisão de espaçamento/alinhamento e personalidade própria; usar a referência já aprovada como guia de estrutura, sem copiar uma marca ou recorrer a padrões decorativos genéricos de interfaces de IA. A reformulação geral permanece aberta até revisão tela a tela.
