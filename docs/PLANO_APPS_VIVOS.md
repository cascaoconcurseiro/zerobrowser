# Plano — Apps vivos (o navegador vira o software que você precisa)

Data: 31/10/2026. Ideia proposta; nada implementado e nada medido. Depende das rotas aprendidas e do firewall (`PLANO_ROTAS_E_FIREWALL.md`) e dos bots (`PLANO_BOTS.md`).

## 1. Ideia
Você descreve em português um software pessoal, por exemplo: "um painel com minhas contas de luz, internet e cartão, mostrando o que vence esta semana e me avisando". O Zero:
1. Descobre de onde vêm os dados nos sites onde você já está logado (rotas aprendidas).
2. Gera um **app local** (uma página interna do Zero) que mostra esses dados juntos.
3. Mantém o app atualizado com um bot na agenda.
4. Deixa o app **agir**: um botão "pagar" no painel chama a rota correspondente, passa pelo recibo antes e pelo firewall e só então executa.

Nenhum dos sites precisa ter API pública, e você não cria chave nenhuma. O app é editado por conversa ("adicione o plano de saúde", "mostre em ordem de vencimento") e pertence a você.

## 2. Diferença para o que existe (pesquisado em 31/10/2026, busca curta)
- Agentes que usam suas sessões logadas já existem (BrowserOS, extensões como Valendata).
- Há ferramentas que geram painéis a partir de comandos (MyNextBrowser, descrição sem detalhes) e raspadores de sites com login que exportam para planilha.
- Não encontrei produto que una: dados vindos de sites sem API, app persistente gerado por conversa, ação de volta nos sites com recibo e firewall, tudo local. Isso é "não encontrei", não "não existe".

## 3. Peças
- **Fonte:** uma rota aprendida (ou receita) com contrato claro: nome, parâmetros, formato do resultado, frescor.
- **App:** definição declarativa (telas, listas, gráficos, botões) gerada pelo agente e salva como arquivo local legível e editável. Roda em página interna do Zero, isolada, sem acesso livre à rede: só chama fontes cadastradas.
- **Atualização:** bot do app com agenda; guarda histórico dos dados (para gráficos e comparações).
- **Ações:** botões ligados a rotas de escrita; sempre recibo antes e firewall; ação financeira começa com aprovação.
- **Pacote compartilhável:** app + fontes sem credenciais nem dados. Quem importa entra nas próprias contas; as rotas são reaprendidas ou revalidadas localmente. Nada de dados pessoais no pacote.
- **Avatar e anel:** cada app vivo é um bot com anel de estado no trilho (design em `PLANO_DESIGN_UX.md`).

## 4. Fases e portões
- **Fase 0 — Prova com 1 app e 3 fontes.** Um painel de vencimentos com 3 sites que você usa, só leitura, montado à mão sobre rotas aprendidas. **Portão:** 7 dias de uso real, atualização automática correta e você preferir abrir isso a abrir os 3 sites.
- **Fase 1 — Geração por conversa:** do pedido ao app mínimo funcionando, sem mexer em código. Aceite: 5 pedidos diferentes, 4 geram app útil sem ajuda técnica.
- **Fase 2 — Edição por conversa e histórico de versões** (voltar à versão anterior).
- **Fase 3 — Ações** com recibo e firewall, começando por ações reversíveis.
- **Fase 4 — Pacotes e galeria** (somente depois da segurança medida).

## 5. Riscos
- Fonte quebra quando o site muda: o app mostra "dado antigo desde..." em vez de números errados; nunca mostrar dado velho como atual.
- Dados sensíveis (contas, saldos) ficam só locais e criptografados no perfil; sem envio para modelo além do necessário para gerar o app; ver o que vai ao modelo e permitir gerar o app só com a estrutura, sem os valores.
- App gerado é código: roda isolado, sem acesso a outras abas, cookies ou arquivos; só chama fontes declaradas.
- Termos de uso de sites (ver riscos de rotas).
- Escopo: começar por leitura. Ação vem depois e só com o firewall medido.

## 6. Decisões suas
- Se o primeiro app de prova é financeiro (vencimentos) ou do trabalho.
- Se pacotes compartilháveis entram no produto ou ficam só locais.
