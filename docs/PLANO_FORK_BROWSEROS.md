# Plano — Zero Browser em cima do BrowserOS

Data: 2026-10-25. Decisão do usuário: trocar a base Electron por um fork do BrowserOS (github.com/browseros-ai/BrowserOS).

**Situação:** adiado em 2026-10-25. Primeiro vamos evoluir o motor no Zero Browser em Electron.

## Em poucas palavras

- O BrowserOS é o próprio Chromium (o motor do Chrome) com mudanças por cima, mais um servidor de IA (Bun/TypeScript) e uma extensão com a tela do agente (React + shadcn, o mesmo estilo do Flame).
- O Zero Browser passa a ser esse navegador com outro nome, outro visual (o do Flame), o **nosso motor** de automação e o **Flame** já instalado.
- Favoritos, histórico, sessões, extensões da loja do Chrome e importação de senhas passam a vir prontos do Chromium. O que fizemos disso no Electron deixa de ser necessário.
- Custo: máquina dedicada a compilar (horas por build) e acompanhar atualizações de segurança do Chromium. O BrowserOS declara AGPL-3.0; código BrowserOS derivado deve cumprir essa licença. Isso não prova, por si só, que todo componente independente do Zero muda automaticamente de licença; avaliar limites dos componentes e obrigações de distribuição antes de qualquer fork.

## 1. Máquina

Conferido nesta máquina em 2026-10-25:

| Item | Precisa | Tem | Situação |
|---|---|---|---|
| Memória | 16 GB ou mais | 32 GB | ok |
| Núcleos | quanto mais, melhor | 16 | ok |
| Disco livre (NTFS) | ~100 GB só o código; build de depuração pede bem mais | 257 GB livres em C: (NTFS) | ok, mas apertado com 2 builds; ideal SSD separado |
| Visual Studio (C++ desktop + MFC/ATL) | versão exigida pelo Chromium 151 fixado no BrowserOS | **não instalado** | instalar |
| Windows SDK + Debugging Tools | versão exigida pelo Chromium 151 | não verificado | instalar junto |
| Python | 3.12+ | 3.13 | ok |
| Git | sim | 2.56 | ok |
| Bun | sim (servidor do agente) | 1.4.3 | conferir a versão fixada no `package.json` deles |
| depot_tools, uv | sim | não | instalar |

**A verificar antes de instalar:** o BrowserOS fixa o Chromium 151.0.7922.137. O README deles pede Visual Studio 2022; a documentação atual do Chromium (ramo principal) já pede Visual Studio 2026. Vale a do Chromium 151: conferir no `docs/windows_build_instructions.md` daquela versão.

Ações que são suas (mudam o sistema): instalar o Visual Studio e o SDK, e, se quiser builds mais rápidos, excluir a pasta `C:\src` do antivírus do Windows.

## 2. Compilação

Etapas, em ordem. A primeira vez leva de um dia a um dia e meio de máquina, a maior parte sem ninguém olhando.

1. **Fork no GitHub** (ação sua, cria repositório público): `browseros-ai/BrowserOS` → `<sua conta>/Zero Browser-OS` (nome a decidir).
2. **Baixar o Chromium fixado** com depot_tools (`fetch --no-history chromium`, depois ir para a versão de `CHROMIUM_VERSION`/`BASE_COMMIT`). Leva algumas horas.
3. **Compilar o BrowserOS sem nenhuma mudança**, só para provar que a máquina compila:
   `uv run browseros build --preset debug --product browseros --chromium-src C:\src\chromium\src`
   Eles estimam de 1 a 3 horas em máquina moderna; a primeira costuma ser a mais longa.
   Antes, `uv run browseros build --preset release --show-plan` mostra os passos e as variáveis que faltam, sem compilar nada.
4. **Builds seguintes** são incrementais: mexer só na extensão ou no servidor (TypeScript) **não** recompila o Chromium. Recompilar o C++ só quando mudarmos patches do navegador.
5. **Instalador:** o próprio sistema deles empacota para Windows (`browseros package`). Assinatura digital (`browseros sign`) exige um certificado de código pago; sem ele, o Windows mostra o aviso do SmartScreen ao instalar.

Limite importante: o ambiente de desenvolvimento do agente deles (`bun run dev:watch`) **só funciona no macOS hoje** (procura o app em `/Applications`). No Windows rodamos o servidor à mão com `--config` apontando para a porta CDP do navegador. Funciona, mas sem a recarga automática deles.

## 3. Licença AGPL-3.0 e marcas

- **O que ganhamos:** podemos copiar, mudar e distribuir tudo.
- **O que exige:**
  - Modificações e distribuição de código coberto pela **AGPL-3.0** precisam cumprir os termos da licença.
  - O alcance sobre componentes independentes ou combinados depende da composição/distribuição concreta; fazer revisão por componente e obter orientação jurídica antes de escolher a licença de um produto baseado em fork.
  - **Uso pela rede (seção 13):** se algum dia o servidor de IA modificado rodar para usuários pela internet, também é preciso oferecer o código a eles.
  - Manter avisos/licenças de cada componente incorporado, incluindo a licença BrowserOS, as licenças do Chromium e os créditos de terceiros; decidir o arquivo `LICENSE` do produto depois da revisão de escopo.
- **Marca:** a AGPL não dá direito ao nome nem ao logo "BrowserOS". Trocar nome, ícones e textos em todo lugar.
- **CLA deles:** só vale se mandarmos melhorias de volta para o repositório deles. Para o fork, não precisa assinar.

## 4. O que muda no motor do Zero Browser

Hoje o motor (`src/automation/service/index.js`, `runAgent`) fala com a página pelo `webContents.debugger` do Electron. No BrowserOS, o servidor Bun fala com o Chromium por **CDP na porta 9000**. Ou seja, é o mesmo protocolo, mas chega por outra porta.

1. **Separar o motor** do Electron: o laço do agente, as ferramentas e as regras do prompt vão para um módulo que só precisa de uma função `sendCommand(método, parâmetros)` e da lista de abas. Isso já resolve o ponto fraco "1.602 linhas num arquivo só".
2. **Ligar ao servidor deles** como um motor alternativo dentro de `apps/server` (TypeScript), usando a conexão CDP que eles já têm. O agente deles continua existindo até o nosso vencer no benchmark.
3. **O que precisa ser refeito** (hoje depende do Electron):
   - captura de tela, que hoje usa `nativeImage`;
   - entrada real de mouse e teclado (`cua-input`);
   - o pedido de aprovação, que hoje abre uma janela do Zero Browser e passa a ser um cartão na tela do agente.
4. **Aprovação:** levar a nossa regra (senha, código, cartão e pagamento nunca são aprovados sozinhos) para dentro do guarda de ferramentas deles (`BrowserToolRuntime`). Não pode haver nenhum caminho que a pule.
5. **Benchmark:** `bench/avaliar.js` passa a falar com o `/mcp` do servidor por HTTP em vez do pipe do Zero Browser. As mesmas 33 páginas continuam valendo. Medir três coisas: nosso motor, o agente deles e o Flame, as três no mesmo navegador.
6. **Ganho de bônus:** com várias abas e vários agentes no Chromium, os pontos fracos "uma aba só" e "sem upload/download" ficam mais fáceis de resolver, porque eles já têm ferramentas de abas, arquivos e downloads.

## 5. O que muda no Flame

- **Fica mais simples:** o Flame é uma extensão de Chrome (MV3) e roda direto no Chromium. Some todo o "calço" que fizemos no Electron (`chrome-shim-preload.js`, partes do `extension-host.js`), e some o risco de API faltando.
- **Vem instalado:** entra como extensão embutida pelo mesmo mecanismo das deles (`bundled-manifest.xml` + feed de atualização). O feed tem que apontar para um servidor **nosso**; se ficar no deles, as atualizações deles sobrescrevem a nossa versão.
- **Mesma pasta para os dois:** o Flame do Chrome e o do Zero Browser continuam saindo de `lume-aipex/extension`.
- **Visual do Flame no navegador inteiro:**
  - a tela do agente deles (`apps/app`) já é React + shadcn, então recebe as cores, a fonte Inter e os cantos do Flame com pouco trabalho;
  - nova aba e painel lateral também saem da extensão;
  - as cores da moldura (abas e barra de endereço) mudam por patch no Chromium (C++), feito depois, com recompilação.
  - O restyle que eu ia fazer no Electron fica cancelado.

## 6. Privacidade (obrigatório antes de qualquer distribuição)

- A extensão deles usa PostHog (análise de uso) e o ambiente tem chaves de Sentry (relato de erros). Pela regra do projeto, **sem telemetria**: remover ou deixar desligado no código, não só "sem chave".
- Revisar para onde o navegador se conecta sozinho: feeds de atualização, OTA do servidor, CDN deles. Apontar para servidores nossos ou desligar.
- Manter os patches de privacidade do ungoogled-chromium que eles já usam.

## 7. O que acontece com o Zero Browser em Electron

- Fica congelado como plano B até o fork chegar no mesmo nível: compilar, ter o nosso motor, ter o Flame e passar no benchmark.
- Favoritos, histórico, sessões e importação **não** são portados: o Chromium já tem.
- O que é levado: o motor, o benchmark, as regras de aprovação e as ideias de interface.

## 8. Fases e critério de pronto

| Fase | Pronto quando | Quem age |
|---|---|---|
| 0. Preparar | VS + SDK + depot_tools instalados; fork criado | você (instalações e fork) |
| 1. Compilar puro | BrowserOS sem mudanças abre no Windows a partir do nosso build | eu, com a máquina rodando horas |
| 2. Renomear e limpar | abre como "Zero Browser", ícones próprios, sem telemetria nem feeds deles | eu |
| 3. Motor | nosso motor roda no servidor e passa 10/10 nas difíceis 31–40 | eu |
| 4. Flame | Flame embutido, passa 10/10 nas difíceis | eu |
| 5. Visual Flame | tela do agente, nova aba e painel com a identidade Flame; depois a moldura (patch C++) | eu |
| 6. Distribuir | instalador, fontes e avisos exigidos pelas licenças dos componentes usados, atualização apontando para nós | você decide depois da revisão de licença |

## Riscos

- **Segurança depende de acompanhar o Chrome:** um navegador baseado em Chromium antigo fica vulnerável. Cada versão nova do BrowserOS ou do Chromium significa mesclar e recompilar.
- **Dependência do ritmo deles:** mudanças grandes no repositório deles podem quebrar nossas alterações; manter as alterações pequenas e isoladas facilita.
- **Tempo de máquina:** builds de horas; erros no meio custam caro. Começar sempre por `--show-plan`.
- **Disco:** 257 GB livres dão para uma configuração; duas (depuração + lançamento) podem não caber.
