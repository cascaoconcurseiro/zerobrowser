# Handoff — Zero Browser

## Documentação reorganizada — 31/10/2026 (noite)

De 46 para ~27 documentos ativos: históricos e planos superados foram para `docs/arquivo/` (nada apagado; cópia de segurança fora do repositório), bots em `docs/bots/`, concorrência (incl. neo, Agentes conectados) em `docs/concorrencia/`. Índice único: `docs/LEIA_ME_PRIMEIRO_IA.md`. Decisões aceitas e registradas: paleta clara com azul de ação; perfil (pessoa) separado de bot (mora dentro do perfil); Bot para todos os usuários (Polare era só exemplo, não bloqueia nada); mascotes pixel art só para bots. Código dessas decisões ainda não feito (ver `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`, 12 passos). Alterações de docs ainda sem commit.

## Direção — 31/10/2026 (noite): roteiro do mentor

`docs/ROTEIRO_DO_MENTOR.md` passa a ser o documento de direção e vale sobre os planos. O quadro vivo, com a primeira tarefa aberta e o critério de pronto, é `docs/ROTEIRO_EXECUCAO_IA.md`. Estado conferido nesta rodada: `0.1.69-dev`, `npm test` 421/421. Nesta fatia, A1 e A2 foram implementadas: `src/bots/agent-executor.js` liga a missão do Bot ao mesmo agente da conversa, em aba oculta, com cancelamento e fechamento da aba; sem passos gravados, "rodar agora" e a agenda usam a missão do Bot. Nenhum commit, push ou instalação.

Próximo passo concreto: leitura da maquete (`docs/prototipos/painel-bot-prototipo.html`) e, no código, A3 (perfil isolado e política de site por tarefa) e A5 (bandeja e medição da aba oculta com a janela minimizada). A prova com um site real e 7 dias seguidos é A7 e ainda depende de um modelo/chave disponível e da resposta do Wesley sobre a página e o PC ligado. A revisão visual da UI instalada continua pendente.
