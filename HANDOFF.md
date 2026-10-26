# Handoff — Navegante

## Última sessão

**Data:** 2026-10-26

- O teste de hover falhava por competição entre o cursor físico do Windows e o mouse sintético em uma janela visível. A fixture agora roda oculta e prova o estado visual; a lógica de entrada do produto continuou em CDP.
- Validações: `npm test` 81/81; `npm run test:electron`; `npm run test:bench-store`; `npm run test:agent-download`.
- Release local Windows x64 0.1.1 compilado e instalado em `%LOCALAPPDATA%\Programs\navegante-cua-validation`. Smoke do candidato e da instalação final passou com provider loopback e perfil temporário. Atalho e registro confirmados. SHA-256 do `app.asar` instalado e do candidato: `32BBA2BF547E26BC9035CA19EAB9F917E23F3511B3C0B76F73D071A1BDB67ED5`.
- Backup restaurável do 0.1.0 está em `backups/2026-10-26-before-0.1.1/`, com 183 arquivos do aplicativo, 6.430 do perfil e o instalador. Manifesto contém inventários e hashes conferidos; não inspecionei dados pessoais.
- O instalador não tem assinatura digital. Os smokes usam providers mock; sites comerciais autenticados e serviços reais ainda não foram validados.
- O projeto foi publicado no branch `main` de `https://github.com/cascaoconcurseiro/zerobrowser`. Commit remoto verificado por `git ls-remote` e API GitHub: `88edb2f7457d74832af0d2a90e2045df846ddce3`. O primeiro commit inclui 96 arquivos; `node_modules`, `dist`, `data`, backups, relatórios gerados e relatórios REA locais estão excluídos. Licença MIT acompanha a declaração do pacote.
- `MASTER_BLUEPRINT.md` permaneceu igual; nenhuma decisão arquitetural foi feita nesta atualização.

## Próximo passo concreto do motor

Implementar como experimento uma memória contextual local e seletiva para correções repetidas de preenchimento. Armazenar apenas metadados não sensíveis do site/controle e resultados de verificação; nunca valores digitados, credenciais ou texto da página. Fazer A/B pareado nas tarefas 02 e 33 e depois na suíte difícil completa, pelo menos cinco repetições por condição. Comparar acerto, reversões, tokens reais e latência; manter a memória desligada por padrão até comprovar acurácia igual ou maior sem custo desproporcional. Começar pelo fluxo de persistência/migração em `src/store/index.js` e pela construção do contexto em `src/automation/service/index.js`.

## Limites pendentes

As suítes locais e demos públicas não comprovam desempenho em Google Planilhas ou sites comerciais autenticados. A validação externa deve usar contas/dados de teste autorizados; compras, pagamentos, exclusões e publicações exigem aprovação explícita.
