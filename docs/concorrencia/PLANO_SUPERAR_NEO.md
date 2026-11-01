# Plano: superar o BrowserOS neo (31/10/2026)

Meta do Wesley: "ganhar tudo deles". Aqui "ganhar" só conta quando houver medida: cada linha abaixo termina num teste de sim ou não, rodado dos dois lados. Sem teste pareado, nada é marcado como vencido. Direção geral em `ROTEIRO_DO_MENTOR.md`.

## O que foi visto (app instalado do neo, só leitura)

Cinco telas: Home, Skills, Connected agents, History, Settings. Visual: fundo azul-claro, títulos em sans-serif (a serifa com itálico azul é só do site), cartões brancos, azul só na ação. O neo observa agentes externos (Claude Code, Codex, Cursor...); não cria nem edita bots. O servidor MCP dele fica em `http://127.0.0.1:9010/mcp`.

## Onde o neo está à frente (a conquistar)

1. **Grupo de abas por tarefa/bot.** Cada agente trabalha no seu grupo e não pisa na aba do usuário. Resolve o "isolamento por Bot" que o HANDOFF diz não existir. Teste: dois bots rodando juntos sem trocar a aba um do outro.
2. **Pedir ajuda humana** (login, código, captcha): o agente espera, o usuário recebe aviso, depois continua. Conferir o que `agent-runtime.js` e `runner.js` já fazem antes de construir. Teste: bot parado num captcha avisa e retoma após a resposta.
3. **Painel "Acontecendo agora".** Um cartão por tarefa com miniatura, estado, última ação com tempo, quem faz e botão Parar. Base do painel novo de bots (`PLANO_DESIGN_UX.md` 11d).
4. **Histórico simples** com busca e filtro "precisa de atenção"; retenção configurável (ele usa 7 dias) e limpeza de imagens/gravações.
5. **"Salvar como skill"** depois de uma tarefa. Equivale a criar Bot fazendo uma vez (Marco 1 do roteiro).
6. **Janelas e perfis por agente**, `pdf` e `grep` de página, cofre de credenciais.
7. **Estado vazio que ensina**, e privacidade em duas listas ("coletamos" / "nunca coletamos").

## Onde o Navegante já está à frente (manter)

Segurança (guarda de injeção, de exfiltração, firewall de intenção, 50 ataques), CDP cru, `hidden_action` (shadow DOM e iframe), `cua_action`, cálculo exato, planilhas, rotas aprendidas, bots com agenda e Parar tudo, e criar bot por uma frase (o neo não tem). Isto é a vantagem a proteger.

## Ordem proposta

1. Teste pareado: subir o MCP do Navegante e rodar as mesmas 5 tarefas no neo e no Navegante, medindo tempo, acertos e custo. Antes disso, nenhuma afirmação de superioridade.
2. Grupo de abas por bot (item 1) e ajuda humana (item 2): fecham o Marco 1 do roteiro.
3. Painel e histórico (itens 3, 4, 7) junto do mockup novo, já com a paleta azul aceita.
4. Salvar como skill (item 5), depois perfis/janelas, pdf, grep e cofre (item 6).

## Pendente

Confirmar no código o que está só declarado (nenhuma ferramenta do MCP do Navegante foi chamada nesta rodada). Os números do item 1 acima ainda não existem.

## Pedido do Wesley (31/10/2026): configurações e resto iguais ao neo

Interpretação a confirmar: Configurações, menu lateral e telas de apoio do Navegante seguem a estrutura e o visual do app do neo. Estrutura de Configurações do neo (vista só em leitura): "Enquanto sua IA trabalha" (perguntar quando travar + notificação de teste; fechar as páginas que abriu ao terminar), Aparência (Claro, Escuro, Seguir o navegador), Histórico e armazenamento (manter histórico por 7 dias; espaço usado; limpar agora), Privacidade (uso anônimo; listas "coletamos" e "nunca coletamos"), Ajuda (guia e detalhes para suporte). Menu: Início, Skills, Agentes conectados, Histórico, Configurações, com o contador de agentes no canto.

Riscos: (1) copiar o desenho e a organização é seguro, copiar código não; confirmar a licença do BrowserOS antes de reaproveitar qualquer trecho. (2) O Navegante tem coisas que o neo não tem (chave do provedor, modelos, bots, consentimentos, motor): ficam, só reorganizadas no mesmo estilo. (3) Isto é trabalho de interface grande; só começa depois do mockup aprovado.

## Resultado do teste pareado (31/10/2026, 1 rodada, sem modelo)

Tarefas 01 a 05 do `bench/tarefas.js`, páginas locais, verificadas pelos verificadores do próprio projeto. Os dois lados recebem os mesmos passos: o Navegante pelo MCP (`browser_locator_action`, perfil isolado de teste), o neo pelo `run` (referências do snapshot). Mede o controle, não a qualidade de nenhum modelo.

| Tarefa | Navegante | neo |
|---|---|---|
| 01 botão | passou | passou |
| 02 formulário | passou | passou |
| 03 select | passou | passou |
| 04 checkboxes | **falhou**: uma chamada `browser_locator_action` ficou 20 s sem resposta e nada foi salvo | passou |
| 05 radio | passou | passou |

Placar: Navegante 4/5, neo 5/5. **Tempo e número de chamadas não são comparáveis nesta rodada**: o script do Navegante inclui pausas fixas (1,2 s por página) e o limite de 20 s da chamada travada; o neo abre uma aba nova por tarefa. Só uma rodada por lado.

Achados: (1) a falha na 04 é real e é a primeira prioridade; ainda não sei qual passo travou nem a causa (candidatas: clique em checkbox dentro de `label`, ou pedido de aprovação interno aguardando resposta). Investigar antes de qualquer outra coisa. (2) `fill` em `<select>` funcionou no Navegante nas tarefas 02 e 03. (3) A lista de ferramentas do MCP do Navegante tem 22 itens, todos declarados em `registerTools`; não há `select` nem `check/uncheck` próprios, só `locator_action`.

Próximo passo: repetir a 04 isolada com registro de cada chamada, corrigir, e rodar 3 repetições dos dois lados antes de falar em tempo.

## Tela "Agentes conectados" do neo vs. Navegante (31/10/2026)

O que o neo mostra (visto, só leitura): título e frase ("Esses agentes de IA podem usar o neo para navegar por você. Conecte um e reinicie-o uma vez"); **endereço MCP** com botão Copiar (`http://127.0.0.1:9010/mcp`); cartão destacado do app Claude Desktop ("precisa de uma extensão, uma vez"); lista **Conectados 6 de 6** (Claude Code, Codex, Cursor, OpenCode, Antigravity, VS Code), cada um com "Pronto para usar", estado "Conectado" e menu "Mais"; botão **"Configurar à mão"**; no rodapé da barra lateral, "6 agentes conectados" com as caras dos agentes, que leva a essa tela. Não abri os menus "Mais" nem o "Configurar à mão".

| Opção do neo | Navegante hoje (conferido no código) |
|---|---|
| Tela própria de agentes conectados | **Não existe.** Só a seção "Clientes de IA" em Configurações, com um seletor de nível (somente leitura, interagir perguntando, interagir automático, controle total). |
| Endereço MCP para copiar | **Não.** O MCP principal vai por pipe local, usado por `scripts/mcp-stdio.js`; o servidor HTTP do `mcp-http-server.js` sobe em porta aleatória e pede token. Nada disso aparece na tela. |
| Conectar cada agente com um clique | **Não.** A conexão é manual: `claude mcp add navegante -- node ...\scripts\mcp-stdio.js`. |
| Lista de agentes com estado | **Só no código.** `McpClientRegistry` guarda clientes, token, nível, expiração, revogação e auditoria, mas não há IPC nem tela que mostre isso. |
| "Configurar à mão" | Não existe; existe só a linha de comando acima, em comentário de código. |
| Contador de agentes na barra lateral | Não. |
| Reiniciar o agente depois de conectar | Não há aviso. |

**Onde o Navegante já tem mais:** níveis de acesso por ferramenta (observar, interagir, desenvolvedor, total), expiração e revogação por cliente, auditoria das chamadas e núcleo intocável. O neo, pelo que vi, só liga e desliga o agente.

**Proposta para superar (Configurações > Agentes conectados):**
1. Endereço e comando prontos, com Copiar; o texto muda por agente.
2. Uma linha por agente conhecido (Claude Code, Claude Desktop, Codex, Cursor, VS Code, OpenCode, outro) com "Conectar" detectando se está instalado.
3. **Conectar mexe na configuração de outro programa**, então mostra a alteração exata e só aplica depois de confirmação por agente; nunca em lote e nunca em silêncio.
4. Para cada agente conectado: nível de acesso próprio, validade, última atividade, "Revogar" e "Ver o que fez" (auditoria).
5. "Configurar à mão" com o passo a passo e aviso de reiniciar o agente.
6. Contador "N agentes conectados" no canto da barra lateral, levando a essa tela.
7. Teste de sim ou não: conectar o Claude Code por esta tela, listar as ferramentas, revogar e ver a chamada seguinte ser negada.

## Caminho para igualar o neo (decidido em 31/10/2026)

Ordem fixa. Cada passo só fecha com o teste de sim ou não passando. Nota de partida do Navegante: 5,5/10 (ver `docs/concorrencia/PLANO_SUPERAR_NEO.md` e a avaliação registrada no HANDOFF).

1. **Motor (código pequeno, resultado medido).**
   - Achar a causa do travamento de 20 s na tarefa 04-checkboxes (N01) e corrigir.
   - Repetir o teste pareado 3 vezes de cada lado, com as mesmas 5 tarefas.
   - **Fecha quando:** Navegante 5 de 5 e tempo igual ou menor que o do neo.
2. **Tela "Agentes conectados".** Endereço MCP, conectar por agente com um clique (com confirmação da alteração exata), nível, validade, revogação e auditoria. Níveis, revogação e auditoria já existem no código; falta a tela.
   - **Fecha quando:** um agente se conecta pela tela sem editar arquivo à mão, e a chamada seguinte depois de revogar é negada.
3. **Visual e Configurações.** Mockup azul de Configurações e menu primeiro, aprovado pelo Wesley antes do código. Copiar padrão (layout, hierarquia, espaçamento), não código nem arquivos visuais do neo. Conferir licença antes de qualquer cópia mais próxima.
   - **Fecha quando:** Wesley aprova no app instalado e os testes de contraste e de seis tamanhos de janela passam.
4. **Recursos de uso.** Painel "acontecendo agora", histórico, grupo de abas por bot, pedido de ajuda humana. Base já existe: selo de aba do bot e aprovação.
   - **Fecha quando:** um bot rodando aparece no painel, com aba própria e botão de assumir.
5. **Mostrar o que já é melhor.** Firewall de intenção, recibo com Desfazer e auditoria aparecem para o usuário, não escondidos.
   - **Fecha quando:** a tela de Configurações ou o recibo mostra essas garantias sem o usuário procurar.

Limite: "ganhar" só conta com medida. A medida com modelo real depende de orçamento aprovado pelo Wesley.

## Estado conferido em 01/11/2026

Este roteiro comparativo contém observações datadas de 31/10 e várias lacunas que mudaram desde então. No código `0.1.78-dev`, executor, isolamento por Bot, agenda persistente e painel já existem; a conversa do Bot usa `BotRunner`. O painel foi redesenhado e verificado localmente em seis tamanhos via `test:delegation-layout`. O teste pareado registrado acima continua sendo somente 1 rodada e não foi repetido nesta sessão: 4/5 vs. 5/5 permanece a única evidência comparativa listada aqui. Grupo de abas por Bot, ajuda humana, conectores reais, tela de agentes conectados e revisão no app instalado seguem pendentes. Não inferir superioridade ao neo/GrokBot pelos testes de integração locais.
