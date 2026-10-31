# Handoff — Zero Browser

## Sessão de 31/10/2026 — fatia 0.1.68-dev

Código em preparação em `main`, próximo passo utilizável do projeto a partir da 0.1.67-dev. A meta ampla permanece ativa: execução autônoma real de Bots, conectores, consentimentos, UX completa de Configurações/Extensões e benchmark pareado ainda não foram concluídos.

Nesta fatia, o modo Delegar classifica localmente pedidos claros de preço, mercado e e-mail. Pedido comum, misto ou sem perfil especialista persistido segue para o agente geral; a interface expõe a sugestão e permite corrigi-la. A execução especialista continua sendo `automation.runAgent` com orientação local no prompt e usa a aba/perfil atuais; não afirmar isolamento ou runtime autônomo por Bot. O envio em segundo plano também distingue agente geral de perfil especialista e não escolhe o primeiro Bot por padrão.

Arquivos centrais: `src/renderer/orchestrator-routing.js`, `src/renderer/app.js`, `src/renderer/index.html`, `src/renderer/styles.css`; cobertura em `test/orchestrator-routing.test.js` e `scripts/electron-ui.integration.js`. Preservar continuidade de dados: `appId` `com.wesley.navegante`, nome interno `navegante`, arquivo `navegante-config` e partição `persist:navegante`; chaves usam `safeStorage`. Não inspecionar segredo nem conteúdo pessoal do Gmail.

Validação: `npm test` 414/414; `npm run test:ui` PASS após corrigir a ordem de estado da fixture; `npm run test:delegation-layout` PASS. Uma primeira tentativa detectou classificação errada para pedido misto preço/e-mail; corrigido para agente geral. Ainda falta `npm run build`, commit, instalação após commit e conferir versão/hash instalado.

Próximo passo concreto: executar `npm run build` para gerar instalador NSIS; após sucesso, conferir `git diff --check`, `git status`, `git diff` e `git log --oneline -5`; fazer commit local da fatia, instalar a versão nova e validar ExitCode, versão do executável e hash do `app.asar`. Não incluir os arquivos `audit-*.txt` já presentes no worktree; são artifacts não relacionados. Sem push. Após instalar, revisar a UI com Wesley e seguir para auditoria/execução real de Bot e demais itens da meta.

Bloqueios: chamadas pagas continuam sem orçamento aprovado. O teste foi local com fixture; não houve chamada real de provedor ou uso da conta Gmail.
