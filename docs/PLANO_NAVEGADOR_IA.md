# Plano — Navegante como navegador principal com IA

Objetivo: usar o Navegante no dia a dia (no lugar do Brave/Chrome) com um agente que acerta mais, responde mais rápido e gasta menos tokens. Cada fase termina com teste automático e, quando mexe no agente, com rodada do benchmark (`npm run bench`) para provar que melhorou.

## Fase 1 — Usável como navegador do dia a dia
- Favoritos: barra de favoritos, estrela na barra de endereço, gerenciador (pastas, busca, editar, excluir).
- Importar favoritos do Brave, Chrome e Edge (arquivo `Bookmarks` local) e de arquivo HTML exportado.
- Histórico com busca, e sugestões na barra de endereço (histórico + favoritos + abas abertas).
- Abas: restaurar sessão ao abrir, reabrir aba fechada (Ctrl+Shift+T), fixar, silenciar, duplicar, arrastar para reordenar, menu de clique direito.
- Atalhos padrão (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab, Ctrl+1..9, Ctrl+F para buscar na página).
- Navegador padrão do Windows (registrar como opção nas Configurações do Windows).

## Fase 2 — Painel do agente no estilo Claude in Chrome
- Painel lateral com conversa, caixa de texto embaixo, botão de parar, indicador "trabalhando na aba X".
- Cada passo do agente aparece como linha compacta (clicou em…, digitou…, leu…), expansível.
- Aprovação de ação perigosa dentro do painel (não em diálogo solto).
- Ícones novos e consistentes (um conjunto só, traço fino), sem o robô atual.
- Histórico de conversas por aba e atalho para abrir o painel (Ctrl+E).

## Fase 3 — Configurações completas
- Seções: Geral, Aparência, Privacidade, Downloads, Agente, Conexões MCP, Desenvolvedor.
- Agente: provedor, modelo, limite de passos, modo de aprovação, sites onde o agente nunca age, orçamento de tokens por tarefa.
- Conexões MCP: mostrar o comando pronto para Claude Code/Desktop, status da ponte (ligada, clientes conectados), lista de ferramentas expostas, ligar/desligar cada uma.
- Exportar/importar configurações.

## Fase 4 — Visão completa da página
- Snapshot único que junta árvore de acessibilidade + iframes + shadow DOM (inclusive fechado, via CDP `DOM.getDocument` com `pierce`).
- Captura de tela anotada com números nos elementos clicáveis, usada só quando o texto não basta (canvas, imagens, mapas, gráficos).
- Leitura de conteúdo fora da tela (rolagem infinita, listas virtuais) sem precisar rolar à mão.
- Medida: tarefas 34 (iframe), 35 (shadow DOM), 36 (menu hover) e 37 (rolagem infinita) do benchmark difícil.

## Fase 5 — Economia de tokens e velocidade
- Mandar só o que mudou na página entre um passo e outro (diff do snapshot), em vez da página inteira toda vez.
- Resumir passos antigos da conversa em vez de reenviar tudo.
- Cache de prompt do provedor (prefixo fixo de instruções e ferramentas).
- Ações em lote (preencher vários campos numa chamada).
- Meta: cair de ~80 mil para menos de 20 mil tokens por tarefa, sem perder acerto no benchmark.

## Fora do escopo
- Burlar CAPTCHA ou esconder que é automação. O agente pausa e pede para você resolver.
- Criar um motor próprio tipo Brave (Chromium compilado). Continua em Electron; bloqueio de anúncios pode entrar depois como fase própria.
