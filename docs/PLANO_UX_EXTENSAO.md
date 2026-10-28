# Plano de UX, painel e extensão — fila executável

Cada lote é um checkpoint: teste → build → instalação → aceitação → backup → docs → commit.
Nada entra sem `npm test` verde e `npm run test:ui` PASS.

## Lote 1 — O chat conta o que aconteceu (maior salto de percepção)

- Linha do tempo por turno: ferramenta, alvo, resultado, duração (a partir de `trace.toolCalls`, já existente).
- Progresso: "ação N de MAX", ferramenta atual, tempo decorrido, tokens da tarefa.
- Aprovação no chat: cartão com Permitir uma vez / sempre neste site / Negar (hoje é diálogo nativo).
- Detalhes de erro com código (`NAME_BOX_NOT_FOUND`, `GUARDIAN_DENIED`, `OUTPUT_INVALID`) e "ver detalhes".
- Aceite: `test:ui` verifica timeline, cartão de aprovação e progresso; IPC `automation:run-agent` passa a emitir eventos.

## Lote 2 — Ações e conversas

- Copiar, reenviar, usar como prompt, exportar (JSON/MD).
- Renomear, apagar, fixar, buscar e exportar conversa.
- Aceite: testes de renderer para cada ação; nenhuma perde histórico.

## Lote 3 — Receitas, módulos e tarefas visíveis

- Aba "Receitas": listar, rodar, editar, exportar/importar.
- Aba "Módulos": listar, rodar com input, apagar.
- Tarefas pausadas: lista com progresso e descarte.
- Memória: criar/editar fato.
- Aceite: rodar receita sem modelo pelo painel; contrato de saída exibido.

## Lote 4 — Design do painel

- Cabeçalho condensado (status + modelo + ações em uma linha).
- Biblioteca unificada em abas dentro do painel.
- Configurações com índice lateral e busca.
- Escala tipográfica (12/13/15), skeletons, toasts sem cobrir o composer.
- Focus trap e ESC em todos os painéis; contraste medido no `test:ui`.
- Aceite: `test:ui` mede contraste calculado, foco preso, estados vazios e cabeçalho.

## Lote 5 — Extensão

- `tabs`/`windows`/`storage` completos; `runtime.onMessage`; `alarms`; `contextMenus`.
- Página de opções e popup próprios; ícones e badges.
- Instalação por pasta com diálogo de permissões; atualização e migração.
- Side panel para extensões secundárias; auditoria de permissões.
- Aceite: extensão de teste carrega, usa storage/tabs, abre opções e sobrevive a reinício.

## Fora de escopo (decisão, não pendência)

- Resolução automática de CAPTCHA (proteção antiabuso).
- Frota/SSO/RBAC, mobile, loja de extensões.
