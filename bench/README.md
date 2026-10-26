# Benchmark do agente

Tarefas em páginas locais (21 básicas em `tarefas.js`, 14 difíceis em `tarefas-dificeis.js` e 3 fluxos SPA numerados 45–47) rodam em `127.0.0.1`. Cada tarefa tem um pedido, uma página e um verificador automático. A suíte cobre formulários, tabelas, iframes, shadow DOM, hover, rolagem infinita, múltiplas abas, arquivos e estado dinâmico. Inspirado no BrowserGym.

## Rodar

1. Abra o Zero Browser com a chave do provedor salva e um modelo escolhido.
2. No terminal, dentro da pasta do projeto:

```bash
npm run bench -- nome-da-rodada
```

O relatório sai em `bench/resultados/nome-da-rodada__DATA.md` (e `.json` com o passo a passo de cada tarefa).

Opções:

- `--motor=flame`: quem faz as tarefas é o Flame (a extensão carregada dentro do Zero Browser), para comparar com o agente do Zero Browser (padrão legado `navegante`). O Flame não informa tokens.
- `--conjunto=dificeis`: só as 14 tarefas difíceis (31 a 44; 42 e 43 baixam e enviam arquivos de `paginas/arquivos/`). `basico` roda as originais; o padrão `todos` roda as duas.
- `--conjunto=reais`: tarefas públicas sem autenticação em `tarefas-reais.js`; hoje inclui Wikipédia, Books/Quotes to Scrape, The Internet, httpbin, demos JavaScript de loja/TodoMVC/tabela dinâmica e controles assíncronos. Precisa de internet. Cada tarefa só pode abrir HTTPS nos hosts permitidos (`public-sites`); credenciais e dados de pagamento não são aprovados. Demos e sites de prática não representam sites de produção. Se uma falhar, confira primeiro se o site mudou.
- `--conjunto=stress --tarefas=47 --repeticoes=3`: roda a loja de demonstração SPA em `127.0.0.1`, sem compras reais. A busca usa debounce e latência variável para respostas fora de ordem; filtros, modal de variantes, rerender e carrinho são validados por um endpoint de estado separado. O sucesso exige SKU, variante, quantidade e preço/subtotal exatos; a mensagem final não conta como prova.
- `npm run test:bench-store`: integração Electron da fixture 47, cobrindo busca, filtros, seleção de variantes, carrinho e verificador de estado local sem chamar um modelo.
- Observação automática após ações suportadas fica ligada por padrão. Use `--no-observe` para comparar sem ela; `--observe` continua aceito para deixar a opção explícita.
- `--tarefas=07,10`: roda só as tarefas que começam com esses números.
- `--repeticoes=3`: repete cada tarefa (o modelo nem sempre faz igual).
- `--max-passos=20`: limite de ações por tarefa (máximo 40).
- `--data-dir=PASTA`: use quando o Zero Browser roda com outra pasta de dados.
- `--servidor`: só sobe as páginas e mostra os endereços, para abrir à mão.
- `--comparar A.json B.json`: mostra o que mudou entre duas rodadas.

## Segurança durante o benchmark

Páginas locais usam `local-fixture`; sites públicos usam `public-sites` com allowlist HTTPS por tarefa. Tarefas públicas com verificação de página exigem preflight quando definido, conferência de estado e limpeza quando configurada. O benchmark não aprova credenciais, códigos ou pagamentos. A aba é fechada ao fim. O texto digitado não vai para o trace; só o tamanho é registrado.

## Usar por outro cliente MCP

```bash
claude mcp add navegante -- node scripts/mcp-stdio.js
```

A ferramenta `run_task` recebe `startUrl`, `prompt`, `maxSteps` e `approvalPolicy` (`ask`, `local-fixture` ou `deny`).
