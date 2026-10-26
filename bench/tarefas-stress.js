// Prova de estresse determinística para uma SPA com carregamento assíncrono,
// navegação por rerender e formulário que adiciona campos conforme as escolhas.
const { norm } = require('./tarefas');

const ok = (aprovado, motivo) => ({ aprovado: Boolean(aprovado), motivo });

const PLANILHA_ID = '48-spreadsheet-grid';
const PLANILHA_ALVO = { id: 'P-1021', projeto: 'Projeto 21 - Lago Azul', unidades: 3, valorUnitario: 125 };
const planilhaInicial = {
  schema: 1,
  tarefa: PLANILHA_ID,
  rows: Array.from({ length: 60 }, (_, index) => {
    const numero = index + 1;
    return {
      id: `P-${String(1000 + numero).padStart(4, '0')}`,
      projeto: `Projeto ${String(numero).padStart(2, '0')} - ${['Lago Azul', 'Ipê', 'Serra Clara', 'Vale Verde', 'Canto Norte'][index % 5]}`,
      equipe: ['Norte', 'Sul', 'Leste', 'Oeste'][index % 4],
      unidades: 1 + ((index * 7) % 4),
      valorUnitario: 90 + ((index * 37) % 150)
    };
  })
};
planilhaInicial.rows[20] = { ...PLANILHA_ALVO, equipe: 'Norte' };

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
  },
  {
    id: PLANILHA_ID,
    categoria: 'spa-planilha-virtualizada',
    estadoInicial: planilhaInicial,
    pedido: 'Esta é uma planilha local de demonstração, com dados sintéticos. Localize o projeto P-1021, Projeto 21 - Lago Azul. Altere Unidades de 3 para 8; aguarde o estado “Alterações salvas” porque a grade vai ordenar novamente. Depois localize o mesmo código e altere Valor unitário de 125 para 260. Aguarde o salvamento e confira que Total calculado mostra 2.080. Não edite outros projetos nem tente alterar a célula Total, que é fórmula calculada.',
    verificar: (e) => {
      const initial = e.estadoInicial;
      const final = e.estadoFinal;
      if (!initial || !final) return ok(false, 'estado independente inicial ou final ausente');
      const initialMatches = JSON.stringify(initial) === JSON.stringify(planilhaInicial);
      const initialById = new Map(initial.rows.map((row) => [row.id, row]));
      const finalById = new Map((final.rows || []).map((row) => [row.id, row]));
      const targetStart = initialById.get(PLANILHA_ALVO.id);
      const target = finalById.get(PLANILHA_ALVO.id);
      const exactRows = initial.rows.length === 60
        && finalById.size === 60
        && initial.rows.every((row) => {
          const actual = finalById.get(row.id);
          if (!actual) return false;
          const expected = row.id === PLANILHA_ALVO.id
            ? { ...row, unidades: 8, valorUnitario: 260 }
            : row;
          return actual.unidades === expected.unidades
            && actual.valorUnitario === expected.valorUnitario
            && actual.total === expected.unidades * expected.valorUnitario;
        });
      const saves = Array.isArray(final.saves) ? final.saves : [];
      const unitSnapshotEsperado = Object.fromEntries(initial.rows.map((row) => [row.id, {
        unidades: row.id === PLANILHA_ALVO.id ? 8 : row.unidades,
        valorUnitario: row.valorUnitario,
        total: row.id === PLANILHA_ALVO.id ? 1000 : row.unidades * row.valorUnitario
      }]));
      const priceSnapshotEsperado = Object.fromEntries(initial.rows.map((row) => [row.id, {
        unidades: row.id === PLANILHA_ALVO.id ? 8 : row.unidades,
        valorUnitario: row.id === PLANILHA_ALVO.id ? 260 : row.valorUnitario,
        total: row.id === PLANILHA_ALVO.id ? 2080 : row.unidades * row.valorUnitario
      }]));
      const unitSave = saves.find((save) => save.rowId === PLANILHA_ALVO.id && save.field === 'unidades'
        && save.from === 3 && save.to === 8 && save.snapshot?.[PLANILHA_ALVO.id]?.unidades === 8
        && save.snapshot?.[PLANILHA_ALVO.id]?.valorUnitario === 125
        && JSON.stringify(save.snapshot) === JSON.stringify(unitSnapshotEsperado));
      const priceSave = saves.find((save) => save.rowId === PLANILHA_ALVO.id && save.field === 'valorUnitario'
        && save.from === 125 && save.to === 260 && save.snapshot?.[PLANILHA_ALVO.id]?.unidades === 8
        && save.snapshot?.[PLANILHA_ALVO.id]?.valorUnitario === 260
        && save.snapshot?.[PLANILHA_ALVO.id]?.total === 2080
        && JSON.stringify(save.snapshot) === JSON.stringify(priceSnapshotEsperado));
      const distinctSaves = Boolean(unitSave && priceSave && unitSave.revision === 1 && priceSave.revision === 2);
      const expectedOrder = [...finalById.values()].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).map((row) => row.id);
      const sorted = Array.isArray(final.order) && JSON.stringify(final.order) === JSON.stringify(expectedOrder)
        && final.order[0] === PLANILHA_ALVO.id;
      const passed = initialMatches && targetStart?.unidades === 3 && targetStart?.valorUnitario === 125
        && target?.unidades === 8 && target?.valorUnitario === 260 && target?.total === 2080
        && exactRows && distinctSaves && saves.length === 2 && final.saveCount === saves.length && sorted;
      return ok(passed, passed
        ? 'estado independente: seed intacto, somente P-1021 mudou, dois autosaves separados foram persistidos, fórmula totalizou 2.080 e a ordenação colocou a linha no topo'
        : `planilha não confirmada: seed=${initialMatches}, linha=${target?.unidades}/${target?.valorUnitario}/${target?.total}, demaisLinhasIntactas=${exactRows}, savesSeparados=${distinctSaves}, saveCount=${final.saveCount}, ordem=${sorted}`);
    }
  }
];

module.exports = { tarefasStress };
