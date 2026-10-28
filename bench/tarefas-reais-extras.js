// Categorias difíceis que a suíte pública não cobria: SPA com login, cadastro, carrinho, app de RH e e-mail.
// Regra: cadastro/e-mail só em sites feitos para teste (QA playgrounds) e e-mail descartável — nada de conta falsa
// em serviço real de terceiros.
const norm = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const compactar = (texto) => String(texto || '').replace(/\s+/g, ' ').trim();
const ok = (aprovado, motivo) => ({ aprovado: Boolean(aprovado), motivo });
const resposta = (r) => `resposta: ${compactar(r.mensagem).slice(0, 140)} | texto: ${String(r.pageText || '').length} chars${String(r.pageText || '').trim() ? ` | trecho: ${compactar(r.pageText).slice(0, 160)}` : ' (vazio)'}`;

const stamp = Date.now().toString(36).slice(-7);
const email = `zb.${stamp}@yopmail.com`;
const inboxTo = `zbto.${stamp}`;
const assunto = `Teste Zero Browser ${stamp}`;
const funcionario = `Zeta${stamp}`;

const tarefasReaisExtras = [
  {
    id: 'e01-saucedemo-carrinho',
    categoria: 'spa-login-carrinho',
    startUrl: 'https://www.saucedemo.com/',
    credenciais: true,
    hosts: ['saucedemo.com', 'www.saucedemo.com'],
    verificarPagina: true,
    pedido: 'Entre com o usuário standard_user e a senha secret_sauce. Adicione ao carrinho o produto "Sauce Labs Backpack" e abra o carrinho. Diga o nome do produto e o preço que aparecem no carrinho.',
    verificar: (_e, r) => ok(
      /sauce labs backpack/i.test(norm(r.mensagem)) && /29[.,]99/.test(r.mensagem),
      resposta(r)
    )
  },
  {
    id: 'e02-automationexercise-cadastro',
    categoria: 'cadastro',
    startUrl: 'https://automationexercise.com/signup',
    credenciais: true,
    hosts: ['automationexercise.com', 'www.automationexercise.com'],
    verificarPagina: true,
    pedido: `Crie uma conta nova com o nome "Zero Tester", e-mail "${email}", senha "Zb!${stamp}", primeiro nome "Zero", sobrenome "Tester", endereço "Rua Teste 1", país "India", estado "SP", cidade "Sao Paulo", CEP "01000-000" e telefone "11999999999". Depois de criar, diga a mensagem de confirmação que aparece na tela.`,
    verificar: (_e, r) => ok(/account created/i.test(norm(r.mensagem)) || /account created/i.test(norm(r.pageText)), resposta(r))
  },
  {
    id: 'e03-automationexercise-carrinho',
    categoria: 'carrinho',
    startUrl: 'https://automationexercise.com/products',
    hosts: ['automationexercise.com', 'www.automationexercise.com'],
    verificarPagina: true,
    pedido: 'Adicione ao carrinho o primeiro produto da lista, abra o carrinho e diga o nome do produto e a quantidade que aparece na linha do carrinho.',
    verificar: (_e, r) => {
      const texto = norm(r.mensagem);
      const carrinho = norm(r.pageText);
      return ok(/carrinho|cart/i.test(texto) && /\b1\b/.test(texto) && (carrinho.includes('cart') || carrinho.includes('carrinho')), resposta(r))
    }
  },
  {
    id: 'e04-orangehrm-funcionario',
    categoria: 'app-rh-spa',
    startUrl: 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login',
    credenciais: true,
    hosts: ['opensource-demo.orangehrmlive.com'],
    verificarPagina: true,
    pedido: `Entre com usuário "Admin" e senha "admin123". Vá em PIM > Add Employee, cadastre o funcionário com primeiro nome "${funcionario}" e sobrenome "Teste", salve e diga o nome completo que aparece na página do funcionário.`,
    verificar: (_e, r) => ok(norm(r.mensagem).includes(norm(funcionario)), resposta(r))
  },
  {
    id: 'e05-yopmail-envio',
    categoria: 'email',
    startUrl: `https://yopmail.com/en/?login=${encodeURIComponent(email.split('@')[0])}`,
    hosts: ['yopmail.com', 'www.yopmail.com'],
    verificarPagina: true,
    pedido: `Nesta caixa de e-mail descartável, escreva um e-mail para "${inboxTo}@yopmail.com" com o assunto "${assunto}" e o corpo "Teste automatizado do Zero Browser". Envie e depois abra a caixa "${inboxTo}" para confirmar que o assunto aparece na lista. Diga o assunto que você viu.`,
    verificar: (_e, r) => ok(norm(r.mensagem).includes(norm(assunto)) || norm(r.pageText).includes(norm(assunto)), resposta(r))
  },
  {
    id: 'e06-google-sheets',
    categoria: 'planilha',
    startUrl: 'https://docs.google.com/spreadsheets/create',
    hosts: ['docs.google.com'],
    verificarPagina: false,
    pedido: `Crie uma planilha nova e, nela, grave o texto "ZB-${stamp}" na célula A1 e o número 42 em B1 usando a ferramenta sheets. Depois leia o intervalo A1:B1 e diga exatamente o que voltou.`,
    verificar: (_e, r) => {
      const texto = compactar(r.mensagem);
      return ok(texto.includes(`ZB-${stamp}`) && /\b42\b/.test(texto), resposta(r))
    }
  }
];

module.exports = { tarefasReaisExtras, emailTeste: email, assuntoTeste: assunto };
