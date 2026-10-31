# Zero Browser — navegador com agente de IA

Marca visível: **Zero Browser**. O identificador interno `navegante` e o `appId` legado são mantidos durante a mudança para preservar o diretório de dados e a identidade de atualização do aplicativo.

Navegador Electron para Windows com agente integrado à OpenRouter, DeepSeek e, em modo opcional, Ollama local.

## Estado atual (2026-10-29)

O executável instalado foi atualizado para **0.1.43-dev**. O exe tem SHA-256 `09500e83e556859e888679392d92e7f3ad4d1204854c8404ff052e4236d27e11` e `app.asar` `c04a29dd9e1159c8c242f36114571640509cb4ebbad34451b7b598dfee477c20`. Integrações do executável instalado passaram em perfis temporários (smoke UX 9 verificações, agente e biblioteca após reinício); isso não é aceite amplo do perfil real. O backup pré-instalação verificável está em `backups/2026-10-28-before-0.1.43-install/`. O instalador iniciou o app automaticamente no perfil padrão e houve uma diferença de uma linha no banco de cookies (293 para 292); integridade SQLite passou, mas a linha removida não estava expirada e sua identidade não foi determinada. Consulte o registro detalhado em `HANDOFF.md` e `manifest.json`; não restaure o backup sem decidir, pois isso reverteria o perfil inteiro.

O instalador foi gerado localmente e não tem assinatura Authenticode. Versão/hash não comprovam segurança geral. A comparação de mercado em `docs/COMPARATIVO_CONCORRENTES_2026-10-28.md` conclui que o Zero segue em estágio de protótipo avançado, abaixo dos concorrentes maduros, sem base para ranking numérico. Backups de versões anteriores e instruções de restauração estão nos arquivos `LEIA-ME.md` das respectivas pastas em `backups/`.

O NSIS foi configurado para não abrir o navegador automaticamente ao concluir a instalação (`build.nsis.runAfterFinish: false`). O script do instalador isolado confirma que a macro de execução normal não foi gerada; esse pacote ainda não foi executado.

### Build instalado (0.1.43-dev; também disponível como artefato QA)

- `tabs read_batch` pagina abas (`tabOffset`/`tabVersion`) e texto (`contentOffset`/`contentVersion`), reiniciando a leitura quando a página muda; `coverage.complete` agora fica `true` no último trecho.
- Perfis locais pelo menu ⋮ (abrir, criar, excluir), cada um como processo próprio via `ZERO_USER_DATA`; sem renomear e sem migrar o perfil atual.
- Atalhos com o foco dentro da página (Ctrl+Shift+T, Ctrl+Tab, Ctrl+1..9, F5) e menu de contexto das abas.
- Histórico de downloads persistente no perfil, ignorando downloads de avaliação e respeitando "limpar ao sair".
- Ferramenta `calculate` (aritmética exata, sem `eval`), nova tentativa em 429/5xx, aviso de repetição e `href` curto no snapshot.
- Guardas: aviso de injeção de prompt vindo da página e aprovação extra para navegação a outro site com dados na URL.
- Motor opt-in, desligado por padrão: `preInspect`, `run_steps` (com pós-condições), journal de efeitos (idempotência), snapshot por diferença, cascata de modelos e streaming. Só `preInspect` tem A/B registrado.
- Verificação em 29/10/2026: no executável instalado, smoke UX 9 verificações, integração completa com provedores mockados e biblioteca após reinício passaram em perfis temporários. A suíte da árvore reportada para esta versão: `npm test` 302/302, `npm run test:ui` PASS, auditoria npm sem vulnerabilidades reportadas e testes de extensão 12/12. Isso não valida uso autenticado do DeepSeek, conexão Ollama real, benchmark pareado nem aceite amplo do perfil real.

### Código em desenvolvimento (0.1.44-dev; ainda não instalado)

- Espaços de Bots isolados, confirmação para elevar autonomia e proteções para não preencher ou expor credenciais. Validação e limites estão em `docs/NOVIDADES.md` e `HANDOFF.md`.

### Fluxos ligados

- Janela Electron, abas, URL/pesquisa, voltar, avançar, recarregar e página inicial.
- Painel de IA com OpenRouter ou DeepSeek direto, chave separada por provedor, catálogo de modelos sincronizado pela API e ferramentas básicas para inspecionar a aba, navegar, clicar, preencher e rolar.
- Configurações de aprovação do agente: sempre perguntar, permitir leitura, permitir ações de baixo risco ou permitir todas automaticamente. A última opção pode enviar/publicar/comprar/excluir sem confirmação; limites técnicos (como navegação HTTP/HTTPS e CDP desativado) continuam valendo.
- Laterais de IA e Configurações reorganizadas com cabeçalhos, campos e estados visuais mais claros; o espaçamento nativo reserva a lateral para os controles permanecerem clicáveis.
- Permissões web suportadas exigem confirmação explícita e ficam concedidas por origem/sessão; não há grant automático de localização.

### Ainda incompleto

- O fluxo real com conta/modelo OpenRouter ou DeepSeek não foi validado nesta máquina.
- No modo padrão “Permitir ações de baixo risco”, ações consequentes, execução JavaScript e comandos CDP mutáveis passam por confirmação no processo principal; uma recusa interrompe o ciclo do agente. Os quatro níveis são configuráveis em Configurações > Agente de IA · aprovações. Os modos foram testados unitariamente; no executável instalado, os diálogos confirmar/cancelar passaram antes desta implementação de níveis.
- O agente ainda carece de validação ampla de screenshot visual pelo modelo; pausa/takeover e retomada têm suporte parcial e precisam de aceite em sites e tarefas reais.
- A integração do agente usa snapshot e ações AX básicas; passou por fixture em `WebContentsView` para snapshot, digitação, clique, mutação e screenshot. O preload de automação das páginas foi removido; faltam benchmark real e validação em sites difíceis.
- Tema, URL completa, DNT, pasta e fluxo de download sem prompt já foram verificados no instalador com uma fixture local. Limpeza ao sair, bloqueio real de cookies de terceiros, seleção interativa de pasta, downloads com diálogo e CDP ainda precisam de aceite instalado.
- O painel pede a chave API do provedor selecionado e sincroniza seu catálogo. A chave cifrada permanece no processo principal. A chamada real de chat depende de uma chave válida e ainda não foi validada nesta máquina.

O plano e os critérios de conclusão estão em [CHECKLIST.md](CHECKLIST.md); decisões e próximos passos estão em [HANDOFF.md](HANDOFF.md).

## Arquitetura

```
src/
├── main/           # Processo principal Electron
│   └── main.js     # WebContentsView, sessões, CDP, partições
├── preload/        # API isolada da interface principal (contextBridge)
│   └── preload.js
├── renderer/       # Interface do usuário
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── automation/     # Serviço de automação experimental
│   ├── service/       # MCP sobre pipe Windows e WebSocket local
│   │   └── index.js
│   └── client/        # Cliente de automação
│       └── index.js
├── ipc/            # Handlers IPC
├── store/          # Configuração persistida (safeStorage)
└── utils/
```

## Funcionalidades

- **In-app browser** com WebContentsView (Electron)
- **Perfil persistente compartilhado entre abas**, preservando o nome interno legado `persist:navegante`
- Serviço MCP experimental por pipe nomeado no Windows (JSON-RPC 2.0) e WebSocket local autenticado para clientes de processo
- Agente instalado verificado em fixture local: inspecionou AX, executou clique e alterou o DOM usando provider simulado
- `browser_wait` inclui `networkidle`; `browser_screenshot(fullPage)` usa CDP e tem teste unitário
- **CDP bruto** para casos avançados, condicionado à opção de desenvolvedor
- **Action DSL**: click, dblclick, drag, press_key, scroll, select_text, set_value, type_text, paste
- Agente com OpenRouter ou DeepSeek direto; catálogo de modelos é carregado pela API do provedor e modelos conhecidos sem tool calling ficam desabilitados
- `safeStorage` protege a chave AES; a chave de API é armazenada cifrada com AES-GCM
- A chave fica cifrada no armazenamento local. O renderer só recebe uma dica mascarada; a chave completa só é revelada após clicar em **Mostrar** e é apagada do campo ao clicar em **Ocultar**.
- Persistência/revelação e chamadas autenticadas simuladas foram testadas no executável instalado. Uma checagem real sem credenciais confirmou TLS/acesso aos dois hosts (DeepSeek respondeu HTTP 401 sem autenticação; catálogo público OpenRouter respondeu HTTP 200). Uma chamada autenticada real ainda não foi feita.
- As chamadas aos provedores usam `net.fetch` do Electron/Chromium, mantendo validação TLS e usando a rede/proxy do sistema. Se aparecer `SELF_SIGNED_CERT_IN_CHAIN`, a autoridade certificadora (CA) do proxy/firewall precisa ser confiada pelo Windows; o Zero Browser não desativa a validação TLS.

## Instalação

```bash
cd <pasta-do-projeto>
npm install
npm start
```

## Desenvolvimento

```bash
npm run dev
```

## Testes

```bash
npm test
npm run test:electron
npm run test:installed
```

## Build

```bash
npm run build
```

## Atalhos

| Atalho | Ação |
|--------|------|
| Ctrl+T | Nova aba |
| Ctrl+W | Fechar aba |
| Ctrl+L | Focar barra de endereço |
| Ctrl+Shift+A | Abrir/fechar painel de IA |
| Alt+← | Voltar |
| Alt+→ | Avançar |

## Configuração do Agente

1. Clique no botão 🤖 na barra de ferramentas
2. A barra lateral do agente abre à direita; escolha OpenRouter ou DeepSeek direto
3. Digite a chave correspondente e clique em **Salvar chave**; a chave é cifrada localmente e não é enviada nessa etapa
4. O campo passa a indicar `Salva: ••••••••xxxx`. Clique em **Mostrar** para revelar a chave vinculada ou **Ocultar** para limpá-la do campo novamente.
5. Clique em **Atualizar** para carregar o catálogo, selecione um modelo habilitado e clique em **Conectar**
5. Descreva a tarefa na caixa inferior; ela opera a aba ativa

Para controlar interrupções e autonomia, abra Configurações e escolha o **Nível de aprovação**. O padrão é **Permitir ações de baixo risco**. **Permitir todas automaticamente** remove confirmações do agente, inclusive para ações consequentes.

Exemplos:
- "Acesse localhost:3000 e clique no botão de login"
- "Preencha o formulário com nome: João, email: joao@email.com"
- "Role a página para baixo"
- "Extraia todos os links da página"

Captura de screenshot pela conversa com o agente e execução visual por coordenadas ainda não estão disponíveis.

## Segurança

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Chave AES protegida pelo `safeStorage`/DPAPI; chave de API cifrada com AES-GCM
- CSP restritivo
- Permissões por origem

## Análise REA

A comparação inspecionou o plugin instalado `resources/plugins/openai-bundled/plugins/browser` e executou análise REA do `app.asar`. O relatório registra evidências, diferenças e limites do analisador; não alega equivalência de implementação nem copia código proprietário.
