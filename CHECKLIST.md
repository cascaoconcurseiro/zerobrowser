# Checklist — Zero Browser

## Transformação de produto e marca

- [x] Definir a marca visível como **Zero Browser**.
- [x] Atualizar nome exibido no pacote, título, cabeçalhos e documentação principal.
- [x] Criar símbolo visual Zero Browser e aplicá-lo aos painéis e ícone do aplicativo.
- [x] Preservar `appId` e identidade interna `navegante` para manter o perfil existente durante a mudança de marca.
- [x] Fazer build Windows e conferir nome/ícone, instalador, executável e atalhos; criar backup verificável antes de instalar por cima.

## Painel de IA inspirado no formulário do Flame

- [x] Inspecionar o formulário real do Flame: caixa de comando, anexos por seletor/arrastar-e-soltar, tags de contexto e skills, seletor de modelo no rodapé, abas de provedor, busca, filtros populares/grátis/todos, modelos customizados, fila e enviar/interromper.
- [x] Levar provedor, credencial, configurações e catálogo de modelos para Configurações do Zero Browser; manter o provedor/modelo preferido salvo.
- [x] Refazer a estrutura do compositor no rodapé com área de texto confortável e seletor compacto de modelo sincronizado com Configurações.
- [x] Indicar estado pronto usando a configuração salva; manter teste de conexão como diagnóstico, sem exigir conexão manual a cada tarefa.
- [ ] Implementar anexos removíveis e tags de contexto/skills apenas após ligar cada item a capacidades reais do agente.
- [ ] Adicionar o botão de anexos e ligar o estado de arrastar-e-soltar a validação de arquivos e permissões.
- [ ] Rever foco, navegação por teclado, nomes acessíveis e estados de envio/erro/interrupção.
- [ ] Comparar visualmente e validar o fluxo do painel com fixture antes de promover para a versão instalada.
- [x] Reestruturar a extensão com cabeçalho Zero, estado de execução, aba em foco, navegação funcional e paleta navy/turquesa; build local da extensão passou.
- [x] Validar typecheck da extensão e a suíte unitária atual (93 testes).
- [ ] Conferir a aparência e os links da extensão no Zero Browser com perfil temporário; o CUA não iniciou nesta sessão e não houve validação visual ao vivo.

## Casca de navegador familiar ao Chrome

- [x] Adicionar menu `⋮` com Nova aba, Histórico, Downloads recentes, Favoritos e Configurações; os itens abrem fluxos reais já ligados ao perfil do navegador.
- [x] Criar painel pesquisável de Histórico e Favoritos e painel de Downloads desta sessão; permitir abrir páginas guardadas e revelar na pasta um arquivo concluído.
- [ ] Persistir histórico de downloads, oferecer abrir/pausar/cancelar/remover e acompanhar downloads em tempo real.
- [ ] Integrar atalhos globais de histórico e downloads quando o foco estiver dentro da página; os atalhos ainda não são anunciados pelo menu.
- [ ] Inspecionar visualmente o novo menu e os painéis de biblioteca em runtime e validar abrir item, busca e arquivo fixture baixado.
- [x] Manter o botão `+` de Nova aba visível ao lado das abas.
- [ ] Fazer os atalhos de navegador funcionarem quando o foco estiver dentro da página.
- [ ] Completar o menu `⋮` já criado com nova janela, comandos de navegação e gerenciamento funcional de extensões.
- [ ] Criar páginas completas de Downloads, Histórico, Favoritos e Configurações, com busca, estados vazios, ações e atalhos.
- [ ] Completar abas: menu contextual, duplicar, fixar, reordenar, silenciar, reabrir fechadas, restaurar sessão e abrir janela privada.
- [ ] Implementar páginas de configuração organizadas por Geral, Aparência, Inicialização, Privacidade e segurança, Senhas/preenchimento, Sites/permissões, Downloads, Agente, Extensões, Acessibilidade, navegador padrão, atualização e Sobre.
- [ ] Implementar gerenciador de extensões com botão **Adicionar extensões**: instalar, listar, ativar/desativar, remover e apresentar permissões; definir fontes/compatibilidade e informar falhas reais de instalação.
- [ ] Completar comandos comuns do menu: nova janela, zoom, localizar na página, imprimir, histórico, downloads, favoritos, extensões, configurações, ajuda e sobre.
- [ ] Criar perfis locais isolados com favoritos, histórico, sessões, downloads e abas próprios; migrar o perfil atual sem perda de dados.
- [ ] Projetar sincronização entre dispositivos com login, escolha de dados, criptografia, resolução de conflitos e recuperação; avaliar separadamente senhas e cookies e não assumir que o Chrome Sync está disponível.
- [ ] Mapear recursos de referência do Chrome e definir critério de paridade por recurso, sem marcar como completo o que ainda não foi implementado/testado.

## Qualidade, release e recuperação

- [x] Manter a instalação anterior intacta até backup e validação isolada do release.
- [x] Fazer backup verificável do app, perfil, atalhos e instalador anterior em `backups/2026-10-26-before-0.1.3`.
- [x] Validar nome, ícone, instalação sobre a versão anterior, preservação do perfil e atalho para o executável instalado.
- [x] Rodar testes aplicáveis do aplicativo e do executável instalado; os benchmarks amplos de acerto/tokens/latência continuam como trabalho de evolução do motor.
- [x] Atualizar este checklist e os documentos de estado; instalação de produção concluída e publicação em `origin/main` confirmada no commit `90cbcd4`.

### Release 0.1.3 — status em 2026-10-26

- [x] `npm test`: 93/93; `npm audit --omit=dev`: zero vulnerabilidades; `npm run test:electron`: exit code 0.
- [x] Build Windows com versão 0.1.3 e pacote Electron 45; integração empacotada passa, incluindo nova aba `zero://newtab`, popup customizado negado e regressão freeze/unfreeze CUA.
- [x] Hash SHA-256 do `app.asar` build e produção coincide: `9DD022EAA3FA9C8AF80A371408C1ED47572FAFC8095497720D4A46C44E9320C2`.
- [x] Verificar no executável instalado preload ausente nas páginas, bloqueio de `javascript:`, popup interno inválido, providers mockados, AX, CUA, configurações, download e decisões de aprovação.
- [x] Backup da instalação anterior: 184 arquivos do app; executável e `app.asar` conferidos por SHA-256.
- [x] Backup do perfil: 7.571 arquivos e 762.275.248 bytes; mesma contagem e tamanho após a atualização.
- [x] Instalar 0.1.3 no caminho de produção; NSIS exit code 0; executável informa versão 0.1.3; atalhos do Desktop e menu Iniciar apontam para produção.
- [x] Commit e push do estado aprovado para `origin/main` (`90cbcd4`).

### Revisão das mudanças Antigravity — correções

- [x] Permitir apenas HTTP(S), `about:blank` e URLs internas exatas no IPC de navegação; a nova aba local não fica bloqueada.
- [x] Revalidar motivo, aba ativa e `WebContentsView` após o `capturePage()` assíncrono; teste instalado simultâneo freeze/unfreeze deixa a viewport ativa.
- [x] Impedir pop-ups para esquemas internos arbitrários.
- [x] Mostrar no diálogo de instalação de extensão permissões, hosts opcionais e padrões de `content_scripts` sem truncar a lista.
- [x] Alinhar versões `package.json` e `package-lock.json` em 0.1.3; corrigir a documentação de observação pós-ação.

## Correções verificadas

- [x] Unificar/verificar seleção de `<select>` em `select_option` e `locator_action`: controles React-like esperam duas animações e até 160 ms; reversão tardia fica como `actionExecuted=true`, `outcomeVerified=false`, sem repetir a seleção automaticamente.
- [x] Adicionar fixture Electron para regressão atrasada de `<select>` nos dois caminhos; `npm run test:electron` passou.
- [x] Instrumentar cada tentativa ao provedor com latência, status, tentativa e tokens informados; resumir chamadas aceitas, retentativas e p50/p90 no relatório, sem adicionar conteúdo de página às métricas.
- [x] Registrar duração e classe genérica `body_parse` quando o corpo de resposta for inválido; distinguir p50/p90 de respostas aceitas e de todas as tentativas, inclusive as falhas.
- [x] Validar tarefa 44 com DeepSeek Flash em 5/5 execuções: todas as seis rotas lidas, resposta correta e transferência final verificada; média 13,9 s, 12 passos, 196.948 tokens de entrada e 5.615 de saída no conjunto.
- [x] Executar sete fluxos em sites públicos de demonstração com scripts (paginação, carregamento assíncrono, nova janela, carrinho, React, tabela dinâmica e controle assíncrono): 7/7 aprovados; limpeza confirmada nos fluxos mutáveis aplicáveis.
- [x] Rodar `npm test` isoladamente: 81/81; a primeira execução em paralelo com Electron teve uma falha temporária `fetch failed: bad port` na fixture de stress, que não se reproduziu na execução isolada. Revisão independente do código de seleção não encontrou findings acionáveis.
- [x] Fortalecer a tarefa difícil 44: só aprovar a transferência se a resposta discriminar os seis estoques corretos, o estado final corresponder e o trace provar leitura de cada rota local sem guardar conteúdo de página.
- [x] Testar captura allow-listed das chaves de rota em `inspect_page`, abertura/troca de aba e `read_batch`; os testes de benchmark passaram 24/24.

- [x] Corrigir declaração duplicada de `app` que impedia o processo principal de iniciar.
- [x] Declarar e validar as dependências Level usadas pelo serviço.
- [x] Corrigir região de arraste para liberar interação da barra de ferramentas.
- [x] Permitir localização para domínios Google reconhecidos, sem liberar outras permissões.
- [x] Ligar o painel de IA à API OpenRouter e implementar navegação, inspeção textual, clique, preenchimento e rolagem básicos.
- [x] Substituir a espera AX por eventos sem receptor por snapshot DOM e execução básica de ações no `AutomationService`.
- [x] Fazer o agente usar o índice do snapshot AX para inspecionar, clicar e preencher, sem reconstruir índices em outro seletor.
- [x] Fazer `browser_new_tab` e `browser_close_tab` chamarem callbacks reais do processo principal; devolver eventos CDP sequenciados em buffer.
- [x] Publicar schemas JSON e métodos JSON-RPC 2.0/MCP `initialize`, `tools/list` e `tools/call` no pipe nomeado do Windows.
- [x] Vincular o WebSocket de compatibilidade a `127.0.0.1` e separar o nome do pipe por usuário/perfil de dados.
- [x] Implementar `browser_wait` para `load`, `domcontentloaded`, `networkidle` e timeout com limpeza de listeners.
- [x] Implementar screenshot de página completa por métricas e captura CDP.
- [x] Inicializar e carregar a chave de cifragem `safeStorage` antes de persistir/ler chave API.
- [x] Adicionar um endpoint de provedor de teste limitado a loopback e um teste de instalação empacotada sem custo externo.
- [x] Validar a segunda instância no executável instalado e verificar que a janela/renderer primários continuam ativos.
- [x] Validar snapshot, digitação, clique, mutação da página e screenshot em um `WebContentsView` Electron usando uma fixture local.
- [x] Recompilar, reinstalar o pacote Windows e confirmar que o executável instalado abre com uma aba ativa.
- [x] Recompilar e reinstalar o NSIS atualizado em diretório isolado, preservando a instalação anterior ainda em uso.
- [x] Corrigir camada nativa `WebContentsView` que cobria o painel de IA e as configurações; reservar a lateral enquanto qualquer painel estiver aberto.
- [x] Corrigir acesso a `view.isVisible()` inexistente no Electron utilizado; selecionar bounds da aba ativa por estado mantido pelo processo principal.
- [x] Testar executável instalado ponta a ponta com provider local: abrir janela, criar fixture, inspecionar AX, clicar e confirmar mutação DOM.
- [x] Informar no painel que o texto da página é enviado ao provedor.
- [x] Registrar lacunas do documento REA e corrigir inconsistências editoriais encontradas.
- [x] Atualizar README para separar recursos ligados dos incompletos.
- [x] Exigir confirmação do processo principal para ações classificadas como consequentes, `browser_evaluate` e comandos CDP; interromper o agente após recusa.
- [x] Testar bloqueio antes do dispatch, recusa sem workaround do modelo, execução JavaScript bloqueada e rejeição de URLs não HTTP(S).
- [x] Corrigir serialização JSON Schema de strings URL refinadas pelo Zod.
- [x] Atualizar a análise REA com os gaps ainda ausentes, evidência parcial do runtime e estado do gate de confirmação.
- [x] Recompilar, instalar em pasta isolada e testar o build com provider local após o gate de confirmação.
- [x] Fazer o processo principal anunciar `tab:created` e atualizar a barra de endereço para abas criadas/trocadas pelo agente.
- [x] Testar no instalador isolado URL curta/completa, tema claro, DNT ligado/desligado e download em pasta configurada usando fixture HTTP local.
- [x] Verificar estado de dependências com `npm audit`: produção sem vulnerabilidades reportadas; árvore de build com 18 achados pendentes.

## Paridade funcional solicitada

### Controle do navegador

- [ ] Definir a referência pública e os fluxos de aceite de cada recurso antes de declarar paridade.
- [ ] Implementar índices estáveis/diff e validar todas as ações e estados AX, inclusive limites de evento sintético, em fixtures.
- [ ] Adicionar interação visual por screenshot/coords, teclado, seleção, duplo clique, arrastar e clipboard.
- [ ] Dar ao agente acesso completo a abas múltiplas, screenshot, download e leitura estruturada; adicionar controle visual e teclado nativo.
- [ ] Implementar progresso por ação, interrupção, takeover do usuário, retomada e reconciliação quando o resultado for incerto.
- [x] Validar no executável instalado o diálogo nativo de confirmação em formulário fixture: permitir envia uma vez; cancelar não envia e interrompe o agente.
- [ ] Ampliar classificação e testes de falsos positivos/negativos em diversos controles e padrões de página.
- [ ] Adicionar defesas testáveis contra prompt injection, exfiltração e instruções conflitantes da página.
  - [x] Primeira camada: `src/automation/injection-guard.js` sinaliza texto de página que dá ordens ao agente (aviso no resultado da ferramenta + contador `injectionWarnings` no trace); coberta por `test/injection-guard.test.js`. Falta bloquear exfiltração (envio de dados para outro site) e validar contra páginas de ataque reais.
  - [x] Bloqueio de exfiltração por navegação: `src/automation/exfiltration-guard.js` exige aprovação quando o agente abre OUTRO site com usuário/senha, consulta longa ou valor longo na URL (ou dados sem HTTPS); ligado em `confirmConsequentialAction`. Não vale com `allow-all` nem em tarefas de benchmark com política própria. Não cobre envio por formulário ou script. Teste: `test/exfiltration-guard.test.js` (precisa de `npm install`).
- [x] Atalhos com o foco dentro da página: Ctrl+Shift+T reabre aba fechada (antes abria aba nova), Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+1..9, F5. Também no foco da interface. Falta validar no app rodando.
- [x] Motor: retry em 429/5xx, ferramenta `calculate`, `repeat-guard`, href curto no snapshot e métrica `cachedInputTokens` (hipóteses; ver `docs/EVOLUCAO_MOTOR.md`). Falta medir cada uma com o comparador.
- [x] Motor: opção `preInspect` / `--preinspect` (snapshot entregue antes da 1ª chamada ao modelo), desligada por padrão. Falta A/B para promover.
- [x] Benchmark: `bench/comparador.js` e `--comparar` pareado com intervalo de confiança e tokens não cacheados (`test/comparador.test.js`).
- [x] Rodar A/B: base x `--preinspect`, mesmo modelo, conjunto difícil com 3 repetições, ordem A B B A; registrado em `docs/EVOLUCAO_MOTOR.md` (acerto 99% → 100%; chamadas −18%, tempo −21%, tokens não cacheados −14%).
- [x] Implementar (opt-in, sem medição): `run_steps` (`--scripts`), snapshot por diferença (`--diff`), cascata de modelos (`--cascade=`), leitor de streaming (`--stream`). Módulos em `src/automation/`, testes em `test/engine-evolution.test.js`; `npm test` 121/121.
- [x] Histórico de downloads persistente (`src/main/download-history.js`, arquivo `downloads-historico.json` no perfil; ignora downloads de avaliação e respeita "limpar ao sair"). Testado só nos módulos; falta conferir no app.
- [x] Menu de contexto das abas (`src/main/tab-menu.js`, IPC `browser:tab-menu`) e fechar aba com clique do meio. Testado só o modelo do menu; falta conferir no app.
- [x] Plano de migração do nome interno e de perfis em `docs/PLANO_NOME_E_PERFIS.md` (não implementado, por mexer em dados do usuário).
- [x] Fase A do nome: `ZERO_*` aceito ao lado de `NAVEGANTE_*` (`src/env.js`, `zeroEnv`); pasta de dados, partição, pipe e `appId` continuam `navegante` de propósito.
- [x] Perfis (menu ⋮ > Perfis): abrir, criar ("Perfil N") e excluir com confirmação, cada um como processo próprio via `ZERO_USER_DATA` (`src/main/profiles.js`, `browser:profile-menu` em `main.js`). Sem renomear perfil. NÃO conferido no app.
- [ ] Conferir perfis no app rodando (abrir 2 ao mesmo tempo, criar, excluir, bench com `--data-dir`) e validar a Fase A numa cópia do perfil.
- [ ] Fase B do nome (copiar pasta de dados, renomear partição, trocar `appId`/pipe): não feita; exige backup e teste numa cópia.
- [~] Dividir `AutomationService`: só o texto do prompt de sistema saiu para `service/prompt.js` (index.js ~2.386 linhas). O resto da classe (loop, snapshot, aprovação) segue junto; dividir exige testes de integração do loop antes. `node --check` passou; após a integração de 2026-10-27, `npm test` 127/127 com a extração já na árvore.
- [ ] A/B de `--scripts`, `--diff`, `--cascade=` e `--stream` contra a base (difícil, 3 rep, A B B A); streaming ainda sem execução antecipada de ferramentas.
- [ ] Repetir `--preinspect` no conjunto básico, em `reais` e com outro modelo antes de ligar por padrão.
- [ ] Rodar A/B de `calculate`, `repeat-guard`, href curto e retry contra 0.1.4 (cada mudança isolada ou em conjunto, dizendo qual).
- [ ] Prototipar roteiro de várias ações verificado pelo host, cascata de modelos e snapshot por diferenças (roteiro em `docs/EVOLUCAO_MOTOR.md`).
- [x] Permissão automática de localização só para Google em HTTPS, usando a origem de quem pediu (`details.requestingUrl`). `setPermissionCheckHandler` não foi adicionado: negar verificações pode quebrar câmera/microfone já concedidos.
- [x] Funções de apoio e schemas de `service/index.js` movidos para `service/helpers.js` (2.494 para 2.349 linhas). A classe `AutomationService` segue em um arquivo só; dividir sem testes rodando seria arriscado.
- [ ] Testar em página fixture controlada e em sites reais apropriados, verificando a alteração resultante na página.

### Configurações e funções do navegador

- [ ] Fazer cada opção de privacidade alterar a sessão ativa e validar headers/cookies com fixture.
- [ ] Implementar limpeza de dados ao sair e testar persistência/cookies de forma segura.
- [ ] Implementar seleção de pasta e diálogo para downloads, incluindo caminhos cancelados/indisponíveis.
- [ ] Ligar a opção de URL completa e tema a estados visuais verificáveis.
- [ ] Aplicar gate de CDP por permissão e origem; ligar WebMCP ou apresentar a opção como indisponível.
- [x] Adicionar escolha OpenRouter/DeepSeek, chaves cifradas separadas, catálogo carregado/atualizado pela API e indicação de compatibilidade com tool calling.
- [x] Testar catálogos e conexões dos dois provedores com endpoints mock no executável instalado; conexão real permanece pendente.
- [x] Atualizar Electron 45/electron-builder 26 e repetir a suíte e a aceitação instalada; validar que o `app.asar` instalado corresponde ao pacote.
- [ ] Implementar gerenciador de extensões ou manter o recurso explicitamente indisponível.
- [ ] Cobrir histórico, favoritos, restauração de abas, popups e estados de download, se confirmados na referência escolhida.

### Serviço de automação

- [ ] Trocar o WebSocket ad hoc por protocolo MCP interoperável ou renomear e documentar explicitamente a API própria.
- [ ] Publicar endpoint estável e controlado, autenticar o cliente e encerrar a porta/pipe junto com o processo.
- [ ] Testar `browser_new_tab`, `browser_close_tab` e buffer CDP em navegações reais, múltiplas abas e recuperação após detach do debugger.
- [x] Publicar schemas JSON válidos para ferramentas, não objetos Zod serializados. Os schemas foram exercitados via `tools/list`; ainda faltam combinações de todos os métodos.
- [ ] Cobrir erros, timeout, cancelamento, reconexão e limpeza de requisições pendentes.

### Aceite e release

- [ ] Testes unitários de cada ferramenta, configuração, confirmação, cancelamento e recuperação.
- [ ] E2E automatizado na janela do Electron com fixture local: navegar, ler, clicar, preencher, rolar, voltar, abrir/fechar aba e interromper tarefa.
- [ ] Validar uma chamada real do modelo com autorização do usuário, sem registrar a chave em logs/testes.
- [x] Repetir QA no instalador Windows com provider simulado em loopback e fixture local; distinguir isso do provedor/serviços externos.
- [ ] Validar conexão real OpenRouter e navegação em sites reais autorizados.
- [x] Validar em site fixture que o diálogo aparece antes de submissão, permitir uma vez executa a ação, cancelar não envia e interrompe a tarefa.
- [ ] Publicar evidências de cada aceite e listar explicitamente tudo que permanecer sem teste.

- [x] Recompilar NSIS e instalá-lo também no caminho padrão AppData\Local\Programs\navegante, que estava vazio; SHA-256 do app.asar instalado corresponde ao build.
- [x] Reexecutar smoke instalado no caminho padrão: renderer, single-instance, catálogo OpenRouter/DeepSeek, chaves separadas, conexão mock, ação AX e confirmação/cancelamento passaram.
- [x] Atualizar relatório e README com o comportamento atual dos provedores e a entrega instalada.


- [x] Corrigir a sobreposição do WebContentsView sobre os painéis HTML, reservando a lateral de IA/Configurações enquanto abertos.
- [x] Corrigir erro iew.isVisible is not a function no Electron 32 usando aba ativa rastreada pelo processo principal.
- [x] Reinstalar build final no caminho padrão e validar painéis IA/Configurações, seus bounds, providers mock, single-instance e ações AX/formulário.
- [x] Substituir `fetch failed` genérico por diagnóstico de rede do provedor com host/código/timeout sem expor chave; cobrir `ECONNRESET` DeepSeek em teste.
- [x] Executar `npm test` após diagnóstico de rede: 20/20 passaram; `npm run test:electron` e `npm run build` terminaram com código 0 e produziram novo NSIS.
- [ ] Repetir smoke instalado do novo build após fechar a instância Navegante já ativa; tentativa com `dist\win-unpacked\Navegante.exe` terminou no startup com exit 2147483651 e sem chegar aos testes do painel.
- [ ] Validar chamada real DeepSeek com credencial do usuário sem copiar/exibir/logar a chave; erro anterior não tinha código de causa suficiente para determinar a origem.
- [x] Adicionar níveis persistentes de aprovação do agente: sempre perguntar, permitir leitura, permitir ações de baixo risco e permitir todas automaticamente.
- [x] Aplicar níveis ao fluxo do agente e às ferramentas MCP para leitura, navegação, ações AX, scripts/CDP e gerenciamento de abas; preservar restrições de URL e CDP.
- [x] Testar o gate de aprovação para leitura, escrita e autorização automática; 21 testes unitários passaram.
- [x] Reorganizar visualmente as laterais de IA e Configurações com cabeçalhos, hierarquia de campos, superfícies neutras, estados de foco e avisos legíveis.
- [ ] Validar visualmente as laterais no executável instalado e repetir smoke depois de fechar a instância que está usando o diretório padrão.

- [x] Adicionar botão independente para salvar a chave OpenRouter/DeepSeek cifrada sem exigir modelo ou conexão; testar DeepSeek com chave mock persistida no perfil isolado.
- [x] Gerar e instalar `dist\\Navegante Setup 0.1.0.exe` no caminho padrão; confirmar hash de `app.asar` igual ao pacote e janela principal com `ready-to-show`.
- [x] Executar `npm test` (22/22), `npm run test:electron` e `npm run test:installed` no executável instalado; smoke cobriu catálogo dos provedores mock, salvamento da chave DeepSeek, ações do agente, preferências, download e aprovar/cancelar.
- [ ] Validar chamada real do agente com DeepSeek usando a chave do usuário; nenhuma credencial real foi lida ou usada nesta sessão.
- [ ] Fazer inspeção visual manual da lateral IA/Configurações; a janela abriu e os controles passaram pelo smoke automatizado via CDP.

- [x] Usar `net.fetch` do Electron/Chromium para catálogo e chamadas de chat, mantendo validação TLS e a configuração de proxy do sistema.
- [x] Exibir dica mascarada com os últimos quatro caracteres da chave vinculada e permitir revelar/ocultar por ação explícita; testar no executável instalado para os dois provedores.
- [x] Executar análise REA CLI do plugin atual de navegador (144 arquivos selecionados), do bundle principal e dos módulos centrais; registrar Evidence IDs e limitações em `VALIDACAO-REA.md`.
- [x] Gerar e instalar novo NSIS; confirmar hash SHA-256 idêntico do `app.asar` no build e na instalação padrão.
- [x] Executar novamente `npm test` (24/24), `npm run test:electron` e smoke instalado (PASS: provedores mock, chaves, agente, abas, settings, download e confirmação/cancelamento).
- [x] Validar TLS/acesso real sem credenciais via Electron `net.fetch`: DeepSeek HTTP 401 sem autenticação e catálogo público OpenRouter HTTP 200; nenhuma chave real foi usada.
- [ ] Validar chat autenticado real DeepSeek/OpenRouter com chave salva pelo usuário; não expor nem registrar a credencial.
- [ ] Resolver os 8 achados moderados restantes no toolchain do electron-builder sem downgrade forçado; produção permanece sem vulnerabilidades.
- [ ] Investigar por que o executável em `dist\\win-unpacked` encerra no startup (`2147483651`), embora o NSIS instalado abra e passe o smoke.


## Benchmark do agente (fase 1, inspirada no BrowserGym)
- [x] Corrigir erro de sintaxe no script de localizador (template aninhado) que quebrava `npm test`.
- [x] Ferramenta MCP `run_task`: abre aba, roda o agente com limite de passos e trace (chamadas, tokens, ferramentas, motivo da parada) e fecha a aba.
- [x] Políticas de aprovação por tarefa (`ask`, `local-fixture`, `deny`): local aprova sem diálogo só em 127.0.0.1; senha/código/cartão e navegação externa sempre recusados.
- [x] Ponte stdio→pipe (`scripts/mcp-stdio.js`, `npm run mcp`) com caminho do pipe compartilhado em `src/automation/pipe-path.js`.
- [x] 20 tarefas locais com verificador automático (`bench/tarefas.js`, `bench/paginas/`, `bench/servidor.js`).
- [x] Executor com relatório de taxa de sucesso por tarefa e categoria (`npm run bench`), comparação entre rodadas e testes (`test/bench.test.js`; `npm test` 33/33).
- [x] Pausa para CAPTCHA/verificação humana: o agente não resolve, avisa no painel, espera a pessoa e retoma (sozinho ou por "Já resolvi"); tarefa 21 do benchmark e testes (`npm test` 38/38).
- [ ] Rodar `npm run bench` com o Navegante aberto e chave real; registrar a primeira taxa de sucesso.
- [ ] Fase 2: snapshot com mais de 250 nós/diff, espera por conteúdo, arrastar real e defesa contra injeção, medidos pelo benchmark.

## Motor e Flame (2026-10-25)
- [x] Motor do Navegante 10/10 nas difíceis 31–40.
- [x] Chat: limite de ações 8 → 30.
- [x] Flame no Navegante: aba sem congelar sob depurador; robô de aprovação e trace do Flame no benchmark.
- [x] Flame: menus hover e lista infinita (36, 37) passando.
- [x] Flame: tarefas 35 e 38 (6/6); duelo completo 10/10 (`flame-dificeis2__*`).
- [x] Robô do benchmark: limite de 5 s em cada chamada ao painel do Flame.
- [ ] Flame: cortar tempo e tokens (média 45 s e ~260k tokens vs ~12 s e ~32k do motor do Navegante).
- [x] Plano do fork BrowserOS escrito (`docs/PLANO_FORK_BROWSEROS.md`); fork adiado pelo usuário.
- [x] Motor: ferramentas `tabs` (list/new/switch/close), `go_back` e `wait_for`; aviso `newTabs` quando um link abre aba; run_task fecha as abas que o agente abriu.
- [x] Benchmark: tarefa 41 (duas abas) 6/6; difíceis 31–41 11/11 (`regressao-abas__*`).
- [x] Motor: benchmark em sites reais (`--conjunto=reais`, 8 tarefas): 16/16 (`reais-2__*`), média 4 passos e 8 s; política `public-sites` no run_task.
- [x] Motor: `scroll` com `find` devolve trechos da página inteira e rola até o primeiro (artigo longo: 21 passos → 2 a 4).
- [ ] Motor: 36 (menu hover) falha às vezes (1 em 4 nesta sessão); investigar se se repetir.
- [x] Motor: upload e download — `downloads` (list/wait/read), `upload_file` (só arquivos da pasta de downloads ou baixados na tarefa, sempre com aprovação), aviso quando uma ação baixa arquivo, janela "Escolher arquivo" bloqueada nas abas do agente. Tarefas 42/43: 8/8; difíceis 13/13; reais 8/8.
- [x] Motor: memória de tarefa avaliada — notas descartadas após teste. Tarefa44 sem notas: 3/3, média 13 passos, 130692 tokens, 12,7 s; com notas: 3/3, 21 passos, 241411 tokens, 20,3 s. Mantém-se o resumo automático de respostas antigas grandes. Não há memória persistente de perfil; ver docs/EVOLUCAO_MOTOR.md.
- [x] Motor: corrigir seleção de `<select>` por locator (texto visível ou `value`) e validar o valor final; tarefa02 de contato 3/3, 7 passos, média 8,8 s.
- [x] Motor: identificar o campo por identidade interna estável após DOM reorder, sem enviar o ID ao modelo; proteger campos sensíveis em shadow DOM/iframe e omitir valores sensíveis do snapshot.
- [x] Motor: validar formulário com CPF/data/telefone em 3 repetições: tarefa33 3/3, 16 passos, média 22,9 s.
- [x] Privacidade do snapshot AX: excluir valores de senha sem rótulo, impedir vazamento por URL `data:`/`formAction` e validar em Electron.
- [x] Locators mutáveis: rejeitar correspondências ambíguas antes de clicar/preencher; manter `count` multi-match e provar em Electron.
- [x] AX `type_text`: separar ação executada da confirmação do valor após dois frames; detectar rerender que reverte campo sem devolver conteúdo no resultado.
- [x] AX `type_text`: não confirmar valor quando o DOM desconecta/substitui o campo; fixture Electron reproduz remount e confirma `outcomeVerified: false`.
- [x] Comparar conjunto básico completo em 2 repetições por condição: 42/42 sem observação e 42/42 com observação; registrar tokens, passos e latência em `bench/resultados/`.
- [x] Corrigir locator `role` para comparar papel com elemento DOM sem lançar erro.
- [x] Instrumentar tamanho de requests/histórico/schemas/snapshot em bytes sem guardar conteúdo; medir em relatório do benchmark.
- [x] Benchmark 47: loja SPA local com debounce, respostas fora de ordem, filtros, variantes e carrinho verificado por estado independente.
- [x] Repetir difíceis e smoke público com/sem observação; observação: 28/28 difíceis e 8/8 públicos, custo menor nesta amostra.
- [x] Repetir a nova loja SPA: sem observação 2/3; com observação 3/3, tokens/tempo/passos menores.
- [x] Ativar observação automática como padrão; manter `--no-observe` para comparação controlada.
- [x] Motor: botão "Continuar" quando para no limite de ações (histórico em memória, reinspeção, aprovações, expiração e testes Electron).
- [ ] Motor: aprovação por risco no lugar de palavras-chave.
- [ ] Motor: pausar e retomar.
- [ ] Motor: dividir `src/automation/service/index.js`.
- [ ] Abas "igual Chrome": nova aba com busca e atalhos, clique do meio, menu "Abrir link em nova aba".
- [ ] Menu ⋮ no canto superior direito (configurações, histórico, favoritos, downloads, extensões).


## Evolução geral do motor — 2026-10-25
- [x] Corrigir bloqueio da própria tarefa ao revisitar suas abas; impedir trocar ou fechar abas pertencentes a outras execuções.
- [x] Corrigir propriedade/política de nova aba antes da navegação para anexo e tratar download direto/redirect sem ler documento inexistente.
- [x] Validar correção de abas/arquivos: 41/43/44 em duas repetições (6/6), além de integração Electron com anexo e redirect.
- [x] Medir e remover compactações de snapshots sem ganho; preservar formato dos controles aprovado.
- [x] Encurtar descrições das ferramentas mantendo schemas; difícil 14/14 e ~3,2% menos tokens de entrada na rodada codex-concise.
- [x] Adicionar fixture45 de SPA com atraso/rerender/campos condicionais e verificador por estado; 2/2 com modelo real.
- [x] Cobrir continuação, exclusão de abas e observação opcional com testes; npm test 64/64.
- [x] Invalidar índices e snapshots quando a aba navega, inclusive reload/SPA que mantém a mesma URL; bloquear fechamento de aba pertencente a outra execução. `npm test` 70/70; `npm run test:electron` e integração de download/redirect passaram.
- [x] Medir observeAfterActions em difíceis, smoke público e nova loja SPA: 37/39 sem observação vs. 39/39 com; entrada -21,0%, passos -19,5%, tempo -18,1% nesta amostra. Observação ligada por padrão, com `--no-observe` para comparação.
- [x] Criar fixture46 de busca assíncrona em SPA com respostas fora de ordem e verificador independente de estado; 4/4 no par de repetições, com e sem observação.
- [ ] Testar sites públicos mais complexos com scripts e verificação independente, além da suíte smoke atual.
- [x] Demonstrar ganho material em amostra pareada difícil/pública/SPA sem reduzir acerto; repetir em conjunto básico/outros modelos permanece pendente.

## Regressão de preenchimento e memória — 2026-10-26
- [x] Repetir `02-formulario-contato` após correções de select/identidade: 3/3, média 6 passos, 7,1 s e 38.566 tokens de entrada no total.
- [x] Repetir `33-validacao-erros`: 3/3, média 12 passos, 19,9 s e 123.201 tokens de entrada no total.
- [x] Testar o carrinho público JavaScript com estado inicial e final independentes: 2/2; começou vazio, terminou em Wireless Keyboard x2 / $99.98, e a limpeza foi confirmada em ambas as repetições.
- [x] Corrigir a limpeza do carrinho no harness para usar `browser_locator_action` com strategy/query e o seletor real `cart-item-remove`; registrar a pré-condição para reprovar dados preexistentes sem alterá-los.
- [x] Comparar notas de memória na tarefa44: ambas as condições 3/3; sem notas 130.692 tokens, 13 passos e 12,7 s; com notas 241.411 tokens, 21 passos e 20,3 s. Não houve ganho de acerto nesta tarefa.
- [x] Revalidar `npm test` 75/75, `npm run test:electron`, `npm run test:bench-store` e `npm run test:agent-download`.
- [x] Reproduzir a falha de preenchimento em React TodoMVC: primeira rodada falhou ao editar o título sem marcar o checkbox (0/1; 20 passos; 113.930 tokens de entrada).
- [x] Orientar o agente ao checkbox único `input.toggle` e implementar `hover` no locator para expor controles ocultos; cobrir hover→visibilidade→clique na integração Electron.
- [x] Repetir TodoMVC com precondição vazia, verificação independente de uma tarefa concluída e uma ativa, e limpeza confirmada: 3/3; 13,7 passos e 33,6 s médios; 204.049 tokens de entrada no total. Rodada exploratória; comparação de custo contra o primeiro n=1 não é estatisticamente conclusiva.
- [x] Revalidar após a correção: `npm test` 76/76, `npm run test:electron`, `npm run test:bench-store` e `npm run test:agent-download` passaram.
- [x] Atualizar `bench/README.md` para refletir a matriz real: 21 básicas, 14 difíceis, 3 SPA locais e 10 fluxos públicos antes da nova tarefa.
- [x] Repetir a suíte difícil completa após corrigir o verificador de pedido impossível: 28/28 em 2 rodadas, média 7 passos, 16,0 s e 835.814 tokens de entrada.
- [x] Adicionar tarefa pública de tabela paginada JavaScript com preflight, filtro de Alice, confirmação de resultado único, captura pós-limpeza e restauração independente; passou 3/3 (3,3 passos, 10,4 s e 60.471 tokens de entrada).
- [x] Corrigir o harness para fornecer separadamente a leitura antes e depois da limpeza; `npm test` 77/77.
- [x] Revalidar as integrações Electron após ampliar o benchmark: `npm run test:electron`, `npm run test:bench-store` e `npm run test:agent-download` passaram.
- [ ] Avaliar memória seletiva por site/tarefa com recuperação curta e evidência de validade; não ativar memória genérica até demonstrar ganho de acerto sem custo desproporcional.
- [ ] Expandir testes públicos independentes além da loja SPA, TodoMVC React e tabela dinâmica; incluir controles assíncronos e páginas mais complexas. Testar Google Planilhas apenas em ambiente autorizado. Demos e sites de prática não representam produção nem sessão autenticada.

## Controles assíncronos e comparação entre abas — 2026-10-26
- [x] Adicionar leituras iniciais restritas a `isEnabled`/`isVisible` no `run_task` para preflight independente; a tarefa r12 confirma o campo desabilitado sem passar valor ao modelo.
- [x] Estender o harness para comprovar estado do locator antes/depois da limpeza e esperar condição assíncrona; r12 aguarda “It's disabled!” até 7 s e verifica `isEnabled=false`.
- [x] Testar Dynamic Controls em três repetições: 3/3; média 5,3 passos, 24,9 s e 89.226 tokens de entrada. Repetir após o ajuste de troca de abas: 3/3; média 5 passos, 26,2 s e 82.549 tokens.
- [x] Fazer `tabs switch` aceitar `inspect:true` e devolver snapshot AX fresco; orientar o agente a usar os índices recebidos. A integração Electron provou switch→snapshot→click sem chamada `inspect_page` separada.
- [x] Medir tarefa44 em A/B pareado, 5/5 por condição: baseline 16,4 passos, 23,8 s e 329.121 tokens; com snapshot no switch, 14,2 passos, 21,0 s e 267.196 tokens. Acerto 5/5 em ambas; a queda de tokens foi 18,8% nesta amostra.
- [x] Proteger formulários 02 e 33 após a mudança: 6/6; repetir suíte difícil completa: 28/28, média 6,9 passos, 13,0 s e 798.274 tokens.
- [x] Revalidar `npm test` 79/79 e `npm run test:electron`, `npm run test:agent-download`; `npm run test:bench-store` passou na repetição após um timeout isolado.
- [ ] A tarefa44 ainda alterna para navegação serial de filiais em 3/5 rodadas pós-ajuste; avaliar ferramenta de comparação em lote de links same-origin, com validação de host, limite de páginas/texto, ownership e aprovação. Exigir 5x antes/depois e suíte sem regressão.
- [ ] Investigar o timeout isolado de `test:bench-store` se voltar a ocorrer; a repetição imediata passou sem alterações.

## Leitura em lote same-origin — 2026-10-26
- [x] Adicionar `tabs read_batch`: lê em paralelo no máximo 6 abas abertas pela própria tarefa, somente na mesma origem da aba ativa; limita cada resultado a 600 caracteres e aceita query curta para filtrar linhas. A operação é somente leitura e não navega nem executa código do modelo.
- [x] Registrar no trace apenas a contagem de páginas lidas, sem copiar texto da página; cobrir com teste de propriedade das abas, origem e limite de texto.
- [x] Medir a tarefa44 em 5 execuções com schema/prompt de leitura em lote: 5/5, média 12 passos, 13,4 s e 198.091 tokens de entrada. O `read_batch` foi usado em 1/5; os resultados melhores não podem ser atribuídos à ferramenta apenas.
- [x] Comparar com referência anterior pós-snapshot na troca (5/5, 14,2 passos, 21,0 s e 267.196 tokens): esta rodada ficou 15,5% abaixo em passos, 36,2% em tempo e 25,9% em tokens de entrada, mas a amostra não isola causalidade nem controla variação do provedor.
- [x] Proteger suíte difícil completa: 28/28 em 2 rodadas; média 6,4 passos, 10,1 s e 698.234 tokens de entrada. A tarefa 41 passou nas duas rodadas.
- [x] Repetir tarefas públicas r11/r12 três vezes cada, com estado inicial/final independente e limpeza: 6/6.
- [x] Revalidar `npm test` 80/80, `npm run test:electron` e `npm run test:agent-download`; `npm run test:bench-store` falhou uma vez por timeout de locator e passou na repetição imediata.
- [ ] Aumentar a adoção do `read_batch` em tarefas multiaba sem forçar uso quando o custo contextual for maior; exigir evidência de leitura útil em 5/5 e comparar em mais tarefas antes de alegar ganho geral.
- [ ] Expandir benchmarks para sites públicos mais complexos e fluxos de produção autorizados; memória contextual ainda precisa de experimento separado.

## Verificação resiliente de preenchimento — 2026-10-26
- [x] Após a verificação normal em dois quadros, observar 160 ms adicionais apenas em campos que expõem sinais de controle por framework; detectar reversão tardia sem novo pedido ao modelo.
- [x] Se o nó de preenchimento for removido, procurar substituto visível por impressão semântica estável e verificar sem escrever nele; aceitar apenas uma correspondência única e guardar estado genérico sem conteúdo do campo.
- [x] Expor `fieldState` e `targetRemounted` no resultado da ação, mantendo `actionExecuted` separado de `outcomeVerified`; não declarar que o valor foi salvo pelo site nem repetir envio.
- [x] Cobrir em Electron: reversão imediata, reversão atrasada, nó recriado com valor preservado, nó recriado que perde o valor e substituição ambígua; `npm run test:electron` passou.
- [x] Validar regressões: `npm test` 80/80; tarefa 02 3/3; TodoMVC React r10 3/3; suíte difícil 28/28 em duas rodadas; integrações `test:bench-store` e `test:agent-download` passaram.
- [ ] Melhorar verificadores de preenchimento para separar valor presente no DOM de valor persistido/salvo, sobretudo em autosave e validações assíncronas; adicionar checks independentes de estado para novos formulários públicos.
- [ ] Repetir testes em mais de um modelo antes de alegar ganho geral; a validação desta rodada usou DeepSeek Flash.

## Atualização de produção e publicação — 2026-10-26

- [x] Isolar `NAVEGANTE_USER_DATA` no harness de teste instalado para usar sempre perfil temporário.
- [x] Ajustar a fixture de hover para evitar competição entre cursor físico do Windows e mouse CDP; validar no Electron.
- [x] Rodar `npm test` (81/81), `npm run test:electron`, `npm run test:bench-store` e `npm run test:agent-download`.
- [x] Criar e verificar backup do app anterior, perfil local e instalador 0.1.0 em `backups/2026-10-26-before-0.1.1/`.
- [x] Compilar NSIS Windows x64 0.1.1 e validar o executável empacotado com perfil temporário.
- [x] Atualizar a instalação usada no mesmo caminho e confirmar app.asar por SHA-256, versão do registro, atalho e smoke instalado.
- [x] Preparar `.gitignore`, README, identidade de licença e remover caminhos pessoais de documentos publicados.
- [x] Inicializar Git `main`, revisar 96 arquivos staged e criar o commit inicial `9f18eee` com código, testes e docs; excluir builds, dados, backup, resultados e relatórios locais de REA.
- [x] Reconfirmar remoto vazio, fazer push de `main` e verificar o commit remoto `88edb2f7457d74832af0d2a90e2045df846ddce3`.

## Grade virtualizada e rolagem direcional — 2026-10-26
- [x] Adicionar tarefa sintética de planilha com 60 linhas virtualizadas, reordenação, dois autosaves e verificação independente de não alteração das demais linhas.
- [x] Corrigir `scroll` para contêineres internos, direção up/down/bottom, busca progressiva limitada e espera por cargas assíncronas.
- [x] Validar tarefa 48 em 3 repetições: 3/3, média 12,3 passos, 26,5 s e 306.082 tokens de entrada; comparação anterior 3/3 em 24,3 passos, 65,8 s e 809.298 tokens.
- [x] Revalidar rolagem infinita (tarefa 37) em 3 repetições: 3/3.
- [x] Repetir a suíte difícil completa: 28/28 em duas rodadas; `npm test` 83/83; integrações Electron, bench-store e agent-download passaram.
- [ ] Repetir tarefa 48 em 5 execuções e confirmar em um segundo provedor/modelo.
- [ ] Rodar a suíte difícil em 5 execuções antes de preparar release; validar instalador isolado com perfil temporário e backup antes de trocar produção.
- [ ] Validar fluxo de planilha real e site de comércio autorizado em ambiente de teste; os resultados atuais usam fixtures sintéticas.

## Rebrand Zero Browser e próximos passos — 2026-10-26

- [x] Atualizar a API usada pela interface para `window.zeroBrowser` e manter `window.navegante` como alias legado para integrações existentes.
- [x] Atualizar nome do pacote npm, descrição, metadados visíveis do MCP e textos da interface/documentação de desenvolvimento para Zero Browser.
- [x] Renomear os atalhos existentes na Área de Trabalho e no Menu Iniciar para `Zero Browser.lnk`, preservando destino e argumentos.
- [x] Manter `appId`, pasta de dados, partição do Chromium e canais internos legados para preservar perfil, atualização e compatibilidade; a migração completa desses identificadores exige migração de perfil/integrações.
- [x] Validar `npm test` (85/85) e `npm run test:electron`.
- [ ] Validar visualmente o gerenciador de extensões e a sobreposição dos painéis em perfil temporário; conferir instalação/desinstalação de extensões unpacked.
- [ ] Completar atalhos, páginas de Configurações/Downloads/Histórico e persistência de estado do navegador antes do próximo instalador.
- [ ] Definir perfis locais e plano próprio de sincronização (conta, criptografia, conflitos e recuperação); isso não integra atualmente ao Chrome Sync.
- [ ] Repetir tarefa 48 em 5 execuções e confirmar em um segundo provedor; depois rodar 5 repetições da suíte difícil.
- [ ] Fazer build e validar instalador com perfil temporário, sem substituir a instalação de produção até conferir backup restaurável.
- [ ] Testar em Planilhas e comércio eletrônico reais apenas com sessão de teste autorizada, sem compras/pagamentos.

## Busca de rolagem orientada por DOM — 2026-10-26

- [x] Extrair a busca por texto no `scroll` para `src/automation/scroll-search.js`, observar mutações DOM e manter fallback de 850 ms e limites existentes.
- [x] Cobrir chegada rápida (320 ms) e tardia (1.100 ms) em Electron; rápido encontrado em 480 ms e carregamento tardio encontrado na etapa seguinte.
- [x] Revalidar `npm test` (85/85), `npm run test:electron`, sintaxe JS e `git diff --check`.
- [x] Medir tarefa 48 cinco vezes com DeepSeek Flash: 5/5, 12,4 passos, 28,13 s e 103.462 tokens de entrada.
- [x] Comparar com referência anterior (3/3, 12,3 passos, 26,5 s, 102.027 tokens); registrar que o ganho de tempo/tokens não foi demonstrado e não declarar promoção global.
- [ ] Rodar comparação pareada em grade rápida, lista lenta e página longa sem alvo; cinco repetições por variante, ordem alternada e segundo provedor antes de manter a otimização como padrão.
- [ ] Próximo experimento de tokens: reduzir gradualmente schemas enviados por chamada, medir acerto/tempo/tokens e restaurar catálogo completo se faltar ferramenta; não desligar `observeAfterActions` sem nova evidência pareada.
- [x] Rodar suíte pública em sites/demos atuais (12 tarefas): 12/12; limpeza confirmada em carrinho, TodoMVC, tabela e controle assíncrono; sem login ou checkout.
- [x] Repetir suíte difícil 2x após a mudança: 27/28. Isolar a falha da tarefa 44 (transferência registrada, leitura Centro ausente) e reproduzir 3 vezes: 3/3, todas as seis leituras corretas.
- [ ] Corrigir ou reduzir a variabilidade de cobertura da tarefa 44 e repetir suíte difícil 2x até 28/28 nas duas rodadas; a repetição isolada não fecha esta pendência.

## Evidência de cobertura em leitura multiaba — 2026-10-26

- [x] Adicionar resumo `pagesRead` / `pagesWithMatches` / `pagesWithoutMatches` ao resultado de `tabs.read_batch` quando há consulta; sinalizar que página índice sem correspondência não conta como fonte com dados.
- [x] Guardar no trace contagens separadas de páginas lidas e páginas com correspondências, sem armazenar texto de página.
- [x] Testar unidade: página índice + cinco fontes (5 correspondências/6 lidas), seis fontes completas e páginas que falham; `npm test` passou após a implementação.
- [ ] Validar a dica nova em execução real que use `tabs.read_batch` e, em seguida, medir a taxa da tarefa 44 em cinco repetições. As tentativas atuais ainda variaram e alguns erros omitiram a filial antes de chamar `read_batch`.

## Registry inspirado no Browsentic — 2026-10-26

- [x] Extrair o catálogo fixo das 17 ferramentas do agente para `src/automation/tools/agent-tool-registry.js`, preservando nomes, descrições, parâmetros e ordem.
- [x] Proteger a paridade do catálogo com teste de ferramentas, tamanho JSON de 6.764 bytes e cópia isolada por execução.
- [x] Rodar `npm test`: 90/90.
- [x] Repetir `npm run test:electron`; em 2026-10-26 concluiu com exit code 0 e log confirma cinco cenários de integração.
- [x] Auditar a licença pública atual: Browsentic v0.9.0 Apache-2.0; versões até 0.7.15 MIT. Não copiar código nesta alteração; Zero permanece MIT.
- [ ] Medir A/B de compactação ou exposição sob demanda com fallback completo; nenhuma economia de tokens ou ganho de acerto foi demonstrado por esta extração estrutural.
## Evidência de navegação após clique — 2026-10-26

- [x] Incluir URL ativa em `pageReads` quando a ação terminou com observação automática bem-sucedida, sempre com restrição de loopback, rota e chave permitida.
- [x] Adicionar teste para clique que navega à filial Centro e leitura confirmada; `npm test` passou 91/91.
- [x] Reexecutar integração Electron; exit code 0 e cinco cenários confirmados no log.
- [ ] Repetir tarefa 44 cinco vezes e suíte difícil duas vezes; o app não estava conectado ao canal MCP (ENOENT), portanto ainda sem benchmark atualizado.
- [ ] Não promover à produção até fechar benchmark difícil, inspeção visual e build/instalador isolado com backup restaurável.

## Candidato local e gate CUA — 2026-10-26

- [x] Gerar candidato local Windows x64 com `npm run build`; registrar SHA-256 no `HANDOFF.md`.
- [x] Testar CUA por serviço Electron com debugger anexado; clique da fixture confirmado.
- [x] Passar `npm run test:installed` no candidato: AX e CUA alteraram fixtures; painel da IA aberto e viewport visível; provedores mock, download, preferências, aprovar e cancelar passaram.
- [ ] Repetir tarefa 44 cinco vezes, suíte difícil duas vezes e smoke visual dentro do Zero.
- [ ] Instalar/publicar somente após todos os gates; produção permanece sem alterações.

## Reteste CUA e janela visível — 2026-10-26

- [x] Corrigir o harness de teste instalado para abrir janela visível; `windowsHide: true` tornava a página sem viewport e invalidava o primeiro diagnóstico.
- [x] Abrir o painel da IA durante o teste CUA e confirmar que a página segue visível e clicável.
- [x] Regenerar build local e passar `npm test` (91/91), `npm run test:electron` (exit 0) e `npm run test:installed` (exit 0).
- [ ] Executar benchmark real da tarefa 44 e suíte difícil com modelo/provedor configurados; mocks não medem tokens, latência nem precisão real.

## Correções da auditoria Gemini — 2026-10-26

- [x] AUD-01: exigir token aleatório no WebSocket local, rejeitar conexões com `Origin` e parar de registrar a porta no log; testes cobrem cliente sem token, com Origin e autenticado.
- [x] AUD-02: corrigir quebra de linhas do `read_batch` e cobrir busca após mais de 240 caracteres.
- [x] AUD-03: remover preload/bridge sem consumidor das páginas; manter APIs privilegiadas apenas na interface do Zero.
- [x] AUD-04: restringir `browser:new-tab` à janela principal, validar esquema da URL, remover opções arbitrárias do renderer e manter preferências seguras nas pop-ups.
- [x] AUD-05: persistir sessão no evento `close` antes da flag de encerramento e salvar lista vazia.
- [x] AUD-06: oferecer botão Parar, abortar requisição ao provider e bloquear as próximas ferramentas; operação CDP já enviada pode terminar.
- [x] Rodar `npm test`: 92/92 passaram.
- [ ] Obter encerramento limpo/exit code do `npm run test:electron` e validar pop-up/OAuth, restauração de sessão e parada no runtime Electron.
- [ ] Avaliar CDP AX, poda, cache e batching por benchmark pareado antes de substituir o snapshot ou fluxo atual; números do relatório Gemini não foram comprovados.
- [x] Corrigir cobertura incompleta em `tabs.read_batch`: informar truncamento de fonte/linhas, abas omitidas, correspondências retornadas e falhas; orientar o agente a não concluir com `coverage.complete=false`.
- [x] `npm test`: 94/94; `npm audit --omit=dev`: zero vulnerabilidades; `npm run test:electron`: exit code 0; integração do instalador 0.1.4 passou em perfil isolado.
- [x] Instalar 0.1.4 no caminho de produção após validação; hash do `app.asar` coincide com o build e os atalhos Desktop/Iniciar apontam para a instalação de produção.
- [x] Criar backup pré-release em `backups/2026-10-26-before-0.1.4`; perfil verificado: 7.571 arquivos e 762.275.248 bytes tanto na origem quanto no backup.
- [ ] Não declarar ganho geral de tokens, latência ou acerto com base apenas nos testes funcionais; medir tarefa 44 e suítes difíceis com modelo real.
- [x] Reinstalar o pacote final depois do ajuste de limite por linha; integração contra o executável de produção passou e SHA-256 do build/instalado coincide (`B25A738F2438E9B41296575CE74ED5D89B6E40CBAB251BD1B2A615F03AFF7FD2`).
- [x] Commitar e enviar o release 0.1.4 para `origin/main` (`e500667`).
- [ ] Fazer smoke visual da extensão e conferir backup restaurável antes de promover a instalação.

## Plano Zero próprio sobre Chromium — 2026-10-26

- [x] Auditar a arquitetura atual sem alterar o motor: localizar acoplamentos a Electron, capacidades e caminho de dados/perfil.
- [x] Pesquisar fontes públicas atuais de Chromium, Electron, Brave e BrowserOS neo; separar observação pública de inspeção instalada.
- [x] Redigir plano completo em `docs/PLANO_ZERO_CHROMIUM_AI.md`, com opções, arquitetura-alvo, migração, critérios de acerto/tempo/tokens, segurança, perfil, sync, atualização e rollback.
- [x] Registrar a direção de destino no `MASTER_BLUEPRINT.md`: Zero sobre Chromium, agente preservado, Electron apenas como ponte durante os gates.
- [x] Verificar recursos locais: C: NTFS com 280,4 GB livres e 31,9 GB RAM; build oficial atual ainda requer preparar VS 2026 e Windows SDK 10.0.28000.2270 (instalados: VS 17.14.37710.0 e SDK 10.0.26100.0).
- [x] Incorporar e fechar revisão independente: separar Gate 3A, definir build repetível sem exigir bit-identical, usar intervalos/amostras estatísticas e bloquear inconclusivos, detalhar ameaça, matriz Must-have, critérios de P95 e update/rollback autenticado com perfil restaurável.
- [ ] Inspecionar visualmente BrowserOS neo instalado quando o MCP BrowserOS neo estiver conectado; pesquisa desta sessão é apenas pública.
- [ ] Fase 0: criar baseline pareado reproduzível do agente atual, com custo de provedor aprovado antes de chamadas pagas.
- [ ] Fase 1: corrigir a experiência diária de abas/atalhos na versão atual antes de iniciar o protótipo Chromium.

## Integração 0.1.5-dev e correção de cobertura — 2026-10-27

- [x] Commitar a paginação do `tabs.read_batch` que estava na árvore de trabalho (`68e51f7`): `tabOffset`/`tabVersion` e `contentOffset`/`contentVersion`, com reinício da leitura quando o conteúdo muda.
- [x] Corrigir `coverage.complete`: continuação deixou de ser tratada como truncamento e leitura por `tabId` deixou de contar as outras abas como omitidas; o último trecho agora vem `complete` (`e72b991`, `test/batch-coverage.test.js`, `test/batch-pagination.test.js`).
- [x] Rebasear `claude/analise-projeto-atual-bf8fc8` sobre o `main` e aplicar por fast-forward; histórico linear, sem merge commit e sem push.
- [x] Resolver os 2 conflitos do rebase: catálogo recalculado em **7329 bytes** (paginação 6928 + `calculate` 401) e prompt de sistema mantido em `service/prompt.js` com o texto de offsets/`complete` trazido do `main`.
- [x] Alinhar `package-lock.json` com `package.json` em 0.1.5-dev (o lock estava em 0.1.4).
- [x] Verificar após a integração: `npm test` **127/127**; `node --check` em `src/`, `scripts/`, `bench/`, `test/`; `git diff --check` limpo; `npm audit --omit=dev` zero.
- [x] Documentar a sessão em `docs/REGISTRO_INTEGRACAO_0.1.5.md` (fluxos, conflitos, evidências, o que falta e como reverter).
- [x] Rodar `npm run test:electron` (exit 0), `test:bench-store` (PASS: busca, facetas, variante, carrinho), `test:agent-download` (PASS: anexo herda posse antes de navegar) e `test:installed` (PASS) na árvore integrada e no build instalado.
- [ ] Conferir no app rodando: perfis (abrir/criar/excluir), menu de contexto de abas, histórico persistente de downloads e atalhos com foco na página.
- [ ] Confirmar no modelo que a tarefa 44 para de paginar quando o último trecho vem `complete`, e medir 0.1.4 vs 0.1.5-dev com `bench/comparador.js`.
- [ ] A/B isolado de `--scripts` e `--diff`; repetir `--preinspect` em `reais` antes de ligá-lo por padrão.
- [x] Build Windows 0.1.5-dev com backup restaurável (`backups/2026-10-27-before-0.1.5-dev`, app + perfil + atalhos + instalador 0.1.4) e instalação validada: `app.asar` idêntico entre build e produção (`3658148c…f606401`) e `status: PASS` na integração do executável instalado. Pedido explícito do usuário.
- [x] Push/publicação: `main` enviado a `origin/main` em 28/10/2026 (`c13447e`) e tag `motor-pre-leaps-2026-10-27` publicada.
- [ ] Rodar `test:electron`, `test:bench-store` e `test:agent-download`, e o benchmark pareado 0.1.4 vs 0.1.5-dev. O build instalado é `-dev`, não um release.

## Saltos do motor — 2026-10-27

- [x] `run_steps` com pós-condições `{url,text,absent}` verificadas pelo host, espera de até 3 s, falha que interrompe o roteiro e contador `scriptExpectationFailures` no trace (`src/automation/expectation.js`, `action-script.js`, `service/index.js`; 6 testes novos).
- [x] Ponto de restauração documentado em `docs/PONTOS_DE_RESTAURACAO.md` (tag `motor-pre-leaps-2026-10-27`).
- [ ] A/B de `--scripts` com e sem `expect` na suíte difícil e na loja 47: chamadas por tarefa, acerto e taxa de pós-condição falha.
- [ ] Journal de efeitos e idempotência (próximo salto): impedir envio duplicado após falha, timeout ou reinício.
- [x] Journal de efeitos (`src/automation/effect-journal.js`): registra a ação consequente antes de despachar, bloqueia repetição sem verificação, confirma sucesso, expira em 30 min e persiste entre reinícios. Opt-in (`effectJournal` / `--journal`; 8 testes).
- [ ] A/B de `--journal`: medir duplicações evitadas e custo em chamadas; validar que não bloqueia repetições legítimas nas tarefas 31/47.
- [ ] Usar a pós-condição de `run_steps` como prova de efeito do journal (hoje são mecanismos separados).
- [x] Classificação de risco por capacidade (`src/automation/risk.js`): níveis credential/destructive/commitment/write/none, precedência, motivos específicos no diálogo e menos falso positivo ("conta"/"pedido" sozinhos deixaram de pedir aprovação). `npm test` 148/148.
- [ ] Matriz de ~50 controles reais (botões "Prosseguir", "Aplicar", "OK", links de menu) para medir falso positivo/negativo da classificação lexical.
- [ ] Usar o nível na política: no modo "Permitir leitura", liberar `write` reversível sem diálogo e manter `commitment`/`destructive`/`credential` com confirmação.
- [x] Verificação final por contrato (`src/automation/task-verifier.js`): `verify` no `run_task` com url/text/absent/textCount/download, `requireVerification` recusa o "concluído" sem prova e `trace.verification` registra só booleanos. 5 testes; `npm test` 153/153.
- [ ] Devolver falha de verificação ao agente com uma rodada de correção (hoje o chamador decide repetir).
- [ ] Usar o contrato de verificação como prova de efeito do journal, em vez da resposta da ferramenta.
- [x] Correção após verificação (`correctionRounds` 0–3): falha do contrato volta ao agente com o motivo (sem texto da página), gasta uma rodada de modelo e encerra recusando quando `requireVerification` está ligado. Corrigido também o caminho em que a recusa era pulada quando o laço já havia verificado. 7 testes; `npm test` 155/155.
- [ ] Ferramenta para o agente consultar o contrato no meio da tarefa (hoje só descobre ao tentar concluir).
- [ ] Medir em benchmark: falsos "concluído" evitados e custo em chamadas de uma rodada de correção.
- [x] Verificação aprovada como prova de efeito: `confirmAttempted({proof:'task-verification'})` confirma tentativas pendentes ao fim da tarefa; contrato falho deixa `attempted`; `trace.effectProofs` conta. 10 testes em `test/effect-journal.test.js`; `npm test` 157/157.
- [ ] Gate do journal dentro de `run_steps` (`beforeStep`/`afterStep`): hoje os passos internos do roteiro não passam por `planEffect` e podem duplicar envio.
- [ ] Medir em benchmark quantas duplicações o conjunto journal + prova evita e o custo em leituras extras.
- [x] Gate do journal em `run_steps` (`beforeStep`/`afterStep`): passo já confirmado é pulado, efeito desconhecido bloqueia o lote sem despachar nada, e falha/exceção liquidam a tentativa. 4 testes; `npm test` 161/161.
- [ ] A/B de `--journal` + `--scripts` em lote real (tarefa 31/47): duplicações evitadas, leituras extras e custo.
- [ ] Prova de efeito por rede (resposta observada) para o journal; hoje a prova é o contrato de estado.
- [x] Extração estruturada (`extract_table`, opt-in): tabela por selector/índice, colunas por cabeçalho normalizado, deduplicação, limite de linhas e proveniência (`url`, `totalRows`, `missingColumns`, `truncated`); trace só com contagens. 7 testes; `npm test` 168/168.
- [ ] Extração de listas de cards e grades virtualizadas (hoje só `<table>`).
- [ ] Paginação automática por `totalRows`/`truncated` e comparação de acerto com extração por texto no benchmark.
- [x] `check_task`: o agente consulta o contrato de verificação no meio da tarefa (somente leitura, `ok:false` como resultado normal, catálogo só com contrato, `trace.verifyChecks`). 2 testes; `npm test` 170/170.
- [ ] A/B do impacto de `check_task` em acerto e chamadas (o modelo pode consultar demais).
- [x] ETL paralelo entre abas: `read_batch` aceita `extract` (colunas/selector/tableIndex/maxRows), devolve linhas por aba com proveniência, `missingColumns`/`truncationReasons`, agregados `rowsReturned`/`rowsTotal` e trace `batchTables`/`batchRows`. 3 testes; `npm test` 173/173; catálogo em 7.815 bytes.
- [ ] Deduplicação entre abas por chave escolhida e extração de listas de cards/grade virtualizada.
- [ ] A/B de `read_batch` com `extract` contra leitura em lote + extração por texto.
- [x] Receitas por site (`recipe`, opt-in): `list`/`save`/`run` de passos estáveis (navigate, click_text, wait_for) com `expect` obrigatório, armazenamento atômico por origem e parada na primeira pós-condição falha. 4 testes; `npm test` 177/177.
- [ ] Passos de receita passarem pelo journal e por preenchimento de campo (hoje só navegação/clique/espera).
- [ ] Captura automática de receita apenas em tarefa verificada e versionamento por mudança de site.
- [x] Checkpoint com os 11 saltos compilado e instalado: `dist/Zero Browser Setup 0.1.5-dev.exe` (SHA-256 `9df4ed8b…a8545f`), `app.asar` `ae7a6564…0ae96a` idêntico em build e produção, integração do instalado `status: PASS`, `npm test` 177/177; backup do estado anterior em `backups/2026-10-27-before-motor-leaps/`.
- [ ] Teste manual do roteiro em `docs/COMO_TESTAR.md` (perfis, menu de abas, downloads, atalhos).
- [ ] Benchmark pareado 0.1.4 × checkpoint com provedor real e as flags `--journal`, `--scripts`, `--preinspect`.
- [x] Push para `origin` em 28/10/2026: `main` em `c13447e`, tag `motor-pre-leaps-2026-10-27` publicada. Teste manual de Planilhas e suíte difícil completa continuam pendentes.
- [x] Canal alternativo para canvas: `clipboard` (read/write, 200k, write com aprovação) e `key_sequence` (repetição de setas/Tab/F2/Ctrl, 50 passos, Enter/espaço com aprovação); fluxo TSV documentado em `docs/PLANILHAS_E_SITES_DIFICEIS.md`. 4 testes; `npm test` 181/181.
- [ ] Medir leitura A1:C20 e escrita de 10 linhas numa planilha de teste (meta ≤4–5 ações, 3 repetições) e comparar com clique por coordenada.
- [ ] Testar o modo de acessibilidade da planilha (leitura de células no snapshot) e, se funcionar, usá-lo antes do clipboard.
- [ ] Conector de API (Sheets) com OAuth explícito — decisão de produto, fora do motor de UI.
- [x] `visual_click`: clique por coordenadas normalizadas 0–1000 do viewport, com `expect` opcional e aprovação; fecha o canal de canvas sem API. 4 testes em `test/visual-sheets.test.js`; `npm test` 185/185.
- [x] `sheets_accessibility`: alterna o modo de acessibilidade do Planilhas (Ctrl+Alt+Z) só em docs.google.com/spreadsheets e manda inspecionar. Hipótese não validada em conta real.
- [ ] Validar `sheets_accessibility` numa planilha real (células aparecem no snapshot?) e ajustar o fluxo conforme o resultado.
- [ ] Benchmark pareado com provedor real (tarefa 44 e 33) usando `--journal`, `--scripts` e `--preinspect`.
- [x] Primeiras execuções reais pós-saltos (deepseek-flash, 1 por condição): 44 padrão 1/1; 44 `--journal` 1/1 mas 18 passos/2,2× tempo; 33 padrão 1/1; 33 `--scripts` 1/1 com −58% passos e −37% tokens. Evidência em `bench/resultados/`.
- [x] Estreitar o journal a efeito crítico (commitment/destructive/credential + upload/Enter; navegação fora) e medir 5×5 na tarefa 44: 5/5 em ambas, −16,1% passos, −15,1% chamadas e −10,1% tokens contra a base. Regressão removida; prova estatística ainda exige o conjunto difícil completo e outro modelo.
- [x] Receitas v2 (inspirado no Pomerado, sem copiar código): schema de entrada, placeholders `{{campo}}`, validação de obrigatórios e `possibleCommit` + `readBeforeRetry` após passo despachado. 5 testes; `npm test` 186/186.
- [ ] Captura automática de receita a partir de tarefa verificada (mint) e schema de saída.
- [ ] Credencial digitada só na origem do login (padrão do Pomerado), com recusa de formulário que envia para outro site.
- [ ] Portar o cálculo de nome acessível do Playwright (Apache-2.0) usado pelo Pomerado e medir em locators.
- [x] Versão **0.1.6-dev** com menu **Novidades** (diálogo nativo lendo `docs/NOVIDADES.md` do pacote) e teste de sincronia entre `package.json`, lock, notas e conteúdo; instalador `d493c626…2165df`, `app.asar` `40f5be10…9257dd`, `status: PASS`, `npm test` 187/187.
- [ ] Validar o diálogo Novidades no app instalado (abrir, ler, fechar) e revisar o texto antes de um release.
- [x] Mint automático: tarefa com contrato aprovado e `run_steps` estável + `expect` grava receita sozinha (`saveRecipe`), com `minted`/`mintSkipped`. 2 testes.
- [x] Ferramenta `sheets`: read/write/goto por intervalo A1 via caixa de nome + clipboard + teclado, sem clicar em célula; fallback orientado. 5 testes; `npm test` 194/194.
- [ ] Testar `sheets` numa planilha real (intervalo, valores, mescladas) e o mint numa tarefa real com run_steps.
- [x] Checkpoint 6 / **0.1.7-dev** instalado: mint automático + `sheets` + receitas v2; instalador `6740ee31…903f19`, `app.asar` `a977bf32…8a59b2`, `status: PASS`, `npm test` 194/194; backup em `backups/2026-10-28-before-mint/`.
- [x] Credencial com escopo de origem: campo sensível só aceita formulário na origem da página ou em `authenticationOrigins`; cross-origin é recusado antes de digitar. 3 testes; `npm test` 198/198.
- [x] Autoridade de receita (`read`/`write`): leitura não executa clique, no save e na execução; `list` mostra a autoridade. Teste em `test/recipe-store.test.js`.
- [ ] Cobrir `hidden_action` sensível sem `formAction` (hoje só aprovação) e formulário montado por script que envia para outra origem.
- [x] Diagnóstico do `sheets`: `diagnostics` (nameBoxFound, selector, typed, selection, rangeApplied) e códigos `NAME_BOX_NOT_FOUND`/`CLIPBOARD_EMPTY`; fallback de digitação pelo setter. 6 testes; `npm test` 199/199.
- [ ] Rodar o `sheets` numa planilha real e usar `diagnostics` para corrigir o seletor/fluxo (próximo passo empírico).
- [x] Checkpoint 8 / **0.1.9-dev** instalado com diagnóstico do `sheets`: instalador `fd752acc…1b09e`, `app.asar` `1a769d28…c3033`, `status: PASS`, `npm test` 199/199; backup em `backups/2026-10-28-before-diagnostics/`.
- [x] Nome acessível padrão (accname W3C, implementação própria): `aria-labelledby`, `aria-label`, rótulo nativo, title, placeholder, conteúdo e valor; usado no snapshot e no locator; oculto e ciclo protegidos. 3 testes; `npm test` 202/202.
- [ ] Completar accname com “name from content” excluindo descendentes ocultos e `aria-describedby`; comparar com o Playwright num conjunto de fixtures.
- [x] Checkpoint 9 / **0.1.10-dev** instalado com accname: instalador `e2f06273…2d27c6c`, `app.asar` `bf495150…5e045`, `status: PASS`, `npm test` 202/202; backup em `backups/2026-10-28-before-accname/`.
- [x] Checkpoint 18 / **0.1.19-dev** instalado com guardião de progresso, pré-inspeção padrão, limite configurável e pausa com diagnóstico: instalador `618f6d3d…b9f7`, `app.asar` `439fe807…3749`, `status: PASS`, `npm test` 269/269, `test:ui` PASS; backup em `backups/2026-10-28-before-progress/`.
- [x] Checkpoint 17 / **0.1.18-dev** instalado com CSP, `newtab.css/js` externos, extensions API, cliente WS e sem IPC morto: instalador `c659c7a3…36da8`, `app.asar` `ab0b381c…1b9f1`, `status: PASS`, `npm test` 261/261, `test:ui` PASS; backup em `backups/2026-10-28-before-csp/`.
- [x] Checkpoint 16 / **0.1.17-dev** instalado após auditoria geral (pipe autenticado, retomada, módulos, batch+contrato, recursos na UI): instalador `61a9ef50…d61eb`, `app.asar` `389b4f7c…c36868`, `status: PASS`, `npm test` 260/260; relatório em `docs/AUDITORIA_2026-10-28.md`; backup em `backups/2026-10-28-before-audit/`.
- [x] Checkpoint 15 / **0.1.16-dev** instalado com `sheets batch`, snapshot compacto no Planilhas e teto de 40 ações: instalador `ff3e6aae…bf7b8`, `app.asar` `b72f59d3…a411`, `status: PASS`, `npm test` 253/253; backup em `backups/2026-10-28-before-sheets-batch/`.
- [x] Checkpoint 14 / **0.1.15-dev** instalado com painel de conversas, texto em parágrafos, memória do agente, módulos de operação e receitas como artefato: instalador `c9477125…bed1b`, `app.asar` `c6909e1a…df33`, `status: PASS`, `npm test` 249/249, benchmark difícil 14/14; backup em `backups/2026-10-28-before-panel-history/`.
- [x] Checkpoint 13 / **0.1.14-dev** instalado com o escopo do Guardian corrigido: instalador `f0ad77fa…a2467`, `app.asar` `24fb5659…570d81f`, `status: PASS`, `npm test` 233/233; backup em `backups/2026-10-28-before-guardian-upload/`.
- [x] Checkpoint 12 / **0.1.13-dev** instalado com tarefa durável, receitas via MCP e sandbox `transform`: instalador `0d2ae9b6…6fc03`, `app.asar` `3e88f32c…bf6d0e`, `status: PASS`, `npm test` 233/233; backup em `backups/2026-10-28-before-durable-jobs/`.
- [x] Checkpoint 11 / **0.1.12-dev** instalado com Guardian e cache opt-in: instalador `cf33b29d…c53f3f`, `app.asar` `aee7ee6e…ae91e21`, `status: PASS`, `npm test` 218/218; backup em `backups/2026-10-28-before-guardian/`.
- [x] Checkpoint 10 / **0.1.11-dev** instalado com schema de saída por receita (`output`/`outputValid`/`OUTPUT_INVALID`) e `sheets` como passo determinístico: instalador `229ee406…a901e2`, `app.asar` `0d46e9db…b043a`, `status: PASS`, `npm test` 208/208; backup em `backups/2026-10-28-before-output-schema/`.
