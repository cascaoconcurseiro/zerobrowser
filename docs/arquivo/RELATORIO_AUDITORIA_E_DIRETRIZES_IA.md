# Relatório Executivo e Técnico: Auditoria Integral, Otimização de Motor, Arquitetura e Design System Impeccable

**Data:** 26 de Outubro de 2026
**Sistema:** Zero Browser / Navegante Engine
**Autor:** Equipe de Auditoria e Arquitetura de Sistemas
**Status do Projeto:** recomendações recebidas; leia as alegações originais conforme a revisão de evidências e correções no fim deste documento. A contagem de testes não equivale a integridade funcional total.

> **Nota de evidência:** este documento foi fornecido como saída de auditoria externa. Alegações de reprodução empírica, severidade e ganhos de tokens/latência não são prova por si só.

---

## 1. Resumo Executivo & Status de Progresso

O relatório original declara uma auditoria completa; a revisão de código desta sessão encontrou alegações que precisam de validação e classificou os seis achados no quadro ao final.

### Alegações e escopo desta revisão
1. **Auditoria de Código & Segurança:** o arquivo original afirmava ter confirmado duas vulnerabilidades críticas e três bugs; nesta revisão, seis achados foram comparados ao código e corrigidos conforme o estado no quadro final. Severidade e explorabilidade não foram todas reproduzidas como exploração real.
2. **Avaliação da Suite de Testes:** o relatório original dizia 91 testes; nesta revisão, `npm test` passou 92/92. Isso cobre os testes existentes, não toda a funcionalidade do navegador.
3. **Comparação de plataforma:** as comparações sobre anti-bot/stealth foram removidas como critério; o Zero não deve ocultar automação nem contornar políticas dos sites.
4. **Otimização do motor:** os valores de corte de tokens e latência do texto original não têm benchmark anexado e são hipóteses, não ganhos comprovados.
5. **Redesign visual:** a seção Impeccable é uma proposta de design, não uma correção técnica implementada nesta sessão.

---

## 2. Auditoria Técnica Cirúrgica: Falhas, Riscos e Correções

Abaixo estão os apontamentos identificados na auditoria com localização exata, severidade e correção necessária.

| ID | Sev | Arquivo:Linha | Categoria | Problema Identificado | Correção Recomendada |
|---|---|---|---|---|---|
| **AUD-01** | **SEC** | `src/automation/service/index.js` | **SEC** | O WebSocket local não tinha autenticação nem validação de `Origin`; o risco de conexões não autorizadas era plausível, mas não foi reproduzido como exploração. | Exigir token aleatório de alta entropia, disponível somente ao cliente confiável do processo, e rejeitar conexões com `Origin` web. |
| **AUD-02** | **CRI** | `src/automation/service/index.js:878` | **EDG / TIP** | No método `read_batch`, o particionamento de texto usava regex com escape incorreto (`/\\r?\n/`), resultando no casamento de caracteres literais de barra invertida em vez de quebras de linha reais. O texto da página nunca era dividido em linhas, truncando a leitura aos primeiros 240 caracteres e quebrando a acurácia de tarefas de cobertura e busca textual profunda. | Corrigir o literal da regex para `/\r?\n/` ou `String.prototype.split('\n')`. |
| **AUD-03** | **SEC** | `src/preload/browser-preload.js` | **SEC** | Uma bridge de página expunha funções de automação e `eval` em cada site. Não foi demonstrada detecção por anti-bot nem exploração de escape do isolamento. | Remover a bridge se não tiver consumidor; manter automação no processo confiável do Zero. Não usar injeção seletiva para ocultar automação nem contornar controles de sites. |
| **AUD-04** | **ALT** | `src/main/main.js:312` | **SEC** | O manipulador IPC `browser:new-tab` aceita opções arbitrárias de abertura (`openerOptions`) diretamente do renderer sem sanitização de flags do `webPreferences` (como `nodeIntegrationInSubFrames` ou `webSecurity`). | Filtrar e aplicar allowlist estrita nos parâmetros de criação de janelas/abas, proibindo propagação de chaves perigosas de `webPreferences`. |
| **AUD-05** | **MED** | `src/main/main.js:940` | **CON** | Condição de corrida no fechamento do aplicativo no Windows: ao clicar no botão fechar ("X"), a flag `shuttingDown` é acionada antes de o evento `before-quit` disparar a persistência com debounce da sessão, cancelando o timer e perdendo o estado da última navegação. | Forçar `flushSessionSync()` síncrono no evento `window-all-closed` ou interceptar `close` da janela principal antes de destruir os WebContents. |
| **AUD-06** | **MED** | `src/automation/service/index.js` | **RES** | Havia timeout do provider, mas não cancelamento ligado ao pedido de parada do usuário. O loop podia aguardar a resposta atual e então seguir para ferramentas. Um CDP já enviado ao Chromium também não pode ser revertido com segurança. | Ligar parada ao `AbortController` da requisição e impedir novas ferramentas após cancelamento; registrar que um comando já despachado pode terminar. |

---

## 3. Otimização do Motor: Velocidade, Acurácia e Redução Drástica de Tokens

O motor atual do Zero Browser baseia-se na captura heurística do DOM via injeção de script (`getAccessibilityTree`). Embora funcional, este modelo sofre de três gargalos severos:

### 3.1. Gargalos do Modelo Atual
1. **Consumo de Tokens por Snapshot:**
   O número de nós e tokens por passo varia conforme site, tarefa, provedor e modelo. Os valores de 4.000–8.000 por passo e mais de 100.000 por tarefa não vieram acompanhados de trace reproduzível; devem ser tratados como estimativas a medir.
2. **Truncamento Cego do DOM:**
   O limite atual de nós pode omitir conteúdo; o efeito depende da ordem DOM e da tarefa. Medir quantas tarefas falham por truncamento antes de escolher outra poda.
3. **Invalidação de Prefix Caching:**
   Mudanças de prefixo podem reduzir cache em alguns provedores. O comportamento, elegibilidade e preço são específicos por modelo e devem ser verificados nas métricas de uso do provedor.

### 3.2. Arquitetura do Motor de Alta Performance (Plano de Evolução)

```
[ Página Web / Tab ]
       │
       ▼ (CDP Nativo)
[ Accessibility.getFullAXTree / DOMSnapshot ] ──► [ Viewport & Interactive Pruning ]
                                                              │
                                                              ▼
                                                   [ Compact Semantic Markup ]
                                                   (Apenas nós clicáveis/focáveis)
                                                              │
                                                              ▼
                                                   [ Immutable System Prompt ]
                                                   (Cache possível; validar por provedor)
```

1. **Uso de CDP Nativo (`Accessibility.getFullAXTree`):**
   - Não depende de injeção de scripts no DOM da página.
   - O protocolo retorna a árvore de acessibilidade do frame solicitado; iframes exigem identificação e leitura de seus frames, e não se deve presumir travessia automática de toda fronteira ou de todo Shadow DOM.
   - Pode retornar papéis e estados semânticos calculados pelo Chromium, mas a cobertura deve ser comparada ao mecanismo atual em sites e fixtures.

2. **Filtro Estrito por Viewport & Interatividade (Token Pruning):**
   - **Regra de Ouro:** Apenas incluir na mensagem do modelo nós que estejam (a) visíveis na tela ativa (calculados via `DOM.getContentQuads` ou interseção com viewport) e (b) que sejam nós de conteúdo semântico relevante ou elementos interativos (`button`, `link`, `input`, `select`, `combobox`).
   - Elementos fora do viewport podem ser resumidos em uma lista compacta, com uma estratégia de recuperação por busca/rolagem para evitar esconder conteúdo relevante.
   - A regra estrita por viewport é uma hipótese de desenho e pode reduzir acerto se esconder conteúdo, menus, opções ou campos fora da dobra. Exige fallback e benchmark antes de substituir o snapshot atual.
   - **Hipótese a medir:** redução de tokens precisa ser medida em tarefas pareadas; não há economia comprovada neste relatório.

3. **Garantia de Prefix Caching:**
   - O System Prompt e a descrição do esquema das ferramentas devem permanecer rigorosamente imutáveis entre chamadas.
   - Economia e TTFT dependem do provedor, modelo, formato e posição do cache. “100% de prefix cache”, “90% de desconto” e “menos de 600 ms” não são garantias do Zero e precisam de medição real.

4. **Batching e Ações Concorrentes Semânticas:**
   - Permitir que o modelo emita sequências lógicas de ações quando o estado não muda (ex.: preencher campo A, preencher campo B, selecionar opção C) em uma única iteração, sem aguardar round-trips repetidos de IA para cada campo de formulário.

---

## 4. O Dilema Estratégico: Extensão Web vs. Navegador Nativo IA vs. Electron

Esta é a decisão de produto mais crítica para o projeto. Abaixo está o confronto técnico sem eufemismos.

| Critério | Opção A: Extensão Web (Chrome MV3) | Opção B: Navegador Nativo IA (Fork BrowserOS / Chromium) | Opção C: Electron Otimizado (Zero Browser Atual) |
|---|---|---|---|
| **Acesso a Recursos do Sistema** | **Baixíssimo.** Preso ao sandbox do Chrome MV3. Sem acesso ao sistema de arquivos local irrestrito, sem sockets nativos livres, sem Named Pipes. | **Total.** Acesso a sockets C++, sistema de arquivos local, portas seriais, interceptação profunda de rede e IPC nativo. | **Alto.** Node.js no Main Process com suporte a arquivos, CLI, Pipes, SQLite e automação local. |
| **Automação autorizada** | Limitada pelas permissões da extensão e do navegador hospedeiro. | Pode integrar controles nativos do produto; continua sujeito a sandbox, permissões e políticas dos sites. | Controle amplo das abas próprias do app; continua sujeito a sandbox, permissões e políticas dos sites. |
| **Sessões e Logins Existentes** | **Excelente.** Aproveita cookies, senhas salvas, extensões de autenticação (Google, GitHub, bancos) da navegação diária do usuário sem setup. | **Exige Migração.** Usuário precisa importar perfis, fazer login novamente e gerenciar um segundo navegador completo. | **Isolado.** Cria partição de sessão própria. Exige que o usuário faça logins dentro da janela do Zero Browser. |
| **Custo de Engenharia e Manutenção** | **Baixo.** Código puramente Web (TS/React). Atualizações do Chromium são absorvidas automaticamente pelo Chrome do usuário. | Alto: exige toolchain, builds e manutenção de segurança contínua. Uso de código BrowserOS precisa cumprir a licença aplicável a esse código; isso não determina automaticamente a licença de todo código independente do Zero. | **Moderado.** Mantido em JavaScript/Node.js com Electron. Atualizações periódicas via npm sem compilar C++. |
| **Controle de Abas & Multi-Agente** | **Limitado.** A API `chrome.debugger` desliga se o usuário abrir o F12 DevTools e tem restrições em páginas internas (`chrome://`) e Web Store. | **Ilimitado.** Pode rodar múltiplos agentes em background em abas silenciosas (headless ou offscreen) com controle nativo de ciclo de vida. | **Total nas Abas do App.** Controle irrestrito sobre WebContents e views sem travas de loja de extensões. |

### Veredito Estratégico e Recomendação Pragmática:

> **A recomendação definitiva é um modelo HÍBRIDO EM 2 ETAPAS:**
>
> 1. **Fase Atual (Curto/Médio Prazo): Consolidar o Zero Browser em Electron.**
>    Não vale a pena saltar agora para o fork C++ do BrowserOS. O custo de compilar Chromium em Windows e manter atualizações precisa ser avaliado. Usar código BrowserOS exige cumprir a licença aplicável a esse código; isso não permite presumir sem análise que todo código independente do Zero recebe automaticamente a mesma licença. O Electron atual permite avançar a experiência mantendo o motor existente.
>
> 2. **Criar a Extensão "Companion" (Extensão Leve):**
>    Transformar o motor em uma extensão pura de Chrome causaria perda de acerto em tarefas complexas (downloads protegidos, automação fora da sandbox, ferramentas do SO). No entanto, criar uma **extensão leve que se conecta via WebSocket/Native Messaging ao Zero Browser** permite o melhor dos dois mundos: capturar abas do Chrome convencional do usuário quando desejado, mas mantendo o poder de processamento e execução dentro do motor nativo.

---

## 5. Nova Identidade Visual & UI/UX: Filosofia Impeccable (pbakaus/impeccable)

### 5.1. O Problema da UI Atual ("Visual Genérico de IA")
Atualmente, ferramentas de IA caem nos mesmos clichês visuais que denunciam amadorismo:
- Gradientes roxos/azuis holográficos ("AI glow").
- Excesso de bordas luminosas, partículas e ícones de estrelas cintilantes (sparkles ✨).
- Telas saturadas de dados irrelevantes, prompts truncados e falta de hierarquia tipográfica.
- Violação direta do princípio básico: *"Menos é mais"*.

### 5.2. Diretrizes Impeccable de Paul Bakaus Aplicadas ao Zero Browser
O manifesto [Impeccable](https://github.com/pbakaus/impeccable) prega que design excepcional é invisível, utilitário, deliberado e artesanal.

1. **Anti-AI Aesthetics:**
   - Banir gradientes neon e brilhos artificiais.
   - Paleta de cores baseada em tons editoriais, neutros quentes e contrastes de precisão suíça:
     - Fundo Primário: Grafite Fosco Profundo (`#121316`) no modo escuro; Cinza Pedra Suave (`#F8F9FA`) no modo claro.
     - Destaque/Ação: Âmbar Ocre Artesanal (`#D97706` / `#F59E0B`) ou Esmeralda Técnico (`#10B981`) para status de sucesso.
     - Superfícies: Sem sombras borradas falsas; uso de bordas finas com 1px semi-transparentes (`rgba(255, 255, 255, 0.08)`).
2. **Tipografia Humana e Ergonômica:**
   - Adotar fontes com textura e legibilidade editorial (ex.: *Plus Jakarta Sans*, *Geist Sans* ou *Newsreader* para cabeçalhos e *JetBrains Mono* / *Geist Mono* para logs de execução).
3. **Dashboards Claros & "Menos é Mais":**
   - Eliminar menus laterais empilhados com 20 opções.
   - Foco em **uma única ação primária por vez**.
   - Painel do Agente com estados transparentes:
     - *Ocioso:* Barra de comando elegante com atalhos de alta frequência.
     - *Executando:* Linha do tempo minimalista mostrando apenas a ação corrente e a evidência (ex.: "Preenchendo endereço de entrega"), sem poluir com JSONs crus.
     - *Aguardando Aprovação:* Cartão proeminente com **botões grandes e contrastantes** para ações críticas ("Aprovar Pagamento de R$ 120,00", "Rejeitar").
4. **Micro-interações Funcionais:**
   - Estados de foco e clique com amortecimento natural (`transition: 120ms cubic-bezier(0.16, 1, 0.3, 1)`).
   - Ausência de animações gratuitas que atrasem a percepção de resposta.

---

## 6. Plano de Ação Imediato

1. **Correção de Vulnerabilidades:**
   - Aplicar a correção da regex em `src/automation/service/index.js` (`AUD-02`).
   - Adicionar autenticação por token no WebSocket local (`AUD-01`).
   - Remover bridges de preload desnecessárias expostas às páginas; isso reduz a superfície de ataque, não oculta automação nem contorna proteções de sites (`AUD-03`).
2. **Motor:**
   - Integrar `Accessibility.getFullAXTree` direto via CDP com poda de nós fora da tela.
3. **Interface:**
   - Aplicar o novo tema Impeccable em `src/renderer/styles.css` e simplificar o layout do painel lateral.

---
## Revisão e correções aplicadas — 26/10/2026

| Achado | Estado no código atual | Evidência e limite |
|---|---|---|
| AUD-01 — WebSocket local sem autenticação | **Corrigido.** O endpoint exige token aleatório de 256 bits, rejeita conexões com `Origin` e não imprime mais a porta no log. | Teste local confirma rejeição sem token e sem aceitar `Origin` de navegador; cliente de processo autenticado conecta. |
| AUD-02 — separação de linhas em `read_batch` | **Corrigido.** Regex reconhece `LF` e `CRLF`. | Regressão cobre termo após 300 caracteres e em linha seguinte; suíte passou. |
| AUD-03 — bridge visível em páginas | **Corrigido por remoção da superfície sem uso identificado.** O preload de abas de sites e as globais `naveganteBrowser`/`naveganteAccessibility` foram removidos; o preload da interface principal permanece isolado. | Integração instalada confirmou as duas globais como `undefined`. Não foi implementada técnica anti-bot/stealth. |
| AUD-04 — opções de criação de abas | **Corrigido.** IPC aceita apenas a janela principal, URLs web HTTP(S), `about:blank` e as páginas internas exatas permitidas. Não recebe `openerOptions` do renderer. Pop-ups preservam o `webContents` criado pelo Electron e as preferências seguras fixas do Zero. | Integração instalada confirmou que `zero://newtab` abre, `javascript:` é recusado e páginas não conseguem abrir `zero://unrecognized-internal-page`. OAuth real ainda não foi validado. |
| AUD-05 — salvar sessão ao fechar | **Corrigido no fluxo de código.** Sessão é salva forçadamente no evento `close`, antes de `shuttingDown`, e listas vazias também são persistidas. `before-quit` salva se necessário. | Não há validação runtime concluída do fechamento nesta rodada; o teste Electron iniciado não produziu resultado final. |
| AUD-06 — parar tarefa durante chamada ao modelo | **Corrigido parcialmente, com limite explícito.** Botão “Parar” aborta a requisição ao provedor e impede a próxima ferramenta. | Teste local confirmou cancelamento do provider. Um comando CDP já despachado não é reversível e pode terminar antes da tarefa parar. |

**Verificação da correção:** em 26/10/2026, `npm test` passou 93/93, `npm audit --omit=dev` reportou zero vulnerabilidades, `npm run test:electron` terminou com exit code 0 e a integração empacotada 0.1.3 passou com nova aba, CUA, AX, provider local, configurações, download e aprovação/cancelamento. O teste de regressão reproduziu o ciclo concorrente freeze/unfreeze e confirmou que a página não fica congelada. O `app.asar` de produção corresponde ao build por SHA-256 (`9DD022EAA3FA9C8AF80A371408C1ED47572FAFC8095497720D4A46C44E9320C2`). O app e o perfil anteriores foram copiados e conferidos em `backups/2026-10-26-before-0.1.3`; a instalação diária agora é 0.1.3 e o perfil manteve 7.571 arquivos/762.275.248 bytes. A integração usa fixtures HTTP locais e provider mock; ela não mede acurácia geral em sites autenticados. A versão 0.1.3 foi publicada em `origin/main` no commit `90cbcd4`.

As propostas de trocar o snapshot pelo CDP AX, poda por viewport, cache de prompt, batching semântico e redesign visual não foram aplicadas nesta correção: são mudanças de motor/produto, não os seis bugs AUD-01–06, e precisam de benchmark de acerto, tokens e latência antes de substituir comportamento existente.

*Fim do Relatório Oficial de Auditoria e Diretrizes Arquiteturais.*
