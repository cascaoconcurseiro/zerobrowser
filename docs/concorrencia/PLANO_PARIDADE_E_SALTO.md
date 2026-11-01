# Plano — Paridade com os grandes e o salto ("delegação com prova")

Data: 31/10/2026. **Status: Implementado (`0.1.54-dev` a `0.1.60-dev` em `src/main/command-registry.js`, `src/main/parity-essentials.js` e `src/automation/learned-routes.js`).**

Base do estado atual: `docs/concorrencia/COMPARATIVO_CONCORRENTES_2026-10-28.md` na árvore principal (fontes de mercado de 28/10/2026, status do Zero de 29/10/2026). Pesquisas adicionais de 31/10/2026 citadas na seção 3.

## 1. Paridade: "tudo que os grandes têm" precisa de um limite

Copiar todos os recursos de Chrome, Edge, Comet, Dia, Opera e BrowserOS atrasaria o salto e deixaria o Zero em segundo lugar em tudo. Proposta: paridade nos recursos que o usuário espera de um navegador de uso diário e que sustentam a tese; o resto é adiado ou descartado, com motivo.

| Recurso dos grandes | Quem tem (comparativo) | Estado do Zero (comparativo) | Decisão |
|---|---|---|---|
| Sincronização entre dispositivos | Dia (Windows e Mac) | Ausente | Adiar; exige conta, criptografia e conflitos. Decidir depois do salto |
| Atualização automática com volta atrás | Navegadores maduros | Ausente | **Obrigatório** (confiança e segurança) |
| Abas avançadas (grupos, fixar, reordenar, restaurar sessão) | Dia, Chrome, Edge | Parcial/ausente | **Obrigatório** |
| Perfis isolados | Chrome, Edge | Existe, sem validação em pacote | **Obrigatório**: validar |
| Extensões | Chrome, Edge | Parcial (carga unpacked, APIs limitadas) | Inventariar compatibilidade; não prometer Web Store |
| Contexto de várias abas no assistente | Comet, Chrome | Não verificado | **Obrigatório** |
| Skills/receitas reutilizáveis | Chrome, Dia | Receitas existem; bots planejados | Entra nos bots |
| Conectores de e-mail, agenda e trabalho | Comet, Chrome, Dia | Ausente | **Obrigatório** (`PLANO_NAVEGADOR_NATIVO_IA.md`) |
| Execução visível, takeover e interrupção | Edge, BrowserOS | Aprovação e takeover parciais | **Obrigatório** e acima do mercado (design) |
| Replay da execução | BrowserOS neo | Ausente | **Obrigatório**: vira o comprovante |
| MCP/CLI para agentes externos | Neon, BrowserOS | Existe, com lacunas | Já planejado (`PLANO_CONTROLE_TOTAL_IA.md`) |
| IA local | Opera (WebAI preview) | Ollama só com mock | Validar com servidor real |
| Aplicativo móvel | Comet | Ausente | Descartar por ora; Telegram cobre o essencial |
| Onboarding e acabamento visual | Dia, Edge | Fraco (nota 2/5 interna) | **Obrigatório** (`PLANO_DESIGN_UX.md`) |

Itens que não aparecem no comparativo (VPN, anúncios, compras, jogos) ficam fora até haver demanda.

## 2. O salto: delegação com prova

### Tese
Todo navegador com IA promete "faça por mim". O que nenhum entrega ao usuário comum é **segurança para delegar de verdade** (dinheiro, e-mail, contas). A tese: o Zero é o navegador em que você entrega trabalho real porque cada ação é **entendida, limitada, provada e, quando possível, desfeita**.

### Peças e o que é novo (pesquisado em 31/10/2026, buscas curtas)
Nenhuma peça isolada é inédita. Dizê-lo é parte do plano.

| Peça | O que já existe | O que falta / onde o Zero pode ser diferente |
|---|---|---|
| Rotas aprendidas | Preprint Unbrowse (arXiv 2604.00694): grafo compartilhado de rotas aprendidas do tráfego; no teste dos autores, 950 ms contra 3.404 ms no Playwright, em 94 domínios (resultado dos próprios autores, um único ambiente) | Fazer local, no navegador do dia a dia, com sessão do usuário e queda automática para clique |
| Rede de rotas verificadas por consenso | Waymark (servidor MCP): mapa de rotas com atestados de sucesso e falha; serviço operado por terceiros | Não construir rede pública agora. Local primeiro; rede opt-in só depois de medir (ver 4, Fase 5) |
| Firewall por origem do dado | FIDES (Microsoft Research): bloqueou os ataques do AgentDojo | Aplicar dentro de um navegador de uso diário, com recibo legível |
| Autonomia conquistada | Padrão descrito pela AWS, KavachOS e um rascunho do IETF ("Progressive Trust"); o rascunho exige decisão humana para **subir** permissão e permite descer automaticamente | Aplicar por bot e por site, com histórico de acertos **verificados** visível ao usuário |
| Reversibilidade e desfazer | Ensaios e guias: cada ação declara se é reversível; padrão irreversível quando não se sabe; desfazer é uma sequência de compensações, não uma pilha. Não encontrei implementação em navegador | **Aposta principal de diferenciação**: toda ação de escrita é classificada e o recibo diz "dá para desfazer até X" |
| Ensaio em gêmeo local | Captura e replay de tráfego é prática comum de desenvolvimento (não pesquisado a fundo) | Levar ao usuário comum: testar o bot sem tocar no site real |

A combinação, funcionando e provada em um navegador local, é o que não encontrei. Não posso garantir que seja inédita nem que o mercado reconheça isso como um salto; é uma hipótese a testar.

### Peça 1 — Reversibilidade explícita e botão Desfazer
- Toda rota ou ação de escrita recebe uma classe: `reversível` (existe ação inversa e janela de tempo), `parcial` (desfaz parte) ou `irreversível` (padrão quando não se sabe).
- O recibo antes de executar mostra a classe: "Dá para cancelar até 30 minutos depois" ou "Não dá para desfazer". Ações irreversíveis exigem mais atenção na aprovação.
- Ao executar, o Zero registra a ação inversa **naquele momento** (com os identificadores gerados, como número do pedido) para o Desfazer funcionar depois.
- Desfazer uma tarefa de vários passos executa as inversas em ordem contrária (sequência de compensações). Se um passo não tiver inversa, o Zero diz o que ficou e o que não dá para voltar.
- Limites que precisam ficar claros ao usuário: e-mail lido pelo destinatário, pagamento já processado e mensagem entregue não voltam.

### Peça 2 — Confiança medida, não suposta (autonomia conquistada)
- Cada bot e cada categoria de tarefa têm um histórico de execuções **com resultado verificado** (a verificação vem de pós-condição independente, leitura de volta pela rota ou comprovante do site; sem verificador, a execução não conta como acerto).
- O Zero **propõe** subir um degrau ("Preços acertou 30 de 30 e todas reversíveis; liberar envio de alerta sem pedir?") e o usuário decide. Seguindo o rascunho do IETF, subir exige decisão humana. Descer é automático: um erro ou bloqueio do firewall rebaixa o bot.
- Painel "Confiança" por bot e por site: acertos, falhas, ações desfeitas, custo, última verificação.
- O núcleo intocável continua valendo: nenhum degrau de autonomia desliga firewall, recibo, log ou aprovação financeira.

### Peça 3 — Ensaio
Antes de ligar um bot novo ou depois de uma mudança do site, rodar o bot contra um gêmeo local do site feito a partir do tráfego capturado, só com leitura. Mostra o que ele faria, sem tocar na conta real. Serve também para detectar mudança de site antes de o bot quebrar.

### Peça 4 — Rotas e firewall
Conforme `PLANO_ROTAS_E_FIREWALL.md`. A classe de reversibilidade vira um campo da ficha da rota.

## 2b. Revisão de 31/10 (noite): o que o Grok Bot faz, só no navegador

Direção geral em `ROTEIRO_DO_MENTOR.md`. Resumo; detalhes em `docs/bots/PLANO_BOTS.md` 0f. Descrições do Grok Bot vêm de terceiros.

| O que o Grok Bot faz | No Zero, só no navegador |
|---|---|
| Bots com nome e conversa contínua | Sim (perfil isolado com histórico) |
| Rotinas agendadas com histórico | Sim, quando o executor for ligado |
| Gravar tarefa (Teach a Task) | Sim; o gravador existe, falta ligar ao executor |
| Aprovações | Sim; o recibo mostra mais detalhe |
| Pausar quando você está ausente | Sim (o código já pausa bots parados) |
| Usar sites logados | Sim, ponto forte |
| Rodar com o PC desligado | Não: servidor próprio (degrau 2) |
| Computador na nuvem compartilhado | Não: degrau 3 |
| Programas fora do navegador | Não: conector de desktop, por último |
| App no celular | Não: adiado |
| Centenas de integrações | Parcial: começa com poucas |

Hoje o Zero **não faz** tudo isso de ponta a ponta: o executor do bot foi ligado na `0.1.69-dev` (missão → agente em aba oculta, com recibo), mas ainda faltam perfil isolado, agenda com persistência e prova com site real. A resposta é "conseguimos fazer", não "já faz". Vantagem possível: recibo, firewall e Desfazer; não provada.

## 3. O que isso muda nos outros planos
- `PLANO_ROTAS_E_FIREWALL.md`: ficha da rota ganha `reversibilidade` (classe, janela, rota inversa).
- `docs/bots/PLANO_BOTS.md`: a escada de autonomia passa a ser alimentada pelo histórico verificado.
- `PLANO_DESIGN_UX.md`: recibo mostra reversibilidade; painel "Confiança"; botão "Desfazer" no comprovante.
- `PLANO_NAVEGADOR_NATIVO_IA.md`: o registro de comandos inclui o campo de reversibilidade em todo comando de escrita.

## 4. Fases e portões
1. **Paridade essencial (tabela da seção 1, itens obrigatórios).** Portão: os 10 fluxos do comparativo passando em pacote e instalado, sem "não verificado".
2. **Núcleo da tese:** rotas, firewall e recibo (`PLANO_ROTAS_E_FIREWALL.md`) com campo de reversibilidade. Portão: Fase 0 das rotas e suíte de ataques conforme aquele plano.
3. **Desfazer.** Começar por 5 ações reversíveis em fixtures (cancelar um pedido, apagar um rascunho, restaurar um item, desfazer envio com janela, reverter uma configuração). Portão: o Desfazer restaura o estado verificado em 5 de 5 fixtures; ações sem inversa aparecem como `irreversível`; zero ação de escrita sem classe.
4. **Autonomia conquistada.** Portão: bot de teste sobe e desce de degrau conforme o histórico; subir sempre exige aceite do usuário; teste de que nenhum degrau desliga o núcleo.
5. **Ensaio e, só depois, rede de rotas opt-in.** Avaliar usar um serviço existente (como Waymark) ou construir próprio; decidir somente com resultado das fases 2 a 4, por causa do risco de rotas maliciosas compartilhadas (rota só vale se for presa ao domínio, parametrizada e verificada por observações independentes).

## 5. Riscos
- Prometer "Desfazer" e falhar é pior do que não oferecer: por isso o padrão é irreversível e a promessa aparece só onde há inversa testada.
- Verificador fraco infla a confiança: sem verificação independente, a execução não pontua.
- Escopo enorme: a ordem das fases protege o essencial; a paridade não pode engolir o núcleo da tese.
- Tese pode não ser percebida pelo usuário: validar com 5 pessoas se "posso desfazer" muda a disposição de delegar (meta, não resultado).

## 6. Decisões
- **Decidido em 31/10/2026:** Wesley aceitou o limite de paridade da seção 1 (sincronização e aplicativo móvel adiados) e o Desfazer como aposta principal.
- Em aberto: por quais ações do dia a dia começar o Desfazer (e-mail, compras, agenda).
