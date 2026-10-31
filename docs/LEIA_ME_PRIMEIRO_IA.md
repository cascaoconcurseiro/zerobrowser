# Leia primeiro — Zero Browser

Use esta ordem ao continuar o projeto:

1. `HANDOFF.md`: estado atual confirmado, versão instalada, bloqueios e próxima ação única.
2. `MASTER_BLUEPRINT.md`: arquitetura e decisões já tomadas; não reabrir sem evidência que exija mudar uma decisão.
3. `CHECKLIST.md`: ordem ativa, donos, limites entre frentes e gates de entrega. Só itens daqui são trabalho ativo.
4. `docs/COMPARATIVO_CONCORRENTES_2026-10-28.md`: estado competitivo, evidência e limites do que foi comparado.
5. Abra o `docs/PLANO_*.md` da frente somente quando for iniciar aquela frente. Planos são propostas; verifique o código antes de afirmar implementação.

Histórico extenso foi preservado em `docs/HANDOFF_HISTORICO_ATE_0.1.50.md` e `docs/CHECKLIST_HISTORICO.md`. Não use o backlog antigo como lista de execução sem reclassificar o item no `CHECKLIST.md`.

## Divisão de responsabilidade

- Bots: perfis, IPC e Central de Bots.
- Motor/medição: automação, fixtures e benchmark.
- UX: renderer, acessibilidade e revisão visual.
- Integração: consolidar uma fatia por vez; validar, atualizar versão, commitar quando houver entrega utilizável e instalar em QA.

Especialistas não fazem commit/instalação e não alteram arquivos fora de sua área. Mudanças em contratos partilhados precisam ser combinadas antes de tocar neles.

## Arquivo ausente

`docs/PLANO_CONTROLE_TOTAL_IA.md` não existe nesta branch. Referências antigas a esse caminho não comprovam que o plano ou requisito esteja presente. O inventário MCP deve usar ferramentas e código existentes e registrar a lacuna.
