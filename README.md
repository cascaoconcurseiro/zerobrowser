# Zero Browser — navegador com agente de IA

Marca visível: **Zero Browser**. O identificador interno `navegante` e o `appId` legado são mantidos durante a mudança para preservar o diretório de dados e a identidade de atualização do aplicativo.

Navegador Electron para Windows com agente integrado à OpenRouter, DeepSeek e, em modo opcional, Ollama local.

## Estado atual (2026-10-28)

O executável encontrado instalado no Windows é o **0.1.42-dev** (SHA-256 do executável `934CC8A06612702768C49FEFF37B27083F05D1D74018B33EBE76B1EC320F3412`; `app.asar` `4F8280C44B868EFBBB45CBCB723E4B6D37C0930FDB37C9A1E33B5F91E8F7420B`). Essa leitura foi somente de versão e hashes: não comprova segurança ou funcionamento da instalação. A árvore de trabalho está na versão **0.1.43-dev**; o candidato mais recente é `dist-ollama-20261028` com smoke UX e integração empacotada aprovados em perfil temporário. Os resultados desse candidato não descrevem automaticamente o executável instalado. Nenhuma atualização da instalação foi feita. O candidato ainda não passou por benchmark pareado completo nem inspeção visual ampla. O menu ⋮ tem **Novidades** com o resumo da versão instalada. Testes com provider local e fixtures confirmam fluxos específicos, mas não comprovam desempenho ou acerto em Planilhas autenticadas, lojas com conta ou todos os sites complexos. O estado e os próximos passos estão em `HANDOFF.md`, `docs/EVOLUCAO_MOTOR.md` e `docs/NOVIDADES.md`.

A instalação atual (0.1.42-dev) não foi alterada. Backups de versões anteriores e instruções de restauração estão nos arquivos `LEIA-ME.md` das respectivas pastas em `backups/`.

### Candidato atual compilado (0.1.43-dev; ainda não instalado)

- `tabs read_batch` pagina abas (`tabOffset`/`tabVersion`) e texto (`contentOffset`/`contentVersion`), reiniciando a leitura quando a página muda; `coverage.complete` agora fica `true` no último trecho.
- Perfis locais pelo menu ⋮ (abrir, criar, excluir), cada um como processo próprio via `ZERO_USER_DATA`; sem renomear e sem migrar o perfil atual.
- Atalhos com o foco dentro da página (Ctrl+Shift+T, Ctrl+Tab, Ctrl+1..9, F5) e menu de contexto das abas.
- Histórico de downloads persistente no perfil, ignorando downloads de avaliação e respeitando "limpar ao sair".
- Ferramenta `calculate` (aritmética exata, sem `eval`), nova tentativa em 429/5xx, aviso de repetição e `href` curto no snapshot.
- Guardas: aviso de injeção de prompt vindo da página e aprovação extra para navegação a outro site com dados na URL.
- Motor opt-in, desligado por padrão: `preInspect`, `run_steps` (com pós-condições), journal de efeitos (idempotência), snapshot por diferença, cascata de modelos e streaming. Só `preInspect` tem A/B registrado.
- Verificação em 28/10/2026: `npm test` 302/302, `npm run test:ui` PASS; auditoria npm reportou 0 vulnerabilidades; segurança das extensões 12/12; smoke UX 9/9, integração empacotada completa e persistência da biblioteca após reinício PASS. Candidato compilado: `dist-ollama-20261028/win-unpacked/Zero Browser.exe` (0.1.43-dev; SHA-256 `D2AF83B1F36BD8EBAD919682EEDCE5797DADC7EB80C774BF10DF7452BD7CDF93`), disponível para aceite manual com `NAVEGANTE_USER_DATA` apontando a uma pasta nova. Isso não valida o instalado 0.1.42-dev, o uso autenticado do DeepSeek nem benchmark pareado.

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
