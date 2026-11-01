# Roteiro do mentor — o que construir, em que ordem e como manter simples

Data: 31/10/2026. Este é o **documento de direção**. Os outros planos (`PLANO_*.md`) detalham cada parte; este diz **o que vale a pena fazer primeiro e o que fica para depois**. Foi escrito para o Wesley (que não programa) e serve também para qualquer IA que continue o trabalho. Se algum plano contradisser este roteiro, vale este roteiro, e o plano deve ser corrigido.

## 1. O produto em uma frase

**Um navegador onde você diz o que quer em uma frase, um bot passa a fazer isso sozinho, mostra a prova do que fez e deixa você desfazer com um clique.**

Tudo o que não ajuda essa frase é extra e fica para depois (seção 7).

## 2. Onde estamos de verdade (conferido no código em 31/10/2026)

Fonte: pasta principal `C:\Users\Wesley\Documents\Navegante`, reconferida ao incorporar este roteiro: versão `0.1.68-dev`, branch `main` no commit `2dea0dc` (o dos próprios documentos), árvore limpa (só `audit-*.txt` não rastreados) e `npm test` 414/414. A primeira versão deste texto foi escrita numa cópia de trabalho parada na `0.1.43-dev`; a tabela abaixo já reflete a pasta principal.

| Peça | Estado |
|---|---|
| Agendador de bots (diário, por intervalo, execução perdida, bots parados), gatilhos por evento, mandato com limites | **Existe**, com teste (`src/bots/scheduler.js`, `scheduler-mandates.test.js`); sem relógio recorrente, sem persistência e em UTC |
| Ficha do bot, modelos prontos, gravador de tarefa, catálogo de avatares | **Existe** (`bot-store.js`, `templates.js`, `recorder.js`, `bot-avatar-catalog.js`); desde a 0.1.67 o avatar é símbolo de traço, não retrato |
| Firewall de intenção, guarda contra injeção, diário de efeitos, rotas aprendidas, registro de comandos | **Existe como arquivo**; falta provar com uso real (`intent-firewall.js`, `injection-guard.js`, `effect-journal.js`, `learned-routes.js`, `command-registry.js`) |
| Ferramenta de anexar arquivo da pasta Downloads (`upload_file`) | **Existe** na lista de ferramentas do agente; não testada de ponta a ponta |
| **Executor do bot (o que de fato roda a tarefa)** | **Ligado na `0.1.69-dev`.** A missão do bot vira uma execução do mesmo agente da conversa, numa aba oculta que fecha no fim, inclusive em falha ou cancelamento (`src/bots/agent-executor.js`; 7 testes). Prova com site real e 7 dias: ainda não. |
| Conectores (e-mail, agenda etc.) | **Dados de exemplo** (`mockItems`); não achei login real |
| Bandeja do sistema, reação a dormir/acordar, "abrir ao ligar o PC" aplicado | **Não existe** (só a configuração é guardada; não há `Tray` nem `powerMonitor` em `main.js`) |
| Interface dos bots | Existe, mas com camadas demais (seção 8) |

**Corrigido desde o rascunho:** erro de ferramenta já interrompe a execução e o cancelamento já entrega `AbortSignal` ao executor (`src/bots/runner.js`, coberto na `0.1.65-dev`). O executor real foi ligado na `0.1.69-dev`. O que continua faltando é a **agenda recorrente com persistência**, o **perfil isolado por tarefa** e a **prova com uso real** — não é preciso refazer o que já foi corrigido.

**Leitura honesta:** há muito planejado e várias peças soltas. O que falta agora é **provar com uso real** e fechar o segundo plano (bandeja, dormir/acordar). Planejar mais não resolve isso.

## 3. O alvo real e a demonstração de um minuto

**Primeiro teste: uma rotina real e repetida, de qualquer pessoa** (o Wesley é o primeiro testador). O Bot serve a todos os usuários (ver `docs/bots/CASOS_DE_USO_BOTS.md`). Se o Zero fizer uma rotina sozinho e certo, há prova verdadeira e medível: tempo economizado.

**Demonstração que impressiona qualquer pessoa em um minuto:**
1. Você escreve "me avise quando esse preço cair" ou "faça minha rotina do mês".
2. O bot aparece com o anel animado e uma linha dizendo o que faz agora.
3. Ele trabalha, avisa e entrega com a prova (recibo) do que fez.
4. Você clica em Desfazer e volta ao estado anterior.

## 4. Regras do mentor

1. **Uma coisa por vez, terminada e provada,** antes da próxima.
2. **"Pronto" só depois de ver rodar.** Planejado ou documentado não conta.
3. **Todo marco tem um teste de sim ou não.** Se não passar, não avança.
4. **Cortar o que não prova a frase da seção 1** (lista na seção 7).
5. **Dizer o que não se sabe.** Nada de número, data ou resultado inventado.
6. **Decidir por quem?** Continua valendo: pessoas que automatizam sites (nicho técnico). Mudar isso exige decisão sua.

## 5. Simplicidade: regras para um usuário comum entender

O sistema tem de ser entendido por quem nunca viu um bot. Regras que valem para toda tela e todo texto:

- **Um nome só:** "Bot". Não usar "Perfil", "Especialista" nem "GrokBot" no texto da interface (hoje aparecem).
- **Poucas palavras fixas:** Bot, Rotina, Avisar, Recibo, Desfazer, Parar tudo. Cada uma significa uma coisa e nada mais.
- **Cada tela faz uma pergunta.** Se a tela precisa de mais de uma, são duas telas.
- **No máximo três ações visíveis por vez.** O resto fica em um menu de contexto.
- **A IA explica antes de agir:** ao criar um bot, ela escreve em frases curtas o que ele vai fazer, quando, onde, o que não vai fazer e quanto pode gastar.
- **Sem jargão** (rota, MCP, perfil, partição, mandato). Se for preciso, uma frase explica ao lado.
- **Sem emoji como ícone.** Símbolos de traço dentro do anel (decisão já tomada).
- **Prova de simplicidade (teste de 5 segundos):** mostrar a tela a uma pessoa por 5 segundos; ela precisa dizer o que o bot faz e o que fazer a seguir. Meta: 4 de 5 acertam.

## 6. Marcos de construção (cada um com teste de sim ou não)

**Marco 1 — O bot roda de verdade.**
Ligar o executor ao agente que já funciona pela conversa. *(Feito na `0.1.69-dev`: a missão abre aba oculta, roda o agente e fecha a aba.)* O bot executa a missão, grava recibo e avisa. *(O perfil isolado por tarefa ainda não existe: hoje a execução usa o perfil atual. Isolar o perfil é parte do marco, não algo já pronto.)*
Teste: um bot de monitoramento de preço roda por **7 dias seguidos**, com o Zero na bandeja, sem estar em primeiro plano, e avisa quando o preço muda.
Inclui: bandeja do sistema (fechar vai para a bandeja), abrir ao ligar o PC, rodar o que ficou atrasado ao acordar (a função de execução perdida já existe).
Risco principal a medir: aba oculta pode parar quando a janela é minimizada (relatos no Electron). Plano B: agendador do Windows (a especificação já existe no código).

**Marco 2 — Uma frase cria o bot.**
A IA devolve uma ficha com formato fixo (nome, símbolo, missão, quando roda, sites, permissões, limites, teste sugerido). O sistema valida e tenta de novo até 3 vezes se vier errado. A IA só **propõe** permissões; você aprova.
Teste: de 10 frases diferentes, pelo menos 8 viram uma ficha correta e o primeiro teste roda.

**Marco 3 — Uma rotina real sua.**
A rotina mensal escolhida por você roda com recibo e Desfazer, e você mede o tempo ganho.
Teste: ela termina certa por 2 meses seguidos, ou pelo menos por 3 execuções de teste comparadas à mão.

**Marco 4 — Painel novo e demonstração.**
Painel de bots simples e bonito (seção 8), com anel animado e linha "o que faz agora", e um vídeo curto da seção 3.
Teste: teste de 5 segundos com 4 de 5 acertos.

**Marcos seguintes (só depois dos quatro; teste de sim ou não a definir quando chegar a vez):**
5. E-mail ao vivo: avisar, rascunho, responder com seu OK.
6. Equipe de bots (bot líder delega a bots trabalhadores).
7. Servidor próprio, para os bots rodarem com o PC desligado.
8. Conectores nativos (Telegram primeiro) e itens da comunidade (primeiro bots como arquivo).
9. Desktop como conector, desligado por padrão.

## 7. O que fica de fora por enquanto (e a condição para voltar)

| Item | Volta quando |
|---|---|
| Controle do desktop (clicar em qualquer programa) | O núcleo intocável estiver provado no navegador (Marco 3) |
| Nuvem oferecida por nós, como o Grok Bot | Houver demanda comprovada com o servidor próprio |
| Aplicativo no celular e sincronização | Depois do Marco 4 |
| Publicar em redes sociais (Instagram, X) | Depois dos monitores e do e-mail; sempre com sua aprovação; risco de bloqueio da conta |
| Loja de extensões da comunidade e servidores MCP de terceiros | Houver usuários e alguém para revisar |
| Rede de rotas opt-in | Depois de medir as rotas |

## 8. Design: decisões e pendências desta rodada

- **Diagnóstico do painel atual** (`index.html`): camadas demais empilhadas (cabeçalho de 3 linhas, aviso, faixa de controle, barra do bot, 5 abas, barra de conversas, menu "Mais ações" com 9 itens), três nomes para a mesma coisa, emoji como ícone, criação de bot em formulário de quatro campos. Conferido no código em 31/10: 5 abas, `Mais ações`, emoji 🛒 e `--accent: #326f61`.
- **Painel novo:** só cabeçalho de uma linha, conversa e campo de texto. Agenda, memória, rotas e histórico vão para a página do bot. Os 9 itens viram menu de contexto.
- **Criar bot:** uma frase; a IA devolve a ficha; você ajusta, aprova e clica "Testar agora".
- **Bots vivos:** o anel muda de forma conforme o estado (parado, trabalhando, esperando você, erro); cada bot mostra uma linha do que faz agora; a troca entre bots aparece numa sala da equipe. Respeitar "movimento reduzido".
- **Inspiração visual: BrowserOS neo.** Do site (não do aplicativo, que não consegui abrir): fundo claro azulado (#F9FBFF), texto cinza-escuro (#393F49), uma cor de ação azul (#0254EC), cantos de 12 px, títulos em serifa e rótulos em fonte mono. No app, painel com um bloco ao vivo por agente e replay com linha do tempo. **Inspirar-se, não copiar:** manter o espírito (claro, calmo, uma cor) com identidade própria.
- **Pendente de decisão:** aceitar sair do verde (#326f61) para a paleta clara com uma cor de ação. Até lá, o verde segue.
- **Próximo passo de design:** mockup visual da criação de bot e do painel novo, antes de qualquer código.

## 9. O que a pesquisa desta rodada mostrou (resumo, com ressalvas)

- **OpenMausBot** (Apache-2.0, TypeScript, Electron): chat estilo Telegram em que cada bot é um agente real; rotinas, gatilhos, aprovações em cartão, modo sem janela, servidor MCP, times por arquivo Markdown. O README **não** descreve criar bot por descrição (essa ideia é nossa). Não li o código. Estudar o gerenciador de permissões e a separação entre motor e interface antes de desenhar o nosso recibo. Não usar a pasta `enterprise/` (licença própria).
- **Hermes Agent** (Nous Research, MIT, fontes secundárias): cria e melhora skills sozinho, memória pesquisável entre sessões, um bot acessível por Telegram/Discord/Slack/WhatsApp, tarefas agendadas em linguagem natural, subagentes isolados.
- **Multiagente (Anthropic):** padrão orquestrador-trabalhadores; segundo a Anthropic, cerca de 15 vezes mais tokens que um chat. Exige limite de gasto por equipe.
- **Monitoramento de páginas (changedetection.io):** comparar texto ou valor, não imagem; modo de preço com mínimo, máximo e porcentagem de variação. Limites de frequência por site: **não encontrei**; testar.
- **E-mail (Gmail):** aviso por Pub/Sub com assinatura "pull" funciona sem servidor público; a assinatura expira e deve ser renovada ao menos a cada 7 dias; o aviso traz só um número de histórico; entrega não garantida (conferir de tempos em tempos). Só funciona com o Zero aberto. Se o Google exige revisão do app para esse acesso: **não verifiquei**.
- **Segurança:** injeção indireta de instruções em navegadores com IA segue sem solução (pesquisa de 2026). Por isso o Zero não confia em detector: confia em firewall de intenção, aprovação, limites (mandato) e Desfazer.
- **Arquivos:** anexar da pasta Downloads é possível com `upload_file`, sem controlar o desktop. Regras: só pastas liberadas; nome do arquivo entra no recibo; o pedido do usuário decide qual arquivo vai e para onde, nunca um e-mail ou página; arquivos com cara de documento pessoal pedem confirmação.

Fontes: https://github.com/electron/electron/issues/42140 · https://developers.google.com/gmail/api/guides/push · https://www.anthropic.com/engineering/multi-agent-research-system · https://mintlify.com/dgtlmoon/changedetection.io/advanced/processors · https://darkreading.com/application-security/no-perfect-fix-ai-browser-prompt-injection-flaws · https://electronjs.org/docs/api/power-monitor · https://github.com/milind-soni/OpenMausBot · https://agentic-ai.readthedocs.io/en/latest/AgentPlatforms/hermes-agent/ · https://browseros.com/neo/

## 10. Decisões já tomadas e perguntas abertas

**Tomadas:** núcleo intocável; paridade limitada e Desfazer como aposta principal; avatares em anel; mockup do modo Delegar como base; produto único com o navegador no centro; desktop por último.

**Abertas (perguntas para o Wesley):**
1. Qual rotina real e repetida o primeiro bot valida? Resolvido: o Polare era só exemplo; a primeira rotina validada é o monitor de preço, e as demais saem da biblioteca de modelos em `docs/bots/CASOS_DE_USO_BOTS.md`.
2. Qual loja ou produto serve de primeiro teste do monitor de preço? — **pendente de resposta**.
3. O PC fica ligado quando os bots precisam trabalhar? (define se o servidor próprio entra cedo)
4. Aceita sair do verde para a paleta clara?
5. Primeiras ações do Desfazer (sugestão: agenda e rascunhos de e-mail).
6. Que pasta o bot pode ler para anexar arquivos (sugestão: só Downloads).

## 11. Como usar este roteiro

- Implementação **só em uma sessão aberta na pasta principal**; a cópia de trabalho ficou como histórico e não recebe código.
- Antes de cada marco, ler só o plano correspondente (`docs/bots/PLANO_BOTS.md` para o Marco 1 e 2; `PLANO_DESIGN_UX.md` para o 4).
- Ao terminar um marco: marcar no `CHECKLIST_PLANOS_2026-10-31.md`, atualizar o topo do `HANDOFF.md` e só então abrir o seguinte.
