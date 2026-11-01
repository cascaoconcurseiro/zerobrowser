# Handoff — Zero Browser

## Documentação reorganizada — 31/10/2026 (noite)

De 46 para ~27 documentos ativos: históricos e planos superados foram para `docs/arquivo/` (nada apagado; cópia de segurança fora do repositório), bots em `docs/bots/`, concorrência (incl. neo, Agentes conectados) em `docs/concorrencia/`. Índice único: `docs/LEIA_ME_PRIMEIRO_IA.md`. Decisões aceitas e registradas: paleta clara com azul de ação; perfil (pessoa) separado de bot (mora dentro do perfil); Bot para todos os usuários (Polare era só exemplo, não bloqueia nada); mascotes pixel art só para bots. Código dessas decisões ainda não feito (ver `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`, 12 passos). Alterações de docs ainda sem commit.

## Direção — 31/10/2026 (noite): roteiro do mentor

`docs/ROTEIRO_DO_MENTOR.md` passa a ser o documento de direção e vale sobre os planos. O quadro vivo, com a primeira tarefa aberta e o critério de pronto, é `docs/ROTEIRO_EXECUCAO_IA.md`. Estado conferido nesta rodada: `0.1.69-dev`, `npm test` 421/421. Nesta fatia, A1 e A2 foram implementadas: `src/bots/agent-executor.js` liga a missão do Bot ao mesmo agente da conversa, em aba oculta, com cancelamento e fechamento da aba; sem passos gravados, "rodar agora" e a agenda usam a missão do Bot. Nenhum commit, push ou instalação.

Próximo passo concreto: leitura da maquete (`docs/prototipos/painel-bot-prototipo.html`) e, no código, A3 (perfil isolado e política de site por tarefa) e A5 (bandeja e medição da aba oculta com a janela minimizada). A prova com um site real e 7 dias seguidos é A7 e ainda depende de um modelo/chave disponível e da resposta do Wesley sobre a página e o PC ligado. A revisão visual da UI instalada continua pendente.

## Sessão de 31/10/2026 — fatia 0.1.68-dev

Código em preparação em `main`, próximo passo utilizável do projeto a partir da 0.1.67-dev. A meta ampla permanece ativa: execução autônoma real de Bots, conectores, consentimentos, UX completa de Configurações/Extensões e benchmark pareado ainda não foram concluídos.

Nesta fatia, o modo Delegar classifica localmente pedidos claros de preço, mercado e e-mail. Pedido comum, misto ou sem perfil especialista persistido segue para o agente geral; a interface expõe a sugestão e permite corrigi-la. A execução especialista continua sendo `automation.runAgent` com orientação local no prompt e usa a aba/perfil atuais; não afirmar isolamento ou runtime autônomo por Bot. O envio em segundo plano também distingue agente geral de perfil especialista e não escolhe o primeiro Bot por padrão.

Arquivos centrais: `src/renderer/orchestrator-routing.js`, `src/renderer/app.js`, `src/renderer/index.html`, `src/renderer/styles.css`; cobertura em `test/orchestrator-routing.test.js` e `scripts/electron-ui.integration.js`. Preservar continuidade de dados: `appId` `com.wesley.navegante`, nome interno `navegante`, arquivo `navegante-config` e partição `persist:navegante`; chaves usam `safeStorage`. Não inspecionar segredo nem conteúdo pessoal do Gmail.

Validação: `npm test` 414/414; `npm run test:ui` PASS após corrigir a ordem de estado da fixture e verificar que o perfil chega ao motor; `npm run test:delegation-layout` PASS em seis viewports; `npm run build` PASS. Uma primeira tentativa detectou classificação errada para pedido misto preço/e-mail; corrigido para agente geral.

Entrega local: commit da fatia `8b3ad15`; instalador NSIS executado com `ExitCode 0` em `C:\Users\Wesley\AppData\Local\Programs\navegante`. Executável informa `0.1.68-dev` / `0.1.68.0`; o hash instalado do `app.asar` confere com a build (`DD7589AB05D7F94AD6EAEA816E5A65F8DB7BB79C282482B78C0059A809369F04`). Instalador SHA-256: `1D2A088B05B73264DFBAB4964ACE77FC9643D8F6D19967430E85489B084BBA05`. O perfil pessoal foi preservado, mas Gmail e chave não foram abertos ou testados.

Próximo passo da fatia (agora reorganizado pelo roteiro): revisar visualmente a UI instalada com Wesley; em seguida retomar auditoria/execução real de Bot e demais itens da meta. Não incluir os arquivos `audit-*.txt` já presentes no worktree; são artifacts não relacionados. Sem push.

Bloqueios: chamadas pagas continuam sem orçamento aprovado. O teste foi local com fixture; não houve chamada real de provedor ou uso da conta Gmail.
