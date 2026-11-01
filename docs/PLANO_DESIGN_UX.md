# Plano de design, UX e fluxos — Zero Browser com bots

Data: 31/10/2026. **Status: Implementado (`0.1.53-dev` a `0.1.60-dev`).** Base: tokens de `src/renderer/styles.css`, `src/main/bot-avatar-catalog.js`, `src/renderer/index.html` e `src/renderer/app.js`.

## 1. Ideia central: o anel

"Zero" é um círculo. O anel é a assinatura visual do produto e a linguagem de estado de tudo que é automático.
- Logotipo: um anel aberto (traço contínuo com uma pequena abertura).
- Cada bot é um avatar dentro de um anel. O anel muda de acordo com o estado: fino e parado (descansando), girando devagar (trabalhando), preenchido e pulsando uma vez (precisa de você), tracejado vermelho (erro), cinza (pausado).
- O mesmo anel aparece na aba que o bot usa, na bandeja, nas notificações e no comprovante. O usuário aprende uma só forma e entende o sistema inteiro.
- Estado nunca só por cor: cada estado muda também o formato do traço (contínuo, tracejado, aberto) e vem com texto ("Trabalhando", "Precisa de você") no nome acessível e no painel.

## 2. Três promessas que o design precisa cumprir

1. **Presença:** a qualquer momento o usuário vê quem está agindo, em qual aba e há quanto tempo. Aba controlada por bot ou por IA externa ganha borda do anel na cor do bot e um selo "controlada por X".
2. **Prova:** nada acontece em silêncio. Cada execução termina em um comprovante legível (o que fez, em quais sites, o que mudou, quanto custou), com captura das telas decisivas.
3. **Controle:** parar, assumir e desfazer estão sempre a um clique. Botão "Parar tudo" fixo na barra superior enquanto algo roda; "Assumir" em qualquer aba controlada.

## 3. Princípios

- Calmo por padrão: sem bots rodando, a janela é um navegador comum e silencioso. O bot só ocupa espaço quando tem algo a dizer.
- Mostrar o trabalho, não o motor: o usuário vê passos em português ("Abrindo a loja X", "Achei R$ 129"), nunca JSON, ferramenta ou prompt. Detalhes técnicos ficam numa camada "Técnico", fechada por padrão, para o usuário avançado.
- Um verbo por tela: cada tela tem uma ação principal clara.
- Aprovar em contexto: o pedido de aprovação mostra o rascunho exato (o e-mail, o pagamento) e as duas saídas, nunca uma pergunta abstrata.
- Nada de pegadinha: ação irreversível sempre mostra o que muda antes e permite voltar quando possível.

## 4. Estrutura da janela

```
┌ Barra de abas ────────────────────────────── [Parar tudo]* [Central] ┐
├ Barra de endereço / ferramentas ─────────────────────────────────────┤
│ Trilho │                                              │ Painel do bot │
│ de     │            Página (conteúdo)                 │ (abre sob     │
│ bots   │                                              │  demanda)     │
└────────┴──────────────────────────────────────────────┴───────────────┘
 * aparece só quando algo está rodando
```

- **Trilho de bots (esquerda, 56px):** avatares com anel de estado, "+" no fim, e a Central no topo. Recolhível. Em janela estreita vira um botão único que abre a lista.
- **Painel do bot (direita, 360px, redimensionável):** substitui o painel de IA atual. Abas internas: Conversa, Agenda, Memória, Histórico. Fecha com Escape e devolve o foco ao avatar.
- **Central (página interna `zero://central`):** visão de todos os bots, aprovações pendentes, falhas, gasto do mês e log de clientes externos (MCP). É a tela de "o que está acontecendo".
- **Barra superior:** o botão "Parar tudo" só aparece com algo rodando, em destaque vermelho com texto, nunca só ícone.

## 5. Fluxos principais

### 5.1 Criar um bot (caminho feliz em 3 passos)
1. Clique em "+" → escolha: **Ensinar** (recomendado), **Descrever** ou **Galeria**.
2. **Ensinar:** o usuário faz a tarefa uma vez com um indicador "Gravando" e um botão "Terminei". O Zero mostra os passos entendidos em linguagem simples, o usuário corrige o que errou e dá um nome.
3. **Revisão:** tela única com Nome e avatar, o que o bot faz, quando roda (agenda), o que pode fazer sozinho × o que pede aprovação, limite de gasto. Botão principal "Criar bot"; secundário "Testar agora (só leitura)".
- Estados: gravação interrompida (retomar), passo não entendido (pedir confirmação), site pede login (ver 5.3).

### 5.2 Rotina agendada rodando
- Início: notificação discreta do sistema "Preços: começou".
- Durante: avatar com anel girando; a aba dele fica oculta, com atalho "Ver ao vivo".
- Fim: notificação com resultado de uma linha e botão "Abrir comprovante". Nada de janela invasiva.
- Execução perdida (PC desligado): na próxima abertura, um cartão na Central "Perdida às 08:00. Rodar agora?".

### 5.3 Entrar em sites (login)
- O bot nunca guarda senha. Ao precisar de login, avatar vai para "Precisa de você" e abre a aba do site com uma faixa "Entre na sua conta; eu continuo daqui".
- Depois do login, o usuário clica "Pronto, continuar". Se a sessão expirar, 2FA ou captcha aparecer, o bot pausa e chama; nunca tenta contornar.

### 5.4 Aprovação
- Cartão no painel e na Central: o que será feito, rascunho completo, destino (para quem, onde), custo. Botões: **Aprovar**, **Editar**, **Recusar**. Teclado: Enter aprova só com foco no botão, Escape não aprova nada.
- Ações financeiras e envio de mensagens começam sempre pedindo aprovação. A autonomia sobe por degraus que o usuário libera por bot.

### 5.5 Assumir o controle
- Em qualquer aba controlada, botão "Assumir". O bot pausa na hora; o usuário mexe; "Devolver ao bot" retoma do ponto atual. Se o usuário apenas clicar na página, o Zero pergunta antes de continuar.

### 5.6 IA externa conectada (MCP)
- Primeira conexão: cartão "Claude Code quer controlar o Zero" com nível pedido (observar, interagir, desenvolvedor, total), validade e perfil. O usuário escolhe e aprova. Na janela, selo "Controlado por Claude Code" com contagem de ações e botão de parar. Revogar com um clique na Central.

### 5.7 Primeira abertura
- Duas telas no máximo: (1) o que é o Zero, em uma frase e com um exemplo animado; (2) "Quer um bot de exemplo?" com 3 modelos seguros (somente leitura). Quem pular chega a um navegador normal com o "+" visível e uma dica única.

## 6. Linguagem visual

- **Cor:** manter a base verde-azulada calma (`#326f61` claro, `#83b8a8` escuro) como cor da marca. Cada bot ganha uma cor própria de uma paleta de 8 tons dessaturados, todos testados contra o fundo para contraste de 3:1 ou mais no anel. Vermelho só para erro e parada; âmbar só para "precisa de você".
- **Tipografia:** uma família legível (manter a do sistema para velocidade; avaliar uma família única para títulos curtos só depois dos testes). Três tamanhos por componente, números tabulares em gastos e preços.
- **Forma:** raio 10px nos cartões e 999px nos avatares e botões "pílula"; bordas finas em vez de sombras no tema claro; sombra só em menus e diálogos.
- **Espaçamento:** escala de 4px (4, 8, 12, 16, 24, 32). Trilho com 56px; painel com 360px.
- **Movimento:** o anel girando é o único movimento contínuo. Transições de 150 a 200ms. Com `prefers-reduced-motion`, o anel "trabalhando" vira um traço estático com um ponto que muda de posição a cada passo.
- **Ícones:** um único conjunto de traço, 20px, com rótulo de texto onde a ação não for óbvia.
- **Voz do texto:** português simples, verbo primeiro, sem jargão ("Pausar bot", não "Suspender worker"). Erros dizem o que houve e o que fazer.

## 7. O que muda no que já existe

| Hoje | Passa a ser |
|------|-------------|
| Painel de IA único | Painel do bot selecionado, com Conversa, Agenda, Memória e Histórico |
| Menu do aplicativo com tudo | Menu continua; ganha "Central" e "Perfis" já existente; bots ficam no trilho, não no menu |
| Perfis só pelo menu | Cor do perfil na moldura da janela; avatar do bot mostra a qual perfil pertence |
| Aprovações em diálogo genérico | Cartão de aprovação com rascunho (5.4) |
| Sem comprovante | Comprovante por execução, exportável (também alimenta o log de ações do plano de segurança) |
| Configurações com muitas seções | Índice por área já existe; acrescentar seções "Bots", "Clientes de IA" e "Limites de gasto" |

## 8. Estados obrigatórios (cada tela)

- Vazio: "Nenhum bot ainda" com a ação "Criar o primeiro" e 3 modelos.
- Carregando: esqueleto, não spinner solto; o anel girando conta como indicador.
- Erro: o que aconteceu, o que o bot já fez, botão "Tentar de novo" e "Ver detalhes".
- Sucesso: comprovante curto, nunca silêncio.
- Texto longo: truncar com tooltip e foco; nomes de bot até 24 caracteres.
- Zero bots rodando × muitos: o trilho rola e agrupa por perfil acima de 8 bots.

## 9. Acessibilidade (regras do projeto, valem para toda tela nova)

- Trilho é uma `nav` com lista; cada avatar é um `button` com nome "Preços, trabalhando, há 2 minutos". Setas navegam, Enter abre o painel, Escape fecha e devolve o foco.
- Estado em texto, formato e cor (nunca só cor). Contraste mínimo AA: 4,5:1 para texto, 3:1 para anel e ícones.
- Mudanças de estado anunciadas em região `aria-live="polite"`; aprovações pendentes e erros usam `role="alert"` somente quando exigem ação imediata.
- Cartão de aprovação: foco vai ao título ao abrir; o botão Recusar é o padrão ao pressionar Escape; nada aprova por tecla acidental.
- Alvos de toque/clique de 44px na versão larga e no modo compacto; foco visível com anel de 2px.
- Movimento reduzido respeitado (seção 6). Teste com leitor de tela (NVDA) em Windows nos três fluxos: criar bot, aprovar, assumir.

## 10. Como validar o design (antes de polir)

1. Protótipo clicável em HTML estático dos fluxos 5.1, 5.4 e 5.5 (sem motor), com 5 pessoas fazendo a tarefa. Meta: 4 de 5 concluem sozinhas, sem ajuda.
2. Teste de 5 segundos: mostrar o trilho e perguntar "o que cada bot está fazendo?". Meta: acertar o estado de pelo menos 4 de 5 avatares.
3. Verificação automática de contraste dos tons dos bots nos dois temas.
4. Passagem de teclado e leitor de tela nos fluxos principais.
5. Só depois: refinamento de marca (logotipo final, família tipográfica).

## 11. Ordem de construção (liga ao `PLANO_BOTS.md`)

1. Tokens: anel de estado, paleta de bots, escala de espaçamento no `styles.css` (sem mudar telas).
2. Trilho de bots + painel (depende do executor e histórico da Fase 1 dos bots).
3. Cartão de aprovação e comprovante.
4. Fluxo "Ensinar" (depende do gravador de ações).
5. Central e permissões de clientes de IA (depende da Fase 2 do controle por IA).
6. Primeira abertura e galeria de modelos.

## 11b. Decisão: avatares dos bots (31/10/2026)

Escolha recomendada e adotada como padrão do plano: **símbolo de traço dentro do anel**, não emoji nem só iniciais.
- Conjunto fechado de cerca de 24 símbolos de traço único (compras, e-mail, gráfico, trabalho, casa, estudo, saúde, viagem, dinheiro, relógio, pasta, lupa, etc.), todos do mesmo conjunto de ícones do produto, para ficarem consistentes e nítidos em 20 a 44px.
- Cor do anel escolhida entre as 8 cores da paleta de bots; o símbolo usa o tom escuro da mesma cor (contraste verificado nos dois temas).
- Dois bots com mesmo símbolo e cor são impedidos pela criação; o sistema sugere a próxima combinação livre.
- Saída para quem quer mais: iniciais (2 letras) ou imagem própria recortada em círculo. Emoji não entra no conjunto padrão: muda de aparência por sistema, briga com o anel e lê mal pequeno.
- Nome acessível sempre inclui nome do bot e estado, nunca só o símbolo.
- Primeiro bot criado por modelo da galeria já vem com símbolo e cor sugeridos; o usuário pode trocar na tela de revisão (5.1).

## 11c. Inspiração no Grok Bot, versão minimalista e controlável pela IA (31/10/2026)

Fontes (secundárias, de terceiros; o produto é novo e ainda está sendo lançado, então o fluxo pode mudar): docs.x.ai/grok-bot/faq, mem0.ai/blog/grok-bot-guide, eesel.ai/blog/grok-bot, buildfastwithai.com (resenha). Não vi o produto em uso; o que segue vem dessas descrições.

### Inspirar, não espelhar
- **Fluxo: inspirar-se.** Ideias de fluxo não são protegidas, e são boas.
- **Visual: não copiar.** Layout, ícones e textos do Grok Bot são marca e identidade de terceiros; copiar o visual traz risco jurídico e deixa o Zero sem rosto próprio. O anel e o minimalismo abaixo são a identidade do Zero.

### O que adotar do fluxo
| Padrão do Grok Bot (segundo as fontes) | No Zero |
|---|---|
| Bot com nome, papel e conversa permanente; "briefing" como contratar alguém | Ficha do bot: nome, papel, o que pode, o que não pode, limites; conversa permanente no painel |
| Rotinas por agenda com histórico de execuções | Agenda + comprovante por execução |
| "Teach a Task": o usuário faz a tarefa no navegador, o Bot grava e gera um rascunho de habilidade para revisar e testar (gravação limitada a 10 minutos; testar é recomendado) | Gravador, rascunho em linguagem simples, revisão e **ensaio** antes de ligar |
| Aprovações para envio, compra, exclusão, publicação | Igual, mas **imposta pelo produto**: uma resenha diz que no Grok Bot a aprovação é orientação e não lista fixa que sempre para. No Zero é o núcleo intocável |
| Pausa de rotinas quando o usuário some por muito tempo | Pausar bots sem verificação do usuário por N dias (padrão 14, configurável) |
| Artefatos duradouros criados pelo bot | Apps vivos, arquivos e relatórios, guardados na Central |
| Computador na nuvem compartilhado entre os bots | Não adotar: o Zero roda no seu navegador; ganha em privacidade, perde o "PC desligado" |

### Dois modos, mesma janela
- **Navegar (padrão):** navegador comum e silencioso; uma barra de comando; trilho recolhido.
- **Delegar:** a conversa com o bot ocupa o centro; a aba do bot aparece ao vivo ao lado; aprovações aparecem no fluxo da conversa. Atalho para alternar; a aba volta ao modo Navegar quando a tarefa termina.

### Minimalismo (regras)
- Uma entrada principal: a **barra de comando** (Ctrl+K). Digitar um endereço, uma busca, um comando ("fechar abas duplicadas") ou um pedido ao bot ("monitore o preço deste produto"). Mesmo campo, o Zero decide pela intenção e mostra o que vai fazer antes de fazer.
- Um acento de cor por tema; cor extra só no anel de cada bot e nos estados (âmbar, vermelho).
- Tipografia carrega a hierarquia; ícones só onde a ação não é óbvia; bordas finas, sem sombras no tema claro.
- No máximo 3 níveis de profundidade: janela, painel, detalhe. Detalhe técnico fica em "Técnico", fechado por padrão.
- Respiro: espaçamento de 16/24 px entre grupos; nada de painel lotado.

### Interface controlável pela IA
A interface é declarativa: o layout (painéis, barras, trilho, modos) é descrito por um esquema e alterado por comandos `ui.*` do registro de comandos (`PLANO_NAVEGADOR_NATIVO_IA.md`). A IA pode, a pedido: esconder a barra de favoritos, mover o painel para baixo, criar um modo foco, abrir o painel de um bot, montar um painel novo (apps vivos).
- Cada mudança mostra antes e depois e entra no histórico versionado; "Desfazer" e "Modo seguro" sempre disponíveis.
- A IA **não** altera nem esconde o núcleo: botão parar tudo, indicador de quem controla a aba, cartão de aprovação e acesso à Central ficam fixos e sempre visíveis.
- O usuário continua mandando: mudança de interface proposta pela IA aparece como sugestão com prévia quando for grande.

### Decisão
**Decidido em 31/10/2026:** o Wesley aprovou o mockup do modo Delegar (barra de comando no topo, conversa com o bot à esquerda com cartão de aprovação, aba do bot ao vivo à direita, botão "Parar tudo" fixo) como base do protótipo clicável. É uma direção visual, não um desenho final: cores, tipografia e logotipo seguem em aberto.

### Portões de design
- Teste dos 5 segundos: a tela inicial e a do modo Delegar são entendidas sem explicação por 4 de 5 pessoas.
- Teste de comando: 10 pedidos em português na barra de comando (3 de navegação, 3 de interface, 4 de bots); 8 de 10 acertam a intenção sem corrigir.
- Teste do núcleo: pedir à IA para esconder parar tudo ou o indicador de controle deve ser recusado.

## 11d. Revisão de 31/10 (noite): simplicidade, painel de bots e inspiração no neo

Feedback do Wesley sobre a interface atual: "bagunçada, parece criada por IA, os bots não se mexem nem conversam, e quem cria o bot devia só descrever e a IA descrever o que ele faz". Direção geral em `ROTEIRO_DO_MENTOR.md`.

**Diagnóstico do que existe (`src/renderer/index.html`).** Painel do bot com camadas demais: cabeçalho de três linhas, aviso de status, faixa de controle da aba, barra do bot, 5 abas, barra de conversas e menu "Mais ações" com 9 itens. Três nomes para a mesma coisa (Perfis, Especialistas, Bots) e "GrokBot" no texto. Emoji como ícone (🛒). Criar bot é um formulário de quatro campos mais dois modos técnicos; a IA não ajuda.

**Regras de simplicidade (valem para toda tela):** um nome só ("Bot"); palavras fixas (Bot, Rotina, Avisar, Recibo, Desfazer, Parar tudo); cada tela faz uma pergunta; no máximo três ações visíveis; a IA explica o que o bot fará em frases curtas; sem jargão; sem emoji como ícone. Prova: teste de 5 segundos, 4 de 5 pessoas dizem o que o bot faz e o que fazer a seguir.

**Painel de bots novo.** Cabeçalho de uma linha, conversa, campo de texto. Agenda, memória, rotas e histórico vão para a página do bot. Os 9 itens do menu viram menu de contexto.

**Criar bot.** Um campo de frase; a IA devolve a ficha (nome, símbolo, missão, quando roda, sites, permissões, limites, teste); você ajusta, aprova e clica "Testar agora". Detalhes de execução em `PLANO_BOTS.md` 0f.

**Bots vivos.** O anel muda de forma por estado (parado, trabalhando, esperando você, erro, pausado), já previsto na seção 1. Cada bot mostra uma linha do que faz agora, com o último passo. A troca entre bots aparece numa sala da equipe, mostrando quem pediu o quê. Todo movimento respeita "movimento reduzido" e cada estado também tem texto, não só forma e cor. Risco: animação com vários bots rodando juntos pode pesar; medir no protótipo.

**Inspiração visual: BrowserOS neo.** Medido no site (não no app, que não consegui abrir; a conexão com o neo falhou): fundo azulado claro #F9FBFF, texto #393F49, azul de ação #0254EC, botões com cantos de 12 px, títulos em serifa (EB Garamond) com uma palavra em itálico azul, corpo em Inter, rótulos em fonte mono, desenho de órbitas com cartões de agente. Pela descrição do produto: página de nova aba como painel com um bloco ao vivo por agente (nome, ferramenta, status) e replay de sessão com linha do tempo. Aproveitar o espírito (claro, calmo, uma cor de ação, hierarquia pela tipografia, um bloco vivo por bot, replay como o recibo) **sem copiar** cores e fontes exatas.

**Decisão pendente:** sair do verde (#326f61, seção 6) para paleta clara com uma cor de ação própria. Até o Wesley aceitar, o verde segue. **Próximo passo:** mockup visual da criação de bot e do painel novo antes de qualquer código.

## 12. Riscos e decisões suas

- Excesso de interface: se a janela mostrar bots demais, perde o ar de navegador. Regra: sem bots, o trilho fica recolhido por padrão.
- Anel animado pode cansar: limitar a um por vez na área do trilho ("N bots trabalhando" agrupado acima de 3).
- Decisões: nome e avatar padrão dos bots (emoji, ilustrações próprias ou iniciais); se o trilho fica à esquerda (proposto) ou integrado à barra de abas; se vale contratar um logotipo final.
