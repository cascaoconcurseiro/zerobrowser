# Arquivo do Handoff

## Sessão de 2026-10-21

## Última sessão
**Data:** 2026-10-21

**O que foi feito:**
- Investigado o erro `SELF_SIGNED_CERT_IN_CHAIN`. Catálogo e chat agora usam `net.fetch` do Electron/Chromium, com verificação TLS mantida.
- Teste real de rede sem credencial via Electron: DeepSeek `https://api.deepseek.com/v1/models` respondeu HTTP 401 (TLS/DNS concluídos; autenticação requerida); OpenRouter `https://openrouter.ai/api/v1/models` respondeu HTTP 200.
- A lateral mostra a dica mascarada dos últimos quatro caracteres e tem ações **Mostrar/Ocultar**. A revelação pede IPC explícito e o texto é removido do campo ao ocultar.
- Electron 45.0.0 e electron-builder 26.15.7. `npm test` 24/24; `npm run test:electron` exit 0; `npm run build` exit 0.
- NSIS atualizado instalado em `C:\Users\Wesley\AppData\Local\Programs\navegante`. Smoke instalado passou: catálogos e chamadas simuladas dos dois providers, salvar/revelar/ocultar chave, agente com mutação AX em fixture, abas, preferências, download e aprovação/cancelamento.
- SHA-256 instalador: `57B8DA6F5BD86E5F16835206795856A5479F223873A9420F451331626052B36D`. SHA-256 do `app.asar` do pacote e instalado (iguais): `4A73BF0ED432DCDFD89E6563CD98017B269D26932545172EBF0974693314F74D`.
- `npm audit --omit=dev`: zero vulnerabilidades. Auditoria completa ainda lista 8 moderadas transitivas no electron-builder; sem altas/críticas.
- REA CLI analisou o plugin atual (144 arquivos selecionados), o bundle principal e módulos centrais. Evidências/limites estão em `VALIDACAO-REA.md`; cobertura semântica permanece parcial.

## Próximo passo
**Arquivo:** `src/automation/model-catalog.js` e UI de Agente em `src/renderer/app.js`.
**Ação:** pedir ao usuário que salve novamente sua chave DeepSeek/OpenRouter na versão instalada, confirme a dica `Salva: ••••••••xxxx`, clique **Atualizar**, escolha um modelo e **Conectar**. Se houver erro, coletar apenas mensagem/código, nunca a chave. A chamada autenticada real ainda não foi executada nesta sessão.

## Bloqueios e pendências
- O smoke de `dist\win-unpacked\Navegante.exe` fecha no startup com exit `2147483651`; o mesmo pacote instalado por NSIS abre e passa o smoke completo.
- Não foi realizada chamada autenticada paga aos provedores. As verificações externas foram sem chave; providers mock cobriram o fluxo autenticado.
- O REA MCP teve erro interno de orçamento de transferência. A CLI completou análise do plugin, mas relata grafo incompleto; análise completa de todo `app.asar` continua sem evidência utilizável.
- Paridade com ChatGPT Desktop continua incompleta; consultar `CHECKLIST.md` e `VALIDACAO-REA.md`.
- Nenhum commit/publicação.

## Handoff substituído em 2026-10-25

# Handoff — Navegante

## Última sessão
**Data:** 2026-10-25

**O que foi feito:**
- Pausa para CAPTCHA: detecção só de leitura (reCAPTCHA, hCaptcha, Turnstile, página "Just a moment"), aviso no painel do agente sem janela modal, retoma quando some ou com "Já resolvi". No benchmark (`run_task`) para direto com `human_check`. Tarefa 21 nova. `npm test` 38/38.
- Fase 1 do benchmark (ideia do BrowserGym): ferramenta MCP `run_task`, 20 tarefas locais com verificador e relatório de taxa de sucesso (`bench/`, `npm run bench`).
- Política `local-fixture`: aprova ações só em 127.0.0.1, recusa senha/código/cartão e site externo. Trace guarda só o tamanho do texto digitado.
- Ponte para clientes MCP: `scripts/mcp-stdio.js` (`npm run mcp`).

## Próximo passo
**Ação:** abrir o Navegante (dev: `npm start`) com chave salva e modelo escolhido, rodar `npm run bench -- primeira` e ler `bench/resultados/primeira__*.md`. Atenção: o app precisa ser reiniciado para carregar o `run_task`; o instalado ainda é a versão antiga.
**Depois:** usar as tarefas que falharem para guiar a fase 2 (snapshot >250 nós, espera, arrastar, injeção).

## Bloqueios e pendências
- Nenhuma rodada real com modelo foi feita; só testes com provedor simulado.
- Instalador não foi regerado com o `run_task`.
- Pendências anteriores (win-unpacked fecha no startup, chat autenticado real, 8 moderadas no electron-builder) seguem em `docs/HANDOFF_ARQUIVO.md`.
- Nenhum commit/publicação.


## Histórico antes da evolução do motor em 2026-10-25
# Handoff — Navegante

## Última sessão
**Data:** 2026-10-25

**O que foi feito:**
- Flame no Navegante: 10/10 nas difíceis (`flame-dificeis2__*`), mas lento (45 s, ~260k tokens por tarefa).
- Plano do fork BrowserOS em `docs/PLANO_FORK_BROWSEROS.md`; usuário adiou: motor primeiro.
- Motor (`src/automation/service/index.js`, `runAgent`):
  - novas ferramentas `tabs` (list/new/switch/close, devolvem o texto da página), `go_back` e `wait_for`;
  - aviso `newTabs` quando um link abre aba; a política do run_task acompanha a aba adotada; run_task fecha as abas abertas pelo agente.
- `main.js`: `activateTab` nos controles do motor. Tarefa nova 41 (duas abas): 6/6. Difíceis 31–41: 11/11, média 10,9 s.
- Benchmark em sites reais: `bench/tarefas-reais.js` (8 tarefas, `--conjunto=reais`), política `public-sites` (só HTTPS nos sites da tarefa). 15/16 → 16/16 depois de `scroll find` devolver trechos.
- Upload/download no motor: ferramentas `downloads` e `upload_file` (só pasta de downloads ou arquivo baixado na tarefa; aprovação sempre). Agente baixa sem a janela "Salvar"; tarefas de avaliação baixam em `<perfil>/downloads-avaliacao`. Janela "Escolher arquivo" interceptada nas abas do agente (CDP). 42/43: 8/8; difíceis 13/13; reais 8/8.
- Memória: anotações (notes) medidas e descartadas, pioravam passos/tokens; ficou resumo automático de respostas antigas grandes. Tarefa 44 (6 filiais). Difíceis 14/14, reais 8/8 (-22% tokens).

## Próximo passo
**Ação:** pausar/continuar no motor: quando `runAgent` (`src/automation/service/index.js`) bate o limite de ações (30 no painel), guardar `messages` e oferecer "Continuar" no painel do agente, retomando com o mesmo histórico. Depois aprovação por risco.
**Depois:** abas igual Chrome (nova aba com busca e atalhos, clique do meio, menu "Abrir link em nova aba") e menu ⋮ no canto superior direito.

## Bloqueios e pendências
- Escudos estilo Brave adiados pelo usuário.
- Nenhum commit; instalador não regerado.



## Sessão de 31/10/2026 — fatia 0.1.68-dev

Código em preparação em `main`, próximo passo utilizável do projeto a partir da 0.1.67-dev. A meta ampla permanece ativa: execução autônoma real de Bots, conectores, consentimentos, UX completa de Configurações/Extensões e benchmark pareado ainda não foram concluídos.

Nesta fatia, o modo Delegar classifica localmente pedidos claros de preço, mercado e e-mail. Pedido comum, misto ou sem perfil especialista persistido segue para o agente geral; a interface expõe a sugestão e permite corrigi-la. A execução especialista continua sendo `automation.runAgent` com orientação local no prompt e usa a aba/perfil atuais; não afirmar isolamento ou runtime autônomo por Bot. O envio em segundo plano também distingue agente geral de perfil especialista e não escolhe o primeiro Bot por padrão.

Arquivos centrais: `src/renderer/orchestrator-routing.js`, `src/renderer/app.js`, `src/renderer/index.html`, `src/renderer/styles.css`; cobertura em `test/orchestrator-routing.test.js` e `scripts/electron-ui.integration.js`. Preservar continuidade de dados: `appId` `com.wesley.navegante`, nome interno `navegante`, arquivo `navegante-config` e partição `persist:navegante`; chaves usam `safeStorage`. Não inspecionar segredo nem conteúdo pessoal do Gmail.

Validação: `npm test` 414/414; `npm run test:ui` PASS após corrigir a ordem de estado da fixture e verificar que o perfil chega ao motor; `npm run test:delegation-layout` PASS em seis viewports; `npm run build` PASS. Uma primeira tentativa detectou classificação errada para pedido misto preço/e-mail; corrigido para agente geral.

Entrega local: commit da fatia `8b3ad15`; instalador NSIS executado com `ExitCode 0` em `C:\Users\Wesley\AppData\Local\Programs\navegante`. Executável informa `0.1.68-dev` / `0.1.68.0`; o hash instalado do `app.asar` confere com a build (`DD7589AB05D7F94AD6EAEA816E5A65F8DB7BB79C282482B78C0059A809369F04`). Instalador SHA-256: `1D2A088B05B73264DFBAB4964ACE77FC9643D8F6D19967430E85489B084BBA05`. O perfil pessoal foi preservado, mas Gmail e chave não foram abertos ou testados.

Próximo passo da fatia (agora reorganizado pelo roteiro): revisar visualmente a UI instalada com Wesley; em seguida retomar auditoria/execução real de Bot e demais itens da meta. Não incluir os arquivos `audit-*.txt` já presentes no worktree; são artifacts não relacionados. Sem push.

Bloqueios: chamadas pagas continuam sem orçamento aprovado. O teste foi local com fixture; não houve chamada real de provedor ou uso da conta Gmail.
