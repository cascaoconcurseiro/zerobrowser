# Checklist — Navegante

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
- [ ] Reconfirmar remoto vazio e fazer push de `main` para `https://github.com/cascaoconcurseiro/zerobrowser`; verificar o commit remoto.
