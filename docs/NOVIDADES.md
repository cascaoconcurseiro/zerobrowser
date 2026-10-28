# Novidades — Zero Browser 0.1.6-dev

Versão de desenvolvimento com foco no motor de IA e em sites difíceis (planilhas, canvas, editores).

## Motor de IA

- **Pós-condições verificadas** em `run_steps`: cada passo pode declarar `expect` (texto, URL, ausência) e o host
  confere antes de seguir.
- **Journal de efeitos**: envio/compra/exclusão não se repetem às cegas; falha com efeito desconhecido exige ler a
  página. Agora só efeito crítico entra no journal, o que removeu o custo em cliques comuns.
- **Risco por capacidade**: aprovação por credencial/destrutivo/compromisso/escrita, com motivo específico no
  diálogo. "Minha conta" e "Meus pedidos" deixaram de pedir aprovação.
- **Verificação por contrato**: a tarefa só é declarada concluída com prova de estado (`url`, `text`, `absent`,
  `textCount`, `download`). O agente pode consultar com `check_task` e receber uma rodada de correção.
- **Extração estruturada**: `extract_table` lê tabelas como linhas com colunas nomeadas e proveniência;
  `read_batch` com `extract` faz o mesmo em todas as abas da tarefa, em paralelo.
- **Receitas por site**: sequências estáveis executadas sem modelo, com schema de entrada (`{{campo}}`) e
  `possibleCommit` para dizer "leia antes de repetir".

## Sites difíceis

- **Clipboard**: ler/gravar texto e TSV para colar uma tabela inteira de uma vez.
- **Sequências de teclado**: setas ×N, Tab, F2, Ctrl+seta, para navegar em grades sem clicar em célula.
- **Clique visual**: `visual_click` em coordenadas 0–1000 da captura, para o que só existe na imagem.
- **Acessibilidade do Planilhas**: alterna o modo de leitor de tela (Ctrl+Alt+Z) para tentar expor células.

## Navegador

- Perfis locais no menu ⋮, menu de contexto das abas, histórico de downloads persistente e atalhos com foco na
  página.
- Build `0.1.6-dev`; o perfil e a instalação anterior permanecem recuperáveis pelos backups em `backups/`.

## Limites conhecidos

- O modo de acessibilidade do Planilhas ainda não foi validado numa conta real.
- Grounding visual depende de um modelo com visão.
- Integração por API (Sheets e afins) ainda não existe.
- Nada disto substitui o teste numa conta/site real: os números do benchmark são de fixtures locais e um modelo.
