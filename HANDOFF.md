# Handoff — Zero Browser

## Estado em 2026-10-26

- Revisadas mudanças Antigravity e corrigidos bloqueio de `zero://newtab`, corrida de freeze/unfreeze, allowlist de pop-ups e permissões de extensão truncadas; release 0.1.3 foi publicado anteriormente.
- Para avançar o motor, `tabs.read_batch` agora relata páginas truncadas, falhas, abas omitidas e correspondências encontradas/devolvidas/omitidas. O trace inclui apenas contadores; nenhuma leitura textual foi adicionada às métricas. O prompt orienta o agente a continuar se `coverage.complete` for falso.
- Verificação 0.1.4: `npm test` 94/94; `npm audit --omit=dev` zero vulnerabilidades; `npm run test:electron` exit code 0; build Windows concluído; integração final do executável de produção passou (AX, CUA, configurações, downloads, aprovação/cancelamento e providers mockados).
- Instalação de produção em `%LOCALAPPDATA%\Programs\navegante` informa 0.1.4. SHA-256 final de `app.asar` no build e produção: `B14007B409DFC0ACB2F88F5873C9A9828F3970A264B0DAA8AE249F9464B6ACB9`. Desktop e menu Iniciar apontam para o executável de produção.
- Backup `backups/2026-10-26-before-0.1.4` preserva o executável anterior 0.1.3, atalhos, instalador 0.1.4 e perfil. Perfil e cópia: 7.571 arquivos e 762.275.248 bytes.
- O instalador temporário de validação, por compartilhar o `appId`, substituiu/removeu a instalação anterior; o caminho original foi restaurado instalando o 0.1.4 já validado. Evitar novas instalações isoladas do NSIS antes de planejar esse efeito colateral.
- A alteração do catálogo reduziu o JSON serializado de 6.764 para 6.747 bytes; não equivale a tokens reais e não prova ganho útil. Não há nova medição A/B de acerto, tokens ou latência nesta sessão.

## Próximo passo concreto

- Rodar benchmark pareado da tarefa 44 e da suíte difícil duas vezes, comparando 0.1.3 vs 0.1.4 no mesmo provedor/modelo; incluir uma variante com mais de seis abas ou mais de oito correspondências para verificar se o agente reage corretamente a `coverage.complete=false`. Registrar acerto, tokens reportados pelo provedor, passos, latência e trace em `docs/EVOLUCAO_MOTOR.md`.
- Depois experimentar seleção contextual de schemas em `src/automation/tools/agent-tool-registry.js`, com fallback completo, e só promover se uma comparação pareada mantiver acerto e reduzir tokens/latência de forma repetível.

## Limites e bloqueios

- A integração empacotada usa fixtures locais e provider mock; não valida Google Planilhas autenticado, Amazon com conta ou todos os sites complexos.
- Memória persistente entre tarefas continua sem evidência de benefício; o teste de notas anterior aumentou tokens e tempo sem elevar acerto.
- O objetivo de navegador próprio, maior cobertura real e desempenho comprovado segue aberto. Não declarar paridade geral com base em fixtures ou no catálogo compacto.
