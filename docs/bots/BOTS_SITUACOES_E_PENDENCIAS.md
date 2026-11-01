# Bots: situações, correções e implementação (31/10/2026)

Pedido do Wesley: pensar em todas as situações e em tudo que se deve pensar, implementar e corrigir nos bots, no nível do Grok Bot, dentro do navegador. Este documento é a lista mestra. Fluxo de telas em `docs/bots/FLUXO_UX_BOTS.md`; comparação com o neo em `docs/concorrencia/PLANO_SUPERAR_NEO.md`; defeitos medidos em `docs/arquivo/AUDITORIA_INTEGRADA_2026-10-31.md`.

Escopo: só navegador (abas, conversa, funcionamento, perfis, avisos). Fora: PC desligado, celular, nuvem.

Aviso de honestidade: a auditoria foi feita na 0.1.64-dev e a árvore está na 0.1.68-dev. As versões 0.1.65 e 0.1.66 corrigiram parte (resultado honesto, contraste). **Todo item "corrigir" abaixo precisa ser reverificado no código atual antes de ser tratado como aberto.** Marquei com (reverificar) o que vem só da auditoria.

## 1. Situações a prever (o que o bot e a tela devem fazer em cada uma)

### 1.1 Execução
| Situação | Comportamento esperado |
|---|---|
| Rotina sem passos / plano vazio | Falha clara "nada a fazer"; nunca "concluído" |
| Um passo devolve erro | Para, marca falha, mostra o que já foi feito; nunca conclui |
| Passo trava (sem resposta) | Prazo por passo; cancela de verdade o que estava em andamento |
| Tempo total estourou | Para, cancela, avisa; recibo diz o que ficou pela metade |
| Usuário clicou Parar | Efeitos em andamento cancelados e verificados (não só o aviso na tela) |
| Gasto máximo atingido | Para antes de ultrapassar; aviso "Precisa de você" |
| Sem chave de IA / chave inválida | Estado em palavras simples + atalho para Configurações; nada de erro técnico |
| Sem internet / provedor fora / 429 / 5xx | Tentativas com espera crescente (respeitando `retry-after`), depois pausa e avisa; sem repetir envio |
| Modelo trocado ou descontinuado | Avisa; usa o padrão do perfil; nunca troca em silêncio para um mais caro |
| Página mudou e o seletor quebrou | Tenta outra forma (texto, papel, visão); se falhar, para e mostra a tela como estava |
| Site lento / conteúdo carrega depois | Espera pelo que importa, com limite; não clica no escuro |
| Banner de cookies / promoção / pop-up | Política por site: recusa cookies opcionais; fecha propaganda; mantém janela de login |
| Pop-up de login (OAuth) | Mantém a janela, devolve o resultado à aba de origem |
| Login expirado | Para e pede ajuda (fluxo 4.3); não tenta senha |
| Captcha / "verificação de conta" / 2FA | Para e pede ajuda; nunca contorna |
| Conteúdo da página pede ações ao bot (injeção) | Trata como dado; mostra aviso na conversa; só age pelo pedido do usuário |
| Ação com efeito externo (enviar, comprar, apagar) | Sempre aprovação por ação (4.4); nunca em lote |
| Retentativa após falha parcial | Não repete envio já feito: cada ação com efeito tem identificador e verificação de que já ocorreu |
| Mesma rotina disparada duas vezes | Só uma execução por bot ao mesmo tempo; a segunda espera ou é descartada com aviso |
| Dois bots no mesmo site e conta | Avisa o conflito; uma fila por site e conta; nunca dois no mesmo formulário |
| Loop / repetição sem progresso | Detector de repetição para o bot e pergunta ao usuário |
| Download / envio de arquivo | Só da pasta permitida; mostra nome, origem e tamanho antes de enviar |
| iframe, shadow DOM, canvas | Usa as ferramentas que já existem para isso; se não der, diz que não conseguiu |
| Aba nova inesperada | Segue a que importa; fecha as que o bot abriu ao terminar (opção) |

### 1.2 Abas e janela
| Situação | Comportamento esperado |
|---|---|
| Bot trabalha em segundo plano | Aba dentro do grupo do bot, cor e mascote; nunca rouba o foco do usuário |
| Bot precisa de você | Traz a aba para frente só quando é preciso, uma vez |
| Usuário clica na aba do bot e digita | O bot pausa a ação nessa aba e avisa ("você assumiu"); retoma só se o usuário mandar |
| Usuário fecha a aba do bot | Bot pausa e pergunta: reabrir, ou parar |
| Muitas abas abertas | Limite por bot (padrão 5) e por perfil; passou, espera |
| Janela minimizada ou em outro monitor | Funciona igual; avisos pelo Windows |
| Janela pequena (compacta) | Painel do bot vira tela cheia com voltar; Parar tudo continua visível |
| Tema escuro / alto contraste | Estados continuam legíveis sem depender de cor |
| Navegador fecha com bot rodando | Aviso antes: "2 bots trabalhando. Parar e sair?"; ao fechar, tarefa fica "interrompida", nunca "concluída" |
| Windows reinicia / queda de energia | Ao abrir de novo, mostra as tarefas interrompidas; retomar só com ação do usuário e só se for seguro repetir |
| Atualização do navegador | Espera o bot terminar ou pergunta; nunca atualiza no meio de ação com efeito |

### 1.3 Agenda e gatilhos
| Situação | Comportamento esperado |
|---|---|
| Hora marcada com o navegador aberto | Roda no fuso do bot (explícito), com horário de verão tratado |
| Hora marcada com o navegador fechado | Política escolhida pelo usuário por rotina: pular, ou rodar ao abrir (uma vez, com aviso) |
| Várias execuções perdidas | Roda no máximo uma ao abrir, nunca as N perdidas em sequência |
| Gatilho por evento (e-mail novo, página mudou) | Só com fonte real e comprovada; mostra de onde veio o evento |
| Mandato (autorização com limite) | Site normalizado por origem, não por `includes`; campos obrigatórios; usado só na execução real |
| Pausa e retomada | Mostra quando a próxima execução acontece; pausa não apaga a agenda |

### 1.4 Conversa e equipe
| Situação | Comportamento esperado |
|---|---|
| Usuário manda pedido enquanto o bot trabalha | Entra na fila, com "depois da tarefa atual / agora (interrompe)" |
| Pedido vago | Uma pergunta curta; nunca chuta |
| Bot não sabe fazer | Diz que não sabe e o que precisaria; nunca finge |
| Bot A pede ajuda ao bot B | Cartão na Sala da equipe e linha na conversa de A; limite de 3 em cadeia; sem laço |
| Bot B está ocupado, pausado ou apagado | A é avisado e escolhe: esperar, outro bot, ou fazer sozinho |
| Dois bots discordam | Usuário decide; os dois lados aparecem |
| Bot cita o que "lembra" | Memória visível e editável; usuário pode apagar item a item |
| Conversa muito longa | Resumo automático visível, sem perder recibos e aprovações |
| Dados sensíveis na conversa | Não vão para log, nem para aviso do Windows; senha digitada é recusada |
| Idioma | Português do Brasil por padrão; acentos preservados em nomes e filtros |

### 1.5 Dados, perfis e ciclo de vida
| Situação | Comportamento esperado |
|---|---|
| Criar, renomear, duplicar bot | Nome único dentro do perfil; duplicar não copia logins |
| Arquivar / restaurar | Arquivar para a rotina e some da lista principal; restaurar volta pausado |
| Excluir bot | Confirmação que diz o que some; recibos e histórico seguem a regra de retenção |
| Exportar / importar bot | Só a ficha e a rotina; nunca logins, chaves nem memória pessoal; importar mostra o que o bot fará antes de ativar |
| Mover bot para outro perfil | Copia ficha e rotina, sem logins; exige novo login no destino |
| Excluir perfil com bots | Diz quantos bots e rotinas somem; exige digitar o nome |
| Perfil já aberto em outra janela | Abre a janela existente; nunca dois processos no mesmo perfil |
| Histórico crescendo | Retenção configurável (padrão 30 dias para detalhes, recibos por mais tempo); limpeza visível |
| Segredos | Cofre do sistema; nada em log, URL, nome de arquivo, aviso ou exportação |
| Atualização de versão | Bots, rotinas, mascotes e perfis preservados; migração com cópia de segurança e volta |

### 1.6 Avisos
Ver `docs/bots/FLUXO_UX_BOTS.md` seção 11. Situações-chave: Windows bloqueia avisos; modo "Não incomodar"; horário silencioso; excesso de avisos do mesmo bot; aviso para bot de perfil fechado; aviso expirado; clique no aviso com o bot já resolvido (abre a conversa com a mensagem "já resolvido").

### 1.7 Acessibilidade e conforto
Teclado em tudo, leitor de tela anunciando mudanças de estado, movimento reduzido, contraste 4,5:1, alvos de 40 px, texto de estado sempre presente, zoom até 200% sem perder função, mascote com texto alternativo.

## 2. O que corrigir

### 2.1 Defeitos da auditoria (reverificar no código da 0.1.68 antes de tratar)
- **A01** Execução de Bot pode concluir sem executar (executor alternativo com dados de mentira; plano vazio como "concluído"). Alta.
- **A02** Resultado de ferramenta com erro pode virar "concluído". Alta. (A 0.1.65 diz ter corrigido o relato honesto: conferir se cobre este caso.)
- **A03** Parar e limite de tempo não cancelam o que está rodando por baixo. Alta.
- **A04** Agenda e eventos não alimentam uma automação contínua (sem relógio recorrente; sem alimentação por e-mail ou webhook). Alta.
- **A05** Fuso e horário de verão no agendador; integração com o Windows só gera texto, sem consumidor. Média.
- **A06** Conectores declaram execução sem transporte real. Alta. Fora do escopo "só navegador" até haver adaptador real; não anunciar como conectado.
- **A07** Apps Vivos com fonte artificial (valor fixo "R$ 249,90", "atualizado agora"). Alta.
- **A08** Métricas fixas e recibo "verificado" sem verificação. Média. Recibo só pode dizer "verificado" quando a verificação rodou.
- **A09** Avatares: duas folhas 10×10 em vez de ativos individuais; teste de layout não prova a imagem visível. Média. Será resolvido pelos 40 mascotes (ver `docs/bots/FLUXO_UX_BOTS.md` seção 13).
- **A10** Documentos e testes regrediram (falha em `npm test` e `test:ui` na .64). Média. Na .68 o HANDOFF registra 414/414 e UI aprovada; manter a conferência a cada versão.
- **A11** Mandato aceita site por `includes` e consome uso ao avaliar. Média.
- **A12** Sem política por site para obstáculos (cookies, promoções, pop-ups). Lacuna.

### 2.2 Achados desta sessão
- **N01** No teste pareado com o neo, a tarefa 04 (checkboxes) travou 20 s numa chamada `browser_locator_action` do Navegante e nada foi salvo. Causa desconhecida. Alta, porque é o controle que todo bot usa.
- **N02** O MCP do Navegante não tem ação própria de selecionar, marcar e desmarcar; só `locator_action`. Média.
- **N03** `profiles.js` mistura perfil de pessoa e perfil de bot (`type: 'bot'`) e guarda só `id` e nome. Precisa separar para o desenho de perfis tipo Chrome.
- **N04** Aviso ao usuário só existe como evento interno e piscada da barra de tarefas; nenhum aviso do Windows nem contador. Média.
- **N05** Textos da interface ainda dizem "GrokBot", "Perfis" e "Especialistas" para bots, e usam emoji como ícone (🔒, 🛒); é o item aberto do checklist de planos. Média.
- **N06** O isolamento "por Bot" não existe: a execução usa a aba e o perfil atuais (HANDOFF). Não afirmar isolamento até haver grupo de abas por bot.

## 3. O que implementar, em ordem, com teste de sim ou não

1. **Executor real e honesto** (A01, A02, A03): sem executor real não roda; erro de passo falha; parar cancela de verdade. Teste: bot com site de teste que falha no passo 2 termina "falhou" com o que fez; parar a meio verifica que nada mais é enviado.
2. **Controle de abas confiável** (N01, N02): corrigir o travamento e criar ações de selecionar, marcar e desmarcar. Teste: tarefas 01 a 05 do benchmark passam 3 de 3 rodadas nos dois lados.
3. **Grupo de abas por bot e aba protegida do usuário** (N06). Teste: dois bots juntos sem trocar a aba um do outro e sem tocar na do usuário.
4. **Estado, conversa de colega e "fazendo agora"**, cartão de aprovação (4.2 e 4.4 do fluxo). Teste: 5 segundos; só teclado; leitor de tela.
5. **Avisos** (seção 11 do fluxo; N04): contador, barra de tarefas e aviso do Windows, horário silencioso, central de avisos. Teste: com o navegador minimizado, o aviso chega em 5 s e o clique abre o cartão certo; 10 eventos seguidos geram no máximo 1 aviso.
6. **Perfis tipo Chrome** (seção 12 do fluxo; N03): modelo com nome, cor, avatar; tela em Configurações; seletor ao abrir; convidado; exclusão com confirmação. Teste: criar, renomear, trocar e excluir sem perder o perfil principal; migração mantém `navegante-config` e a partição.
7. **40 mascotes** e criar bot em 4 passos (seção 13; A09, N05). Teste: os 40 abrem, legíveis em 32 px nos dois temas; mascote escolhido persiste após reiniciar e atualizar.
8. **Parar no login e retomar** (4.3). Teste: bot no login avisa em 5 s e retoma depois que o usuário entra.
9. **Agenda contínua com política de fechado e fuso** (A04, A05, A11). Teste: rotina diária roda 7 dias seguidos no horário; execuções perdidas rodam no máximo uma vez.
10. **Ensinar gravando**, validado do início ao fim (gravar, salvar, reiniciar, reproduzir com verificação do resultado).
11. **Sala da equipe** (4.5): pedidos entre bots com limite de 3 e sem laço.
12. **Política de obstáculos por site** (A12) e **Apps Vivos reais** (A07), só quando houver fonte comprovada.

Cada passo: mockup com a paleta azul antes de tela nova; depois `npm test`, `npm run test:ui`, `npm run test:delegation-layout` e `npm run build`; só então atualizar HANDOFF e CHECKLIST.

## 4. Migração (não pode perder dados)
- Bots atuais que são "perfis de bot" em `profiles.js` viram bots dentro do perfil principal, com cópia de segurança antes e volta possível.
- Preservar `appId` `com.wesley.navegante`, nome interno `navegante`, arquivo `navegante-config` e partição `persist:navegante`; chaves continuam em `safeStorage`.
- Mascotes antigos (folhas 10×10) mapeiam para o mascote novo mais próximo ou para "escolher de novo" sem perder o bot.

## 5. Decisões do Wesley (31/10/2026: propostas aceitas)
1. Mascote em pixel art para bots, com símbolos de traço só nas ações da interface (conflito com a 0.1.67)?
2. Primeira rotina real: resolvida em 31/10/2026, não é uma rotina única; ver `docs/bots/CASOS_DE_USO_BOTS.md` (biblioteca de modelos; primeiro validado: monitor de preço).
3. Tempos: pausar bot parado no login e expirar aprovação (proposta: 15 min); lembrete de aviso (1 h).
4. Política com o navegador fechado na hora marcada: pular, ou rodar uma vez ao abrir (proposta: rodar uma vez, com aviso).
5. Lixeira de 30 dias para perfil excluído (proposta: sim).
6. Aviso do Windows genérico por padrão, sem nome de loja nem valores (proposta: sim).
7. Limite de bots em cadeia (proposta: 3) e de abas por bot (proposta: 5).

**Situação em 31/10/2026:** o Wesley aceitou as propostas. Decididos: 1 (mascote em pixel art para identidade do bot; símbolo de traço só em ações da interface), 3 (15 min para pausar no login e expirar aprovação; lembrete de aviso em 1 h), 4 (rodar uma vez ao abrir, com aviso), 5 (lixeira de 30 dias para perfil), 6 (aviso do Windows genérico), 7 (3 bots em cadeia, 5 abas por bot). **Ainda aberto: item 2**, a primeira rotina real (Polare ou monitor de preço), que não tinha proposta; só bloqueia o passo 8 em diante da seção 3. Antes de mexer no catálogo de avatares, conferir o histórico da 0.1.67 para não desfazer o que ela preservou (identidade de upgrade).

**Atualização (31/10/2026, tarde):** o Wesley esclareceu que o Polare era só exemplo e que os bots são para todos os usuários. O item 2 está resolvido: biblioteca de 48 modelos em `docs/bots/CASOS_DE_USO_BOTS.md`, primeiro validado = monitor de preço. Os passos 8 em diante da seção 3 não esperam mais resposta do Wesley.
