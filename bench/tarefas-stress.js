// Prova de estresse determinística para uma SPA com carregamento assíncrono,
// navegação por rerender e formulário que adiciona campos conforme as escolhas.
const { norm } = require('./tarefas');

const ok = (aprovado, motivo) => ({ aprovado: Boolean(aprovado), motivo });

const tarefasStress = [
  {
    id: '45-spa-recovery',
    categoria: 'spa-script-heavy',
    pedido: 'No painel de solicitações, abra o chamado do pedido 5842 da cliente Camila Prado. Confira o número de série do equipamento na ficha e registre um reembolso de R$ 184,90 com o motivo "Produto com defeito". Aguarde a confirmação e informe o protocolo gerado.',
    verificar: (e) => {
      const r = e.reembolso;
      if (!r?.concluido) return ok(false, `reembolso não concluído; etapas: ${(e.etapas || []).join(', ') || 'nenhuma'}`);
      const valido = r.chamado === 'RA-8452'
        && r.cliente === 'Camila Prado'
        && r.pedido === '5842'
        && r.serie === 'SN-AX441-992'
        && r.tipo === 'Reembolso'
        && r.valor === '184.90'
        && norm(r.motivo) === 'produto com defeito'
        && r.protocolo === 'RB-5842-731'
        && e.etapas?.includes('detalhe:RA-8452')
        && e.etapas?.includes('formulario:Reembolso')
        && e.etapas?.includes('campo:serie')
        && e.etapas?.includes('confirmado:RB-5842-731');
      return ok(valido, `estado registrado: ${JSON.stringify(r)}`);
    },
    gabarito: {
      estado: {
        reembolso: {
          concluido: true,
          chamado: 'RA-8452',
          cliente: 'Camila Prado',
          pedido: '5842',
          serie: 'SN-AX441-992',
          tipo: 'Reembolso',
          valor: '184.90',
          motivo: 'Produto com defeito',
          protocolo: 'RB-5842-731'
        },
        etapas: ['detalhe:RA-8452', 'formulario:Reembolso', 'campo:serie', 'confirmado:RB-5842-731']
      }
    }
  },
  {
    id: '46-spa-async-search',
    categoria: 'spa-script-heavy',
    pedido: 'No painel financeiro, localize a fatura pendente de Bosque Digital, contrato BD-904, referente a maio de 2026, no valor de R$ 2.480,00. Abra os detalhes, confira os dados e aprove a fatura. Aguarde a confirmação do painel.',
    verificar: (e) => {
      const a = e.aprovacao;
      if (!a?.concluida) return ok(false, `aprovação não confirmada; etapas: ${(e.etapas || []).join(', ') || 'nenhuma'}`);
      const valido = a.fatura === 'F-2026-1847'
        && a.cliente === 'Bosque Digital'
        && a.contrato === 'BD-904'
        && a.competencia === '2026-05'
        && a.valor === '2480.00'
        && a.statusAnterior === 'Pendente'
        && a.statusFinal === 'Aprovada'
        && a.protocolo === 'AP-1847-5206'
        && e.etapas?.includes('detalhe:F-2026-1847')
        && e.etapas?.includes('confirmado:AP-1847-5206');
      return ok(valido, `estado registrado: ${JSON.stringify(a)}`);
    },
    gabarito: {
      estado: {
        aprovacao: {
          concluida: true,
          fatura: 'F-2026-1847',
          cliente: 'Bosque Digital',
          contrato: 'BD-904',
          competencia: '2026-05',
          valor: '2480.00',
          statusAnterior: 'Pendente',
          statusFinal: 'Aprovada',
          protocolo: 'AP-1847-5206'
        },
        etapas: ['detalhe:F-2026-1847', 'confirmado:AP-1847-5206']
      }
    }
  },
  {
    id: '47-spa-loja-carrinho',
    categoria: 'spa-ecommerce',
    pedido: 'Na loja de demonstração, encontre o Fone Aurora X Pro. Use a busca e os filtros para conferir que ele está na categoria Áudio, é da marca Aurora e custa menos de R$ 800. Abra as opções do produto, escolha a cor Preto e a conexão Bluetooth 5.3. Adicione 2 unidades ao carrinho e confira o carrinho.',
    verificar: (e) => {
      const item = e.carrinho?.itens?.[0];
      if (!item) return ok(false, `carrinho não registrado; etapas: ${(e.etapas || []).join(', ') || 'nenhuma'}`);
      const valido = e.carrinho.itens.length === 1
        && item.sku === 'AUR-XP-BLK-53'
        && item.produto === 'Fone Aurora X Pro'
        && item.marca === 'Aurora'
        && item.categoria === 'Áudio'
        && item.cor === 'Preto'
        && item.conexao === 'Bluetooth 5.3'
        && item.quantidade === 2
        && item.precoUnitario === '749.90'
        && item.subtotal === '1499.80'
        && e.etapas?.includes('busca:aurora')
        && e.etapas?.includes('filtro:audio-aurora-ate-800')
        && e.etapas?.includes('variante:AUR-XP-BLK-53')
        && e.etapas?.includes('carrinho:AUR-XP-BLK-53:2');
      return ok(valido, `estado registrado: ${JSON.stringify(e.carrinho)}`);
    },
    gabarito: {
      estado: {
        carrinho: {
          itens: [{
            sku: 'AUR-XP-BLK-53',
            produto: 'Fone Aurora X Pro',
            marca: 'Aurora',
            categoria: 'Áudio',
            cor: 'Preto',
            conexao: 'Bluetooth 5.3',
            quantidade: 2,
            precoUnitario: '749.90',
            subtotal: '1499.80'
          }]
        },
        etapas: ['busca:aurora', 'filtro:audio-aurora-ate-800', 'variante:AUR-XP-BLK-53', 'carrinho:AUR-XP-BLK-53:2']
      }
    }
  }
];

module.exports = { tarefasStress };
