# Leia primeiro — Zero Browser (índice único dos documentos)

Regra: **poucos documentos vivos, o resto em arquivo.** Antes de criar um documento novo, procure o assunto abaixo e acrescente nele.

## 1. Núcleo (ler nesta ordem ao continuar o projeto)

1. `docs/ROTEIRO_DO_MENTOR.md` — direção, marcos e regras de simplicidade. Vale sobre os demais; se um plano contradisser, corrija o plano.
2. `docs/ROTEIRO_EXECUCAO_IA.md` — quadro vivo: primeira tarefa aberta, critério de pronto, registro de sessões.
3. `HANDOFF.md` — estado atual, versão instalada, bloqueios e próxima ação (só o topo, máx. 20 linhas).
4. `MASTER_BLUEPRINT.md` — arquitetura e decisões tomadas; não reabrir sem evidência.
5. `CHECKLIST.md` — ordem ativa e gates de entrega. Só itens daqui são trabalho ativo (buscar com grep, não ler inteiro).
6. `README.md` — visão geral e como rodar. `docs/NOVIDADES.md` — texto que o app mostra ao usuário (lido por código e teste; não mover).

## 2. Por assunto (abrir só quando iniciar aquela frente)

| Assunto | Documento |
|---|---|
| **Bots** (plano, fluxo de UX, notificações, perfis tipo Chrome, 40 mascotes, situações/defeitos A01–A12/N01–N06, casos de uso para todos os usuários) | `docs/bots/` — `PLANO_BOTS.md`, `FLUXO_UX_BOTS.md`, `BOTS_SITUACOES_E_PENDENCIAS.md`, `CASOS_DE_USO_BOTS.md` |
| **Concorrência** (Grok, neo, Comparativo, "Agentes conectados"/MCP, teste pareado, paridade e salto) | `docs/concorrencia/` — `PLANO_SUPERAR_NEO.md`, `COMPARATIVO_CONCORRENTES_2026-10-28.md`, `PLANO_SUPERAR_CONCORRENTES.md`, `PLANO_PARIDADE_E_SALTO.md` |
| Design, UX e paleta (azul aceita em 31/10) | `docs/PLANO_DESIGN_UX.md`; protótipos em `docs/prototipos/` |
| Motor, velocidade e custo | `docs/PLANO_MOTOR.md`, `docs/EVOLUCAO_MOTOR.md`, `docs/PLANILHAS_E_SITES_DIFICEIS.md` |
| Controle por IA externa / MCP | `docs/PLANO_CONTROLE_TOTAL_IA.md`, `docs/COMO_CONECTAR_IA_EXTERNA.md`, `docs/CATALOGO_COMANDOS_NAVEGADOR.md` (contrato das ferramentas MCP está em COMO_CONECTAR_IA_EXTERNA) |
| Navegador nativo, extensões | `docs/PLANO_NAVEGADOR_NATIVO_IA.md`, `docs/COMPATIBILIDADE_EXTENSOES_CHROME.md` |
| Segurança (firewall, recibo) | `docs/PLANO_ROTAS_E_FIREWALL.md` (inclui relatório de ataques) |
| Como testar à mão | `docs/COMO_TESTAR.md` |
| Índice dos planos de 31/10 e seus itens | `docs/CHECKLIST_PLANOS_2026-10-31.md` |

## 3. Arquivo (histórico; não é lista de execução)

`docs/arquivo/` guarda, sem apagar nada: checklists e handoffs antigos (`CHECKLIST_HISTORICO`, `HANDOFF_HISTORICO_ATE_0.1.50`, `HANDOFF_ARQUIVO`, `CHECKLIST_GERAL_PROJETO`), auditorias (`AUDITORIA_*`, fonte dos defeitos A01–A12), planos já feitos ou superados (`PLANO_APPS_VIVOS`, `PLANO_ZERO_CHROMIUM_AI`, `PLANO_FORK_BROWSEROS` — adiado, `PLANO_NOME_E_PERFIS` — perfis agora em `docs/bots/FLUXO_UX_BOTS.md` seção 12, `PLANO_MATURIDADE_4`, `PLANO_UX_EXTENSAO`, `PLANO_NAVEGADOR_IA`, `PLANO_ATUALIZACAO_ASSINADA`), registros (`PONTOS_DE_RESTAURACAO`, `REGISTRO_INTEGRACAO_0.1.5`), análises REA (`REA-ChatGPT-Browser-Analysis`, `VALIDACAO-REA`), `RELATORIO_AUDITORIA_E_DIRETRIZES_IA` e `conceitos/`. Para reclassificar um item antigo, copie-o para o `CHECKLIST.md` com dono e critério.

## Divisão de responsabilidade

- Bots: perfis, IPC e Central de Bots.
- Motor/medição: automação, fixtures e benchmark.
- UX: renderer, acessibilidade e revisão visual.
- Integração: consolidar uma fatia por vez; validar, atualizar versão, commitar quando houver entrega utilizável e instalar em QA.

Especialistas não fazem commit/instalação e não alteram arquivos fora de sua área. Mudanças em contratos partilhados precisam ser combinadas antes de tocar neles.
