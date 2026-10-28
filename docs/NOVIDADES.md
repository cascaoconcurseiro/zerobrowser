# Novidades — Zero Browser 0.1.18-dev

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
