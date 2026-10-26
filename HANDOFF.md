# Handoff — Zero Browser

## Estado em 2026-10-26

- Foram revisadas mudanças do Antigravity e corrigidos quatro problemas: `zero://newtab` bloqueado pelo IPC, corrida após `capturePage()` que podia reocultar a aba, pop-ups aceitando esquemas internos arbitrários e permissões de extensões truncadas no diálogo. A versão do `package-lock.json` também foi alinhada com `package.json` em 0.1.3.
- A suíte unitária passou 93/93, `npm audit --omit=dev` reportou zero vulnerabilidades, `npm run test:electron` terminou com exit code 0 e a integração empacotada passou em `C:\Users\Wesley\AppData\Local\Programs\zero-browser-release-validation-3\Zero Browser.exe`. Ela cobriu nova aba interna, rejeição de popup customizado não permitido, bridge ausente em páginas, recusa de URL `javascript:`, corrida freeze/unfreeze, AX, CUA, providers mockados, configurações, download e aprovação/cancelamento.
- Build e produção usam `app.asar` SHA-256 `9DD022EAA3FA9C8AF80A371408C1ED47572FAFC8095497720D4A46C44E9320C2`. O executável de produção informa 0.1.3 e a instalação NSIS terminou com exit code 0.
- Antes da troca, o app, o perfil e os dois atalhos foram copiados para `backups/2026-10-26-before-0.1.3`. A cópia contém 184 arquivos do app e 7.571 arquivos/762.275.248 bytes do perfil; os hashes do executável e `app.asar` batem com a instalação anterior. O perfil após a instalação mantém a mesma contagem/tamanho. Atalho da Área de Trabalho e menu Iniciar apontam novamente para `C:\Users\Wesley\AppData\Local\Programs\navegante\Zero Browser.exe`.
- O estado aprovado foi commitado como `90cbcd4` e enviado para `origin/main` sem force push. A instalação de produção e o commit remoto apontam para a mesma fonte 0.1.3.
- A arquitetura continua Electron. Ganhos gerais de tokens/latência não são presumidos: o catálogo enviado mantém 6.764 bytes de schemas por chamada; `read_batch` ainda tem limites de abas/linhas e falha multitab 2/3; Google Planilhas autenticado e compras reais não foram testados.

## Próximo passo concreto

- Em `src/automation/service/index.js`, tornar `read_batch` explícito sobre correspondências truncadas e abas não lidas, com testes que diferenciem resultados parciais de cobertura completa.
- Depois fazer A/B pareado de subconjuntos de ferramentas em `src/automation/tools/agent-tool-registry.js`, medindo tokens reais, acerto e latência antes de alterar o catálogo padrão.

## Limites e bloqueios

- A chamada de cancelamento aborta o pedido ao provedor e bloqueia ferramentas seguintes; um comando CDP já despachado pode terminar.
- A integração instalada usa fixtures HTTP locais e provider mock; ela não comprova acurácia em Planilhas autenticadas, Amazon com conta ou todos os sites complexos.
- A memória entre tarefas continua ausente; não introduzir memória automática sem recuperação seletiva de fatos confirmados e medição de custo/acurácia.
