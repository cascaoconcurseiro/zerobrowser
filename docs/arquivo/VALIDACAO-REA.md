# Validação REA — Navegante x ChatGPT Desktop

**Data:** 2026-10-21  
**Escopo:** análise estática REA do plugin de navegador instalado, inventário do `app.asar`, análise REA focada do bundle principal extraído, revisão do Navegante, testes locais e build Windows.  
**Conclusão:** a implementação **não está completa nem equivalente**. Esta validação registra diferenças observadas, não afirma igualdade com o produto original.

## Atualização de evidências — 2026-10-21

- Referência instalada nesta rodada: `OpenAI.Codex_26.1016.6573.0_x64__2p2nqsd0c76g0`; o trecho histórico abaixo, com `26.1013.4894.0`, pertence à captura anterior e não deve ser tratado como versão atual.
- O `app.asar` atual tem 21.559 entradas; bundle principal `.vite/build/main-CT5a1yCd.js`, 4.080.823 bytes, SHA-256 `cdac659a830908ec5202a887e5a37b302074bfc9e9ab0f52fed3e8abbdb9e713`, conferido com a integridade declarada no cabeçalho ASAR.
- Plugin instalado `resources/plugins/openai-bundled/plugins/browser`, digest da raiz `c2f4b40a2869e842ba0d625ce90022273b725a61e6077e510cd9578c5684da43`. REA CLI completou análise do diretório inteiro (144 arquivos selecionados), Evidence `ev_3a50e399f79835abdb6ec6e4b3820c1b526b905346ac64eb577b5a7dcf5946bf`; o resultado declara grafo incompleto e relações dinâmicas/semânticas não provadas. Análises focadas atuais: bundle principal Evidence `ev_776261b2b697923b6d9e3b19a697fe94865d9cec7084f326ad598acd5602c2be`; módulos browser-service/browser-client Evidence `ev_4f024a77e70c569a6f42722298bfde4ef59063014dbe8ffc3100e79bdd141aca`. O servidor REA MCP falhou no orçamento interno de transferência; a CLI foi usada como alternativa.
- `npm` agora resolve Electron `45.0.0` e electron-builder `26.15.7`. `npm test`: 24/24; `npm run test:electron`: exit 0; `npm run build`: exit 0. O smoke no `dist\\win-unpacked\\Navegante.exe` encerrou com exit `2147483651` na inicialização; a instalação via NSIS abriu e o smoke do executável instalado passou integralmente.
- Instalador: `dist\\Navegante Setup 0.1.0.exe`, SHA-256 `57B8DA6F5BD86E5F16835206795856A5479F223873A9420F451331626052B36D`. `app.asar` instalado e do pacote: SHA-256 `4A73BF0ED432DCDFD89E6563CD98017B269D26932545172EBF0974693314F74D` (correspondência exata).
- Smoke instalado confirmou catálogos e conexões OpenRouter/DeepSeek via loopback, salvar chave, exibir dica mascarada, revelar/ocultar segredo, agente com mutação AX, preferências, download e aprovação/cancelamento. Nenhuma chave real foi lida ou chamada externa foi feita.
- Rede real sem credenciais: um probe descartável com `net.fetch` do Electron recebeu HTTP 401 em `https://api.deepseek.com/v1/models` (TLS completou; o endpoint exige autenticação) e HTTP 200 em `https://openrouter.ai/api/v1/models`. Isso valida DNS/TLS/acesso a esses hosts nesta máquina sem ler ou enviar chave; não valida autenticação, chat pago, nem outros proxies/redes. O erro `SELF_SIGNED_CERT_IN_CHAIN` foi reproduzido como classificação do erro antigo de Node fetch, mas não ocorreu com a pilha Chromium neste probe. Se uma rede diferente ainda apresentar CA não confiável, instalar/confiar a CA correta no Windows; não contornar TLS.
- `npm audit --omit=dev`: zero vulnerabilidades. `npm audit --audit-level=high` reportou 8 moderadas em dependências transitivas do electron-builder (`sprintf-js` via `roarr/global-agent/@electron/get`); nenhuma alta/crítica no relatório final.

## Identidade e evidência do alvo

- Pacote instalado: `OpenAI.Codex_26.1013.4894.0_x64__2p2nqsd0c76g0`.
- `app.asar`: 582.072.504 bytes; SHA-256 `BBEC1D64E135B718A154B31655BB8AD9A39472BAC1B2CABBA991A9D97A339DD8`.
- Inventário completo pelo parser ASAR: 21.396 entradas.
- Bundle principal encontrado: `.vite/build/main-C4DYk222.js`, 4.049.746 bytes. Extraído para a pasta temporária `C:\Users\Wesley\AppData\Local\Temp\navegante-rea-chatgpt` e conferido contra o SHA-256 de integridade declarado no cabeçalho ASAR: `c8a2af504b21314fa6a64ad1b4ec83dbad80033ede902caf9978fd9c74a2c175` — correspondência exata.
- Plugin: `resources/plugins/openai-bundled/plugins/browser`; 144 arquivos relevantes, 121 JavaScript analisados e zero falhas de parsing. O digest da raiz analisada foi `21e409ed812f846532bb4479df3cc31c5da6846c88df535d595ba27dc02f0ac3`.
- REA plugin Evidence: `ev_6a493d4b4b6b96be26247741e350569c410ee7f9b378fa6c9344bd1d5399e74b`. A análise semântica ficou parcial, com relações desconhecidas; não é prova de cobertura completa do plugin.
- REA bundle principal extraído Evidence: `ev_6d6e0390e1044e3a295d7efa5b5980f8546463897ff43f6e6925673b063d90b4`. Um arquivo foi parseado, sem erro sintático; a extração semântica retornou cobertura parcial/truncada. O Evidence de módulo focado é `ev_527793f67dc15039c3522b9a1029e167121864bfdc5cbb58747bce111efca563`.
- A análise REA do `app.asar` inteiro foi tentada duas vezes. A primeira interrompeu por divergência de integridade declarada num binário nativo desempacotado. A segunda usou `record-and-continue`, mas excedeu 300 s e não produziu Evidence aproveitável. O inventário ASAR e a extração/hash do bundle foram verificados separadamente.

## Checklist por requisito

### 1. Alvo original e REA

- [x] Resolver instalação Store e inspecionar a estrutura completa do ASAR (21.396 entradas).
- [x] Extrair e conferir a integridade do bundle `.vite/build/main-C4DYk222.js`.
- [ ] Analisar com cobertura completa o `app.asar` inteiro. **Não passou:** REA encontrou divergência num `.node` desempacotado; a tentativa tolerante excedeu o limite de 300 s.
- [x] Analisar com REA o plugin browser instalado. Parsing completo dos arquivos JavaScript selecionados; semântica parcial.
- [x] Inspecionar `browser-client.mjs`, `browser-service.mjs` e `docs/api.json` por contratos e operações. `docs/api.json` documenta AXAPI, CUAAPI, DomCUAAPI, PlaywrightAPI, ContentAPI e operações Browser/Tabs/Tab.
- [x] Inspecionar estaticamente o bundle principal extraído. Foram observados `CODEX_APP_TOOLS_PIPE_PATH`, referência a `browser-service.mjs`, partição `persist:codex-browser-app-route:` e `WebContentsView`.
- [ ] Validar runtime interno do ChatGPT Desktop e APIs nativas. **Não executado**; esta tarefa usou evidência estática do pacote instalado.
- [ ] `rea_open_binary` em `codex.exe` e `codex-command-runner.exe`. **Não executado**; itens opcionais e fora do aceite de comportamento.

### 2. Navegante

- [x] `WebContentsView`, partições persistentes por aba, lock de instância única e handler `second-instance` presentes em `src/main/main.js`.
- [x] `safeStorage` usado em `src/store/index.js` para proteger a chave AES; a chave de API é cifrada pelo store com AES-GCM.
- [x] Os 11 nomes solicitados de ferramentas estão registrados; além deles há `browser_new_tab` e `browser_close_tab`.
- [x] Corrigidos nesta sessão: criação/fechamento de abas por callbacks reais do processo principal, buffer sequenciado de eventos CDP, schemas JSON para `tools/list`, `tools/call` JSON-RPC 2.0 em pipe nomeado Windows e bind WebSocket em `127.0.0.1`.
- [x] O agente agora obtém o índice do snapshot de acessibilidade e executa clique/preenchimento pelo mesmo `AutomationService.executeAXAction`.
- [x] O processo principal confirma ações classificadas como consequentes, scripts `browser_evaluate` e comandos CDP não classificados como leitura segura; após recusa, o ciclo do agente para. Testes cobrem bloqueio antes do dispatch e impedem pedido de workaround ao modelo.
- [x] Corrigido o caminho da chave: o store inicializa `safeStorage` antes de cifrar/decriptar; o teste de instalação usou uma chave descartável local e completou três chamadas mock.
- [x] `browser_screenshot(fullPage)` usa métricas de layout/CDP; unit test verificou captura declarada com 1280×2400.
- [ ] AXAPI completa. **Parcial:** snapshot DOM e ação básica; eventos sintéticos não reproduzem fielmente entrada nativa.
- [ ] PlaywrightAPI, CUAAPI, DomCUAAPI e ContentAPI equivalentes. **Ausentes.** Há screenshot e DOM/AX básicos, mas não a superfície das APIs do alvo.
- [ ] Action DSL fiel. Os nomes click, dblclick, drag, press_key, scroll, select_text, set_value, type_text e paste existem, mas a implementação é DOM sintético; não equivale a eventos reais de cursor/teclado/clipboard. `drag` não equivale ao caminho por coordenadas do CUA; `select_text` não tem todos os modos/posicionamento do contrato original.
- [x] Implementada espera `networkidle` por eventos CDP, com 500 ms de quietude, timeout e limpeza; testes cobrem idle e timeout.
- [x] Confirmação no fluxo instalado com fixture local. O teste automatizou o diálogo nativo: “Permitir uma vez” enviou o formulário uma vez; “Cancelar” manteve o formulário sem envio e interrompeu o agente após duas chamadas ao provider mock. Sites externos e maior variedade de controles continuam pendentes.
- [ ] Automação real com provedor OpenRouter. **Não executada:** testes usam `fetch` simulado; não expor nem consumir chave/custo externo sem autorização explícita.

### 3. Bugs e dependências

- [x] `level-supports` está declarado em `package.json` e resolvido em `node_modules`; verificação automatizada passou.
- [x] `requestSingleInstanceLock()` e listener `second-instance` existem no código principal.
- [x] `npm run test:installed` lançou duas instâncias com o mesmo perfil: a segunda encerrou com código 0 e o renderer/CDP da principal permaneceu ativo. O teste confirma exclusão da segunda instância; não observa foco visual.
- [ ] `browser_evaluate` executa script arbitrário no contexto da página; agora requer confirmação explícita no processo principal, mas ainda não tem política granular por origem ou escopo de script.
- [ ] `browser_cdp_events` registra eventos assim que o debugger está anexado, mas domínios CDP específicos ainda precisam estar habilitados para produzir eventos correspondentes.
- [ ] O preload legado `src/preload/browser-preload.js` mantém uma ponte de eventos AX sem listener correspondente; o agente principal já chama o AX diretamente e não depende dessa ponte.
- [ ] A chave OpenRouter real e resposta em site externo ainda não foram verificadas.

### 4. Build e execução

- [x] `npm test`: 19 testes passaram; incluem parsing JavaScript, dependências, permissões Google, política de privacidade por fixture, caminhos de download, catálogo OpenRouter/DeepSeek, agente simulado, AX, confirmação/recusa, bloqueio de `browser_evaluate` e CDP, schemas MCP, eventos, espera e screenshot de página completa.
- [x] `npm run test:electron`: fixture local em Electron passou com código 0.
- [x] `npm run build`: build Windows x64 / NSIS passou após as correções da confirmação no processo principal e serialização dos schemas.
- Instalador atual: `dist\Navegante Setup 0.1.0.exe`, 82.575.341 bytes, SHA-256 `F9A61A46B5953ADCDCED11C3B028BABA76EBFA030A900CEEB2AAE266F1CA2B7C`. `app.asar` no build e instalado: SHA-256 `4F2A4D3D851DA45C6598DF3F1286C3187F227A1C69EFD7EC0A14A485156E5D42`.
- [x] Corrigido defeito de interação: o `WebContentsView` nativo cobria os painéis HTML. Ao abrir IA/Configurações, a janela agora reduz a largura da página e reserva a faixa lateral; ao fechar, restaura a largura. A aba ativa é rastreada pelo processo principal, sem chamar `isVisible()` (método ausente no WebContentsView Electron usado).
- [x] NSIS atualizado instalado em `C:\Users\Wesley\AppData\Local\Programs\navegante` (saída 0); o diretório padrão estava vazio e agora contém o build correspondente.
- [x] `npm run test:installed -- "$env:LOCALAPPDATA\Programs\navegante\Navegante.exe"`: PASS. Verificou abertura/fechamento dos painéis IA e Configurações e bounds nativos que deixam seus controles acessíveis; também validou catálogos mock OpenRouter/DeepSeek (3 opções cada), modelo sem tool calling desabilitado, chaves separadas, renderer sem leitura das chaves, segunda instância, aba e mutação AX, URL curta/completa, tema, DNT, download e permitir/cancelar formulário. Fixtures e credenciais eram locais e descartáveis.
- [x] Observação REA passiva confirmou o renderer `file:///.../resources/app.asar/src/renderer/index.html`, título Navegante e aba Google carregada em Chromium 128 / Electron 32.3.3.
- [ ] Validar provider externo, navegação em sites reais e ações consequentes. **Pendente.**
- [x] Verificar dependências com `npm audit`: zero vulnerabilidades na árvore de produção; 18 na árvore completa de desenvolvimento/build (4 moderadas, 13 altas, 1 crítica), incluindo Electron 32.3.3 e electron-builder 25.1.8. **Atualização e revalidação do runtime/build pendentes.**

## Gaps por prioridade

### Críticos

1. A classificação de risco ainda é heurística e requer mais cobertura para minimizar falsos positivos/negativos, além de defesa específica contra prompt injection e exfiltração.
2. O aceite local instalado passou com provider mock; OpenRouter real, páginas externas e segurança em sites não foram testados.
3. A implementação AX é DOM-based e não cobre o controle visual/teclado real nem PlaywrightAPI/CUAAPI/DomCUAAPI. Painéis e Settings agora foram verificados contra a camada nativa sobreposta em smoke instalado, mas falta QA visual manual por screenshot nesta sessão.

### Importantes

1. Implementar cancelamento, takeover/retomada e estado por ação no painel do agente.
2. Expor eventos CDP por subscrição e garantir habilitação/remoção de domínios/listeners.
3. Remover ou conectar a ponte AX antiga em `browser-preload.js`.
4. Validar isolamento, autenticação e descoberta do pipe MCP; documentar cliente e ciclo de vida do endpoint.
5. Acrescentar validação visual do foco da janela após o segundo lançamento.
6. Atualizar Electron/electron-builder e reduzir vulnerabilidades do toolchain; repetir smoke instalado depois da migração.
7. Catálogo dinâmico OpenRouter/DeepSeek e chaves separadas implementados e testados com mocks; validar com provedores reais e credenciais autorizadas.

### Nice-to-have / paridade ampliada

- APIs de exportação `ContentAPI`, downloads e file chooser, APIs Playwright locator/frame, imagem e screenshot de elemento, DOM CUA por node id, fluxo visual por coordenadas.
- Histórico, restauração de abas, perfis e extensões, se fizerem parte do alvo de produto definido.

## Comandos de reprodução

No repositório Navegante:

```powershell
cd C:\Users\Wesley\Documents\Navegante
npm test
npm run test:electron
npm run test:installed
npm run build
```

Inventário completo do ASAR e hash do bundle principal (sem extrair os 582 MB inteiros):

```powershell
node -e "const a=require('@electron/asar');const p='C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.1013.4894.0_x64__2p2nqsd0c76g0\\app\\resources\\app.asar';const f=a.listPackage(p);console.log(JSON.stringify({entries:f.length,main:f.filter(x=>x.includes('main-C4DYk222.js'))}))"
```

Análise REA reproduzível: chamar `analyze_javascript_application` com `format: "directory"`, `detail: "summary"`, `input_path: "C:\Users\Wesley\AppData\Local\Temp\navegante-rea-chatgpt"` para o bundle extraído, ou apontar `format: "directory"` ao diretório instalado do plugin. A análise ASAR completa excedeu o limite registrado acima.

`npm run test:installed` usa por padrão `C:\Users\Wesley\AppData\Local\Programs\navegante-rea-validation\Navegante.exe` (o primeiro argumento pode apontar outro executável instalado). Cria perfil temporário, servidor de provider em loopback e processos de teste; não usa a chave real.

## Próxima sequência concreta

1. Ampliar classificação e testes do gate para controles ambíguos, formulários e falsos positivos/negativos.
2. Adicionar controle por coordenadas/teclado, progresso, cancelamento e takeover/retomada.
3. Ampliar testes de domínios CDP, detach/reconnect, ações AX em páginas complexas e sites externos autorizados.
4. Implementar superfícies Playwright/DOM CUA/Content e concluir a revisão das configurações ainda sem aceite.

## Atualização de 2026-10-21 — aprovação e laterais

- Implementado seletor persistente em Configurações > Agente de IA · aprovações: **Sempre perguntar**, **Permitir leitura**, **Permitir ações de baixo risco** (padrão) e **Permitir todas automaticamente**.
- O gate do processo principal aplica a política à inspeção/leitura e aos caminhos do agente/MCP de navegação, ações AX, screenshot, texto, espera, abas, scripts e CDP. A autorização automática não habilita CDP completo, não permite esquemas além de HTTP/HTTPS e não muda outros bloqueios técnicos.
- `npm test`: 21/21 passaram, incluindo modos de leitura, escrita e autorização automática. `npm run test:electron`: exit code 0. `npm run build`: exit code 0; instalador gerado.
- O teste instalado deste build não foi concluído: a tentativa de abrir `dist\win-unpacked\Navegante.exe` encerrou no startup enquanto outra janela Navegante estava aberta. Isso não valida o instalador atualizado nem o layout visual no executável.
- Laterais reorganizadas em CSS/HTML e mantidas na largura reservada nativamente (360 px). Falta inspeção visual no executável após substituí-lo com segurança.
- O último rebuild também ajustou a largura das laterais em janelas estreitas para acompanhar o limite de 40% da vista nativa. Hash do instalador NSIS: `BD8CB14DCBD9AFCBB23C300A4B7323BA2BF6796F1C0C33CC928DB635265AEF5B`; `app.asar`: `910FB9B04D8DC30733D0B32277005A4882E0A4D8135C84EF8C2E3A3F2C26EED7`.
