# Checklist — Zero Browser

## Estado atual

- Código e executável instalado em `0.1.51-dev`; build, instalação e hashes registrados em `HANDOFF.md`. Reinstalação pós-commit ainda pendente.
- A aprovação de ações no chat e a regra de autonomia dos Bots foram concluídas na .50. A .51 corrige a Central e as sobreposições do modo Delegar.
- Este arquivo contém apenas a ordem ativa e o backlog priorizado. O inventário cronológico antigo foi preservado em `docs/CHECKLIST_HISTORICO.md`; itens abertos lá não são tarefas autorizadas/ativas até serem promovidos para cá.
- Planos em `docs/PLANO_*.md` são propostas. Confirmar cada capacidade no código e no executável antes de mudar status para concluído.

## Entrega atual — layout Delegar e Central de Bots (0.1.51-dev)

- [x] Alinhar a posição da Central ao trilho e ao painel reservado pelo processo principal, removendo o encobrimento pela página nativa.
- [x] Organizar cabeçalho, contagem, lista rolável, identidade do Bot atual e ação de criação.
- [x] Corrigir layout compacto, contraste do endereço e espaço desperdiçado pela barra de favoritos vazia.
- [x] Verificar UI e layout em quatro tamanhos; `npm test` 370/370 e `npm run test:ui` passaram.
- [x] Build NSIS gerado, instalado e verificado; backup dos 184 arquivos e hashes registrados em HANDOFF.
- [x] `test:installed` PASS com perfil temporário e endpoints loopback mockados.
- [ ] Commit local e reinstalação após commit.

## Próxima entrega — ciclo de vida reversível de Bots

**Objetivo:** arquivar e restaurar um Bot sem apagar nem mover diretório, cookies, login ou associação de avatar. Uma janela já aberta continua funcionando e deve indicar que o Bot está arquivado. O app deve impedir novas aberturas pelo menu e IPC.

**Limite:** exclusão permanente e detecção/contenção de processos Bot ativos ficam fora desta fatia. O código atual não mantém um registro confiável dos processos separados; apagar a pasta pode remover dados ainda usados.

- [ ] **Modelo/persistência:** guardar estado de arquivamento no registro do perfil Bot; preservar esse campo na leitura/escrita; recusar arquivar perfil que não seja Bot.
- [ ] **IPC/abertura:** oferecer arquivar/restaurar na API do processo principal e negar abertura de Bot arquivado, inclusive se o renderer estiver desatualizado.
- [ ] **Central/trilho:** separar botões Arquivar/Restaurar; mostrar Bots ativos e arquivados em seções distintas; manter o avatar estável e identificar janela já aberta de Bot arquivado.
- [ ] **Verificação:** cobrir persistência, permissões IPC, abertura negada, restauração, avatar e estados acessíveis da UI em perfil temporário.
- [ ] **Entrega:** revisão do diff; `npm test` e smokes Bot/UI; gerar nova versão e hashes; commit local; backup da instalação anterior; instalar e verificar smoke no executável instalado.

## Ordem das próximas frentes

1. **Bots — lifecycle reversível** (fatias desta entrega; sem purge físico).
2. **Motor — velocidade, acerto e tokens:** criar baseline de tarefas/condições e medir separadamente sucesso verificado, rodadas, latência, tokens do provedor/cache e custo. Otimizar somente depois da baseline. Nenhuma medição paga até haver orçamento aprovado.
3. **Layout e acessibilidade:** revisar os demais estados instalados contra o conceito visual do projeto, com aceite por tela/estado; manter o motor fora desse diff.
4. **MCP e segurança de Bots:** inventário de ferramentas e ataques em fixture por gate; não misturar com o benchmark de velocidade.
5. **Concorrentes e maturidade:** atualizar notas apenas com evidência equivalente e fontes datadas; sem ranking numérico sem benchmark pareado.
6. **Exclusão permanente de Bots e atualizações assinadas:** planejar separadamente, com coordenação entre processos e rollback verificável.

## Regra de divisão do trabalho

- Especialista Bots: `src/main/profiles.js`, IPC de Bots e fluxo Central relacionado; sem motor, release ou mudanças nas guardas de segurança.
- Especialista Motor/medição: `src/automation/**`, fixtures e `bench/**`; sem renderer/IPC de Bots.
- Especialista UX: `src/renderer/**` e smoke visual/acessível; sem contratos IPC ou guardas.
- Integração/release: agente principal consolida uma fatia vertical por vez, revisa conflitos, roda os gates, incrementa versão, commita e instala. Não sobrepor arquivos compartilhados; entregas de especialistas ficam sem commit.

## Histórico recente concluído

- [x] Reorganizar a continuidade do projeto: separar checklist ativo do arquivo histórico, reduzir o handoff ao estado atual, corrigir o README e criar o guia de leitura.
- [x] **0.1.48-dev:** carga de ferramentas sob demanda, recusas MCP em fixture e Central responsiva; commit `c3af35f`, build e instalação QA registrados no arquivo histórico.
- [x] **0.1.49-dev:** smoke instalado corrigido para o fluxo real da UI; commit `fabe822`, build e instalação QA registrados no arquivo histórico.
- [x] **0.1.50-dev:** aprovações no chat e autonomia Bot; `npm test` 370/370, `test:ui`, `test:bot-runtime` e smoke instalado passaram; commit `ddac732`, build e instalação QA registrados no `HANDOFF.md`.
