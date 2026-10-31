# Handoff — Zero Browser

## Estado confirmado — 2026-10-31

- Código local em `0.1.53-dev`; a `0.1.52` está instalada e validada (commit `6e037d1`, backup da `.51` em `backups/2026-10-31-before-0.1.52-install/`).
- Na fatia `0.1.53-dev`: concluídos os tokens do anel de estado (texto + formato do traço + selo + cor), a paleta de 8 cores de Bots com contraste ≥ `3:1` nos temas claro e escuro (`src/main/bot-avatar-catalog.js`), a escala de `4px` (`src/renderer/styles.css`), o indicador de aba controlada com botão `Assumir` / `Devolver ao bot` e a etiqueta de reversibilidade no cartão de aprovação (`src/renderer/app.js`).
- A Central agora separa Bots Ativos/Arquivados, permite arquivar/restaurar sem mover dados do perfil, e bloqueia novas aberturas de Bot arquivado. Escritas em `perfis.json` usam coordenação entre processos.
- O painel Delegar começa em `min(480px, 34vw)` e pode ser redimensionado por mouse/toque ou teclado; o `BrowserView` acompanha a mesma largura e mantém espaço para a página. Avatares pixel ficam menores e centralizados no anel.
- Verificação local: `npm test` 374/374; `npm run test:ui` PASS; `npm run test:delegation-layout` PASS em 1584x966, 1402x901, 700x800, 700x600, 400x800 e 400x600; checagens de sintaxe e `git diff --check` PASS. Revisão independente estática sem falhas concretas.
- Build .52 concluído e validado no executável empacotado (`dist\win-unpacked\Zero Browser.exe`) em perfil QA isolado (`%LocalAppData%\ZeroBrowserQA`): smoke `--ux-only` PASS, Central ocultando o chat subjacente (`underlyingChatHidden: true`), divisor redimensionável (`476px -> 500px`), sprites centralizados (`delta=0`) e ciclo `Arquivar`/`Restaurar` PASS.
- Hashes SHA-256 da build `0.1.52-dev`:
  - `dist\Zero Browser Setup 0.1.52-dev.exe`: `2DADE2099CF789930415BD4243BA0313E7544009224FCAD427B703ED2A0F6915`
  - `dist\win-unpacked\Zero Browser.exe`: `3F2C786DC04F940FFFEE172535FC9FD22A3C5E5DD98131ABDE009C73AADD12F2`
  - `dist\win-unpacked\resources\app.asar`: `B92DB671F83F028E201DCF8EBA66CF383D28B9984D9841589F6DD88247682380`
- Planos de `31/10/2026` incorporados em `docs/` (`docs/CHECKLIST_PLANOS_2026-10-31.md`, `docs/CHECKLIST_GERAL_PROJETO.md` e `docs/PLANO_*.md`).
- Backup da `.51` verificado em `backups/2026-10-31-before-0.1.52-install/` (184 arquivos); commit local `6e037d1`; instalador `0.1.52-dev` executado com `ExitCode: 0`. Executável instalado em `%LocalAppData%\Programs\navegante\Zero Browser.exe` reporta versão `0.1.52.0` com hashes idênticos ao pacote e atalhos Desktop/Start Menu preservados. Perfil normal (`Principal`) verificado (`provider: deepseek`, `model: deepseek-flash`, `hasApiKey: true`). Sem push.

## Próxima ação concreta

Iniciar a próxima fatia (`0.1.53-dev`) seguindo `docs/CHECKLIST_PLANOS_2026-10-31.md` e `docs/PLANO_DESIGN_UX.md`: tokens do anel de estado e paleta de 8 cores de Bots com contraste verificado, indicador na aba controlada com botão `Assumir` e evolução do cartão de aprovação/recibo.

## Dados e limites verificados

- A aplicação conserva `app.setName('navegante')` e `appId: com.wesley.navegante`; o perfil padrão continua em `%AppData%\navegante`. O arquivo de configuração normal existe (só metadados de arquivo foram observados; chave e valores não foram lidos).
- A janela de QA usou `%LocalAppData%\ZeroBrowserQA\0.1.51-preview\userData`, uma pasta separada que começa sem as configurações do perfil padrão. Fechar QA antes de abrir a instalação normal evita que o bloqueio de instância única deixe a janela QA em primeiro plano.
- Arquivar não encerra uma janela Bot que já esteja aberta em outro processo; o app ainda não rastreia processos Bot ativos. A exclusão definitiva fica fora desta entrega.
- `docs/conceitos/zero-browser-modo-delegar-0.1.45-dev.png` é um conceito do modo Delegar, não uma imagem da Central. Não é especificação pixel a pixel de todas as telas.

## Registro e continuidade

- Ordem ativa, pendências e divisão dos especialistas: `CHECKLIST.md`.
- A revisão atual não mudou decisões do núcleo; `MASTER_BLUEPRINT.md` permanece inalterado.
- Histórico anterior: `docs/HANDOFF_HISTORICO_ATE_0.1.50.md` e `docs/CHECKLIST_HISTORICO.md`.
- Branch `main`, 14 commits à frente de `origin/main` antes desta entrega; não fazer push sem pedido explícito.
