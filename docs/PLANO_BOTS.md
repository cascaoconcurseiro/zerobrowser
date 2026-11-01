# Plano — Bots autoexecutáveis no Zero Browser

Data: 31/10/2026. **Status: Fases 1 a 5 implementadas (`0.1.56-dev` a `0.1.60-dev` em `src/bots/`).** Os arquivos citados estão implementados e testados na suíte principal.

## 0. Revisão (31/10): o bot é um espaço que o usuário cria, não uma lista de bots prontos

Direção do usuário: não uma galeria de bots fixos, e sim o usuário criar os seus por contexto ("um para o trabalho, um para compras") e que isso vá além do que os navegadores com IA fazem hoje. Os concorrentes citados no comparativo têm um assistente único para tudo. O diferencial proposto é **um bot = um espaço isolado**, com:

1. **Perfil próprio de navegação.** Logins, cookies e histórico separados (usa a infraestrutura de perfis). O bot de compras não enxerga a sessão do trabalho, e uma página maliciosa aberta por um bot não alcança os dados do outro. É segurança por construção, não só uma configuração.
2. **Memória própria, visível e editável.** Tela "o que este bot sabe" (tamanho, marca, lojas preferidas, regras do trabalho). O bot propõe guardar algo e você confirma. Conteúdo de página nunca grava na memória sozinho, porque isso permitiria a um site "ensinar" regras falsas ao bot.
3. **Autonomia em degraus, por bot.** Começa só sugerindo. Depois faz com aprovação. Depois faz sozinho as ações leves. O bot só sugere subir de nível depois de um histórico de execuções aprovadas sem correção, e você decide. Ações de pagar, enviar e apagar não sobem de nível sozinhas.
4. **Regras e limites próprios.** Sites permitidos, o que pode fazer, orçamento mensal de tokens, horários e rotinas (Fases 2 e 3).
5. **Aprender por demonstração.** Modo "me mostre": você faz a tarefa uma vez e o Zero registra os passos e os transforma em receita, em vez de você descrever. Depende de um gravador de ações que ainda não existe.
6. **Diário e desfazer.** Cada bot mantém um diário do que fez e por quê; onde der, desfaz (já existe um journal de efeitos para base).
7. **Exportar e importar bot sem dados pessoais.** A ficha com regras e passos, sem logins nem memória. Bot importado entra sem permissões e mostra exatamente o que pede.

O "pesquisador de preços" das seções abaixo vira um modelo inicial dentro desse esquema, não o produto.

## 0b. Ideias que vão além de "bot que checa preço e responde e-mail"

Pesquisar preço e responder e-mail são o que os assistentes de navegador já mostram como demonstração. Candidatas a diferencial, escolhidas porque o Zero roda dentro do navegador com sessões logadas, perfis isolados, receitas e MCP:

1. **Mandato (autoridade delegada com envelope).** Em vez de "autonomia" genérica, você assina um mandato: ação exata, sites, valor máximo, prazo de validade e número de usos. Ex.: "reserve o primeiro horário que abrir até dia 20, no máximo R$ 150, uma vez". O bot age rápido dentro do envelope e o que sai dele pede aprovação. Resolve o conflito entre agir sozinho e ser seguro.
2. **Comprovante automático.** Cada execução guarda capturas das telas de confirmação, horário, o que foi enviado e um registro que não pode ser alterado depois. Útil para rotinas de trabalho que exigem prova de entrega.
3. **Site vira ferramenta.** Qualquer site que você usa logado vira uma ferramenta chamável por outros agentes via MCP (por exemplo, "consultar pedido", "baixar relatório"). Já existem receitas expostas por MCP; falta empacotar e documentar. Mira o público técnico.
4. **O Zero observa e oferece.** Em processamento 100% local, ele nota padrões ("toda sexta você baixa X e cola em Y") e propõe virar bot. Só com seu consentimento, com lista do que foi observado e opção de apagar.
5. **Memória da web pessoal.** Busca por significado em tudo que você viu ("a tabela de frete que olhei semana passada"). Grande, sensível em privacidade; alguns navegadores já têm versões; não verifiquei o estágio atual deles.
6. **Bot de teste para quem desenvolve.** Roda os fluxos do seu site toda noite e entrega o que quebrou, com capturas.

Recomendação de ordem: 1, 2 e 3 (usam o que já existe e se reforçam); depois 4; 5 e 6 só se houver demanda.

## 0c. Referência declarada pelo usuário: ser o "Grok Bot" do navegador

Fontes consultadas em 31/10/2026: documentação oficial do Grok Bot (docs.x.ai) e um artigo de terceiros (i-scoop). O produto, em beta e com mudanças frequentes, é um conjunto de "Bots" nomeados que o usuário conversa como colegas, cada um com memória, arquivos e preferências próprias, que trabalham em apps (e-mail, Slack, Notion, Drive e navegador), rodam rotinas agendadas ou por evento, aprendem uma tarefa por gravação ("Teach a Task"), trabalham em grupo e passam tarefas entre si. Por padrão, e-mail e mensagens saem como rascunho que exige aprovação. Quando chega numa tela de login, o bot para e devolve o controle ao usuário. Segundo o artigo de terceiros, roda num computador em nuvem e o usuário não escolhe o modelo. Detalhes de preço e limites não foram confirmados por fonte oficial.

| Recurso do Grok Bot | No Zero | Situação no plano |
|---|---|---|
| Bots nomeados com memória, arquivos e preferências próprias | Bot como espaço isolado (perfil, memória visível, regras) | Seção 0, itens 1–4 |
| Conversar com o bot como colega | Painel de conversa por bot no navegador | A fazer (Fase 1) |
| Parar ao chegar no login e devolver o controle | Tarefa que pode ser retomada, já existente | Desenhado (ver Polare) |
| Aprovação por padrão, "parar agora" | Degraus de autonomia, mandato, botão parar tudo | Seção 0, item 3 e 0b |
| Ensinar uma tarefa gravando a tela | **Aprender por demonstração (gravador de ações)** | Sobe de prioridade: é o recurso central |
| Rotinas por agenda **e por evento** (e-mail novo, mudança) | Agendador (Fase 2) + gatilhos por evento | Acrescentar gatilhos à Fase 2 |
| Plugins de Gmail, Slack, Notion, Drive e navegador para o resto | O navegador já cobre o "resto"; conectores por API depois | Fase 4 |
| Grupo de bots que passam tarefas entre si | Equipe de bots | Depois da Fase 4 |
| Trabalha com o notebook desligado (computador em nuvem) | **Não tem**: o Zero roda no seu PC | Lacuna; ver abaixo |
| Falar com o bot pelo celular, Slack, X | Acesso remoto/mensagem ao bot | Lacuna; ver abaixo |

**Onde o Zero pode ser melhor:** os dados e as sessões ficam no seu computador (nada vai para a nuvem de terceiros), você escolhe o modelo e o provedor (ou roda local), usa as suas sessões já logadas, e qualquer outra IA controla o navegador por MCP (`PLANO_CONTROLE_TOTAL_IA.md`).

**Onde o Zero perde e o que fazer:**
- *Funcionar com o PC desligado.* Só com um servidor. Caminho: primeiro iniciar com o Windows e executar o que ficou pendente (Fase 2); depois, opcionalmente, um "modo servidor" com o Zero rodando numa máquina virtual do usuário. Não prometer antes de existir.
- *Falar com o bot fora do computador.* Caminho: aviso por notificação e e-mail (Fase 2) e, mais tarde, mensagem por um app de chat; exige cuidado de segurança porque dá controle remoto.

## 0c2. Caminho até um Grok Bot completo (bots que rodam sem o seu PC)

Hoje o plano cobre bots que rodam **no seu computador, com o Zero aberto ou na bandeja**. O Grok Bot, segundo descrições de terceiros, roda em um computador na nuvem compartilhado entre os bots, o que permite trabalhar com o seu aparelho desligado e conversar pelo celular. Para chegar lá existem três degraus; cada um é um produto a mais, não um ajuste.

| Degrau | O que é | Quem paga a infraestrutura | Segurança | Quando |
|---|---|---|---|---|
| 1. Local | Bots no seu PC (plano atual) | Você | Sessões ficam só no seu computador | Agora |
| 2. Servidor próprio | O mesmo executor rodando sem janela numa máquina sua que fica ligada (um PC, mini-servidor ou VPS), com o Zero como controle remoto | Você | Sessões ficam em uma máquina que você controla | Depois de os bots locais provarem valor |
| 3. Nuvem oferecida por nós | Navegadores na nuvem, contas, cobrança, suporte, celular | Nós | Sessões logadas de várias pessoas guardadas na nuvem: risco alto | Só com demanda comprovada, equipe e orçamento |

Recomendação: ir do degrau 1 ao 2 e só considerar o 3 depois. O degrau 3 muda o negócio (infraestrutura, custos por usuário, responsabilidade legal e de segurança por guardar logins de terceiros) e perde a vantagem de privacidade do Zero.

### O que decidir já, para a porta continuar aberta
- **Executor separado da janela:** o motor que roda o bot não pode depender da interface. Deve poder rodar sem janela (headless) e ser acionado por comandos do registro (`PLANO_NAVEGADOR_NATIVO_IA.md`).
- **Bot como arquivo declarativo:** ficha, agenda, regras, rotas e limites em arquivos legíveis e exportáveis, sem dados pessoais, para poder mudar de máquina.
- **Segredos atrás de uma interface:** o cofre de sessões e tokens deve ser um módulo trocável (cofre do Windows hoje, cofre do servidor depois), sem espalhar acesso direto.
- **Canal de mensagens como abstração:** Telegram primeiro, mas o bot não deve saber qual canal usa, para somar WhatsApp, e-mail ou app depois.
- **Login remoto:** quando o bot precisar de você (login, captcha, 2FA) num servidor, é preciso uma visão remota segura da aba. Hoje o plano assume que você está na frente do PC.
- **Estado em arquivos/banco portáveis:** histórico, memória e comprovantes migráveis entre máquinas.

### O que continua igual em qualquer degrau
Núcleo intocável, firewall de intenção, recibo, Desfazer e autonomia conquistada. Um servidor sem esses controles seria pior do que o bot local.

### O que ainda não sabemos
Custo real de manter navegadores ligados 24 horas, como cada site reage a acessos de um servidor (bloqueios, captcha, sessão que expira) e se o público do Zero quer isso. Medir no degrau 2 com poucas pessoas antes de pensar no 3.

## 0d. Interface: onde os bots (avatares) ficam

Interpretação do pedido "bonequinhos": cada bot tem um avatar escolhido pelo usuário (emoji, imagem ou cor + inicial) e fica sempre visível. Proposta:
- **Barra de bots** na lateral esquerda da janela, abaixo/ao lado das abas. Um avatar por bot, com um anel de estado: parado, trabalhando, precisa de você (aprovação, login, captcha) e com erro. O estado também aparece em texto e no nome acessível, nunca só por cor.
- **Clicar no avatar** abre o painel de conversa daquele bot (pedir tarefas, ver o que está fazendo, aprovar rascunhos, ver memória e histórico). O painel de IA atual vira o painel do bot selecionado.
- **Ver trabalhando:** a aba oculta em que o bot trabalha pode ser aberta para você acompanhar ao vivo e assumir o controle (takeover).
- **Central de atividade** (um clique): todas as execuções, aprovações pendentes, falhas e gastos de todos os bots, com "parar tudo".
- **Bandeja do Windows:** ícone do Zero com contador de pendências, para os bots que rodam com a janela fechada (Fase 2).
- **Cor por bot:** a cor do avatar também marca a moldura da janela quando a aba pertence àquele perfil, para você saber qual bot/perfil está agindo.
- Criar bot novo: botão "+" no fim da barra.
- Obrigatório pela acessibilidade: navegação por teclado na barra, nomes acessíveis, contraste e redução de movimento nas animações do anel.

## 0e. Como tudo vira um programa só

O Zero já é um programa só (aplicativo Electron). Os planos são camadas do mesmo aplicativo, cada uma útil sozinha:
1. Navegador: abas, perfis, biblioteca, extensões.
2. Motor do agente: tarefas, receitas, verificação, aprovação, diário de efeitos.
3. Bots: espaços com memória, agenda, histórico e interface (seção 0d).
4. Controle externo: MCP e CDP com permissões por cliente (`PLANO_CONTROLE_TOTAL_IA.md`).
5. Central: visão única de bots, execuções, aprovações, auditoria e gastos.
"Faz tudo no navegador" significa tudo o que uma página web permite com as suas sessões logadas. Programas do Windows fora do navegador ficam fora desta meta. Regra de construção: cada camada só avança depois que a anterior passa nos seus testes; não construir a interface dos bots antes de o executor e o histórico existirem.

## 0f. Revisão de 31/10 (noite): fazer o bot funcionar de verdade, só no navegador

Direção geral e marcos: `ROTEIRO_DO_MENTOR.md`. Esta seção detalha a parte de bots.

**Achado principal.** O executor do bot é uma casca: `src/main/main.js:267-271` lança "Esta rotina ainda não está conectada ao executor do navegador". `bots:run-now` exige passos já prontos (`main.js:1672`). Os conectores recebem dados de exemplo (`mockItems`). O agendador, o mandato, os gatilhos e o gravador existem e têm teste. **Falta ligar o motor; por isso os bots não parecem bots.**

**Caminho de um bot (só navegador).** Gatilho (horário, intervalo, evento) → abre aba oculta com o perfil do bot → roda o agente que já funciona pela conversa, com a missão e as permissões do bot → cada passo alimenta o anel e a linha "o que faz agora" → recibo e histórico → aviso. Uma execução por vez no começo. O perfil isolado por tarefa ainda **não existe**: hoje a execução usa o perfil atual e isso faz parte do Marco 1, não de algo pronto.

**Criar bot por descrição.** Você escreve uma frase; a IA devolve uma ficha em formato fixo: nome, símbolo, missão, quando roda, sites, permissões, limites de passo/tempo/gasto, aviso e teste sugerido. O sistema valida o formato e tenta de novo até 3 vezes; se falhar, abre o formulário simples. **A IA propõe, você aprova as permissões** (núcleo intocável). A ficha é mostrada em frases curtas: o que vai fazer, quando, onde, o que não vai fazer, quanto pode gastar. O OpenMausBot, pelo README, não faz isso.

**Continuar rodando em segundo plano.** Fechar a janela vai para a bandeja; abrir ao ligar o PC (aplicar de fato a configuração); ao acordar do sono, rodar o que ficou atrasado (a função existe). Risco a medir primeiro: aba oculta pode parar com a janela minimizada (relatos no Electron; correções recentes que não verifiquei se a versão em uso inclui). Plano B: agendador do Windows (a especificação já existe em `buildWindowsScheduledTaskSpec`). Teste de aceite do Marco 1: 7 dias seguidos com o Zero na bandeja.

**Equipe de bots.** Padrão orquestrador-trabalhadores: um bot líder divide a tarefa e delega a bots trabalhadores com contexto separado; a troca aparece numa sala da equipe (quem pediu o quê). Segundo a Anthropic, gasta cerca de 15 vezes mais tokens que um chat: exige limite de gasto por equipe e só vale quando a tarefa se divide em partes independentes. Depois do Marco 4.

**Monitor de páginas.** Comparar texto ou valor, não imagem (imagem dá alarme falso). Modo preço/estoque com mínimo, máximo e porcentagem de variação. A IA só é chamada quando algo muda. Intervalo mínimo por site (padrão sugerido 5 a 15 min; sem dado sobre limites de cada loja, testar). Usos do mesmo mecanismo: estoque, vaga de agendamento, edital, prazo, mudança de texto, concorrente, fatura. Só lê: risco baixo.

**E-mail ao vivo.** Degraus por remetente ou tipo: (1) só avisa e resume; (2) rascunho; (3) pergunta "posso responder?" e envia após o seu OK; (4) responde sozinho só para casos que você liberou, com limite pequeno. Enviar a terceiros exige aprovação e a IA não pode desligar isso (núcleo); o degrau 4 só existe se você ativar na interface. O texto do e-mail é dado externo: pode ser lido, mas não decide destinatário nem ação. Técnica: assinatura "pull" do Gmail (sem servidor público), renovar a cada 7 dias no máximo, buscar o conteúdo pelo histórico, conferir de tempos em tempos. Só com o Zero aberto. Revisão do Google para esse acesso: não verificada.

**Arquivos do computador.** `upload_file` (existe na lista de ferramentas) anexa um arquivo de Downloads ao campo da página, sem controlar o desktop. Regras: só pastas liberadas (Downloads por padrão); nome e destino entram no recibo; só o pedido do usuário decide qual arquivo e para onde; mais de uma correspondência: perguntar; arquivo com cara de documento pessoal, chave ou senha: confirmar. Não testado de ponta a ponta.

**Outros usos pedidos (por risco).** Seguros (só leitura): monitoramento, resumo da manhã, pesquisa com fontes, arquivar notas e comprovantes. Médios (rascunho e aprovação): e-mail, respostas a mensagens, agenda, carrinho de compras (para antes de pagar), formulários repetidos. Altos (sempre com a sua aprovação, risco de bloqueio da conta): publicar e responder em redes sociais (Instagram, X, LinkedIn). A maioria das redes proíbe automação por navegador; existem APIs oficiais, possivelmente pagas e com limites: confirmar na documentação antes de planejar. Pagar e transferir dinheiro ficam sempre com você.

**Grok Bot só no navegador.** Faz: bots com nome e conversa contínua, rotinas com histórico, gravar tarefa (Teach a Task), aprovações, pausar quando você está ausente, usar sites logados. Não faz sem outro degrau: rodar com o PC desligado (servidor próprio, 0c2), computador na nuvem compartilhado (nuvem), programas fora do navegador (conector de desktop, por último), aplicativo no celular (adiado), centenas de integrações prontas (começa com poucas). Detalhes do Grok Bot vêm de terceiros.

**Já corrigido antes desta revisão.** Erro de ferramenta interrompe a execução e o cancelamento entrega `AbortSignal` ao executor (`src/bots/runner.js`, coberto na `0.1.65-dev`). Não refazer; o que falta é o executor real, a agenda recorrente com persistência e a prova com uso real.

## 1. O que é

Um **bot** é uma ficha salva no navegador: objetivo, entradas, o que pode fazer, quando roda e o que entrega. Ele roda sozinho no horário, guarda o histórico e avisa quando há algo relevante. Exemplo principal: **pesquisador de preços**.

Não é um agente novo. É o agente atual (`run_task`) chamado por um agendador, com permissões restritas e resultados guardados.

## 2. O que já existe e o que falta

| Peça | Estado |
|---|---|
| Executar uma tarefa do agente (`run_task`, `src/automation/service/index.js`) | existe |
| Receitas por site com entradas e validação (`src/automation/recipe-store.js`) | existe |
| Extração estruturada com contrato de saída (`src/automation/output-schema.js`) | existe |
| Tarefa que pode ser retomada (`src/automation/job-store.js`) | existe |
| Aprovação de ação consequente, aviso de prompt injection (`injection-guard.js`) | existe |
| Armazenamento de dados do usuário (`src/store/index.js`, `src/main/library/`) | existe |
| Agendador, ficha de bot, histórico de execuções, notificação, tela de bots | **Atualizado em 31/10 (noite):** existem na pasta principal (`src/bots/scheduler.js`, `bot-store.js`, `runner.js`, `templates.js`, `recorder.js`; tela em `index.html`). Falta ligar o executor (ver 0f). |
| Execução em segundo plano sem atrapalhar a aba do usuário | **não existe:** sem bandeja, sem reação a dormir/acordar; "abrir ao ligar o PC" só guarda a configuração |

## 3. Desenho

**Ficha do bot** (`src/bots/bot-store.js`): `id`, `nome`, `modelo` (ex.: `price-researcher`), `entradas` (produto, lojas, preço-alvo), `permissao` (padrão: somente leitura), `agenda` (a cada N horas, diário, dia do mês), `limites` (passos, tempo e gasto máximos por execução e por mês), `aviso` (quando notificar), `ativo`.

**Agendador** (`src/bots/scheduler.js`, no processo principal): verifica a agenda a cada minuto, dispara uma execução por vez e, se o app estava fechado no horário, roda a execução perdida ao abrir (uma vez, sem acumular).

**Executor** (`src/bots/runner.js`): abre a execução em aba própria oculta (não mexe na aba que você está usando), chama o agente com política de somente leitura, aplica os limites, valida a saída pelo contrato do modelo e grava o resultado. Ação consequente (comprar, enviar, apagar) não é aprovada sozinha: a execução para e envia aviso pedindo sua decisão.

**Histórico**: cada execução grava data, duração, tokens, custo reportado, se usou modelo ou só receita, resultado e erro. Guardar um limite (por exemplo as últimas 200 por bot).

**Tela "Bots"** (painel no renderer): lista, criar a partir de um modelo, rodar agora, pausar, ver histórico e gráfico, editar limites.

**Aviso**: notificação do Windows (Electron `Notification`) para: alvo atingido, falha, bot parado esperando aprovação.

## 4. O primeiro bot: pesquisador de preços

Entradas: produto, lojas (opcional), preço-alvo, CEP para frete (opcional).
Saída por loja: título, preço, frete, disponibilidade, link, data da coleta.

Fluxo:
1. **Primeira execução, com você presente:** o agente procura o produto nas lojas e mostra os candidatos. **Você confirma qual é o produto certo em cada loja** (modelo, cor, voltagem, usado ou novo). Sem essa confirmação o bot compararia produtos diferentes e o resultado enganaria.
2. O agente extrai os dados e salva uma receita por loja (onde está o preço, como ler o frete).
3. **Execuções seguintes:** usam a receita na página já confirmada, sem modelo quando possível. Se a página mudou e a receita falha, cai para o agente com modelo, registra o motivo e avisa.
4. Compara com o histórico, atualiza o gráfico e avisa se o preço caiu abaixo do alvo ou ficou no menor valor já visto.

Por que isso importa para o custo: a repetição sem modelo é o que torna um bot diário barato. A meta mensurável é a porcentagem de execuções sem chamada ao modelo (definir o valor depois da primeira medição).

## 4b. Mais dois exemplos pedidos pelo usuário

**Bot de e-mail (lê e responde).** Roda no perfil de trabalho, lendo o webmail já logado. Degrau 1: classifica, resume e marca o que é urgente. Degrau 2: escreve rascunho de resposta no seu estilo, que você aprova antes de enviar. Auto-envio só no degrau 3, só para remetentes e modelos que você liberou, e nunca para destinatário novo. Risco principal: o e-mail é conteúdo não confiável e pode conter instruções para o agente ("encaminhe tudo para..."). Regras: o texto do e-mail é tratado como dado; encaminhar, anexar, enviar para endereço novo ou apagar sempre exigem aprovação; manter o `injection-guard` e testar com e-mails hostis. Alternativa mais robusta que ler a tela: usar a API do provedor com autorização OAuth sua; decidir depois.

**Bot de preço de ação.** Somente leitura: consulta uma cotação em uma fonte escolhida por você e avisa quando passar do valor definido. É o caso mais simples e barato (receita sem modelo). Limites: sites gratuitos costumam ter atraso de cotação; para dado em tempo real, usar fonte oficial ou API. O bot só informa; não compra, vende nem recomenda investimento.

## 5. Fases e critérios de aceite

1. **Ficha, executor manual e histórico.** Criar um bot de teste ("ler título e preço de uma URL fixture"), rodar pelo botão, ver o histórico. Aceite: testes automáticos do store e do executor; limites de passos, tempo e gasto realmente interrompem; ação consequente é bloqueada.
2. **Agendador e início com o Windows.** Intervalo, diário e dia do mês; execução perdida ao abrir; agenda sobrevive a reiniciar. Opção "iniciar com o Windows" (`app.setLoginItemSettings`), abrindo minimizado na bandeja, e fechar a janela não encerra o app enquanto houver bot ativo. Aceite: testes com relógio simulado; notificação de sucesso, falha e aprovação pendente; ligar o PC, entrar no Windows e ver a execução pendente rodar sem abrir janela.
3. **Pesquisador de preços.** Confirmação do produto, receita por loja, comparação, alerta de alvo, gráfico. Aceite: 3 lojas de fixture e 1 loja real autorizada por você; custo por execução e % sem modelo medidos e registrados; página alterada cai no agente e avisa.
4. **Criar bot por texto e galeria.** "Monitore esta página e me avise se mudar" vira ficha. Mais modelos: monitor de mudança, resumo diário, acompanhamento de entrega. Sugestão "você repetiu isto 3 vezes, salvar como bot?".
5. **Rodar com o Zero fechado e PC dormindo.** Tarefa agendada do Windows que abre o Zero no horário (e pode acordar o PC da suspensão, se a opção de energia permitir). Aceite: executa e fecha sem deixar processo preso.

## 6. Segurança e limites de uso
- Bot nasce somente leitura. Dar mais permissão é decisão explícita sua, por bot.
- Nenhuma senha ou chave dentro da ficha. Sites com login usam a sessão do perfil, e a execução para se a sessão expirou.
- Conteúdo de página pode tentar instruir o agente; manter o `injection-guard` ligado nos bots e testar com página hostil.
- Gasto máximo por execução e por mês, com botão de parar tudo.
- Captcha e bloqueios de lojas: o bot avisa e para, não tenta contornar. Alguns sites proíbem coleta automática nos termos de uso; isso é decisão sua, bot por bot.
- Até a Fase 2, o Zero precisa estar aberto no horário. A partir dela, ele pode iniciar com o Windows, mas só depois que você entra na sua conta; com o PC desligado ou suspenso, a execução espera e roda ao ligar (uma vez, sem acumular).

## 7. Riscos
- **Produto errado comparado.** Mitigação: confirmação na primeira execução e link fixo por loja.
- **Páginas mudam e a receita quebra.** Mitigação: fallback para o agente e aviso, com contador de falhas por bot.
- **Custo de modelo em bots diários.** Mitigação: receita primeiro, limites de gasto e a Etapa 1 do `PLANO_MOTOR.md` (barateia cada chamada).
- **Execução em segundo plano afetando a navegação.** Mitigação: aba oculta própria e uma execução por vez.

## 8. Ordem em relação aos outros planos
As Fases 1 e 2 não dependem do benchmark e podem começar já. A Fase 3 deve esperar pelo menos a Etapa 1 do `PLANO_MOTOR.md` para medir o custo de forma confiável.

## 9. Decisões suas
- Primeiro bot: pesquisador de preços, em quais lojas, com qual produto de teste.
- Aviso: notificação do Windows já na Fase 2; e-mail ou celular só depois, se necessário.
- Permitir ou não que bots rodem com o Zero fechado (Fase 5).
