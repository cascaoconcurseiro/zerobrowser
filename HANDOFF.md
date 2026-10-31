# Handoff — Zero Browser

## Estado confirmado — 2026-10-31

- Código em `0.1.51-dev`; o último commit de produto ainda é `ddac732`. Build NSIS gerado e instalado em `C:\Users\Wesley\AppData\Local\Programs\navegante` (exit code 0); versão do exe `0.1.51-dev`, ProductVersion `0.1.51.0`.
- Esta fatia corrige o layout Delegar, reserva painel no processo principal para evitar sobreposição da página nativa, reorganiza a Central, melhora tela estreita e contraste do endereço.
- Validação local: `npm test` 370/370, `npm run test:ui` PASS e `npm run test:delegation-layout` PASS em 1584x966, 1402x901, 700x800 e 400x800. `node --check` e `git diff --check` PASS.
- Build `dist/Zero Browser Setup 0.1.51-dev.exe`: 130.433.452 bytes; SHA-256 `961090C2C9DA8E5DD1B36F2C964F41B2E4DD586B54C1A4B94AECF97556BE8A0D`. exe SHA-256 `5FBD4B96EF71E13D07B0B9D6A5116AA66E1B3D1210504EFC701FAC5495B12794`; `app.asar` SHA-256 `59D5B676B92FCFB1DACB247DAA2E02215E2E7A72903CAB82A0BD8AC3482FF113`.
- Backup pré-instalação dos 184 arquivos do programa: `backups/2026-10-31-before-0.1.51-install/navegante/`. A pasta de dados permaneceu separada em `%LOCALAPPDATA%\ZeroBrowserQA\0.1.50-preview\userData`.
- `test:installed` PASS no executável .51, com perfil temporário e provedor/site em loopback mockado: navegação, ação AX, configurações, download, aprovação/recusa e cancelamento. Não houve chamada externa nem cobrança.
- Commit local pendente; após ele, reinstalar o mesmo artefato e repetir a verificação no executável. O instalador não tem assinatura Authenticode.

## Próxima ação concreta

Revisar o diff da .51, fazer commit local, reinstalar a versão compilada após o commit e executar smoke instalado com perfil isolado. Depois retomar a fatia de arquivamento/restauração reversível do Bot em `src/main/profiles.js`, handlers em `src/main/main.js`, API em `src/preload/preload.js` e Central em `src/renderer/app.js`.

## Limite técnico atual

`deleteProfile()` remove fisicamente a pasta do perfil, enquanto `launchProfile()` destaca o processo (`detached`/`unref`) e não mantém um registro de processos ativos. Portanto, não afirmar que o app consegue detectar uso em outro processo; não incluir exclusão definitiva/limpeza de dados nesta etapa. Revisões independentes confirmaram esse limite.

## Registro e continuidade

- Ordem ativa e divisão por áreas: `CHECKLIST.md`.
- Histórico integral anterior preservado: `docs/HANDOFF_HISTORICO_ATE_0.1.50.md` e `docs/CHECKLIST_HISTORICO.md`.
- Índice e ordem de leitura: `docs/LEIA_ME_PRIMEIRO_IA.md`.
- Estado competitivo e limites das evidências: `docs/COMPARATIVO_CONCORRENTES_2026-10-28.md`.
- O `MASTER_BLUEPRINT.md` não foi alterado; esta revisão reorganiza execução e documentação, sem decisão arquitetural nova.
