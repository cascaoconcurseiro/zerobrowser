# Novidades — Zero Browser 0.1.13-dev

Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

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
  de login declarada), formulário cross-site e receita que grava em modo leitura. A resposta final também é
  revisada: se o agente afirma um efeito específico (salvei, enviei, apaguei) sem contrato de verificação, o
  resultado traz `guardian` com o motivo.
- **Cache de prefixo opt-in**: `promptCache` envia `prompt_cache_key` só a provedores que têm esse campo
  (OpenAI/OpenRouter) e um breakpoint `cache_control` no system para modelos Claude. O resultado traz
  `promptCache.cacheHitRate` e diz para desligar quando o provedor não devolve token cacheado.
- **Guardian independente**: cada ação passa por um revisor determinístico antes de executar. Ele recusa navegação
  fora de HTTP/HTTPS, URL com usuário e senha, envio de arquivo para origem diferente da tarefa (ou de uma origem
  de login declarada), formulário cross-site e receita que grava em modo leitura. A resposta final também é
  revisada: se o agente afirma um efeito específico (salvei, enviei, apaguei) sem contrato de verificação, o
  resultado traz `guardian` com o motivo.
- **Cache de prefixo opt-in**: `promptCache` envia `prompt_cache_key` só a provedores que têm esse campo
  (OpenAI/OpenRouter) e um breakpoint `cache_control` no system para modelos Claude. O resultado traz
  `promptCache.cacheHitRate` e diz para desligar quando o provedor não devolve token cacheado.
- **Saída com contrato por receita**: a receita declara `output` — cada campo aponta para uma célula A1 do
  intervalo lido. O host valida os valores lidos (não o que o modelo diz ter lido), converte número no padrão
  brasileiro (`R$ 1.234,56` → `1234.56`), booleano e lista, e devolve `output` + `outputValid`. Contrato quebrado
  devolve `OUTPUT_INVALID` com os problemas por campo, em vez de texto solto.
- **`sheets` como passo de receita**: ler/gravar intervalo A1 agora faz parte das receitas determinísticas
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
- **Planilhas**: ferramenta `sheets` lê/grava intervalo A1 (TSV + clipboard + teclado), sem clicar em célula.
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
- Build `0.1.6-dev` (histórico); o perfil e a instalação anterior permanecem recuperáveis pelos backups em `backups/`.

## Limites conhecidos

- O modo de acessibilidade do Planilhas ainda não foi validado numa conta real.
- Grounding visual depende de um modelo com visão.
- Integração por API (Sheets e afins) ainda não existe.
- Nada disto substitui o teste numa conta/site real: os números do benchmark são de fixtures locais e um modelo.
