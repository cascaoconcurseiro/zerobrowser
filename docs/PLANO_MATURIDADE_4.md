# Plano para maturidade 4/5 — Zero Browser

Data: 29/10/2026. Planejamento proposto; nenhum critério abaixo está automaticamente concluído. A nota 4 é uma meta interna de produto confiável para uso recorrente no escopo definido, não prova de participação de mercado nem paridade integral com concorrentes. Baseline: comparativo de 28/10 e handoff atual; revalidar antes de cada etapa.

## Regras de avaliação

Para dar 4 a um quesito: todos os critérios essenciais abaixo passam no candidato empacotado, com evidências reproduzíveis, sem defeitos críticos ou altos abertos no escopo, e revisão independente. Resultados em código, mock, pacote, instalação e uso real são registrados separadamente. Metas numéricas abaixo são propostas de aceite, não medições atuais. Medir o estado inicial antes de definir compromissos definitivos e registrar amostras e limitações. Qualidade comparativa exige benchmark pareado; ausência de acesso ou custo deixa o critério pendente, não aprovado.

## Etapas e dependências

### 0. Linha de base e segurança de dados
- [ ] Inventariar versões, configuração, critérios e 10 fluxos no comparativo; identificar regressões e classificar achados por impacto, reprodução e responsável. Preservar perfil/backup; não restaurar automaticamente a diferença anterior de cookie.
- [ ] Executar o pacote QA `dist-active-tab-qa-20261029` em perfil temporário; validar fluxo da fixture, captura nativa, concessão e revogação de activeTab. Registrar versão, hash, comandos e limites.
- [ ] Definir matriz de ambientes Windows, resoluções, temas e acessibilidade; criar um registro de evidências e bugs. Bloqueio: testes de instalação sobre perfil real dependem de backup verificado e procedimento de recuperação.

### 1. Segurança e recuperação (bloqueia novas capacidades privilegiadas)
- [ ] Revisar fronteiras IPC, extensões, permissões, navegação/redirecionamentos, downloads, armazenamento, credenciais, CDP e ações do agente. Exercitar extensões e páginas adversariais em perfil descartável.
- [ ] Definir modelo de ameaças, permissões mínimas e revisão de dependências; corrigir achados por risco. Transformações permanecem desativadas até isolamento e ataques de escape serem verificados.
- [ ] Validar aprovação, cancelamento, takeover, retentativa e recuperação de estado incerto; nenhuma ação sensível deve ser repetida cegamente. Auditar logs para não registrar segredos ou conteúdo sensível.
- [ ] Aceite 4/5: revisão independente concluída; zero achados críticos/altos abertos; testes negativos e recuperação passam no pacote; política de privacidade e limites de confiança documentados. Isso não substitui auditoria externa.

### 2. Navegador confiável e UX (em paralelo após 0; mudanças privilegiadas dependem de 1)
- [ ] Completar endereço/busca, navegação, erros/rede, abas (fixar, duplicar, reordenar, restaurar), janelas, biblioteca e downloads (abrir, pausar, cancelar, remover), com persistência e recuperação.
- [ ] Validar isolamento de dois perfis, remoção e backup/restauração em dados descartáveis. Planejar migração separadamente, com consentimento para dados pessoais.
- [ ] Padronizar onboarding, estados vazios/erro, configurações, atalhos, foco, nomes acessíveis, temas e tamanhos de janela. Fazer revisão visual e testes de teclado e leitor de tela.
- [ ] Aceite navegação 4/5: matriz dos 10 fluxos essenciais e cenários de falha passa em pacote e instalação de QA; sessão e biblioteca sobrevivem a reinício; nenhuma perda de dados na migração simulada. Aceite UX 4/5: tarefas essenciais concluídas por pelo menos 5 participantes representativos, com problemas críticos corrigidos e nova rodada de confirmação; contraste, foco e teclado verificados nas superfícies principais. A amostra pequena serve para encontrar problemas, não medir satisfação populacional.

### 3. Extensões e integrações (depende de 1)
- [ ] Mapear APIs das extensões prioritárias a partir de manifestos obtidos de fontes autorizadas; publicar matriz suportado/parcial/ausente. Validar ciclo MV3, MV2 quando aplicável, popup, activeTab, captura real, permissões opcionais e scripting conforme contratos e modelo de segurança.
- [ ] Implementar apenas APIs necessárias com autorização por extensão, aba, origem e escopo; cobrir concessão, revogação, navegação, encerramento e tentativa de falsificação. Validar extensões fixture e Flame real quando disponível/autorizada.
- [ ] Testar conexão MCP com clientes reais e fluxos de recuperação; priorizar integrações de trabalho segundo valor e consentimento. Publicar instruções de compatibilidade e erros claros.
- [ ] Aceite 4/5: matriz das extensões e integrações escolhidas passa em pacote e instalação QA, com testes negativos e lista pública de limitações; auditoria de segurança da etapa 1 aprovada. Não alegar compatibilidade universal nem Chrome Web Store sem validação própria.

### 4. Agente, modelos e IA local (depende de 1; pode avançar junto de 2 e 3)
- [ ] Validar fluxo real opt-in de DeepSeek/OpenRouter e um servidor Ollama local instalado pelo usuário, sem coletar chaves; verificar descoberta, seleção, chamada, cancelamento, indisponibilidade e recuperação. Registrar custos e condições antes de chamadas pagas.
- [ ] Melhorar observação, controle de abas, retomada, inspeção e verificação de efeitos; cobrir carregamento assíncrono, múltiplas abas, formulários, erros e CAPTCHA com intervenção humana.
- [ ] Aceite automação 4/5: cenários prioritários executados de ponta a ponta em sites de teste e amostra de sites reais autorizados, com pós-condições independentes, aprovações e takeover verificados. Aceite IA local 4/5: pelo menos dois modelos locais compatíveis e fluxos de erro/cancelamento validados no pacote, com requisitos de hardware publicados; inferência continua sujeita ao hardware disponível.

### 5. Medição comparativa (base após 0; rodada final após 2–4)
- [ ] Definir conjunto versionado de pelo menos 30 tarefas representativas, incluindo navegação, pesquisa, extração, formulários, multiaba, recuperação e ações aprovadas; separar sites fixture e reais autorizados e evitar dados pessoais.
- [ ] Comparar Zero com pelo menos dois concorrentes acessíveis nas mesmas tarefas e condições possíveis; documentar versões, plano, região, modelos, número de repetições, interrupções e custos. Onde modelos ou ambientes diferirem, separar os resultados.
- [ ] Medir sucesso por pós-condição independente, falhas, p50/p90 de tempo, tokens e custo quando disponíveis; publicar dados agregados e incerteza, inclusive resultados negativos.
- [ ] Aceite 4/5 proposto: pelo menos 80% de sucesso verificado no conjunto acordado, nenhuma falha de segurança crítica e desempenho/custo competitivos nos cenários comparáveis. O limiar final deve ser calibrado após baseline e comparação; não inferir desempenho dos concorrentes por marketing.

### 6. Distribuição, atualização e operação (depende de 1; release depende de 2–5)
- [ ] Produzir builds reproduzíveis identificados por versão/hash, CI de regressão, assinatura verificável e cadeia de publicação; implantar atualização com verificação de assinatura, rollback e falhas recuperáveis. Testar atualização, reinstalação e rollback em perfis descartáveis.
- [ ] Definir política de backup, migração, diagnósticos sem dados pessoais, suporte e divulgação de vulnerabilidades. Projetar sync com escolha explícita de dados, criptografia, conflitos e recuperação; implementar somente após desenho e revisão de segurança. Senhas/cookies requerem decisão específica.
- [ ] Aceite 4/5: ciclo instalar → usar → atualizar → falhar/recuperar → rollback passa em máquina/perfil QA, assinatura e integridade verificadas; sync, se incluído no escopo de release, passa testes de isolamento, conflito e recuperação. Release e publicação exigem autorização aplicável.

### 7. Aceite final e acompanhamento
- [ ] Reexecutar matriz completa no mesmo candidato, com revisão independente e evidência por critério; resolver falhas críticas/altas e regressões. Validar experiência em instalação QA e documentar diferenças em relação à produção.
- [ ] Recalcular cada nota pela rubrica e publicar tabela com evidência, limites e data; só avisar que todos os quesitos atingiram 4 quando todos os critérios forem demonstrados. Atualizar comparativo de mercado com fontes correntes e benchmark próprio.

## Organização e prioridades

### Donos e limites de cada frente

| Frente | Dono | Escopo de escrita | Saída verificável | Dependência/limite |
|---|---|---|---|---|
| Integração e release | Agente principal | `main.js`, pacote, versão, checklist/handoff e integração | Candidato único, testes consolidados, commit local e instalação QA com hash conferido | Só integra mudanças revisadas; nenhum especialista faz commit, instala ou altera a versão |
| Motor e custo | Especialista de motor | `src/automation/service/agent-runtime.js`, testes do motor e `docs/EVOLUCAO_MOTOR.md` | Uma hipótese por vez, fixture reproduzível e antes/depois; benchmark real registra modelo, custo, latência e acerto | Trabalha em paralelo com UX após a linha de base; chamada paga só com orçamento/chave autorizados |
| Bots e segurança MCP | Especialista de segurança/Bots | Guardas do runtime Bot e `scripts/bot-runtime.integration.js` | Testes negativos para credenciais, CDP, navegação, envio externo, aprovação e recuperação | A etapa 1 bloqueia novas ferramentas privilegiadas; uma pessoa é dona do fluxo Bot por vez |
| UX e acessibilidade | Especialista de UX/a11y | `src/renderer/**` e testes de UI | Critérios visuais/teclado para Delegar, Central, takeover e estados responsivos | Pode avançar em paralelo após a base; não altera guardas de segurança nem IPC |
| Extensões e integração externa | Especialista de extensões | código/tests de `src/extensions/**`, `src/host/**` e docs de compatibilidade | Matriz por API e fixtures de concessão/revogação; Flame real é evidência separada | Depende da revisão de segurança; nenhum agente altera o motor ou a UI sem coordenação |
| Medição e mercado | Especialista de benchmark/concorrência | `bench/**` e `docs/COMPARATIVO_CONCORRENTES_*.md` | Tarefas versionadas, pós-condições independentes e rubrica com limites/fonte | Não mistura anúncios com resultados operacionais; só pontua desempenho com condições comparáveis |

### Ordem de execução e paralelismo

1. **Fechar etapa 0:** instalar o candidato 0.1.47-dev em QA, conferir versão/hash/atalho e registrar a mesma baseline para todas as frentes.
2. **Abrir em paralelo depois da baseline:** (a) motor em fixtures sem custo, (b) UX responsiva e teclado, (c) definição do conjunto de benchmark. Cada frente trabalha em arquivos próprios e entrega critério/teste; ninguém integra diretamente na mesma pasta de trabalho da outra frente.
3. **Fechar o gate de segurança:** Bot/MCP cobre navegação com aprovação, envio externo e recuperação em fixture; achados críticos/altos bloqueiam novos acessos privilegiados.
4. **Validar extensões após o gate:** matriz de compatibilidade e fixtures; Flame real somente em perfil descartável e fluxo autorizado.
5. **Integrar uma fatia por vez:** agente principal revisa os diffs, executa a suíte e instala após o commit; só então começa a próxima versão. Especialistas não alteram arquivos fora da frente designada.
6. **Medição real e nota de mercado:** depende de baseline e orçamento/provedor aprovado; 200 avatares e redução de bytes de esquema não entram como evidência de qualidade do modelo.
7. **Aceite final:** executa etapas 0–7 do plano com revisão independente; publica nota 4 apenas quando cada critério essencial passar no pacote e instalação QA.

**Gargalos:** validação do provedor real com custo, superfícies de extensão/Flame e aceite de usuário. Não há estimativa confiável de calendário até concluir a baseline e dimensionar acesso, orçamento e resultados. O backlog detalhado do `CHECKLIST.md` continua sendo referência; esta ordem define quais itens podem começar e quem os integra.
