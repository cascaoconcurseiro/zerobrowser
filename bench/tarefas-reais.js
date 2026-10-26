// Tarefas em sites públicos de verdade, sem login nem compra. Respostas conferidas em 2026-10-25;
// se um site mudar o conteúdo, a tarefa falha por causa do site: confira a página antes de culpar o motor.
const norm = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ok = (aprovado, motivo) => ({ aprovado: Boolean(aprovado), motivo });
const resposta = (r) => `resposta: ${String(r.mensagem || '').replace(/\s+/g, ' ').slice(0, 90)}`;
const compactarEspacos = (texto) => String(texto || '').replace(/\s+/g, ' ').trim();
const textoInicialTodoMvc = 'This is just a demo of TodoMVC for testing, not the real TodoMVC app. todos Double-click to edit a todo Created by Remo H. Jansen Part of TodoMVC';

const tarefasReais = [
  {
    id: 'r01-wikipedia-busca',
    categoria: 'busca',
    startUrl: 'https://pt.wikipedia.org/wiki/Wikip%C3%A9dia:P%C3%A1gina_principal',
    hosts: ['wikipedia.org'],
    pedido: 'Use a busca da Wikipédia para achar o artigo do Pico da Neblina e diga a altitude dele em metros.',
    verificar: (_e, r) => ok(/2[\s. ]?995/.test(r.mensagem), resposta(r))
  },
  {
    id: 'r02-livro-preco',
    categoria: 'leitura',
    startUrl: 'https://books.toscrape.com/',
    hosts: ['books.toscrape.com'],
    pedido: 'Qual é o preço do livro "A Light in the Attic"? Abra a página do livro para conferir.',
    verificar: (_e, r) => ok(/51[.,]77/.test(r.mensagem), resposta(r))
  },
  {
    id: 'r03-paginacao',
    categoria: 'navegacao',
    startUrl: 'https://quotes.toscrape.com/',
    hosts: ['quotes.toscrape.com'],
    pedido: 'Vá para a próxima página de citações e diga quem é o autor da primeira citação dela.',
    verificar: (_e, r) => ok(/marilyn monroe/.test(norm(r.mensagem)), resposta(r))
  },
  {
    id: 'r04-mais-caro-categoria',
    categoria: 'comparacao',
    startUrl: 'https://books.toscrape.com/',
    hosts: ['books.toscrape.com'],
    pedido: 'Na categoria Travel, qual é o livro mais caro? Diga o título e o preço.',
    verificar: (_e, r) => ok(/provence/.test(norm(r.mensagem)) && /56[.,]88/.test(r.mensagem), resposta(r))
  },
  {
    id: 'r05-carregamento-lento',
    categoria: 'espera',
    startUrl: 'https://the-internet.herokuapp.com/dynamic_loading/2',
    hosts: ['the-internet.herokuapp.com'],
    pedido: 'Clique em Start, espere terminar de carregar e diga o texto que aparece.',
    verificar: (_e, r) => ok(/hello world/.test(norm(r.mensagem)), resposta(r))
  },
  {
    id: 'r06-nova-janela',
    categoria: 'abas',
    startUrl: 'https://the-internet.herokuapp.com/windows',
    hosts: ['the-internet.herokuapp.com'],
    pedido: 'Clique no link "Click Here" e diga o título que aparece na página que ele abre.',
    verificar: (_e, r) => ok(/new window/.test(norm(r.mensagem)), resposta(r))
  },
  {
    id: 'r07-formulario-envio',
    categoria: 'formulario',
    startUrl: 'https://httpbin.org/forms/post',
    hosts: ['httpbin.org'],
    pedido: 'Preencha o pedido de pizza com o nome "Ana Teste", tamanho Medium e cobertura Bacon, envie o formulário e diga qual valor aparece em "size" na resposta.',
    verificar: (_e, r) => ok(r.urlFinal === 'https://httpbin.org/post' && /medium/.test(norm(r.mensagem)), `url final: ${r.urlFinal || 'nenhuma'}; ${resposta(r)}`)
  },
  {
    id: 'r08-wikipedia-leitura',
    categoria: 'leitura',
    startUrl: 'https://pt.wikipedia.org/wiki/Porto_Alegre',
    hosts: ['wikipedia.org'],
    pedido: 'Em que dia, mês e ano a Wikipédia diz que é a data oficial da fundação de Porto Alegre?',
    verificar: (_e, r) => ok(/26/.test(r.mensagem) && /marco|03/.test(norm(r.mensagem)) && /1772/.test(r.mensagem), resposta(r))
  },
  {
    id: 'r09-js-carrinho-demo',
    categoria: 'ecommerce-js',
    startUrl: 'https://demo.testautomationtv.com/products',
    hosts: ['demo.testautomationtv.com'],
    verificarPagina: true,
    capturarTextoInicial: true,
    verificarEstadoInicial: (text) => /Cart:\s*0/i.test(text),
    pedido: 'Primeiro confira se o carrinho está vazio; se já houver itens, não altere nada e me avise. Se estiver vazio, use a busca para encontrar Wireless Keyboard e adicione exatamente 2 unidades. Quando o contador mostrar 2, pare de clicar em adicionar e abra uma vez o botão acessível “View cart contents”; confira a linha Wireless Keyboard x2 e o total $99.98. Não prossiga para checkout nem pagamento.',
    limpezaAposVerificacao: {
      quando: (page, initial) => /Cart:\s*0/i.test(initial)
        && /Cart:\s*[12]/i.test(page)
        && /Wireless Keyboard\s*x[12]/i.test(page)
        && /Total:\s*\$(49\.99|99\.98)/i.test(page)
        && !/Ergonomic Mouse|Noise Cancelling Headphones|HD Webcam|Portable SSD|USB-C Charging Hub/i.test(page),
      acoes: [{ strategy: 'css', query: '[data-testid="cart-item-remove"][data-product-id="1"]', action: 'click' }],
      verificar: (text) => /Cart:\s*0/i.test(text) && /Your cart is empty\./i.test(text)
    },
    verificar: (_e, r) => {
      const page = String(r.pageText || '');
      const initialEmpty = r.initialPageRead === true && r.initialStateVerified === true;
      const count = /Cart:\s*2/i.test(page);
      const item = /Wireless Keyboard\s*x2/i.test(page);
      const total = /Total:\s*\$99\.98/i.test(page);
      const passed = initialEmpty && r.pageTextRead === true && count && item && total && r.pageCleanupVerified === true;
      return ok(passed, passed
        ? 'estado independente: carrinho começou vazio, terminou Cart 2 / Wireless Keyboard x2 / Total $99.98 e a limpeza foi confirmada'
        : `estado não confirmado: inicialVazio=${initialEmpty}, contador=${count}, itemQuantidade=${item}, total=${total}, leitura=${r.pageTextRead}, limpeza=${r.pageCleanupVerified}${r.pageTextReadError ? ` (${r.pageTextReadError})` : ''}${r.pageCleanupError ? `; limpeza: ${r.pageCleanupError}` : ''}${r.pageCloseError ? `; ${r.pageCloseError}` : ''}`);
    }
  },
  {
    id: 'r10-react-todomvc',
    categoria: 'spa-react',
    startUrl: 'https://demo.playwright.dev/todomvc/',
    hosts: ['demo.playwright.dev'],
    verificarPagina: true,
    capturarTextoInicial: true,
    verificarEstadoInicial: (text) => compactarEspacos(text) === textoInicialTodoMvc,
    pedido: 'Esta página é um demo público de teste. Só continue se a lista estiver vazia e a tela não contiver nenhuma tarefa; se já houver qualquer tarefa, não altere nada e me avise. Se estiver vazia, adicione exatamente duas tarefas com os títulos NAVEGANTE-TESTE-A-20261026 e NAVEGANTE-TESTE-B-20261026 usando Enter. Marque a primeira pelo controle checkbox “Toggle Todo” (CSS: ul.todo-list > li:first-child input.toggle); não edite nem dê duplo clique no título. Deixe a outra ativa. Pare sem apagar as tarefas; confira que as duas aparecem, o contador diz “1 item left” e aparece “Clear completed”. Não navegue para outra página.',
    limpezaAposVerificacao: {
      quando: (page, initial) => compactarEspacos(initial) === textoInicialTodoMvc
        && page.includes('NAVEGANTE-TESTE-A-20261026')
        && page.includes('NAVEGANTE-TESTE-B-20261026')
        && /1\s+item left/i.test(page)
        && /Clear completed/i.test(page),
      acoes: [1, 2].flatMap(() => [
        { strategy: 'css', query: 'ul.todo-list > li:first-child', action: 'hover' },
        { strategy: 'css', query: 'ul.todo-list > li:first-child button.destroy', action: 'click' }
      ]),
      verificar: (text) => compactarEspacos(text) === textoInicialTodoMvc
    },
    verificar: (_e, r) => {
      const page = String(r.pageText || '');
      const startedEmpty = r.initialPageRead === true && r.initialStateVerified === true;
      const exactItems = page.includes('NAVEGANTE-TESTE-A-20261026') && page.includes('NAVEGANTE-TESTE-B-20261026');
      const oneActive = /1\s+item left/i.test(page);
      const oneCompleted = /Clear completed/i.test(page);
      const passed = startedEmpty && r.pageTextRead === true && exactItems && oneActive && oneCompleted && r.pageCleanupVerified === true;
      return ok(passed, passed
        ? 'estado independente: começou vazio, deixou duas tarefas (uma ativa e uma concluída) e confirmou a limpeza'
        : `estado TodoMVC não confirmado: inicialVazia=${startedEmpty}, tarefas=${exactItems}, ativa=${oneActive}, concluída=${oneCompleted}, leitura=${r.pageTextRead}, limpeza=${r.pageCleanupVerified}${r.pageTextReadError ? ` (${r.pageTextReadError})` : ''}${r.pageCleanupError ? `; limpeza: ${r.pageCleanupError}` : ''}`);
    }
  },
  {
    id: 'r11-tabela-paginada-js',
    categoria: 'tabela-js',
    startUrl: 'https://practice.expandtesting.com/dynamic-pagination-table',
    hosts: ['practice.expandtesting.com'],
    verificarPagina: true,
    capturarTextoInicial: true,
    verificarEstadoInicial: (text) => /Showing 1 to 3 of 10 entries/i.test(text)
      && /Alice Johnson/i.test(text)
      && /Bob Williams/i.test(text)
      && /Daniel Martinez/i.test(text),
    pedido: 'Esta é uma tabela pública de demonstração, apenas para leitura. Primeiro confirme que a tabela tem 10 registros e mostra Alice Johnson, Bob Williams e Daniel Martinez na primeira página; se não, não interaja e me informe. Use o campo Search para filtrar Alice Johnson. Confirme que a busca deixa só essa linha e que a coluna Major mostra Mathematics. Pare deixando o filtro ativo e me diga o major de Alice; o verificador externo limpará o campo depois de conferir. Não edite linhas, não navegue e não use links externos.',
    limpezaAposVerificacao: {
      quando: (page) => /Showing 1 to 1 of 1 entries/i.test(page)
        && /Alice Johnson/i.test(page)
        && /Mathematics/i.test(page)
        && !/Bob Williams|Daniel Martinez/i.test(page),
      acoes: [{ strategy: 'css', query: 'input[type="search"]', action: 'fill', value: '' }],
      verificar: (text) => /Showing 1 to 3 of 10 entries/i.test(text)
        && /Alice Johnson/i.test(text)
        && /Bob Williams/i.test(text)
        && /Daniel Martinez/i.test(text)
    },
    verificar: (_e, r) => {
      const startedAsExpected = r.initialPageRead === true && r.initialStateVerified === true;
      const filteredSingleRow = /Showing 1 to 1 of 1 entries/i.test(r.pageText || '')
        && /Alice Johnson/i.test(r.pageText || '')
        && /Mathematics/i.test(r.pageText || '')
        && !/Bob Williams|Daniel Martinez/i.test(r.pageText || '');
      const restoredInitialTable = /Showing 1 to 3 of 10 entries/i.test(r.cleanupPageText || '')
        && /Alice Johnson/i.test(r.cleanupPageText || '')
        && /Bob Williams/i.test(r.cleanupPageText || '')
        && /Daniel Martinez/i.test(r.cleanupPageText || '');
      const answered = /alice johnson/i.test(norm(r.mensagem)) && /mathematics/i.test(norm(r.mensagem));
      const passed = startedAsExpected && r.pageTextRead === true && filteredSingleRow && restoredInitialTable && r.pageCleanupVerified === true && answered;
      return ok(passed, passed
        ? 'estado independente: filtrou somente Alice Johnson, confirmou Mathematics e o harness restaurou as 3 primeiras linhas'
        : `tabela não confirmada: preflight=${startedAsExpected}, filtro=${filteredSingleRow}, resposta=${answered}, tabelaRestaurada=${restoredInitialTable}, leitura=${r.pageTextRead}, limpeza=${r.pageCleanupVerified}${r.pageTextReadError ? ` (${r.pageTextReadError})` : ''}${r.pageCleanupError ? `; limpeza: ${r.pageCleanupError}` : ''}`);
    }
  },
  {
    id: 'r12-controle-assincrono-js',
    categoria: 'estado-assincrono-js',
    startUrl: 'https://practice.expandtesting.com/dynamic-controls',
    hosts: ['practice.expandtesting.com'],
    verificarPagina: true,
    capturarTextoInicial: true,
    captureInitialChecks: [{ strategy: 'css', query: '#input-example input[type="text"]', action: 'isEnabled', esperado: false }],
    verificarEstadoInicial: (text, checks = []) => /Enable/i.test(text)
      && !/It's enabled!/i.test(text)
      && checks.length === 1
      && checks[0].success === true
      && checks[0].value === false,
    pedido: 'Página pública de prática. Não toque na seção Remove/add e não digite nada. Só continue se o campo de texto em Enable/disable estiver realmente desabilitado e o botão se chamar Enable; caso contrário, pare sem alterar a página. Clique Enable, espere o estado assíncrono até aparecer “It’s enabled!” e o botão “Disable”, confirme que o campo está habilitado e pare deixando-o habilitado para a verificação externa. Não navegue.',
    limpezaAposVerificacao: {
      quando: (page) => /It's enabled!/i.test(page),
      validarAntes: [{ strategy: 'css', query: '#input-example input[type="text"]', action: 'isEnabled', esperado: true }],
      acoes: [{ strategy: 'role', query: 'button', name: 'Disable', exact: true, action: 'click' }],
      timeoutDepoisMs: 7000,
      esperarDepois: (text) => /It's disabled!/i.test(text) && /Enable/i.test(text),
      validarDepois: [{ strategy: 'css', query: '#input-example input[type="text"]', action: 'isEnabled', esperado: false }],
      verificar: (text) => /It's disabled!/i.test(text) && /Enable/i.test(text)
    },
    verificar: (_e, r) => {
      const initialDisabled = r.initialPageRead === true && r.initialStateVerified === true
        && r.initialLocatorChecks?.length === 1 && r.initialLocatorChecks[0].success === true && r.initialLocatorChecks[0].value === false;
      const enabledBeforeReset = /It's enabled!/i.test(r.pageText || '')
        && /Disable/i.test(r.pageText || '')
        && r.cleanupBeforeChecks?.length === 1
        && r.cleanupBeforeChecks[0].success === true
        && r.cleanupBeforeChecks[0].atual === true;
      const disabledAfterReset = /It's disabled!/i.test(r.cleanupPageText || '')
        && /Enable/i.test(r.cleanupPageText || '')
        && r.cleanupAfterChecks?.length === 1
        && r.cleanupAfterChecks[0].success === true
        && r.cleanupAfterChecks[0].atual === false;
      const passed = initialDisabled && r.pageTextRead === true && enabledBeforeReset && r.pageCleanupVerified === true && disabledAfterReset;
      return ok(passed, passed
        ? 'estado independente: iniciou desabilitado, ficou habilitado após espera e o harness reverteu para desabilitado'
        : `controle assíncrono não confirmado: inicialDesabilitado=${initialDisabled}, habilitadoAntesDaLimpeza=${enabledBeforeReset}, leitura=${r.pageTextRead}, limpeza=${r.pageCleanupVerified}, desabilitadoDepois=${disabledAfterReset}${r.pageCleanupError ? ` (${r.pageCleanupError})` : ''}`);
    }
  }
];

module.exports = { tarefasReais };
