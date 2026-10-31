# Checklist — Zero Browser

## Estado atual

- Código e instalação local em `0.1.58-dev`: Rotas Aprendidas (`src/automation/learned-routes.js`), ponte WebMCP com ordem de preferência (`WebMCP -> Rota -> Receita -> Clique`) e ensaio em Gêmeo Local (`LocalTwinSandbox`).
- Na fatia `0.1.53-dev` (Design e UX): implementados os tokens de espaçamento (escala de `4px`), paleta de 8 cores de Bots com contraste WCAG ≥ `3:1` verificado nos temas claro e escuro (`BOT_ACCENT_PALETTE` e `BOT_STATE_COLORS`), anel de estado nunca só por cor (`idle`, `working`, `needs-attention` `!`, `error` `×`, `paused` `‖` + nome acessível), indicador na aba controlada (`.tab-controlled` + `#tab-control-banner`), botão `Assumir` / `Devolver ao bot` e etiqueta explícita de reversibilidade no cartão de aprovação.

## Entrega atual — Tokens de estado, paleta 8 cores, indicador de aba controlada e Assumir (0.1.53-dev)

- [x] Paleta de 8 cores de Bots (`BOT_ACCENT_PALETTE`) e cores de estado (`BOT_STATE_COLORS`) com contraste ≥ `3:1` verificado por teste automatizado em fundos claros e escuros.
- [x] Tokens de espaçamento na escala de `4px` (`--space-1` a `--space-12`) e anel de estado dos avatares combinando cor, traço (`solid`, `dashed`, `dotted`, `double`), selo (`!`, `×`, `‖`) e texto acessível.
- [x] Indicador na aba controlada (`.tab-controlled` + `#tab-control-banner`) e botão `Assumir` / `Devolver ao bot` pausando imediatamente o agente.
- [x] Etiqueta explícita de reversibilidade (`Reversível`, `Parcialmente reversível`, `Não reversível`) no cartão de aprovação no chat.
- [x] Testes automatizados (`npm test` 375/375, `npm run test:delegation-layout` PASS, `npm run test:ui` PASS).
- [x] Próximo passo de Design/UX: recibo pós-ação com botão `Desfazer` para ações reversíveis e barra de comando por intenção (`Ctrl+K`) concluídos na `0.1.54-dev`.
- Este arquivo contém apenas a ordem ativa e o backlog priorizado. O inventário cronológico antigo foi preservado em `docs/CHECKLIST_HISTORICO.md`; itens abertos lá não são tarefas autorizadas/ativas até serem promovidos para cá.
- Planos em `docs/PLANO_*.md` são propostas. Confirmar cada capacidade no código e no executável antes de mudar status para concluído.

## Entrega concluída — Central, ciclo dos Bots e divisor Delegar (0.1.52-dev)

- [x] Central oculta e torna inerte o chat subjacente; fechar restaura chat e foco.
- [x] Separar Bots Ativos/Arquivados; arquivar/restaurar sem mover dados, cookies, login ou avatar; bloquear novas aberturas no processo principal.
- [x] Serializar alterações concorrentes entre processos para não perder registros Bot/perfil.
- [x] Reduzir largura inicial Delegar para `min(480px, 34vw)`; permitir ajuste por mouse/toque e teclado, mantendo espaço mínimo para a página.
- [x] Central acompanha a largura do painel; melhorar estado ativo de Delegar e alvos de clique compactos.
- [x] Redimensionar e centralizar os sprites dentro do círculo.
- [x] `npm test` 374/374; `npm run test:ui` PASS; `npm run test:delegation-layout` PASS em seis tamanhos; revisão estática independente sem falhas concretas.
- [x] Build .52 (`dist/win-unpacked/Zero Browser.exe` e `dist/Zero Browser Setup 0.1.52-dev.exe`), confirmação no executável com perfil QA isolado (Central substituindo o chat, divisor `476px -> 500px`, sprites centralizados `delta=0` e arquivar/restaurar Bot) e hashes SHA-256 gerados.
- [x] Backup da .51 instalada (`backups/2026-10-31-before-0.1.52-install/`, 184 arquivos), commit local `6e037d1`, instalação da .52 (`ExitCode: 0`) e abertura no perfil normal (`Principal`, `deepseek` / `deepseek-flash`, `hasApiKey: true`).
- [x] Registrar a verificação final pós-instalação (atalhos Desktop/Start Menu `True`, versão instalada `0.1.52.0` e hashes idênticos ao pacote).

## Entrega concluída — layout Delegar e Central de Bots (0.1.51-dev)

- [x] Alinhar a posição da Central ao trilho e ao painel reservado pelo processo principal, removendo o encobrimento pela página nativa.
- [x] Organizar cabeçalho, contagem, lista rolável, identidade do Bot atual e ação de criação.
- [x] Corrigir layout compacto, contraste do endereço e espaço desperdiçado pela barra de favoritos vazia.
- [x] Verificar UI e layout em quatro tamanhos; `npm test` 370/370 e `npm run test:ui` passaram.
- [x] Build NSIS gerado, instalado e verificado; backup dos 184 arquivos e hashes registrados em HANDOFF.
- [x] `test:installed` PASS com perfil temporário e endpoints loopback mockados.
- [x] Commit local `095728a`, reinstalação após o commit e smoke no executável.

## Próxima entrega — estados de Bots já cobertos; falta validação no executável

**Objetivo:** arquivar e restaurar um Bot sem apagar nem mover diretório, cookies, login ou associação de avatar. Uma janela já aberta continua funcionando e deve indicar que o Bot está arquivado. O app deve impedir novas aberturas pelo menu e IPC.

**Limite:** exclusão permanente e detecção/contenção de processos Bot ativos ficam fora desta fatia. O código atual não mantém um registro confiável dos processos separados; apagar a pasta pode remover dados ainda usados.

- [x] **Modelo/persistência:** guardar estado de arquivamento no registro Bot; serializar alterações concorrentes; não apagar nem mover arquivos.
- [x] **IPC/abertura:** arquivar/restaurar pela API principal e impedir abertura nova de Bot arquivado.
- [x] **Central/trilho:** separar Ativos/Arquivados, oferecer Arquivar/Restaurar e preservar associação do avatar.
- [x] **Verificação local:** persistência, concorrência entre processos, abertura negada, restauração, avatar e estados de UI cobertos.
- [x] **Verificação instalada:** confirmar visualmente as ações no executável .52 com perfil isolado.
- [ ] **Limite conhecido:** janela Bot já aberta em outro processo continua ativa e não é detectada; detecção e encerramento ficam fora desta etapa.

## Ordem das próximas frentes

1. **Validação/instalação .52:** Central visual, divisor de largura, avatares e perfil normal com configuração existente.
2. **Interações do restante do navegador:** conferir estados de foco, botões e sobreposições por tela com critérios visuais/funcionais.
3. **Motor — velocidade, acerto e tokens:** o benchmark pareado e fixtures locais já existem em `bench/`; primeiro escolha baseline e experimento. Chamadas a provedores reais só com orçamento aprovado.
4. **MCP e segurança de Bots:** inventário de ferramentas e ataques em fixture por gate; sem misturar com o benchmark.
5. **Concorrentes e maturidade:** atualizar notas só com evidência comparável e fontes datadas.
6. **Detecção de Bots ativos, exclusão permanente e atualizações assinadas:** planejar separadamente; não apagar pastas até haver coordenação/rollback seguro.

## Regra de divisão do trabalho

- Especialista Bots: `src/main/profiles.js`, IPC de Bots e fluxo Central relacionado; sem motor, release ou mudanças nas guardas de segurança.
- Especialista Motor/medição: `src/automation/**`, fixtures e `bench/**`; sem renderer/IPC de Bots.
- Especialista UX: `src/renderer/**` e smoke visual/acessível; sem contratos IPC ou guardas.
- Integração/release: agente principal consolida uma fatia vertical por vez, revisa conflitos, roda os gates, incrementa versão, commita e instala. Não sobrepor arquivos compartilhados; entregas de especialistas ficam sem commit.

## Histórico recente concluído

- [x] Reorganizar a continuidade do projeto: separar checklist ativo do arquivo histórico, reduzir o handoff ao estado atual, corrigir o README e criar o guia de leitura.
- [x] **0.1.48-dev:** carga de ferramentas sob demanda, recusas MCP em fixture e Central responsiva; commit `c3af35f`, build e instalação QA registrados no arquivo histórico.
- [x] **0.1.49-dev:** smoke instalado corrigido para o fluxo real da UI; commit `fabe822`, build e instalação QA registrados no arquivo histórico.
- [x] **0.1.50-dev:** aprovações no chat e autonomia Bot; `npm test` 370/370, `test:ui`, `test:bot-runtime` e smoke instalado passaram; commit `ddac732`, build e instalação QA registrados no `HANDOFF.md`.
