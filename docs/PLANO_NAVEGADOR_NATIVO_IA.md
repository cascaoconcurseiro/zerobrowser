# Plano — Navegador nativo para IA (integrações, extensões e controle total)

Data: 31/10/2026. Proposta; nada implementado. Pedido do Wesley: integrações nativas com apps e extensões, bots mais próximos do Grok Bot, e um navegador "como se fosse criado pela própria IA", com controle total. Este plano mantém o poder total e discorda de um ponto: controle **irrestrito** (seção 5).

## 1. Princípio: o navegador é uma API, a interface é só um cliente

Hoje é fácil acontecer o que o `PLANO_CONTROLE_TOTAL_IA.md` aponta: o MCP cobre página e abas, mas não histórico, favoritos, downloads, configurações, perfis e extensões. A causa é estrutural: esses recursos nasceram como botões, não como comandos.

Solução estrutural: um **registro de comandos** único. Todo recurso do navegador existe como comando com nome, parâmetros tipados, tipo de efeito (`leitura`, `escreve`, `sistema`) e nível de permissão. Menus, botões, atalhos, bots e IAs externas chamam o mesmo registro. Consequências:
- A IA tem, por construção, tudo que o usuário tem. Não há recurso "só de interface".
- Cada comando já nasce com permissão, log e aprovação.
- Regra de revisão: recurso novo sem comando registrado não entra no navegador.

Escopo dos comandos: abas, janelas, grupos; histórico, favoritos, downloads; configurações e perfis; extensões; DevTools (console, rede, desempenho, armazenamento); tema e layout; bots, agendas, memória e rotas; conectores; central e logs.

## 2. Integrações nativas (conectores)

Ordem de preferência para agir em qualquer serviço:
1. **Conector oficial** (API com login autorizado pelo usuário): mais estável, rápido e seguro.
2. Ferramenta declarada pelo site (WebMCP).
3. Rota aprendida.
4. Receita ou clique.

Conectores iniciais, por valor (ordem a confirmar com o Wesley): e-mail (Gmail e Outlook), agenda, arquivos e planilhas (Drive), Notion, GitHub, Slack ou Discord, e mensageria para falar com o bot (Telegram primeiro, WhatsApp depois).

Regras:
- Autorização por OAuth feita pelo usuário; tokens guardados no cofre do sistema (Windows), nunca em memória do bot nem em logs.
- Escopos mínimos e **somente leitura por padrão**; escrita (enviar, apagar, criar) liga por bot e passa pelo firewall de intenção e pelo recibo.
- **Zero como cliente MCP:** conectar qualquer servidor MCP existente (o ecossistema já tem muitos), com a mesma política de permissões. Ganho grande com pouco código; precisa de curadoria e aviso de risco ao conectar servidor de terceiros.
- Mensageria resolve a lacuna "falar com o bot pelo celular": pelo Telegram, o usuário manda tarefas e recebe aprovações. Continua exigindo o PC ligado. Autenticar o remetente (só contas autorizadas) é obrigatório.

## 3. Extensões

- **Extensões do Chrome:** o Electron suporta apenas parte das APIs de extensões. Antes de prometer compatibilidade, fazer o inventário: quais extensões populares (gerenciador de senhas, bloqueador, tradutor) funcionam. Resultado vira a lista "compatíveis".
- **Extensões do Zero:** pacotes com manifesto que podem declarar comandos, painéis, conectores, bots e modelos de app. Instalação em um clique, permissões listadas antes de ativar, ativação por perfil.
- **Extensão criada pela IA:** o usuário descreve, a IA gera o pacote, o Zero mostra o que ele pede de permissão e o código em resumo legível, e só ativa com aprovação. Roda isolada.

## 4. A IA modifica o próprio navegador

Camada de personalização que a IA pode criar e alterar: painéis, atalhos, temas, scripts por site, mini-apps (apps vivos). Regras:
- Tudo versionado: cada mudança é um commit local com descrição; desfazer com um clique; histórico navegável.
- **Modo seguro:** abrir o Zero sem nenhuma personalização, para recuperar de uma mudança ruim.
- Mudanças rodam na camada de personalização, nunca no núcleo (seção 5).
- A IA mostra o antes e o depois ao propor uma mudança de interface.

## 5. Núcleo intocável (onde discordo de "irrestrito")

A IA terá controle total sobre **tudo o que o usuário controla**. A única exceção: ela não pode remover as proteções que existem para impedir que ela (ou um texto hostil que a enganou) cause dano. Esse conjunto é o núcleo intocável:
- Botão e comando de parar tudo.
- Firewall de intenção e recibo antes de executar.
- Log de auditoria (não pode ser apagado nem editado pela IA).
- Aprovação de ações financeiras e envio a terceiros até o usuário liberar por bot.
- Cofre de segredos e redação de segredos.
- Limites de gasto e de tempo.
- Atualização assinada e modo seguro.

Motivo: o Zero abre sua conta de banco e seu e-mail. Se a IA pudesse desligar o firewall, uma página ou e-mail hostil só precisaria pedir "desligue o firewall" para vencer o que o plano inteiro de segurança constrói. "Controle total, sem poder de se libertar" mantém a utilidade e fecha esse caminho.

O usuário pode mudar essas proteções, mas apenas por ação humana na interface (confirmação por tecla e, para as mais sensíveis, pela senha do Windows), nunca por comando de IA. Se o Wesley insistir em irrestrito mesmo assim, registrar o risco: qualquer texto hostil lido pela IA vira um caminho para o controle total do navegador logado.

## 6. Mais perto do Grok Bot

Já previsto em `PLANO_BOTS.md` seção 0c; acrescentar:
- Conectores nativos (seção 2) como "plugins" dos bots.
- Rotinas por evento: e-mail novo, mudança de página, mensagem recebida, horário.
- Canal de mensagens (Telegram) para conversar e aprovar fora da janela.
- Equipe de bots com um coordenador e memória compartilhada opcional.
- Aprender por demonstração (gravador) como porta de entrada principal.

Lacuna que continua: executar com o PC desligado exige modo servidor; fora deste plano até haver demanda.

## 7. Fases e portões

- **Fase 0 — Inventário e registro de comandos.** Listar todas as ações de interface existentes (menus, botões, atalhos) e criar o registro. **Portão:** medir a cobertura (percentual de ações de interface que passam pelo registro); meta de 100% nas ações de abas, configurações, perfis e extensões na primeira rodada.
- **Fase 1 — Migrar a interface para o registro**, módulo por módulo, com um teste que falha se um botão novo não passa pelo registro.
- **Fase 2 — Expor no MCP com níveis** (liga com a Fase 2 do controle por IA). Testes negativos por nível.
- **Fase 3 — Conectores:** e-mail e agenda, só leitura, depois rascunho, depois envio com aprovação. Portão: teste com e-mails hostis (ver bot de e-mail).
- **Fase 4 — Cliente MCP** com aviso de risco para servidores de terceiros.
- **Fase 5 — Mensageria (Telegram)** com remetentes autorizados.
- **Fase 6 — Extensões do Zero** e inventário de compatibilidade com extensões do Chrome.
- **Fase 7 — Personalização versionada** e modo seguro; extensão criada por IA.
- **Teste do núcleo intocável (contínuo):** a IA tenta desligar firewall, apagar log, aumentar o próprio limite de gasto e esconder o botão de parar; todas devem ser recusadas. Portão de qualquer fase que mexa em comandos.

## 8. Riscos
- Migrar a interface para o registro é um refactor grande; fazer incremental, com testes.
- Conectores aumentam a superfície de ataque: escopos mínimos, somente leitura primeiro, tokens no cofre.
- Servidores MCP de terceiros podem ser maliciosos: lista com aviso, permissões por servidor, mesma política de origem do firewall (resposta de servidor externo é dado externo).
- Extensões do Chrome incompatíveis frustram: só prometer as testadas.
- Personalização pela IA pode quebrar a interface: versionamento e modo seguro.
- Mensageria expõe um canal de entrada: só contas autorizadas e as mesmas aprovações.

## 9. Decisões suas
- **Decidido em 31/10/2026:** o Wesley aceitou o núcleo intocável (seção 5) em vez de controle irrestrito.
- Lista e ordem dos conectores (quais apps você usa de verdade).
- Mensageria: Telegram primeiro está bom?
- Se o Zero deve permitir servidores MCP de terceiros desde o início.
