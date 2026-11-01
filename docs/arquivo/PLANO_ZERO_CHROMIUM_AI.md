# Plano completo — Zero Browser sobre Chromium, pensado para IA

**Estado:** plano de arquitetura e execução; migração ainda não iniciada.
**Data da pesquisa:** 2026-10-26.
**Objetivo do usuário:** navegador de uso diário com abas, perfis e extensões, e com controle amplo, confiável e supervisionável para a IA; preservar o motor e as capacidades existentes, sem queda de acerto, velocidade ou eficiência.

## Critérios de pronto deste plano

- A direção de produto e as alternativas estão comparadas; o destino recomendado é claro, sem apresentar Chromium como motor escrito do zero.
- O inventário mostra o que será reaproveitado e quais acoplamentos precisam ser substituídos.
- As fases têm dependências, gates observáveis, segurança, atualização, preservação/rollback de dados e critérios de paridade de tarefas.
- Métricas de acerto, tokens, latência e UX têm método de comparação e resultado inconclusivo não libera migração.
- Pesquisa pública, inspeção instalada, evidência do código e pendências estão identificadas separadamente; o plano passou por revisão independente.

## 1. Decisão recomendada

Construir o **Zero Browser como um fork próprio do projeto aberto Chromium**, com identidade, interface, distribuição e recursos de IA próprios. Não criar um motor de renderização do zero. O produto atual em Electron continua como base de transição até que o navegador Chromium passe por todos os gates de compatibilidade e desempenho.

O motor atual da IA deve ser preservado. A migração começa separando a orquestração do agente dos objetos Electron e criando uma interface de navegador que possa ser implementada primeiro pelo host Electron existente e, depois, pelo host Chromium. O protótipo só substitui a versão atual depois de provar paridade nas mesmas tarefas.

**“Controle total” no plano significa** que, com a permissão definida pelo usuário, o agente pode administrar recursos do próprio Zero: abas e janelas, navegação, leitura de acessibilidade/DOM, ações visuais, downloads, extensões instaladas, perfis e estado da tarefa; pode trabalhar em abas próprias, operar em paralelo, mostrar atividade, pausar, pedir autorização e permitir auditoria/replay.

Nenhum navegador pode remover literalmente todas as limitações. O sistema operacional, o sandbox, permissões de extensões, autenticação e proteções dos sites continuam valendo. O Zero não deve contornar login, 2FA, CAPTCHA ou controles de site. Deve oferecer controle amplo dentro de limites explícitos, auditáveis e configuráveis pelo usuário.

## 2. O que já existe e será preservado

O projeto já é um navegador sobre Chromium por meio do Electron, com a casca de navegador construída pelo Zero. O usuário final não precisa começar com uma janela de automação vazia. Hoje o projeto inclui:

| Parte atual | Evidência no repositório | Plano de preservação |
|---|---|---|
| Loop do agente, ferramentas, provedor, verificação, retomada e políticas | `src/automation/service/index.js` | Preservar o contrato e a lógica; substituir gradualmente os pontos em que a execução depende de `webContents` e do debugger Electron. |
| Catálogo das ferramentas do agente | `src/automation/tools/agent-tool-registry.js` | Manter nomes, schemas e semântica durante a migração; qualquer mudança de ferramenta exige comparação de resultados e tokens. |
| CUA, acessibilidade, DOM e ações | `src/automation/cua-input.js` e serviço de automação | Implementar no adaptador Chromium e provar resultado observado, sem simular sucesso. |
| Host de abas, janelas e sessões | `src/main/main.js` | Substituir por serviços nativos do browser Chromium; preservar comportamento e contratos usados pelo agente. |
| IPC, preload, execução Flame e shim de extensões | `src/ipc/`, `src/preload/`, `src/main/extensions/` | Inventariar chamadas e dependências. O shim atual não é compatibilidade integral de extensões Chrome. |
| MCP e ponte local | `src/automation/pipe-path.js` e serviço MCP | Preservar as ferramentas MCP e o isolamento local; reforçar autenticação e escopo da nova ponte. |
| Configurações, credenciais protegidas, histórico e favoritos | `src/store/`, biblioteca SQLite, perfil `persist:navegante` | Importar seletivamente para um perfil de staging; não copiar bancos/perfis abertos às cegas. Manter backup e restauração comprovada. |
| Benchmarks e fixtures | `bench/`, `test/`, relatórios em `bench/resultados/` | Congelar um conjunto comparável e usar as mesmas tarefas e verificadores nos dois navegadores. |

**Ponto de atenção atual:** ainda existe acoplamento real ao Electron: o serviço recebe `webContents`, chama métodos Electron e usa o debugger Electron. O shim de extensões também adapta `chrome.*` sobre o runtime Electron. Não é correto chamar esse shim de suporte completo às extensões Chromium.

## 3. Referências de produto

As referências informam requisitos, não autorizam copiar código ou identidade visual.

| Referência | O que aproveitar como requisito | O que não presumir |
|---|---|---|
| **Brave** | Navegador diário completo: abas organizadas, sidebar, extensões Chromium, importação, sincronização criptografada e proteções de privacidade integradas e configuráveis. | VPN, Rewards, carteira ou outros serviços Brave não são requisito automático para o Zero. A interface deve ter identidade própria. |
| **BrowserOS neo** | Navegação em abas próprias por agente, tarefas concorrentes sem tomar as abas pessoais, painel ao vivo, pausa/observação e replay da execução; foco em uso local com sessões reais do usuário. | O próprio README descreve Neo como navegador secundário para agentes, separado do BrowserOS voltado a navegação diária. O Zero pretende reunir navegador diário e agente no mesmo produto. |

**Limite da pesquisa de referência:** BrowserOS Neo MCP não estava conectado nesta sessão. A análise acima usa páginas públicas oficiais e o README do projeto; não é inspeção visual da versão instalada. Antes de fechar a direção visual, inspecionar a instalação com Neo conectado e observar o Brave em execução, sem copiar assets, texto ou layout pixel a pixel.

## 4. Alternativas avaliadas

| Alternativa | Vantagem | Limitação | Decisão |
|---|---|---|---|
| Continuar no Electron e ampliar o shim de extensões | Reaproveita quase toda a aplicação atual; menor risco e entrega mais rápida de abas/menus. | Electron declara suporte parcial às APIs de extensões e não busca compatibilidade completa com Chrome. Não atende sozinho a meta de ampla compatibilidade. | Manter como ponte e corrigir já a experiência de abas; não usar como arquitetura final. |
| Aplicação de navegador própria baseada diretamente no Chromium | Maior controle sobre interface, perfis, abas, permissões, APIs nativas para a IA e compatibilidade de extensões Chromium. | Exige build próprio, integração nativa, testes extensos e responsabilidade contínua por atualizações de segurança e distribuição. | **Recomendada como destino do Zero.** |
| Extensão MV3 dentro do Chrome/Brave | Integração simples com navegador já instalado e ecossistema de extensões existente. | O navegador hospedeiro define permissões e limites; não dá ao Zero controle da interface, perfis ou ciclo de vida do browser. | Complemento opcional, não produto principal. |
| Escrever motor de navegador do zero | Controle do código de renderização em teoria. | Reimplementaria HTML, JavaScript, rede, acessibilidade, segurança e compatibilidade web; esforço desproporcional e enorme risco de qualidade. | Rejeitada. |

## 5. Arquitetura de destino proposta

```text
Zero Browser (Chromium)
├── Interface do navegador: abas, barra, janelas, menus, configurações e downloads
├── Serviços de navegador: perfis, extensões, permissões, histórico, favoritos e updates
├── Zero Control Bridge nativa: API privada, escopada e auditável para operações do browser
├── Zero Agent Core (JavaScript/Node, reaproveitado inicialmente)
│   ├── planejamento, provedores, ferramentas, memória e verificação
│   ├── política de aprovação, pausa/cancelamento e trilha de auditoria
│   └── MCP local e conectores externos autorizados
└── Profile/Data layer: dados locais, importação, backup e, futuramente, sync Zero
```

### Interface entre o motor e o navegador

Definir um contrato `BrowserRuntime` temporário para as capacidades já necessárias: listar/criar/ativar/fechar abas; navegar e esperar; obter snapshot de acessibilidade e texto/DOM permitido; clicar, preencher, rolar e agir por CUA; capturar evidência; iniciar/monitorar downloads; consultar perfil/permissões; receber eventos e cancelar ação. A interface não deve vazar objetos `webContents`, `BrowserWindow` ou APIs específicas de Chromium para o loop do agente.

Durante a migração existirão dois adaptadores:

- `ElectronRuntime`: adaptação do host atual para que os benchmarks antigos continuem executáveis.
- `ChromiumRuntime`: implementação nativa do novo host. O limite de comunicação será escolhido no protótipo; avaliar bridge nativa Chromium/Mojo e processo local autenticado. Não expor uma porta CDP irrestrita como API de produto.

O motor do agente, as ferramentas, a semântica de evidência e as políticas permanecem comuns aos dois lados até os dados mostrarem que uma mudança é necessária. O adaptador não pode ignorar a aprovação central nem converter uma ação executada em sucesso sem verificar o estado final.

**Caminho candidato para a bridge:** serviço de controle allowlisted dentro do browser Chromium, com interface Mojo no lado nativo, e o agente JavaScript separado falando com esse serviço por IPC local (pipe nomeado com ACL de usuário e handshake de curta duração). O protótipo deve comparar essa opção com integração embutida no processo Chromium e escolher pela prova de isolamento, cancelamento, atualização e custo de manutenção. Não usar endpoint CDP aberto como API permanente do Zero. A decisão final fica para o Gate 3A.

### Controle multiagente

- Cada tarefa recebe um `agentId`, um conjunto de abas e um perfil/escopo de dados claramente definido.
- O agente vê e atua nas abas de tarefa; as abas pessoais do usuário não são tomadas ou fechadas implicitamente.
- Painel do navegador mostra agente, tarefa, site, ação atual, permissões, resultado, pausa e cancelamento.
- Replay é opt-in/configurável, local, com política de retenção e redação de segredos. Não guardar senhas, chaves, conteúdo sensível ou texto digitado desnecessário.
- Ações sensíveis ou irreversíveis (comprar, pagar, enviar, excluir, publicar e mudanças relevantes de conta) param para confirmação ou handoff humano conforme política.

## 6. Plano por fases e gates

### Fase 0 — Referência de qualidade e requisitos fechados

1. Congelar uma versão do agente atual, configuração, prompt, provedor/modelo e corpus de benchmark.
2. Organizar os relatórios existentes por execução e definir uma referência nova e reproduzível; não misturar métricas de tarefa, provedor ou fixture diferentes.
3. Inventariar todos os tools, callers, fallbacks, integrações Flame/MCP, persistência, dados e permissões, marcando cada capacidade como mantida, adaptada ou retirada (retirada exige decisão explícita).
4. Definir matriz real de extensões que o Wesley usa e tarefas de navegação de uso diário.

**Gate 0:** matriz de capacidades assinada no checklist; baseline repetível; critérios de acerto, custo e segurança escritos antes de qualquer port.

### Fase 1 — Tornar utilizável a versão atual e preparar a transição

1. Corrigir primeiro abrir/alternar/fechar abas, botão `+`, `Ctrl+T`, `Ctrl+W`, nova janela e restauração básica da sessão na versão atual.
2. Testar em janela visível com mouse, teclado e foco dentro de páginas; testar pop-ups, múltiplas abas e painel da IA aberto.
3. Validar fluxo de instalação de extensões suportadas no Electron e mostrar compatibilidade/erros reais. Não anunciar compatibilidade geral.
4. Não substituir a versão usada pelo usuário sem backup verificável e caminho de restauração.

**Gate 1:** usuário consegue navegar normalmente; suite de interação de abas passa; motor da IA mantém comportamento atual. Esta etapa melhora o app de transição, não fecha a migração.

### Fase 2 — Contrato portátil do motor

1. Extrair chamadas de navegador específicas do agente para o contrato `BrowserRuntime` sem trocar o comportamento do agente.
2. Implementar primeiro `ElectronRuntime` e executar toda a regressão por essa nova interface.
3. Manter política central de aprovação, resultado verificado, cancelamento, retomada, observação após ação e redação do trace.
4. Definir mensagens, tipos e autenticação da bridge local; bind apenas a IPC local protegido, com capacidades allowlisted e escopo por agente/perfil.

**Gate 2:** todos os testes e tarefas baseline continuam passando via `ElectronRuntime`; comparação antes/depois do refactor não aponta mudança de acerto, passos, latência ou tokens fora da margem aprovada.

### Fase 3 — Prova de Chromium independente

1. Fixar um commit/milestone Chromium e registrar origem, patches, licenças e processo de atualização.
2. Preparar estação de build Windows e gerar build local reproduzível do Chromium sem marca Chrome.
3. **Gate 3A — viabilidade da bridge primeiro:** comparar o candidato Mojo + processo agente por pipe com uma integração embutida; registrar fluxo de dados, ameaça, bootstrap, ACL, escopo, cancelamento, atualização e fallback antes de escolher.
4. Provar no Chromium mínimo operações reais: criar/ativar/fechar aba; ler AX; clicar e verificar estado; cancelar chamada em voo; entregar aprovação/handoff. Páginas e extensões não podem chamar a bridge sem permissão.
5. Criar protótipo Zero com janela, uma aba, barra de endereço, nova aba, perfil isolado e DevTools desativado para terceiros.
6. Validar instalação/execução, navegação básica, importação de dados não sensíveis e compatibilidade da matriz de extensões prioritárias.

**Gate 3A (binário):** bridge escolhida e protótipo passa teste cruzado de origem, extensão sem permissão, outra conta Windows, replay de mensagem, token ausente/expirado, revogação e cancelamento. Um processo malicioso executando com a mesma identidade/permissão do usuário está fora do limite que um pipe local sozinho consegue proteger; o sistema não pode alegar isolamento contra esse adversário.

**Gate 3B:** build Windows funcional repetível com commit Chromium, toolchain e argumentos GN fixados; não exigir binários bit a bit idênticos. Contrato de controle cobre as ferramentas atuais; extensões prioritárias e perfil funcionam; ameaças da bridge revisadas. Se não passar, corrigir a prova antes de portar o catálogo inteiro.

### Fase 4 — Casca de navegador completa

**Escopo inicial:** Windows x64 para canal de desenvolvimento, beta opt-in e estável. Mac/Linux ficam fora do primeiro lançamento e só entram após o fluxo Windows fechar. Antes do começo da Fase 4, definir a lista `Must-have` de extensões e o inventário MoSCoW de recursos.

Implementar com identidade Zero própria, guiando-se pelo inventário de Brave:

- abas e janelas (nova, reabrir, reordenar, fixar, agrupar, silenciar, arrastar, restaurar e privada);
- barra de endereço/pesquisa, voltar/avançar/recarregar, downloads, histórico, favoritos e busca;
- gerenciamento de extensões compatíveis com Chromium, permissões, origem e ativar/desativar/remover;
- perfis isolados, importar dados com prévia, backups e restauração;
- páginas de configurações, privacidade/permissões, tema, acessibilidade, atualização, sobre e navegador padrão;
- proteção de privacidade configurável, sem quebrar sites silenciosamente; explicar bloqueios e oferecer exceções por site.

**Gate 4 — critérios iniciais:** 100% dos itens `Must-have` do inventário têm teste e passam; 100% das extensões marcadas críticas passam o fluxo principal e mostram permissões; pelo menos 90% do conjunto de compatibilidade priorizado passa ou recebe motivo de incompatibilidade confirmado; abas/atalhos em 100% dos casos essenciais; isolamento verificado entre pelo menos três perfis; crash/restart restaura as abas esperadas no perfil de teste. Medir três ações locais em fixture: início do processo até a nova aba estar utilizável, comando de nova aba até a página local estar pronta e comando de alternar aba até a página ativa estar visível. Fazer 30 execuções alternadas por navegador como triagem. Para promoção, fazer pelo menos 200 execuções por navegador/ação e calcular intervalo de confiança bootstrap de 95% do P95; limite superior da razão P95 Chromium / melhor referência (Zero Electron ou Brave) deve ser ≤1,10. Se o intervalo tiver largura acima de 5% ou cruzar 1,10, aumentar N; resultado inconclusivo bloqueia promoção. Mesmo PC, estado de energia e perfil de teste; sem carga pesada concorrente; fixture de loopback sem internet. Congelar versões e cronômetros no Gate 0.

### Fase 5 — Experiência nativa de navegador IA

- Painel de comando persistente com provedor/modelo e controles que já existem no Zero/Flame.
- Página nova aba como painel de tarefas: agente ativo, progresso, site, abas de trabalho, ações recentes, assistir, parar, retomar e replay.
- Múltiplos agentes em espaços/abas próprios sem interferência entre usuário e tarefa ou entre agentes.
- Ferramentas para abas, conteúdo, arquivos/downloads e leitura de múltiplas páginas com esquemas completos e seleção contextual quando comprovadamente reduz tokens.
- Memória seletiva e editável por site/tarefa: fonte, data, confiança, expiração e opção de apagar; recuperada só quando relevante. Não carregar todo o histórico para cada prompt.
- Integração MCP de um clique para clientes compatíveis, status de conexão persistente e instalação/configuração verificável.

**Gate 5:** agente pode executar uma tarefa autorizada de ponta a ponta, usuário observa/pausa/cancela, ação sensível exige handoff, resultado tem prova independente e a memória melhora acerto ou custo em experimento pareado.

### Fase 6 — Migração de dados e sincronização

1. Migrar em perfil de staging favoritos, histórico, preferências, extensões listadas e sessões, com relatório de itens importados/ignorados.
2. Senhas, cookies e sessões autenticadas ficam fora da migração automática até haver plano separado, consentimento explícito e verificação de criptografia/plataforma.
3. Sincronização será serviço Zero próprio com login, criptografia em trânsito e repouso, dispositivos revogáveis, resolução de conflitos, exportação e exclusão.
4. Começar sync com favoritos, preferências e abas abertas. Senhas só numa etapa posterior e após revisão de segurança.
5. Não depender das APIs privadas de Google Chrome Sync; terceiros tiveram o acesso a APIs privadas do Chrome restringido.

**Gate 6:** importação e restauração ensaiadas com perfil descartável; sync passa teste offline, conflito, logout, revogação e exclusão; nenhum segredo em logs ou telemetria.

### Fase 7 — Piloto, atualização e distribuição

1. Canal de desenvolvimento instalado em diretório/perfil separado da versão diária.
2. Testes automatizados, teste de instalação/atualização/desinstalação/rollback, crash/restart, assinatura do instalador e verificação de hashes.
3. Canal beta opt-in; medir crash, regressão, consumo de memória, latência e métricas do agente com coleta local/consentida.
4. Lançamento estável só após gates de segurança, benchmark e suporte a dados passarem.
5. Processo recorrente para atualizar Chromium e dependências, avaliar CVEs, portar patches, compilar e publicar. Chromium não fornece por si só o atualizador de produto final.

**Política operacional proposta:** verificar advisories do projeto Chromium e dependências semanalmente; acompanhar cada milestone estável do upstream; bloquear novos releases do Zero em caso de CVE crítica aberta no código incluído; planejar atualização de emergência em até 7 dias após correção upstream crítica, sujeito à capacidade de validação; definir suporte para a versão atual e a anterior; assinar artefatos e manter rollback da última versão conhecida. O responsável e os SLAs finais precisam ser definidos antes do canal beta.

**Gate 7:** instalação paralela e rollback comprovados; updater valida assinatura do pacote e metadados do canal e rejeita assinatura inválida, pacote adulterado e downgrade não autorizado; atualizações interrompidas não deixam o produto inutilizável; rollback restaura versão anterior e perfil de teste utilizável, com snapshot/hashes verificados; documentação de licença/terceiros publicada; fonte de advisories, responsável, SLA para crítico, suporte e calendário de releases definidos.

## 7. Avaliação de acerto, velocidade, tokens e regressões

### Corpus obrigatório

- Tarefas difíceis existentes, incluindo multiaba/transferência de dados.
- Planilha local de teste com grade, fórmulas/valores e salvamento confirmado.
- Loja SPA de demonstração, variantes/carrinho e endpoint independente de estado.
- Formulários dinâmicos, React, seleção de controles, carregamento assíncrono, scroll e navegação SPA.
- Abas/janelas, downloads, arquivo, permissão, extensões, sessão retomada, cancelamento e recuperação após crash.
- Sites reais somente com contas e dados de teste autorizados, sem compras, pagamentos ou publicação real.

### Protocolo pareado

- Mesma tarefa, estado inicial, fixture, texto de comando, provedor, modelo, parâmetros, política de aprovação e ambiente.
- Fazer smoke inicial com cinco repetições por tarefa crítica e duas rodadas da suíte difícil; isso detecta defeitos, mas **não** é, isoladamente, prova estatística de não regressão.
- Antes do gate de promoção, calcular tamanho de amostra com base na variabilidade do baseline pareado e em poder estatístico de pelo menos 80%; alternar a ordem Electron/Chromium e manter modelo, provedor, comandos, parâmetros, fixture e política fixos.
- Para sucesso binário, comparar pares com intervalo de confiança de 95% (McNemar/exato ou método pareado adequado) por tarefa/categoria e global; um resultado sem amostra suficiente ou intervalo inconclusivo bloqueia promoção.
- Para tokens e tempo, usar diferenças/razões pareadas e bootstrap de 95% para mediana e P90; registrar distribuição e retentativas, não apenas média.
- Capturar estado final por verificador, `actionExecuted`/`outcomeVerified`, passos, chamadas, retentativas, tokens de entrada/saída/cache quando informados e latência total + p50/p90 do provedor.
- Relatórios separados para mock/fixture, provedor real e site autenticado; mock valida integração, não qualidade de modelo.

### Gate de não regressão

- Nenhuma ferramenta/capacidade atual desaparece sem decisão explícita.
- Zero regressão em tarefa marcada crítica (dados incorretos, ação sensível sem aprovação, vazamento de segredo, aba pessoal alterada ou estado final falso).
- Taxa de sucesso agregada e por categoria: limite inferior do intervalo de confiança de 95% da diferença Chromium−Electron deve ser ≥0. Tarefas críticas exigem zero regressões observadas; caso a amostra não consiga sustentar isso, resultado é inconclusivo e não se promove.
- Para afirmar não regressão de eficiência, o limite superior de 95% da razão pareada de tokens e de P90 de tempo deve ser ≤1,0. Resultado inconclusivo bloqueia a promoção. A equipe pode medir melhorias graduais sem promover o novo runtime até cumprir o gate.
- Qualquer ganho de token precisa vir do uso do modelo em condição pareada, não de tamanho de schema ou build isolado.

## 8. Segurança, privacidade e extensões

- **Modelo de ameaça:** proteger dados contra conteúdo web não confiável, extensões sem permissão, outro usuário local e chamadas MCP não autorizadas; impedir que páginas ou extensões obtenham controle do browser por prompt injection ou acesso direto à bridge. Processo malicioso com a mesma conta Windows não é isolado pelo ACL sozinho e exige limitação explícita da promessa de segurança.
- A IA recebe ações pelo bridge privilegiado do Zero; websites e extensões não recebem credencial nem endpoint da bridge.
- Bridge apenas local, autenticada, com lista de comandos, escopo de aba/perfil/agente, rate limit, nonce/anti-replay, cancelamento, rotação/revogação e ACL de usuário. Definir bootstrap da autenticação por handle protegido/pipe ACL; segredo não fica em arquivo de configuração nem storage acessível a renderer.
- Renderer da página, extensão de usuário, UI do navegador e serviço do agente têm fronteiras separadas; qualquer fluxo entre elas passa por IPC validado no processo de navegador. Nunca deixar CDP aberto a rede/LAN.
- Manter sandbox e isolamento de processo. Conteúdo de página é dado não confiável, inclusive instruções embutidas em páginas e documentos.
- Segredos, senha, chave API, cookies e texto sensível não entram em prompt/trace por padrão; conteúdo enviado ao modelo é minimizado e mostrado conforme configuração.
- Controle de extensões inclui origem do pacote, assinatura quando aplicável, permissões solicitadas, revisão do usuário, atualização e remoção. Extensão pode executar código privilegiado e deve ser tratada como parte da superfície de ataque.
- Log/replay locais por padrão, opção para desligar, retenção/apagar/exportar e remoção de campos sensíveis.
- Permissões de login, pagamento, envio, exclusão, publicação e mudanças de conta usam confirmação ou handoff segundo política explícita.

## 9. Dados, backup e reversão

- Congelar e validar backup do aplicativo, instalador, configurações e perfil antes de instalar protótipo no mesmo dispositivo.
- Instalar Chromium em diretório e perfil de staging próprios; não reutilizar nem converter o perfil de produção durante a prova.
- Fazer importação seletiva, confirmar contagens e hashes onde se aplicam e testar que o perfil anterior continua abrindo.
- Versionar migrações do perfil; executar upgrade, falha/interrupção de update, recusa de downgrade e rollback em cópia descartável; confirmar que dados posteriores ao snapshot são recuperáveis ou avisados explicitamente antes de reverter.
- Migração de produção só depois de instalação, atualização, login/importação autorizados e rollback testados.
- Manter dois canais durante piloto e documentar o comando/caminho de restauração. Não apagar a versão antiga até aceite explícito do novo canal estável.

## 10. Recursos, riscos e estimativa

### Ambiente de build verificado nesta máquina

Em 2026-10-26, o volume C: tem 280,4 GB livres em NTFS e o sistema reporta 31,9 GB de RAM. Isso atende ao espaço mínimo atual de build indicado pela documentação Chromium Windows (100 GB NTFS, 8 GB RAM mínimo, mais de 16 GB recomendado). A versão instalada do Visual Studio foi reportada como 17.14.37710.0 e o Windows SDK como 10.0.26100.0; a documentação atual consultada pede Visual Studio 2026 (18.x) e SDK 10.0.28000.2270. Portanto, **o disco e a RAM parecem suficientes, mas o ambiente de build Chromium ainda precisa ser atualizado**. Revalidar os requisitos imediatamente antes do primeiro checkout/build.

Esses 100 GB são de desenvolvimento/build, não o tamanho do download do usuário. O usuário receberá apenas o pacote de instalação produzido; o tamanho desse pacote só pode ser estimado depois de construir e medir a configuração final do Zero.

### Riscos principais

| Risco | Resposta planejada |
|---|---|
| Acoplamento do agente às APIs Electron atrasa port | POC do contrato antes da casca completa; manter adaptador Electron para comparação. |
| Build completo do Chromium falha ou demora no Windows | Atualizar ferramentas, pin de revisão, primeiro protótipo pequeno, usar cache e manter orçamento de disco. |
| Extensão importante não funciona ou pede APIs extras | Matriz priorizada com nomes/versões e teste no protótipo antes da decisão de UX final. |
| Mudança de runtime reduz acerto ou aumenta custo | Gate pareado obrigatório e rollback para Electron. |
| Migração danifica perfil/logins | Perfis isolados, backup testado e importação seletiva; cookies/senhas separados. |
| Bridge de controle vira porta de invasão local | IPC autenticado e allowlisted, sem endpoint CDP irrestrito; red-team e teste de prompt injection. |
| Fork atrasa patches de segurança | Responsável, calendário de atualização, pin de versões e gate de CVE no processo de release. |
| Sync de conta Google não está disponível para terceiros | Sync Zero próprio; não prometer compatibilidade com Chrome Sync. |

**Prazo e custo financeiro:** não fixar antes da Fase 3. O risco de integração nativa, atualização contínua e matriz de extensões só ficará claro após a prova Chromium. A Fase 0 deve calcular amostra estatística e custo de chamadas ao modelo; ensaios com provedor pago precisam de orçamento aprovado.

## 11. Critérios de pronto do projeto

O Zero pode substituir a versão diária quando todos os itens abaixo forem verdadeiros:

1. Navegação diária com abas/janelas, perfis, histórico, downloads, extensões e configurações foi testada em janela real.
2. Agente usa a mesma semântica de ferramenta e política, opera em abas próprias e conclui tarefas autorizadas com evidência observável.
3. Todas as capacidades atuais do motor foram mapeadas e mantidas ou receberam decisão explícita.
4. Taxa de sucesso agregada e por categoria passou o gate pareado com amostra e intervalo de confiança suficientes; teste inconclusivo não libera promoção.
5. Benchmark pareado não mostrou regressão em acerto, tarefa crítica, tokens/tempo ou segurança segundo os gates acima.
6. Importação, backup, atualização, desinstalação e rollback foram testados em perfil temporário e depois em piloto opt-in.
7. Extensões e permissões estão visíveis; o inventário obrigatório e os limites reais estão aprovados e explicados sem alegar “sem nenhuma limitação”.
8. Processo de atualização de Chromium, assinatura, licença/terceiros, telemetria e suporte está pronto para releases sucessivos e tem responsável e SLA definido.

## 12. O que está pendente

- Validar visualmente BrowserOS Neo instalado com MCP conectado; a análise deste plano usa apenas fontes públicas.
- Confirmar a lista de extensões prioritárias e quais recursos do Brave são essenciais para o Zero; fechar matriz MoSCoW e denominadores antes da Fase 4.
- Reexecutar o baseline atual sob um protocolo único antes de compará-lo ao novo runtime; resultados históricos vêm de rodadas/provedores diferentes.
- Atualizar Visual Studio e Windows SDK antes do build Chromium.
- Definir provedor/modelo e limite de orçamento para benchmarks com chamadas pagas.

## 13. Fontes verificadas em 2026-10-26

- Electron embute Chromium e Node.js: https://www.electronjs.org/docs/latest/
- Limites atuais das APIs de extensões Electron: https://www.electronjs.org/docs/latest/api/extensions/
- Requisitos e build Chromium no Windows: https://chromium.googlesource.com/chromium/src/+/main/docs/windows_build_instructions.md
- Atualizações/canais de release Chromium: https://www.chromium.org/chrome-release-channels/ e https://www.chromium.org/administrators/turning-off-auto-updates/
- Brave Features: https://brave.com/features/
- BrowserOS neo: https://browseros.com/neo/
- BrowserOS README, distinção BrowserOS/Neo, cockpit, sessões e licença declarada: https://github.com/browseros-ai/BrowserOS/blob/main/README.md
- Acesso de navegadores de terceiros a APIs privadas do Chrome Sync: https://blog.chromium.org/2021/01/limiting-private-api-availability-in.html
- Marca de build Chromium/Chrome: https://www.chromium.org/developers/gyp-environment-variables/
