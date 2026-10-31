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

Responsáveis sugeridos: produto/UX para jornadas e aceite; engenharia de navegador/extensões para etapas 2–3; segurança para etapa 1 e revisão dos gates; agente/IA para etapa 4; QA/performance para 0 e 5; release/operações para 6; revisão independente e documentação para 7. São papéis de trabalho, não compromissos de contratação. Segurança e diagnóstico podem ocorrer em paralelo com UX e medição; acesso privilegiado e release dependem dos respectivos gates.

Prioridade imediata: validar o pacote QA atual, corrigir qualquer regressão reproduzida e fechar a revisão de permissões. Gargalos prováveis: compatibilidade real de extensões, segurança do sandbox, testes com provedores e concorrentes, assinatura e sync. Não há estimativa confiável de calendário sem dimensionar equipe, acesso, orçamento e resultados da linha de base; estimar após a etapa 0 por entregas e incerteza.
