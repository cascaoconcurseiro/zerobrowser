# Checklist consolidado dos planos — 31/10/2026

Tudo abaixo é **proposta**; nada foi implementado ainda, salvo onde estiver marcado `[x]`. Marcar só com evidência (teste, execução ou arquivo). Este arquivo está separado do `CHECKLIST.md` principal de propósito: a análise foi feita sobre a árvore principal (0.1.43-dev, 29 arquivos sem commit) e estes documentos nasceram numa cópia de trabalho. Para incorporar: copiar os documentos `docs/PLANO_*.md` e este arquivo para a pasta principal e acrescentar uma linha no topo do `HANDOFF.md` apontando para cá.

## Índice dos documentos
Guia completo de leitura e ordem de construção para outra IA (GPT): `docs/LEIA_ME_PRIMEIRO_IA.md`. Além dos quatro abaixo, existem `PLANO_DESIGN_UX.md`, `PLANO_ROTAS_E_FIREWALL.md`, `PLANO_APPS_VIVOS.md`, `PLANO_NAVEGADOR_NATIVO_IA.md` e `PLANO_PARIDADE_E_SALTO.md`.

- `docs/PLANO_SUPERAR_CONCORRENTES.md` — posicionamento, três afirmações a provar, portões.
- `docs/PLANO_MOTOR.md` — velocidade, tokens e custo.
- `docs/PLANO_BOTS.md` — bots como espaços criados pelo usuário, rotinas, agendamento, ideias além do óbvio.
- `docs/PLANO_CONTROLE_TOTAL_IA.md` — MCP completo, console/rede, permissões por cliente.

## 0. Estado e pendências imediatas
- [x] Análise da árvore principal: `npm test` 333/333 (atualizado para 374/374 na `0.1.52-dev`) e `npm audit --omit=dev` zero (31/10/2026).
- [x] Commitar as 29 alterações da árvore principal com a suíte verde (commit `0c56c26` e entregas até `6e037d1`).
- [x] Corrigir `temperature: 0.2` enviada a modelos OpenAI que a rejeitam (`src/automation/service/agent-runtime.js`, coberto em `test/provider-metrics.test.js`).
- [x] Filtrar a lista de modelos da OpenAI para chat com ferramentas (`src/automation/model-catalog.js`, `normalizeModel`, coberto em `test/model-catalog.test.js`).
- [x] Backup da instalação antes de testar no pacote instalado (`backups/2026-10-31-before-0.1.52-install/`, 184 arquivos) e perfil principal preservado.
- [x] Decidir a pasta de trabalho: documentos copiados de `analise-projeto-atual-bf8fc8` para `docs/` da árvore principal.

## 1. Posicionamento e concorrentes (`PLANO_SUPERAR_CONCORRENTES.md`)
- [ ] Confirmar o nicho: navegador-agente controlável para usuários técnicos.
- [ ] Provar A (acerto ≥ 90% do melhor rival), B (tokens ≤ 1,2×) e C (segurança) com dados públicos.
- [ ] Etapa 1: higiene (itens da seção 0).
- [ ] Etapa 2: benchmark real de 30 tarefas contra BrowserOS neo e mais um rival. **Portão 1.**
- [ ] Etapa 3: suíte de ataques, revisão independente, log de ações exportável. **Portão 2.**
- [ ] Etapa 4: atualização automática assinada com volta atrás, abas/downloads/perfis conferidos no app, replay da execução. **Portão 3** (uso real por 7 dias).
- [ ] Etapa 5: Ollama real com 2 modelos; MCP com clientes reais.
- [ ] Etapa 6: publicar relatórios e medir 5–10 usuários técnicos por 2 semanas.

## 2. Motor (`PLANO_MOTOR.md`)
- [ ] Etapa 0: linha de base (hash congelado, conjunto de tarefas, 3 repetições, orçamento de 10 tarefas × 1 repetição).
- [ ] Etapa 1: A/B pareado de `--scripts`, `--preinspect` (conjunto básico, `reais`, outro modelo), `promptCache`, seletor de ferramentas avançadas, `cascade`; descartar deduplicação de snapshots; `diff`/`stream` só se sobrar orçamento. Perfil padrão e A/B final.
- [ ] Etapa 2: decompor onde o tempo vai (modelo, ferramenta, espera, snapshot).
- [ ] Etapa 3: menos chamadas (run_steps padrão, leituras em paralelo, receitas por site, execução antecipada no streaming).
- [ ] Etapa 4: menos tokens por chamada (prefixo estável, snapshots menores, compactação, teste de orçamento de bytes).
- [ ] Etapa 5: comparar três modelos por custo por tarefa resolvida.
- [ ] Etapa 6: levar o perfil final ao benchmark contra rivais.
- [ ] Portão do fim da Etapa 1: custo por tarefa resolvida −20% sem perder acerto.

## 3. Bots (`PLANO_BOTS.md`)
- [x] Fase 1: ficha do bot (`src/bots/bot-store.js`), executor manual somente leitura (`src/bots/runner.js`), histórico, limites de passos/tempo/gasto e parada em < 1s (`0.1.56-dev`).
- [x] Fase 2: agendador (`src/bots/scheduler.js`: intervalo, diário, dia do mês), execução perdida ao abrir (`runMissedSchedulesOnce`), notificação e iniciar com o Windows na bandeja (`0.1.57-dev`).
- [x] Fase 3: modelo "pesquisador de preços" (`src/bots/templates.js`: confirmação do produto, receita por loja, alerta, histórico); modelo "preço de ação" (somente leitura, `0.1.57-dev`).
- [x] Fase 4: gravador "Ensinar uma tarefa" (`src/bots/recorder.js`), botão `Ensinar` na UI e salvar como Bot (`0.1.57-dev`).
- [ ] Fase 5: tarefa agendada do Windows para rodar com o Zero fechado.
- [ ] Bot como espaço isolado: perfil próprio, memória visível e editável (nunca gravada por conteúdo de página), autonomia em degraus, orçamento próprio.
- [ ] Ideias além do óbvio: mandato (autoridade com limite), comprovante automático, site vira ferramenta MCP, observa e oferece, bot de teste para desenvolvedores; memória da web pessoal só se houver demanda.
- [ ] Meta "Grok Bot do navegador" (ver seção 0c do `PLANO_BOTS.md`): painel de conversa por bot; aprender por demonstração (gravador de ações) como recurso central; rotinas por evento (e-mail novo, mudança de página); equipe de bots depois da Fase 4.
- [ ] Interface dos bots (seção 0d do `PLANO_BOTS.md`), só depois de executor e histórico existirem: barra de avatares com anel de estado (texto + cor, nunca só cor); painel de conversa por bot; abrir a aba do bot e assumir o controle; central de atividade com "parar tudo"; contador na bandeja; cor por bot/perfil; botão "+" para criar bot; teclado, nomes acessíveis, contraste e redução de movimento.
- [ ] Integração em camadas (seção 0e): navegador, motor, bots, controle por IA e central; cada camada só avança após passar nos testes da anterior.
- [ ] Caminho até Grok Bot completo (seção 0c2 do `PLANO_BOTS.md`): degraus local, servidor próprio, nuvem oferecida; recomendação é ir ao degrau 2 antes de pensar no 3.
- [ ] Preparar a porta desde já: executor sem janela (headless), bot como arquivo exportável, cofre de segredos trocável, canal de mensagens abstrato, login remoto, estado portável.
- [ ] Lacunas assumidas: funcionar com o PC desligado (só com modo servidor, opcional e futuro) e falar com o bot pelo celular (futuro, exige desenho de segurança).
- [ ] Bot de e-mail: só rascunho primeiro; teste com e-mails hostis antes de qualquer envio.
- [ ] Rotina do "dia 05" (sistema do trabalho): testar duração da sessão antes de desenhar.

## 4. Controle total por IA (`PLANO_CONTROLE_TOTAL_IA.md`)
- [x] Fase 1: obter o `tools/list` real, gravar como contrato (`docs/MCP_TOOLS_COMPARATIVO.md`), comparar com Playwright MCP e Chrome DevTools MCP (`0.1.56-dev`).
- [x] Fase 2: clientes pareados, níveis (`observar`, `interagir`, `desenvolvedor`, `total`), validade e escopo, log, parar tudo, segredos redigidos (`src/automation/mcp-diagnostics.js`, `0.1.56-dev`).
- [x] Fase 3: `console_messages`, `page_errors`, `network_requests` com redação de segredos (`0.1.56-dev`).
- [ ] Fase 4: cookies/armazenamento, emulação, diálogos, upload, PDF, árvore de acessibilidade, arrastar, teclas, iframes.
- [ ] Fase 5: controle do navegador (histórico, favoritos, downloads, configurações, perfis, extensões).
- [ ] Fase 6: HTTP local e porta CDP com token; Claude Code, Codex e Playwright controlam uma página fixture.
- [ ] Fase 7: documentação por cliente e por nível.
- [ ] Registrar o Zero como servidor MCP nesta máquina (`claude mcp add navegante -- node <pasta>\scripts\mcp-stdio.js`) — ação do usuário; o Zero estava aberto e com o canal ativo em 31/10.

## 4b. Design, UX e fluxos (`PLANO_DESIGN_UX.md`)
- [x] Avatares: símbolo de traço dentro do anel colorido (seção 11b do plano), com iniciais ou imagem própria como alternativa (decidido em 31/10/2026; implementação pendente).
- [ ] Decidir: trilho à esquerda ou na barra de abas, logotipo final.
- [ ] Escolher e desenhar o conjunto de cerca de 24 símbolos e a paleta de 8 cores de bots.
- [x] Tokens: anel de estado, paleta de 8 cores de bots com contraste verificado, escala de 4px (`0.1.53-dev`, validado em `test/bot-avatar-catalog.test.js` e `scripts/electron-delegation-layout.integration.js`).
- [ ] Protótipo HTML dos fluxos criar bot, aprovar e assumir; teste com 5 pessoas (4 de 5 concluem sozinhas).
- [ ] Teste de 5 segundos do trilho (acertar estado de 4 de 5 avatares).
- [ ] Trilho + painel do bot; cartão de aprovação; comprovante por execução; fluxo Ensinar; Central; primeira abertura.
- [x] Mockup do modo Delegar aprovado como base do protótipo (31/10/2026; seção 11c do plano de design).
- [x] Protótipo clicável em HTML a partir desse mockup (`docs/prototipos/fluxos-delegar-prototipo.html`: criar/ensinar bot, aprovar, assumir, `0.1.57-dev`).
- [x] Dois modos (Navegar e Delegar) e barra de comando única (`Ctrl+K`) que decide pela intenção e mostra o que fará antes (`0.1.54-dev`).
- [x] Interface declarativa com comandos `ui.*` (`src/main/ui-customizer.js`), mudanças versionadas, prévia, desfazer e modo seguro; núcleo (parar tudo, indicador de controle, aprovação, Central) fixo (`0.1.57-dev`).
- [x] Gravador "ensinar uma tarefa" (`src/bots/recorder.js`) com rascunho em linguagem simples, revisão e pausa de bots sem verificação por 14 dias (`0.1.57-dev`).
- [ ] Testes: 5 segundos (4 de 5), comando (8 de 10), núcleo (IA não consegue esconder parar tudo).
- [ ] Teclado e NVDA nos três fluxos; movimento reduzido; estados vazio/erro/carregando em cada tela.

## 4c. Rotas aprendidas e firewall (`PLANO_ROTAS_E_FIREWALL.md`)
- [ ] Fase 0 das rotas: 5 sites, comparar clicar × rota (portão: 3 de 5 com tempo −70% e tokens −80%, meta).
- [x] Observador de rede, compilador de rota, executor com queda automática, biblioteca, WebMCP, ensaio (gêmeo local) em `src/automation/learned-routes.js` (`0.1.58-dev`).
- [x] Suíte de 50+ ataques em 5 famílias e linha de base no Zero atual (`test/intent-firewall-attacks.test.js`, 50/50 bloqueados na `0.1.55-dev`).
- [x] Etiquetas de origem, política de efeitos, recibo antes de executar (recibo igual à requisição enviada, `0.1.55-dev`).
- [ ] Publicar "N de N ataques sem efeito indevido" e taxa de falsos bloqueios.
- [x] Deixar explícito no produto o limite: texto livre externo copiado para campos livres (`containsExternalText` / `warningLabel` em `src/automation/service/intent-firewall.js`, `0.1.55-dev`).

## 4d. Apps vivos (`PLANO_APPS_VIVOS.md`)
- [x] Fase 0: painel de vencimentos com 3 fontes (`createWeeklyDueAppPrototype` em `src/live-apps/live-app-engine.js`, `0.1.59-dev`; 7 dias de uso real pendente).
- [x] Geração por conversa, edição e versões, ações com recibo e firewall, pacotes sem dados pessoais (`src/live-apps/live-app-engine.js`, `0.1.59-dev`).
- [ ] Decidir: primeiro app de prova (financeiro ou trabalho) e se pacotes compartilháveis entram.

## 4e. Navegador nativo para IA (`PLANO_NAVEGADOR_NATIVO_IA.md`)
- [x] Fase 0: inventário das ações de interface (`docs/CATALOGO_COMANDOS_NAVEGADOR.md`) e registro único de comandos (`src/main/command-registry.js`, `0.1.54-dev`).
- [ ] Fase 1: interface chamando o registro; teste que falha se um botão novo não passar por ele.
- [x] Fase 2: comandos no MCP por nível, com testes negativos (`test/bots-and-mcp.test.js`, `0.1.56-dev`).
- [x] Fase 3: conectores (e-mail, agenda, arquivos), leitura primeiro; escrita com aprovação, recibo e firewall (`src/connectors/index.js`, `0.1.59-dev`).
- [x] Fase 4: Zero como cliente MCP, com aviso de risco para servidores de terceiros (`ExternalMcpClient`, `0.1.59-dev`).
- [x] Fase 5: mensageria (Telegram) com remetentes autorizados (`AuthorizedMessagingBridge`, `0.1.59-dev`).
- [ ] Fase 6: extensões do Zero; inventário de compatibilidade com extensões do Chrome no Electron (não prometer sem testar).
- [x] Fase 7: personalização versionada, modo seguro (`VersionedUiCustomizer`, `0.1.57-dev`).
- [x] Núcleo intocável (parar tudo, firewall, recibo, log de auditoria, aprovação financeira, cofre, limites, atualização): teste contínuo de que a IA não consegue desligá-lo (`test/command-registry.test.js`, `0.1.54-dev`).
- [x] Núcleo intocável aceito pelo Wesley em 31/10/2026 (implementação pendente).
- [ ] Decidir: lista e ordem dos conectores; Telegram primeiro; servidores MCP de terceiros.

## 4f. Paridade e salto (`PLANO_PARIDADE_E_SALTO.md`)
- [ ] Paridade essencial: atualização automática com volta atrás, abas avançadas, perfis validados, contexto de várias abas, conectores, replay/comprovante, onboarding. Portão: 10 fluxos do comparativo sem "não verificado".
- [x] Campo de reversibilidade (reversível, parcial, irreversível por padrão) em toda ação de escrita; zero escrita sem classe (`0.1.54-dev`).
- [x] Recibo mostra janela de reversão; Desfazer em sequência de compensações; 5 de 5 fixtures restauradas (`test/command-registry.test.js`, `0.1.54-dev`).
- [x] Histórico de execuções com resultado verificado; rastreador "Confiança" por bot e por site (`EarnedAutonomyTracker`, `0.1.59-dev`).
- [x] Autonomia conquistada: subir degrau só com aceite humano, descer automático; teste de que nenhum degrau desliga o núcleo (`test/live-apps-connectors-parity.test.js`, `0.1.59-dev`).
- [x] Ensaio em gêmeo local (somente leitura, `LocalTwinSandbox` na `0.1.58-dev`).
- [ ] Rede de rotas opt-in: decidir só depois das fases 2 a 4.
- [x] Limite de paridade e Desfazer como aposta principal aceitos pelo Wesley em 31/10/2026 (sincronização e app móvel adiados; implementação pendente).
- [ ] Decidir: primeiras ações para o Desfazer (e-mail, compras, agenda).

## 5. Dependências do usuário
- [ ] Teto de gasto com API e escolha do provedor (OpenRouter ou OpenAI) para o benchmark.
- [ ] Chave salva por você no app; teste de conexão real.
- [ ] Acesso aos rivais (contas/planos) além do BrowserOS neo.
- [ ] Ollama com modelos instalados, se quiser a Etapa 5 local.
- [ ] Teste de sessão do sistema do trabalho: tempo de duração e se sobrevive a fechar/reabrir o Zero.
- [ ] Qual webmail e quais fontes de cotação você usa.
- [ ] 5 pessoas para o teste de uso; certificado de assinatura de código.

## 6. Decisões abertas
- [ ] Sincronização entra no produto ou fica fora.
- [ ] Níveis de permissão oferecidos a IAs externas, validade máxima do nível *total*, porta CDP já ou depois.
- [ ] Permitir bots com o Zero fechado.
- [ ] Notificação só do Windows ou também e-mail/celular.
- [ ] Prioridade entre os planos: sugestão é Etapas 1–2 do geral e do motor em paralelo com a Fase 1 do controle por IA e do bots, que não dependem do benchmark.
