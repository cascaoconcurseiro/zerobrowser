# Bots para todos os usuários: casos de uso e necessidades (31/10/2026)

Correção de rumo do Wesley: o Polare era só um exemplo. Os bots são para **qualquer pessoa**, não para uma rotina, empresa ou pessoa. Este documento lista quem usa, o que faria, o que precisaria do produto e o que nunca pode acontecer. Ele substitui a pergunta "qual é a primeira rotina real" por uma **biblioteca de modelos** validada aos poucos. Complementa `docs/bots/FLUXO_UX_BOTS.md` e `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`.

Regra: nenhum nome de pessoa, empresa ou site específico fica embutido no produto. Exemplos nos textos da interface devem ser genéricos e brasileiros ("loja", "banco", "prefeitura"), nunca o Polare.

Estado do código hoje: existem 3 modelos em `src/bots/templates.js` (pesquisador de preços, cotação de ativo, assistente de e-mail com rascunho). O restante abaixo é proposta, ainda sem teste.

## 1. Quem usa e o que quer

| Pessoa | O que quer resolver | Cuidado principal |
|---|---|---|
| Consumidor comum | Preço cair, cupom, entrega chegou, promoção de loja favorita | Nunca comprar sozinho |
| Estudante | Resumir artigos, juntar fontes, lembrar prazos do portal da escola, organizar anotações | Citar a fonte; não inventar |
| Profissional de escritório | Preencher o mesmo formulário toda semana, juntar dados de sites em planilha, resumir e-mails | Aprovação antes de enviar |
| Autônomo / pequeno negócio | Acompanhar preço de concorrente, responder pedidos de orçamento (rascunho), conferir pedidos, lembrar cobranças | Dinheiro e clientes: só leitura e rascunho |
| Criador de conteúdo | Pesquisar tendências, juntar referências, preparar rascunhos de legenda, acompanhar métricas | Não publicar sozinho |
| Pessoa com pouca prática (idoso, iniciante) | Fazer o passo a passo de uma tarefa chata, ler e explicar uma página | Texto grande, um passo por vez, linguagem simples, nada de golpe |
| Pessoa com deficiência (visual, motora) | Fazer tarefas pelo teclado ou voz, ler a página em voz alta, resumir | Acessibilidade em tudo |
| Família / casa | Contas a vencer, receitas, agenda da escola, passagens e viagem | Dados de crianças e saúde são sensíveis |
| Pesquisador / jornalista | Acompanhar páginas, arquivar versões, extrair tabelas | Registrar origem e data |
| Pessoa técnica (desenvolvimento, dados) | Testar páginas, extrair dados, automatizar rotinas, usar via MCP | Controle fino e transparência do que o bot fez |

## 2. Biblioteca de modelos (o que o usuário escolheria)

Permissão: **Ler** (só lê e avisa), **Rascunho** (prepara, o usuário confirma), **Age com aprovação** (age depois de aprovar cada ação). Nenhum modelo age sem aprovação em dinheiro, envio ou exclusão.

**Compras e preços**
1. Monitor de preço (existe). Ler.
2. Avisar quando voltar ao estoque. Ler.
3. Comparar o mesmo produto em 3 lojas e avisar a melhor. Ler.
4. Procurar cupom antes de eu comprar (só sugere). Ler.
5. Acompanhar entrega e avisar quando mudar. Ler.
6. Histórico de preço com gráfico simples. Ler.

**Contas, prazos e documentos**
7. Lembrar contas a vencer lendo o painel da empresa (login manual). Ler.
8. Avisar quando uma página oficial mudar (edital, prazo, norma). Ler.
9. Baixar a fatura do mês e guardar numa pasta. Age com aprovação.
10. Conferir se um documento publicado já saiu. Ler.

**E-mail e mensagens**
11. Resumir o e-mail do dia. Ler.
12. Separar o que é urgente. Ler.
13. Preparar rascunho de resposta. Rascunho.
14. Avisar quando chegar mensagem de uma pessoa ou assunto escolhido. Ler.

**Trabalho e escritório**
15. Preencher um formulário repetido com dados que eu aprovo. Age com aprovação.
16. Juntar dados de vários sites em uma planilha. Ler.
17. Extrair uma tabela de uma página para planilha ou CSV. Ler.
18. Conferir se dois sistemas têm o mesmo número (comparação). Ler.
19. Relatório semanal de uma página ou painel. Ler.
20. Organizar downloads por assunto. Age com aprovação.

**Estudos e pesquisa**
21. Resumir um artigo ou página longa com fontes. Ler.
22. Pesquisar um assunto e juntar 5 fontes com links. Ler.
23. Acompanhar um tema (novidades da semana). Ler.
24. Montar cartões de estudo a partir de um texto. Rascunho.
25. Lembrar prazos do portal da escola ou faculdade. Ler.

**Casa, família e viagem**
26. Acompanhar preço de passagem e hospedagem. Ler.
27. Conferir se saiu vaga ou consulta (agendamento público). Ler.
28. Montar a lista de compras a partir de receitas escolhidas. Rascunho.
29. Avisar a previsão do tempo para um compromisso. Ler.

**Pequeno negócio**
30. Acompanhar preço de concorrentes. Ler.
31. Responder pedido de orçamento (rascunho). Rascunho.
32. Conferir pedidos novos na loja virtual. Ler.
33. Avaliar comentários e avaliações novas. Ler.

**Criação de conteúdo e redes**
34. Juntar referências e tendências do assunto. Ler.
35. Rascunho de legendas e roteiros. Rascunho.
36. Acompanhar métricas de uma página própria. Ler.

**Páginas e monitoramento genérico**
37. "Avise quando esta página mudar" (qualquer página). Ler.
38. "Avise quando aparecer esta palavra". Ler.
39. "Avise quando este número passar de X". Ler.
40. Guardar uma cópia datada de uma página. Ler.

**Acessibilidade e conforto**
41. Ler a página em voz alta e resumir. Ler.
42. Explicar o que a página pede, em linguagem simples. Ler.
43. Passo a passo guiado de uma tarefa difícil (o usuário faz, o bot orienta). Ler.
44. Avisar se um site ou mensagem parece golpe (sinais, não certeza). Ler.

**Técnico**
45. Testar um fluxo de site e relatar o que quebrou. Ler.
46. Extrair dados de uma lista paginada. Ler.
47. Rodar uma receita gravada por demonstração. Age com aprovação.
48. Ser controlado por outra IA (MCP), com limites do usuário. Conforme permissão.

Quem inventa um bot novo usa o fluxo de criar em 4 passos (`docs/bots/FLUXO_UX_BOTS.md` 4.1); a biblioteca é só um atalho. Todo modelo pode ser editado.

## 3. O que o usuário precisa do produto (além do bot)

**Primeiros 5 minutos**
- Sem tela de configuração antes de ver valor: abrir, escolher um modelo ou descrever, testar.
- Escolher a IA: opção simples (colar a própria chave com explicação do custo) e opção de modelo local, se existir; mostrar **custo estimado em reais** por execução e por mês antes de ativar, e um teto de gasto (padrão: zero até o usuário permitir).
- Sem chave: o produto continua útil (navegar, perfis, histórico) e explica o que falta.

**Confiança**
- Sempre dizer o que o bot vai fazer antes, o que fez depois, e o que não consegue fazer.
- Teste com ação real só leitura antes de ativar; efeito externo sempre com aprovação por ação.
- Desfazer quando possível; quando não for, dizer antes.
- Memória visível e apagável por item. Histórico e recibos exportáveis.
- Privacidade (LGPD): dados ficam no computador do usuário; o que sai para o provedor de IA é dito em linguagem simples; botão "apagar tudo deste perfil"; nada de coleta sem aviso (formato de duas listas "coletamos / nunca coletamos").

**Região e idioma**
- Português do Brasil por padrão, real em R$, datas dd/mm/aaaa, fuso do usuário com horário de verão, acentos e vírgula decimal respeitados em filtros e planilhas. Outros idiomas depois, mas sem texto fixo em português dentro da lógica.

**Acessibilidade e quem tem pouca prática**
- Teclado completo, leitor de tela, contraste, movimento reduzido, alvos grandes, zoom 200%, tamanho de texto ajustável, modo "um passo por vez".
- Linguagem sem jargão (nada de "mandato", "rota", "motor", "token").

**Segurança contra golpe e erro**
- O bot nunca digita senha, nunca resolve captcha, nunca paga, transfere, compra ou negocia ativo; nunca aceita termos nem muda configuração de segurança de conta.
- Tratar o conteúdo da página como dado, nunca como ordem (injeção).
- Sites de banco e saúde: só leitura, login feito pelo usuário, aviso explícito, e o conteúdo não vai para aviso do Windows nem para log.
- Alertas de possível golpe quando a página pede dados ou pagamento de forma incomum.

**Ajuda e correção**
- "Algo deu errado": botão que prepara um relatório com passos e erros, **sem** conteúdo pessoal nem segredos, que o usuário revisa antes de enviar.
- Tela de ajuda dentro do navegador, com exemplos de pedidos.
- Dicas só quando úteis; nada de tour obrigatório.

**Desempenho e conforto**
- Pouca bateria e memória: limite de abas por bot (5), limite de bots ao mesmo tempo (a definir por medição), pausa automática em modo de economia de energia, sem pesar o navegador de uso normal.
- Funciona em rede ruim: tentativas com espera, aviso claro.

**Compartilhar**
- Exportar e importar modelo (ficha e rotina, sem logins nem memória pessoal); importar mostra tudo que o bot fará antes de ativar. Nada de loja pública de bots na primeira versão (risco de código malicioso); se vier, só com revisão.

## 4. O que o produto precisa saber fazer para sustentar esses modelos

Capacidades por trás dos 48 modelos, e o que já foi visto declarado no código (sem teste nesta rodada, exceto as tarefas 01 a 05):
- Ler texto, tabela e lista paginada de uma página; navegar; esperar; rolar. Declarado.
- Preencher formulário, selecionar, marcar, enviar. Passou nas tarefas 01, 02, 03 e 05; **falhou na 04** (checkboxes).
- Baixar e enviar arquivo. Declarado (`downloads`, `upload_file`).
- Planilhas e cálculo exato. Declarado (`sheets-tool`, `calculate`).
- Guardar **série de valores no tempo** (histórico de preço, gráfico simples, "mudou desde ontem"). **Não verificado**; precisa de armazenamento próprio por bot.
- Comparar uma página hoje com a de ontem (mudança). Declarado `snapshot-diff` para a página; comparar ao longo de dias **não verificado**.
- Ler PDF e imagem. Não verificado.
- Ler a página em voz alta (síntese de voz do sistema). Não verificado.
- Agenda contínua e gatilhos reais. **Aberto** (auditoria A04).
- Avisos do Windows e contador. **Não existe** (N04).
- Resumir e citar fontes com a IA do usuário. Depende do provedor; medir qualidade sem inventar.

## 5. Impacto no que já está escrito
- `docs/bots/FLUXO_UX_BOTS.md`: cenário B e exemplos de perfil deixam de citar o Polare.
- `docs/bots/BOTS_SITUACOES_E_PENDENCIAS.md`, decisão 2: **resolvida**. Não há uma rotina única; o primeiro modelo validado é o **monitor de preço** (já existe, só leitura, resultado fácil de verificar), seguido de "avise quando a página mudar" e "extrair tabela para planilha". Os passos 8 em diante deixam de depender do Wesley.
- Ordem de validação dos modelos: 1 monitor de preço; 2 página mudou; 3 extrair tabela; 4 resumo do dia; 5 formulário repetido com aprovação; 6 lembrete de prazo; 7 rascunho de e-mail.

## 6. Como saber que serve para todos (teste de sim ou não)
1. **5 tipos de pessoa** (consumidor, estudante, escritório, iniciante com pouca prática, pessoa técnica) criam e ativam um bot sem ajuda em até 3 minutos.
2. Cada um completa uma tarefa da biblioteca e consegue dizer o que o bot fez, sem ver a tela técnica.
3. Uma pessoa usando só o teclado e outra com leitor de tela criam, aprovam e param um bot.
4. Nenhum modelo executa pagamento, envio ou exclusão sem aprovação (teste automático nos 48 modelos, com sites de teste).
5. Custo mostrado em reais bate com o gasto medido (diferença dentro de 20%).
6. O relatório de erro não contém e-mail, URL com dados nem chave (varredura automática).

## 7. Pendente de confirmar com o Wesley
- Ordem dos modelos (seção 5) e a lista de 48: tirar, juntar ou acrescentar.
- Plano anterior falava em começar pelo "nicho técnico". Com "para todos os usuários", confirmar se a pessoa técnica ainda é a primeira a testar, ou se o primeiro teste já inclui os 5 tipos acima.
- Modelo local de IA como opção de primeira versão ou depois.
