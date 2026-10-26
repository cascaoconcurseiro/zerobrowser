# Navegante — navegador com agente de IA

Navegador Electron para Windows com agente integrado à OpenRouter ou DeepSeek.

## Estado atual (2026-10-26)

O release local 0.1.1 para Windows x64 foi instalado e passou pelo smoke test no executável instalado, usando perfil temporário e provedores HTTP simulados em loopback. A suíte local passou 81/81, e as integrações Electron de hover, SPA/carrinho e nova aba passaram. Isso não valida chamadas autenticadas a provedores externos, Google Planilhas, Amazon ou todos os sites reais difíceis; paridade geral e prontidão para distribuição pública ainda não foram demonstradas.

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
- A integração do agente usa snapshot e ações AX básicas; passou por fixture em `WebContentsView` para snapshot, digitação, clique, mutação e screenshot. Faltam ações robustas e validação em sites reais; o preload AX legado continua sem receptor próprio.
- Tema, URL completa, DNT, pasta e fluxo de download sem prompt já foram verificados no instalador com uma fixture local. Limpeza ao sair, bloqueio real de cookies de terceiros, seleção interativa de pasta, downloads com diálogo e CDP ainda precisam de aceite instalado.
- O painel pede a chave API do provedor selecionado e sincroniza seu catálogo. A chave cifrada permanece no processo principal. A chamada real de chat depende de uma chave válida e ainda não foi validada nesta máquina.

O plano e os critérios de conclusão estão em [CHECKLIST.md](CHECKLIST.md); decisões e próximos passos estão em [HANDOFF.md](HANDOFF.md).

## Arquitetura

```
src/
├── main/           # Processo principal Electron
│   └── main.js     # WebContentsView, sessões, CDP, partições
├── preload/        # Scripts de preload (contextBridge)
│   ├── preload.js      # API principal do renderer
│   └── browser-preload.js  # API de acessibilidade injetada nas páginas
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
- **Sessões isoladas** por aba: `persist:navegante-browser-<id>`
- Serviço MCP experimental por pipe nomeado no Windows (JSON-RPC 2.0) e WebSocket vinculado a loopback
- Agente instalado verificado em fixture local: inspecionou AX, executou clique e alterou o DOM usando provider simulado
- `browser_wait` inclui `networkidle`; `browser_screenshot(fullPage)` usa CDP e tem teste unitário
- **CDP bruto** para casos avançados, condicionado à opção de desenvolvedor
- **Action DSL**: click, dblclick, drag, press_key, scroll, select_text, set_value, type_text, paste
- Agente com OpenRouter ou DeepSeek direto; catálogo de modelos é carregado pela API do provedor e modelos conhecidos sem tool calling ficam desabilitados
- `safeStorage` protege a chave AES; a chave de API é armazenada cifrada com AES-GCM
- A chave fica cifrada no armazenamento local. O renderer só recebe uma dica mascarada; a chave completa só é revelada após clicar em **Mostrar** e é apagada do campo ao clicar em **Ocultar**.
- Persistência/revelação e chamadas autenticadas simuladas foram testadas no executável instalado. Uma checagem real sem credenciais confirmou TLS/acesso aos dois hosts (DeepSeek respondeu HTTP 401 sem autenticação; catálogo público OpenRouter respondeu HTTP 200). Uma chamada autenticada real ainda não foi feita.
- As chamadas aos provedores usam `net.fetch` do Electron/Chromium, mantendo validação TLS e usando a rede/proxy do sistema. Se aparecer `SELF_SIGNED_CERT_IN_CHAIN`, a autoridade certificadora (CA) do proxy/firewall precisa ser confiada pelo Windows; o Navegante não desativa a validação TLS.

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
