# Checklist — Zero Browser

## Meta de evolução total — ativa

- [ ] Fechar os achados A01–A12 da auditoria integrada com implementação e evidência por item; manter explícitos os itens que dependem de provedor pago, contas de teste ou revisão humana.
- [ ] Concluir a evolução visual a partir da referência aprovada com acabamento profissional, fluxo claro e identidade própria; ainda há telas sem revisão visual integrada.
- [x] Tornar a Central mais clara e retirar dados/ações simulados que pareciam serviços ativos.
- [ ] Concluir executor de Bot com isolamento, limites por tarefa, política de site aplicada no processo principal, cancelamento verificável e resultado independente.
- [x] Criar um orquestrador explícito no modo Delegar: classificar pedidos claros de preço, mercado e e-mail; pedidos comuns, mistos ou sem Bot salvo seguem para o agente geral; mostrar a rota e permitir corrigir a escolha. O perfil especialista é orientação local no agente geral, não um runtime autônomo isolado.
- [ ] Implementar agenda persistente e gatilhos reais, depois provar execução com Zero fechado e retomada.
- [ ] Conectar serviços externos e Apps a transportes/fontes reais; manter aprovação, recibo e estado verdadeiro.
- [ ] Fechar popup, cookies, banners e permissões por política explícita sem dispensar consentimento em nome do usuário.
- [x] Renderizar avatares como símbolo de traço individual dentro do anel, preservar identidade estável e medir centralização no app empacotado; comparação visual com a referência ainda pendente.
- [x] Preservar dados de usuário entre atualizações: `appId`, nome interno, arquivo de configuração e partição persistente continuam estáveis; instalação de QA usa diretório isolado.
- [ ] Finalizar hierarquia e fluxos de navegador, Bots, extensões, configurações, menus e diálogos nas referências aprovadas; revisar acessibilidade e telas compactas.
- [x] Corrigir a legibilidade visual dos dois cartões explicativos de envio no estado inicial do Bot; contraste AA é medido pela fixture Electron.
- [ ] Medir velocidade, acerto, tokens e custo por tarefa; comparar com concorrentes em conjunto pareado, sem chamadas pagas sem orçamento aprovado.
- [ ] Commit local e instalação verificada após cada fatia utilizável; sem push.
- [ ] Executar os marcos 1–4 de `docs/ROTEIRO_DO_MENTOR.md` (bot roda 7 dias; uma frase cria o bot; uma rotina real do Wesley; painel novo) e marcar cada um só com o teste de sim ou não. O roteiro vale sobre os planos. A ordem prática e o critério de pronto de cada tarefa estão em `docs/ROTEIRO_EXECUCAO_IA.md`; a primeira tarefa aberta é A1 (ligar o executor).

## Pendências ativas consolidadas (31/10/2026)

Código (bots e motor)
- [ ] Reverificar A01–A12 (`docs/arquivo/AUDITORIA_INTEGRADA_2026-10-31.md`) no código da 0.1.69; a 0.1.69 liga o executor real, o resto segue aberto: perfil isolado por tarefa, allowlist por navegação, cancelamento verificável, agenda e conectores reais.
- [ ] Corrigir N01 (checkbox travou 20 s no teste pareado) e demais N01–N06 de `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`.
- [ ] Implementar os 12 passos de `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md` (separar perfil de bot, notificações, Sala da equipe, grupos de abas por bot).

Decididos em 31/10, NÃO implementados (não afirmar como feitos)
- [ ] Paleta clara com azul de ação (mockup antes do código; o app ainda é verde).
- [ ] Perfis tipo Chrome em Configurações (`docs/bots/FLUXO_UX_BOTS.md` seção 12).
- [ ] Importar os 40 mascotes pixel art como ativos individuais (seção 13; hoje o app usa símbolos de traço da 0.1.67).
- [ ] Notificações em 4 canais (seção 11; hoje só existe `bots:notification` e `flashFrame`).
- [ ] Tela "Agentes conectados" e superar o neo com medida (`docs/concorrencia/PLANO_SUPERAR_NEO.md`).

Aprovações do Wesley pendentes
- [ ] Aprovar `docs/bots/FLUXO_UX_BOTS.md` antes do mockup; revisar os 48 modelos de `docs/bots/CASOS_DE_USO_BOTS.md`.
- [ ] Revisão visual do app instalado e teste de uso (hoje 0.1.69-dev).

Qualidade e entrega
- [ ] Medir velocidade, acerto, tokens e custo em conjunto pareado (sem chamada paga sem orçamento aprovado).
- [ ] Fechar popups/cookies por política explícita; unificar configurações, extensões, menus e diálogos conforme a referência.
- [ ] Commit local e instalação verificada após cada fatia utilizável; push só com pedido do Wesley.

Histórico das fatias 0.1.51 a 0.1.68: `docs/arquivo/CHECKLIST_HISTORICO.md`.
