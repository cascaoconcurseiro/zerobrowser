# Fluxo de UX dos Bots no navegador (31/10/2026)

Vale junto de `PLANO_DESIGN_UX.md` 11d (regras de simplicidade), `docs/bots/PLANO_BOTS.md` e `docs/concorrencia/PLANO_SUPERAR_NEO.md`. Primeiro o fluxo, depois o visual. Paleta clara com azul de ação já aceita; mockup só depois deste documento ser aprovado.

Escopo: só o navegador (abas, conversa, funcionamento). Fora: PC desligado, celular, nuvem.

## 1. Pessoa e cenário

Pessoa comum, sem conhecimento técnico (o Wesley é o primeiro usuário, não o único): não programa, quer descrever o que precisa e ver o bot fazer. Cenários guiadores: (A) "avise quando o preço cair" (monitor de preço); (B) preencher todo mês o mesmo formulário de um sistema. Os dois precisam: criar com uma frase, rodar sozinho, parar quando precisa dele, mostrar o que fez, deixar desfazer.

## 2. Vocabulário fixo (uma palavra por coisa)

Bot, Rotina, Avisar, Recibo, Desfazer, Parar tudo, Sala da equipe. Proibido na interface: GrokBot, Perfis, Especialistas, mandato, rota, gêmeo local, jargão do motor. Sem emoji como ícone.

## 3. Arquitetura de informação

```
Barra lateral do navegador
├── Bots (lista: um item por bot, com estado)
│   └── Bot X
│       ├── Conversa      (padrão ao abrir)
│       └── Detalhes      (rotina, o que ele lembra, sites e limites, histórico)
├── Sala da equipe        (só aparece com 2+ bots)
├── Histórico             (tudo que os bots fizeram, mais recente primeiro)
└── Configurações         (seção "Bots": limites, avisos, limpeza)
Sempre visível, em qualquer tela: Parar tudo
```

Máximo de 5 itens por nível. O que hoje está em 5 abas e no menu de 9 itens vira: Conversa (padrão) e Detalhes; ações raras vão para o menu de contexto do bot.

## 4. Fluxos

### 4.1 Criar bot (caminho feliz: 4 passos, 1 tela por passo)

1. **Descrever.** Um campo: "O que o bot deve fazer?" com 3 exemplos clicáveis. Botão único: Continuar.
2. **Conferir a ficha.** A IA devolve em frases curtas: nome, símbolo, o que fará, quando roda, sites que usará, o que ele **não** pode fazer, quanto pode gastar (padrão: zero). Cada linha tem Editar. Botões: Testar agora / Voltar.
3. **Teste ao vivo.** O bot roda uma vez na aba dele, com o passo a passo visível. Nada com efeito externo sem aprovação. Botões: Ficou bom / Ajustar.
4. **Ativar.** Escolher quando roda (agora, todo dia, quando mudar). Botão: Ativar. Aparece o bot na lista com estado.

Ramos: teste falha → mensagem dizendo o que travou e uma ação (Tentar de novo, Ajustar, Ver o que houve); site pede login → fluxo 4.3; descrição vaga → a IA faz uma pergunta curta em vez de inventar. Sair no meio salva como rascunho.

### 4.2 Bot trabalhando

- Início: o bot abre a aba dele **em segundo plano**, dentro do grupo de abas do bot, nunca na aba do usuário. A aba mostra cor e símbolo do bot.
- Na lista e no cabeçalho: anel de estado (parado, trabalhando, esperando você, erro, pausado) **mais texto** do estado. Linha única: "Comparando preços na loja Y · há 12 s".
- Conversa: o bot escreve como colega, em primeira pessoa, frases curtas ("Achei 3 ofertas abaixo de R$ 150. Quer ver?"). Passos aparecem recolhidos; Ver passos abre a linha do tempo.
- Fim: recibo ("Fiz X, em Y, às 10:23") com Desfazer quando a ação for reversível; quando não for, o recibo diz isso.
- O usuário pode: abrir a aba do bot (Ver o bot trabalhando), pausar, parar, ou ignorar.

### 4.3 Bot precisa de você (login, código, captcha)

1. Bot para **antes** de tentar adivinhar. Estado vira "esperando você".
2. Aviso: notificação do navegador + marcador na lista + mensagem na conversa dizendo exatamente o que falta ("Preciso que você entre na loja Y").
3. Botão Ir para a aba: traz a aba do bot para frente, já na página certa. O usuário resolve.
4. Botão Continuar (ou o bot detecta e retoma). Se o usuário não responder em N minutos (configurável), o bot pausa e avisa uma vez, sem insistir.
Regra: o bot nunca digita senha nem resolve captcha sozinho.

### 4.4 Aprovar uma ação com efeito (enviar, comprar, apagar)

Cartão com: o que será feito, em qual site, o conteúdo exato (para/assunto/mensagem ou item/preço), o que não dá para desfazer. Botões: Aprovar / Recusar; o foco inicial fica em Recusar para ações irreversíveis. Sem aprovação em N minutos: a ação expira e o bot avisa. A aprovação vale só para aquela ação, nunca para a próxima.

### 4.5 Bots conversando entre si (Sala da equipe)

- Quando um bot precisa de outro: ele escreve na Sala ("@Preços, me diga o menor valor do item Z"). O pedido aparece como cartão: quem pediu, para quem, o quê, estado (pedido, em andamento, respondido).
- Na conversa do bot que pediu, aparece uma linha: "Pedi ajuda ao bot Preços" com link para a Sala.
- O usuário vê tudo, pode comentar, pausar um bot ou cancelar um pedido. Bot não recebe pedido de outro bot sobre ações com efeito externo sem passar por 4.4.
- Limites: no máximo 3 bots numa cadeia; sem laço (A pede a B que pede a A); gasto somado ao limite do bot que iniciou.

### 4.6 Parar tudo

Botão sempre visível no cabeçalho. Um clique: para todos em menos de 1 segundo, sem confirmação, e mostra "N bots parados · Desfazer parada". Tarefas no meio ficam marcadas como interrompidas, nunca como concluídas.

### 4.7 Erros e vazios

- Primeiro uso, sem bots: tela com uma frase ("Descreva uma tarefa e crio um bot para ela"), o campo de criar e 3 exemplos. Nada de lista vazia muda.
- Falha: sempre dizer o que aconteceu, o que o bot já fez antes de falhar, e a próxima ação possível.
- Sem internet, chave de IA ausente ou limite de gasto atingido: o estado do bot diz o motivo em palavras simples e leva à tela de Configurações certa.

## 5. Descrição das telas

```
┌──────────────────────────────────────────────────────────┐
│ Bots                              [Parar tudo]  [+ Novo]  │
├───────────────┬──────────────────────────────────────────┤
│ ◉ Preços      │  Preços · trabalhando                     │
│   trabalhando │  Comparando preços na loja Y · há 12 s    │
│ ◌ Mercado     │ ───────────────────────────────────────── │
│   parado      │  Preços: Achei 3 ofertas abaixo de R$150. │
│ ◔ E-mail      │          [Ver passos]                      │
│   esperando   │  Recibo: filtro aplicado 10:22 [Desfazer] │
│   você        │                                            │
│               │  [ Escreva para o bot…            ] [Enviar]│
│ Sala da equipe│  [Conversa] [Detalhes]                     │
└───────────────┴──────────────────────────────────────────┘
```

Cabeçalho do bot em **uma linha** (nome, estado em texto, uma ação principal). No máximo 3 ações visíveis por tela; o resto no menu de contexto. Estados obrigatórios em toda tela: normal, vazio, carregando, erro, esperando você.

## 6. Acessibilidade (obrigatório)

Estado do bot sempre em texto, não só cor ou forma; anéis animados respeitam "movimento reduzido"; tudo por teclado (lista com setas, Enter abre, Esc volta, atalho para Parar tudo); foco visível; avisos de estado novos anunciados para leitor de tela (região `aria-live` educada; "esperando você" e erros em modo assertivo); contraste mínimo 4,5:1 para texto e 3:1 para ícones nos temas claro e escuro; alvos de toque/clique de pelo menos 40 px; cartão de aprovação com foco preso e Esc recusa.

## 7. Avaliação rápida de usabilidade (heurísticas)

| Pergunta | Resposta do desenho |
|---|---|
| Sabe o que fazer ao chegar? | Campo de criar e exemplos no estado vazio; lista com estados na primeira vez que há bots |
| Toda ação tem resposta? | Estado em texto, linha "fazendo agora", recibo |
| Consistência? | Vocabulário fixo; mesmo cartão para aprovar em qualquer bot |
| Prevenção de erro? | Padrão sem gasto, aprovação por ação, foco em Recusar, bot nunca digita senha |
| Recuperação? | Desfazer no recibo e na parada geral |

## 8. Como saber que ficou bom (testes de sim ou não)

1. **5 segundos:** 4 de 5 pessoas dizem o que o bot faz e o que fazer a seguir.
2. **Criar bot em até 90 segundos** por alguém que nunca usou, sem ajuda.
3. **Dois bots ao mesmo tempo** sem trocar a aba um do outro e sem tocar na aba do usuário.
4. **Bot parado no login** avisa em até 5 s e retoma depois que o usuário entra.
5. **Parar tudo** zera a atividade em menos de 1 s, medido.
6. **Só teclado:** criar, aprovar e parar sem mouse.
7. **Leitor de tela** anuncia mudança de estado e o cartão de aprovação.
8. **Cadeia de bots**: pedido A→B aparece na Sala e na conversa de A, e o laço é bloqueado.

## 9. Ordem de entrega

1. Grupo de abas por bot (4.2) + estado em texto e Parar tudo (4.6).
2. Conversa de colega e "fazendo agora" (4.2), cartão de aprovação (4.4).
3. Criar bot em 4 passos (4.1) e estado vazio (4.7).
4. Parar no login (4.3).
5. Sala da equipe (4.5).
6. Mockup visual com a paleta azul antes de cada tela nova; depois `npm test` e `npm run test:ui`.

## 10. Em aberto (decisão do Wesley)

- Tempo de espera antes de pausar (4.3) e de expirar aprovação (4.4): proposta de 15 minutos nos dois.
- Primeira rotina validada: monitor de preço, como modelo da biblioteca (ver `docs/bots/CASOS_DE_USO_BOTS.md`); o Polare era só exemplo.
- Limite de bots em cadeia: proposta de 3.

## 11. Notificações: como chegam e como funcionam

Estado hoje no código (conferido em 31/10): só existe o evento interno `bots:notification` para a janela e `flashFrame` (pisca na barra de tarefas) quando um bot precisa de intervenção. Não encontrei aviso do Windows nem contador na barra de tarefas. Tudo abaixo é desenho novo.

**Canais, do mais discreto ao mais forte:**
1. **Dentro do navegador:** marcador na lista de bots, contador no item "Bots" da barra lateral, mensagem na conversa do bot e faixa curta no topo da janela ("Preços precisa de você · Ver"). Sempre acontece.
2. **Barra de tarefas do Windows:** número de avisos pendentes sobre o ícone e piscada uma vez. Só para urgentes.
3. **Aviso do Windows (toast):** aparece quando a janela do navegador não está em foco ou está minimizada. Respeita o modo "Não incomodar" do Windows. O clique abre o navegador direto na conversa do bot, no cartão certo.
4. **Resumo diário (opcional, desligado):** uma mensagem por dia com o que os bots fizeram. E-mail só com ação do usuário para ligar; nunca com conteúdo de página ou valores.

**Três níveis:**

| Nível | Exemplos | Canais | Som |
|---|---|---|---|
| Precisa de você | login, código, captcha, aprovação, erro que parou o bot, limite de gasto atingido | 1, 2 e 3 | só se o usuário ligar |
| Resultado | preço caiu, tarefa terminou, algo mudou na página | 1 e 3 | não |
| Informativo | resumo diário, bot pausado pelo usuário, atualização | 1 | não |

**Regras:**
- No máximo 1 aviso do Windows por bot e por tipo a cada 5 minutos; os demais viram "+3 avisos" dentro do navegador.
- Horário silencioso (padrão 22h às 7h): só "Precisa de você" com bloqueio real de dinheiro ou envio passa; o resto espera e aparece como resumo ao acordar.
- Por bot, escolha única: **Avisar sempre / Só quando precisar de mim / Nunca** (padrão: só quando precisar de mim).
- O texto do aviso do Windows é genérico por padrão ("Preços precisa de você"). Nome da loja, valores e assunto de e-mail só aparecem dentro do navegador, para não vazar na tela bloqueada. Quem quiser pode ativar detalhes.
- O aviso não aprova nada. Aprovar exige abrir o cartão e ver o conteúdo exato (4.4).
- Se o Windows bloquear avisos, o navegador diz isso uma vez, em Configurações > Avisos, e continua usando os canais 1 e 2. Nunca falha em silêncio.
- Central de avisos: lista dentro de Histórico, filtro "Precisa de você", com não lidos preservados ao reiniciar. Aviso resolvido sai do contador; aviso expirado fica marcado como expirado.
- Aviso pendente depois de 1 hora vira um lembrete único; depois disso o bot pausa e só aparece na lista.
- Acessibilidade: cada aviso novo é anunciado por leitor de tela (urgentes em modo assertivo), nunca só por cor ou som; contador em texto.

**Perfis e avisos:** cada perfil roda no seu processo (ver seção 12). Aviso de um bot só chega enquanto o perfil dele estiver aberto. Proposta para a primeira versão: não mostrar resumo de outros perfis (o Chrome também não) e dizer claramente, em Configurações > Perfis, que o bot só trabalha com o perfil aberto.

**Dados do aviso:** `id`, `botId`, `profileId`, `nível`, `tipo` (login, aprovação, erro, resultado, resumo), `título genérico`, `detalhe` (só interno), `criadoEm`, `lidoEm`, `resolvidoEm`, `expiraEm`, `alvo` (conversa + cartão). Sem segredos, sem conteúdo de página.

## 12. Perfis de usuário, como no Chrome

Estado hoje: `src/main/profiles.js` já cria perfis com nome e pasta própria, lista, exclui e monta o menu de perfis. Mas guarda só `id` e `nome`, e mistura perfil de pessoa com perfil de bot (`type: 'bot'`). Não há tela em Configurações, cor nem avatar.

**Pedido do Wesley:** perfis salvos, com nome, dentro de Configurações, como o Chrome.

**Decisão de desenho:** **Perfil é uma pessoa ou contexto** (Pessoal, Trabalho, Estudos). **Bot não é perfil**: o bot mora dentro de um perfil e usa os logins dele, com aba e grupo próprios. Isso exige separar os dois no código e migrar os bots já criados sem perder dados (ver `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`).

**Configurações > Perfis:**

```
┌─────────────────────────────────────────────┐
│ Perfis                                       │
│ Cada perfil tem seus próprios logins,        │
│ histórico, favoritos, extensões e bots.      │
├─────────────────────────────────────────────┤
│ (W) Wesley · em uso                 [Editar] │
│ (T) Trabalho                [Abrir] [Editar] │
│ (E) Estudos                 [Abrir] [Editar] │
│                                              │
│ [+ Adicionar perfil]                         │
│ [x] Perguntar quem está usando ao abrir      │
│ [ ] Abrir este perfil ao iniciar o Windows   │
└─────────────────────────────────────────────┘
```

- **Adicionar:** nome (obrigatório, único, sem diferenciar maiúscula), cor (8 cores da paleta azul), inicial automática ou imagem. Abre uma janela nova do perfil.
- **Editar:** nome, cor, avatar, "criar atalho na área de trabalho" (como o Chrome).
- **Excluir:** confirmação dizendo o que some (logins, histórico, favoritos, N bots, N rotinas) e exigindo digitar o nome; o perfil em uso não pode ser excluído; sugestão de 30 dias numa lixeira antes do apagamento definitivo (a confirmar).
- **Trocar:** menu no canto da barra (nome e inicial do perfil atual) lista os perfis; clicar abre a janela daquele perfil, sem fechar a atual.
- **Seletor ao abrir:** quando ligado, mostra cartões com cor e nome.
- **Convidado:** janela sem histórico nem logins, apagada ao fechar. Sem bots.
- **Limites:** até 20 perfis; nomes até 40 caracteres.
- **Perfil e bots:** o bot só trabalha com o perfil aberto. O cartão do bot diz a qual perfil pertence. Mover um bot para outro perfil copia a ficha e a rotina, **não** copia logins.
- **Segredos:** chaves de IA e logins ficam no perfil (cofre do sistema, `safeStorage`). Excluir o perfil apaga as chaves. Nada vai para nome de arquivo, URL ou log.
- **Conflitos:** dois processos no mesmo perfil não são permitidos (já há trava em `profiles.js`); o segundo abre a janela do primeiro.
- **Continuidade de dados:** não mudar `appId` `com.wesley.navegante`, nome interno `navegante`, arquivo `navegante-config` nem a partição `persist:navegante`; o perfil principal atual continua sendo o perfil "Wesley" sem migrar nada.

**Avatar do perfil vs. mascote do bot:** o perfil usa inicial em círculo colorido (ou imagem escolhida pelo usuário), como o Chrome. Os 40 mascotes são só dos bots, para nunca confundir pessoa com bot na tela.

## 13. Os 40 bots em pixel art (arquivo do Wesley)

Recebido: `Bots_Pixel_Art_Todos_40.zip`, 40 PNG de 640×640 com fundo transparente (conferido nos 40), em dois lotes (`lote_1` 01 a 20 e `lote_2` 21 a 40). Nomes: Faísca, Gota, Nuvem, Nébula, Pingo, Pistache, Florís, Cubito, Mimi, Cometa, Bolha, Cristal, Lumi, Geleca, Morango, Aurora, Lua, Polvito, Cogumelo, Fantim, Kiwi, Trovito, Estrela, Tofu, Órbita, Biscoito, Pomar, Tulipa, Veludo, Marinho, Cacto, Espiral, Cereja, Galax, Urso, Abóbora, Placa, Sorriso, Nevasca, Foguete. Vi só dois (Faísca e Foguete): personagens fofos, contorno azul-marinho escuro, sombra no chão, uma pose parada por arquivo. Os outros 38 não foram vistos.

**Como entram no fluxo:**
- São o **mascote** do bot, escolhido na ficha (passo 2 de criar bot) numa grade com os 40. O nome sugerido do bot é o nome do mascote (Faísca), editável. Os mascotes não trazem função: a função é a descrição do usuário.
- Cada mascote é um **ativo individual** (`id` estável = nome em minúsculas sem acento), no lugar das duas folhas 10×10 de hoje (achado A09 da auditoria). Tamanhos: 640 (original), 64 e 32, gerados com redução vizinho-mais-próximo e `image-rendering: pixelated`.
- **Estados:** os arquivos têm uma pose só. O estado do bot continua em **anel de cor + texto + movimento leve em CSS** (pulinho ao trabalhar, balanço ao esperar, imóvel parado), sempre respeitando movimento reduzido. Quadros próprios por estado são um pedido opcional ao autor da arte.
- **Conflito com decisão anterior:** a versão 0.1.67-dev trocou avatares pixelados por símbolos de traço, e a seção 11d do plano de design proibiu "emoji como ícone". Este envio indica que o Wesley quer os mascotes. Proposta: mascote em pixel art para a identidade do bot (lista, cabeçalho, aba) e símbolo de traço só para ações da interface. **Preciso da confirmação do Wesley** antes de mexer no catálogo.
- **Mesmo mascote em dois bots:** permitido, mas o seletor mostra "já usado por Preços" e sugere os não usados primeiro.
- **Acessibilidade:** cada mascote tem texto alternativo com o nome ("Mascote Faísca"); a informação nunca depende só da imagem.
- **Verificação ao importar:** conferir que os 40 abrem, ficam centralizados e legíveis em 32 px nos temas claro e escuro antes de publicar.
