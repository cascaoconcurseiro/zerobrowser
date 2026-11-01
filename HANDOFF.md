# Handoff — Zero Browser

## Estado atual — 31/10/2026 (noite, 0.1.69-dev)

Quadro vivo: `docs/ROTEIRO_EXECUCAO_IA.md`. Verificação: `npm test` 450/450, `npm run test:background-bot` PASS, `npm run test:bot-runtime` PASS, `npm run test:delegation-layout` PASS, `npm run test:ui` PASS.
Concluído nesta sessão:
- **A1/A2:** Missão vira tarefa em aba oculta (`agent-executor.js`).
- **A3:** Perfil isolado por Bot (`persist:navegante-bot-<id>`), barreira de rede (`bot-site-guard.js`) e isolamento de abas (`isolatedTabs: true`).
- **A4:** Fuso local para rotinas, persistência em disco de `lastRunAt` (`bot-tasks.json`) e relógio recorrente com `unref()`.
- **A5:** Segundo plano com Tray nativo, fechar esconde na bandeja, `powerMonitor`, `loginItem` e medição com janela minimizada (10.0 ticks/s estável, sem estrangulamento).
- **A6:** Notificações de bot e bloqueio no preload, gerando recibos auditáveis na conversa e no histórico.
- **E1:** Limpeza de dados simulados em `main.js`.
- **Instalação:** Versão `0.1.69-dev` instalada no Windows (`ExitCode: 0`), backup da .68 preservado em `backups/2026-10-31-before-0.1.69-install/` e atalhos conferidos.

Próximos passos:
1. Aprovação do Wesley para a prova de 7 dias com modelo/chave (A7).
2. Marco 2: criação de Bot por frase fixa (B1–B3).
3. Leitura da maquete `docs/prototipos/painel-bot-prototipo.html`.
