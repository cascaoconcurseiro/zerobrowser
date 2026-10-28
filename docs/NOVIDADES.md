# Novidades — Zero Browser 0.1.35-dev

Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Painel mais legível

- **Receitas no painel**: botão Receitas lista as do site atual e executa sem modelo, mostrando passos e contrato de saída.

- **Gestão de conversas**: renomear, fixar no topo (★) e apagar pelo seletor — tudo salvo no perfil.

- **Aprovação no chat (opt-in)**: com  ligado e o painel aberto, a confirmação de ação aparece como cartão (Permitir uma vez / Sempre neste site / Negar). Painel fechado continua usando o diálogo do sistema; sem resposta em 60 s, a ação é negada.

- **Copiar**: cada resposta tem botão Copiar; a barra de conversas copia a conversa inteira em Markdown.

- **Tempo e tokens da execução**: cada resposta termina com “Concluído em 8,3 s · 12.345 tokens”, vindo do evento de fim da tarefa.

- **Progresso ao vivo**: durante a tarefa o painel mostra “Ação N de MAX · ferramenta” em vez de “Executando…”.
- **Linha do tempo**: cada resposta traz um resumo recolhível das ferramentas executadas, com passo e falha/código quando houver.

- **Erro com código**: a mensagem de falha mostra a etiqueta do código (, , …) para diagnosticar sem abrir o trace.

- **Transparência da resposta**: cada resposta mostra quais ferramentas consumiram rodadas (), no rodapé do cartão. É o primeiro item do lote 1 do plano de UX.

- **Estado vazio acionável**: três exemplos clicáveis (ler planilha, preencher formulário, resumir página) preenchem a caixa de comando com um clique. O smoke de UI passou a exigir isso.

- **Foco visível em toda a casca**: botões, selects, abas e caixa de texto ganham anel de foco — navegação por teclado deixa de ser às cegas.
- **Respostas mais largas**: mensagens do agente usam até 96% da largura; as suas ficam em 78%, separando quem falou.
- **Contraste dos textos secundários** elevado (nota de privacidade e dicas).

## Fallback visual

- **Sugestão de captura quando o DOM é pobre**: se  encontra 3 controles ou menos (canvas, app visual), o resultado orienta uma única  e proíbe repetir inspeção — menos rodadas e menos token em sites que o DOM não descreve.

## Fluxos com login sob autorização explícita

- **`allowCredentials` em tarefas de QA**: uma tarefa pode liberar campos de senha **apenas** nos hosts declarados
  e somente quando o chamador passa essa opção. Sem ela, senha/código continuam recusados — nada muda no uso normal.
- **Motivo real da recusa**: quando uma ação é negada por política, a mensagem agora traz o motivo específico
  (antes mostrava só “cancelada pelo usuário”).
- **Suíte `--conjunto=reais-extras`**: carrinho (SauceDemo), cadastro e carrinho (Automation Exercise), app de RH
  (OrangeHRM demo), e-mail descartável (Yopmail) e Google Planilhas.
- **Suíte `--conjunto=email`** com fixture local: mover mensagem para pasta, marcar como lida, salvar rascunho e
  enviar.

## Sites reais difíceis

- **Conteúdo principal no snapshot**: `inspect_page` passou a extrair o texto de `main`/`article`/`#content` em vez
  do `body` inteiro. Em portais pesados, menu e rodapé ocupavam o limite de texto e a manchete ficava de fora.
- **Títulos da página**: o snapshot agora traz até 12 títulos (`headings`) para o modelo se orientar sem gastar uma
  rodada extra de leitura.
- **Aceita string ou objeto**: a leitura continua compatível com páginas que devolvem texto simples.

## Segurança do canal local

- **Token do pipe restrito ao seu usuário**: no Windows, o arquivo `pipe-token` agora recebe ACL explícita
  (`icacls /inheritance:r`) só para o SID atual e SYSTEM — outros usuários locais deixam de poder lê-lo, mesmo com
  acesso à pasta do perfil. O token é apagado quando o app fecha e só é gravado depois que a instância possui o pipe
  (uma segunda instância não sobrescreve a primeira). Usa SID, não nome de conta, então perfil roaming ou
  redirecionado continua funcionando.

## Menos rodadas, mais progresso

- **Guardião de progresso**: se o agente só lê por 3 rodadas, o host injeta um aviso para agir ou concluir; na 5ª,
  manda parar de inspecionar. No meio e no fim do orçamento, lembra quantas ações restam e pede para agrupar
  ferramentas no mesmo turno.
- **`run_steps` ligado por padrão no painel**: até 12 passos conhecidos (preencher campos, marcar itens, clicar)
  numa única rodada, com pós-condição conferida pelo host em cada passo. É o maior corte de rodadas em formulários.
- **Pré-inspeção ligada por padrão no painel**: a primeira leitura da página chega pronta antes do primeiro turno do
  modelo, economizando uma rodada inteira em toda tarefa.
- **Limite de ações configurável**: 20, 40 (padrão) ou 60 em Configurações → Agente · recursos.
- **Pausa com diagnóstico**: ao parar no limite, a mensagem diz quais ferramentas gastaram as rodadas e qual foi o
  último erro, além do botão **Continuar** com o histórico.
- **Planilhas em uma chamada**: o exemplo de `sheets batch` (ler intervalo e gravar total) entrou no prompt, junto da
  proibição de inspecionar antes numa planilha.


Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Auditoria e correções

- **CSP nas páginas locais**: a casca (painel, menus) e a nova aba agora recusam script/estilo inline e conexões de
  rede. Para isso, o estilo e o script da nova aba saíram do HTML para `newtab.css` e `newtab.js`, e as cores dos
  atalhos viraram classes. Um teste de UI com Electron (`npm run test:ui`) falha se a CSP bloquear qualquer coisa.
- **APIs de extensão**: `management.getAll` lista as extensões realmente carregadas; `management.setEnabled(id,false)`
  descarrega uma extensão de terceiros na sessão; `uninstall` aponta para ⋯ → Extensões → Remover em vez de apagar
  arquivos do usuário.
- **Cliente de automação**: requisições pendentes são rejeitadas na hora em que a conexão cai, sem esperar 30 s.
- **Sem código morto**: o canal IPC `automation:list-tools` (sem consumidor) foi removido.

- **Pipe MCP autenticado**: o canal local que clientes como Claude Code e Codex usam agora exige um token criado a
  cada início (arquivo `pipe-token` na pasta de dados do usuário). Antes, qualquer processo local podia dirigir o
  navegador; agora a primeira linha da conexão precisa provar acesso à pasta do perfil.
- **Retomada funcionando de verdade**: ao pausar no limite de ações na mesma sessão, a tarefa agora vai para a lista
  com id; antes o cartão **Continuar tarefa** aparecia, mas o botão não fazia nada.
- **Módulos voltaram a rodar**: o Guardian recusava `module run` sem `code` (que usa o código salvo) por engano.
- **Contrato de saída com lote**: receita que lê dentro de `sheets batch` agora alimenta `output`/`outputValid`; antes
  falhava com “nenhuma leitura”.
- **Recursos ligados de verdade**: Receitas, cálculo/módulos no sandbox e cache de prefixo estavam no motor mas o
  painel nunca os ativava. Agora há três opções em **Configurações → Agente de IA · recursos** (receitas e módulos
  ligados por padrão; cache opt-in) e o IPC repassa as três.


Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Painel e conversas

- **Planilhas com menos ações**: `sheets` ganhou `action: "batch"` (até 12 operações — ler, gravar, ler de novo —
  numa única chamada, com uma só aprovação de escrita). O agente não precisa mais gastar uma rodada por intervalo.
- **Inspeção barata no Planilhas**: `inspect_page` numa planilha devolve só título, seleção e abas (célula não
  existe no DOM) em vez de uma árvore de acessibilidade inútil; o retorno já orienta a usar `batch` e proíbe
  clique em célula. É isso que fazia a tarefa “demorar e pedir 30 ações”.
- **Orçamento maior**: o padrão do painel subiu de 30 para 40 ações; com batch, o caso normal cabe em 4–6.

- **Histórico de conversas**: cada conversa fica salva com título e data; você alterna pelo seletor no topo do
  painel, cria uma **Nova** e continua de onde parou depois de fechar o app.
- **Resposta organizada**: o texto do modelo agora sai em parágrafos, listas, títulos, negrito e blocos de código,
  em vez de um bloco único. O parser não injeta HTML — o texto do modelo continua sendo texto.
- **Retomar tarefa**: se uma tarefa foi pausada (inclusive antes de fechar o app), aparece um cartão
  **Continuar tarefa** no topo do chat, com modelo, horário e endereço.
- **Memória do agente**: botão **Memória** mostra o que foi guardado (fatos por site e ações concluídas), com
  validade de 30 dias e opção de apagar. Senha, token e cartão são recusados na hora de guardar.
- **Módulos de operação**: com `transforms` ligado, o agente pode gravar um código curto por site
  (`module save`), executar no sandbox e repetir o cálculo sem modelo; se falhar, ele corrige e roda de novo.
- **Receitas como artefato**: `recipe_export`/`recipe_import` levam uma receita de um perfil a outro sem banco.

## Motor de IA

- **Tarefa durável**: quando o agente para no limite de rodadas, o histórico é gravado em disco e sobrevive a
  fechar o app (TTL de 20 min). Ao reabrir, a aba é recriada no último endereço e "Continuar" retoma de onde parou;
  até 8 tarefas, sem chave de API no arquivo.
- **Receitas como integração (MCP)**: `recipe_list` e `recipe_run` expõem as receitas salvas a qualquer cliente MCP.
  Rodam sem modelo, exigem a aba na origem certa, respeitam entradas obrigatórias e devolvem o contrato de saída.
- **Transformação isolada**: `transform` roda uma função determinística sobre dados já lidos (somar coluna,
  normalizar data) em processo separado, sem `require`, rede ou disco, com timeout e limite de tamanho. O Guardian
  recusa código que tente sair do contexto.
- **Guardian independente**: cada ação passa por um revisor determinístico antes de executar. Ele recusa navegação
  fora de HTTP/HTTPS, URL com usuário e senha, envio de arquivo para origem diferente da tarefa (ou de uma origem
  de login declarada) em fluxos com URL inicial declarada (run_task/MCP), formulário cross-site e receita que grava
  em modo leitura. No uso interativo, o upload depende apenas da sua aprovação no diálogo. A resposta final também
  é revisada: se o agente afirma um efeito específico (salvei, enviei, apaguei) sem contrato de verificação, o
  resultado traz `guardian` com o motivo.
- **Cache de prefixo opt-in**: `promptCache` envia `prompt_cache_key` só a provedores que têm esse campo
  (OpenAI/OpenRouter) e um breakpoint `cache_control` no system para modelos Claude. O resultado traz
  `promptCache.cacheHitRate` e diz para desligar quando o provedor não devolve token cacheado.
- **Saída com contrato por receita**: a receita declara `output` — cada campo aponta para uma célula A1 do
  intervalo lido. O host valida os valores lidos (não o que o modelo diz ter lido), converte número no padrão
  brasileiro (`R$ 1.234,56` → `1234.56`), booleano e lista, e devolve `output` + `outputValid`. Contrato quebrado
  devolve `OUTPUT_INVALID` com os problemas por campo, em vez de texto solto.
- **`sheets` como passo de receita**: ler/gravar intervalo A1 faz parte das receitas determinísticas
  (`read`, `write`, `goto`), com a mesma autoridade `read`/`write` e sem clique em célula.
- **Nome acessível padrão**: snapshot e locators usam a ordem do accname (labelledby, aria-label, rótulo nativo,
  title, placeholder, conteúdo), o que reduz clique no controle errado em qualquer site.
- **Diagnóstico do Planilhas**: `sheets` devolve `diagnostics` (caixa de nome, seleção, intervalo aplicado) e códigos
  como `NAME_BOX_NOT_FOUND` e `CLIPBOARD_EMPTY`, para saber exatamente onde falhou.
- **Credencial com escopo de origem**: campo sensível só é preenchido quando o formulário envia para a origem da
  página ou para uma origem de autenticação declarada; formulário cross-origin é recusado antes de digitar.
- **Autoridade de receita**: `read` só navega e espera; `write` pode clicar. A receita recusa cliques quando é de
  leitura.
- **Mint automático**: tarefa verificada que usou passos estáveis vira receita sozinha, sem o modelo precisar salvar.
- **Receitas v2**: schema de entrada (`{{campo}}`), validação de obrigatórios e `possibleCommit` com
  “leia antes de repetir”.
- **Pós-condições verificadas** em `run_steps`: cada passo declara `expect` e o host confere antes de seguir.
- **Journal de efeitos**: envio/compra/exclusão não se repetem às cegas; só efeito crítico entra no journal.
- **Risco por capacidade**: aprovação por credencial/destrutivo/compromisso/escrita, com motivo específico.
- **Verificação por contrato**: `url`, `text`, `absent`, `textCount` e `download`, com `check_task` e correção.
- **Extração estruturada**: `extract_table` e `read_batch` com `extract` em paralelo entre abas.

## Sites difíceis

- **Clipboard**: ler/gravar texto e TSV para colar uma tabela inteira de uma vez.
- **Sequências de teclado**: setas ×N, Tab, F2, Ctrl+seta, para navegar em grades sem clicar em célula.
- **Clique visual**: `visual_click` em coordenadas 0–1000 da captura, para o que só existe na imagem.
- **Acessibilidade do Planilhas**: alterna o modo de leitor de tela (Ctrl+Alt+Z) para tentar expor células.

## Navegador

- Perfis locais no menu ⋮, menu de contexto das abas, histórico de downloads persistente e atalhos com foco na
  página.
- O perfil e a instalação anterior permanecem recuperáveis pelos backups em `backups/`.

## Limites conhecidos

- O modo de acessibilidade do Planilhas ainda não foi validado numa conta real.
- Grounding visual depende de um modelo com visão.
- Integração por API (Sheets e afins) ainda não existe.
- Módulos rodam só sobre dados já lidos: não executam código dentro da página nem clicam sozinhos.
- Nada disto substitui o teste numa conta/site real: os números do benchmark são de fixtures locais e um modelo.
