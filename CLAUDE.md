# Zero Browser (Navegante) — instruções para qualquer IA

Leia nesta ordem antes de qualquer ação: `docs/LEIA_ME_PRIMEIRO_IA.md` (índice único) → topo do `HANDOFF.md` (onde paramos, máx. 20 linhas) → `docs/ROTEIRO_EXECUCAO_IA.md` (primeira tarefa aberta e critério de pronto). Direção e regras de simplicidade: `docs/ROTEIRO_DO_MENTOR.md`.

## Regras do projeto
- Responder em português do Brasil, linguagem simples; o Wesley não programa. Começar pelo resultado.
- Nada de commit, push, instalação ou envio sem pedido explícito do Wesley.
- Honestidade: plano não é código. Antes de afirmar que algo existe, confira no código e rode o teste. `CHECKLIST.md`, seção "Decididos em 31/10, NÃO implementados", lista o que ainda é só decisão.
- Núcleo intocável: parar tudo, firewall + recibo, auditoria, aprovação de dinheiro/envio, cofre de segredos, limites de gasto e tempo. Nunca ler ou imprimir chaves, cookies ou e-mails.
- Compatibilidade de dados: manter `appId` `com.wesley.navegante`, nome interno `navegante`, arquivo `navegante-config`, partição `persist:navegante`.
- Chamadas pagas a provedores só com orçamento aprovado.

## Verificação
`npm test` (hoje 421/421), `npm run test:ui`, `npm run test:delegation-layout`, `npm run build`. Relate o resultado real; separe o validado localmente do que depende de teste no app instalado.

## Ao encerrar a sessão
Marcar `[x]` no `CHECKLIST.md` só com prova; atualizar o topo do `HANDOFF.md` (máx. 20 linhas, histórico antigo vai para `docs/arquivo/HANDOFF_ARQUIVO.md`); atualizar o quadro de `docs/ROTEIRO_EXECUCAO_IA.md`; `MASTER_BLUEPRINT.md` só se uma decisão de arquitetura mudou. Novo assunto: acrescente ao documento do tema, não crie arquivo novo sem listá-lo no índice.

## Mapa
Raiz: README, MASTER_BLUEPRINT, HANDOFF, CHECKLIST. `docs/bots/` bots; `docs/concorrencia/` concorrentes e neo; `docs/arquivo/` histórico (não é lista de tarefas). `docs/NOVIDADES.md` é lido pelo app e testado: não mover.
