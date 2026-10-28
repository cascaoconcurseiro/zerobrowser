# Zero Browser — navegador com agente de IA

Marca visível: **Zero Browser**. O identificador interno `navegante` e o `appId` legado são mantidos durante a mudança para preservar o diretório de dados e a identidade de atualização do aplicativo.

Navegador Electron para Windows com agente integrado à OpenRouter ou DeepSeek.

## Estado atual (2026-10-27)

O **0.1.11-dev** é o que está instalado em produção no Windows desde 28/10/2026, instalado por cima do 0.1.10-dev após backup verificável e validação do executável empacotado. O `app.asar` do build e da instalação coincide (`0d46e9db…b043a`), e a integração do executável instalado passou. É um build `-dev`: não passou por todos os gates de release (benchmark pareado completo e inspeção visual), então trate como candidato. O menu ⋮ tem **Novidades** com o resumo desta versão. Testes com provider local e fixtures confirmam fluxos de integração, mas não comprovam desempenho ou acerto em Planilhas autenticadas, lojas com conta ou todos os sites complexos. O estado e os próximos passos estão em `HANDOFF.md`, `docs/EVOLUCAO_MOTOR.md` e `docs/NOVIDADES.md`.

A instalação anterior (0.1.10-dev) está preservada em `backups/2026-10-28-before-output-schema/`; a 0.1.9-dev, em `backups/2026-10-28-before-accname/`; a 0.1.8-dev, em `backups/2026-10-28-before-diagnostics/`; a 0.1.7-dev, em `backups/2026-10-28-before-credential/`; a 0.1.6-dev, em `backups/2026-10-28-before-mint/`; o release 0.1.4, em `backups/2026-10-27-before-0.1.5-dev/` — com instruções de restauração no `LEIA-ME.md` de cada pasta.

### Em desenvolvimento (0.1.11-dev)

- `tabs read_batch` pagina abas (`tabOffset`/`tabVersion`) e texto (`contentOffset`/`contentVersion`), reiniciando a leitura quando a página muda; `coverage.complete` agora fica `true` no último trecho.
- Perfis locais pelo menu ⋮ (abrir, criar, excluir), cada um como processo próprio via `ZERO_USER_DATA`; sem renomear e sem migrar o perfil atual.
- Atalhos com o foco dentro da página (Ctrl+Shift+T, Ctrl+Tab, Ctrl+1..9, F5) e menu de contexto das abas.
- Histórico de downloads persistente no perfil, ignorando downloads de avaliação e respeitando "limpar ao sair".
- Ferramenta `calculate` (aritmética exata, sem `eval`), nova tentativa em 429/5xx, aviso de repetição e `href` curto no snapshot.
- Guardas: aviso de injeção de prompt vindo da página e aprovação extra para navegação a outro site com dados na URL.
- Motor opt-in, desligado por padrão: `preInspect`, `run_steps` (com pós-condições), journal de efeitos (idempotência), snapshot por diferença, cascata de modelos e streaming. Só `preInspect` tem A/B registrado.
- `npm test` 127/127 nesta árvore e a integração do executável instalado passou (`status: PASS`). Faltam `test:electron`, `test:bench-store`, `test:agent-download` e benchmark com modelo real.

### Fluxos ligados

- Janela Electron, abas, URL/pesquisa, voltar, avançar, recarregar e página inicial.
- Painel de IA com OpenRouter ou DeepSeek direto, chave separada por provedor, catálogo de modelos sincronizado pela API e ferramentas básicas para inspecionar a aba, navegar, clicar, preencher e rolar.
- Configurações de aprovação do agente: sempre perguntar, permitir leitura, permitir ações de baixo risco ou permitir todas automaticamente. A última opção pode enviar/publicar/comprar/excluir sem confirmação; limites técnicos (como navegação HTTP/HTTPS e CDP desativado) continuam valendo.
- Laterais de IA e Configurações reorganizadas com cabeçalhos, campos e estados visuais mais claros; o espaçamento nativo reserva a lateral para os controles permanecerem clicáveis.
- Permissão de localização automática em domínios Google reconhecidos; demais permissões cobertas pelo diálogo do navegador.

### Ainda incompleto

- O fluxo real com conta/modelo OpenRouter ou DeepSeek não foi validado nesta máquina.
- No modo padrão “Permitir ações de baixo risco”, ações consequentes, execução JavaScript e comandos CDP mutáveis passam por confirmação no processo principal; uma recusa interrompe o ciclo do agente. Os quatro níveis são configuráveis em Configurações > Agente de IA · aprovações. Os modos foram testados unitariamente; no executável instalado, os diálogos confirmar/cancelar passaram antes desta implementação de níveis.
- O agente ainda não oferece screenshot visual para o modelo, teclado completo, arrastar por coordenadas, seleção, execução multiaba, pausa/takeover ou retomada.
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
