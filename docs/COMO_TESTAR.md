# Como testar o Zero Browser (0.1.8-dev)

Checklist manual para a versão instalada em 28/10/2026. O que depende de modelo/provedor está separado do que já
pode ser conferido sem chave.

**Build instalado:** `0.1.8-dev`, `app.asar` `55a0f841…33c52`; backup do estado anterior em
`backups/2026-10-28-before-credential/`.

## 0. Novidades e versão

- [ ] Menu ⋮ mostra **0.1.6-dev** e abre **Novidades** com o resumo (motor, sites difíceis, limites).
- [ ] O diálogo fecha em **Fechar** e não altera a página.

## 1. Casca do navegador (não depende de provedor)

- [ ] Abrir o app pelo atalho e confirmar **versão** no menu ⋮.
- [ ] **Perfis**: menu ⋮ → Perfis → abrir um segundo perfil (processo separado) e voltar ao principal. Criar
      "Perfil 2" e excluir. Confirmar que favoritos/histórico não se misturam.
- [ ] **Abas**: abrir 3 abas, usar Ctrl+Tab / Ctrl+Shift+Tab / Ctrl+1..9, F5 com o foco dentro da página,
      Ctrl+Shift+T depois de fechar uma aba e clique do meio num link.
- [ ] **Menu de contexto da aba** (botão direito): duplicar, fixar, silenciar, fechar.
- [ ] **Downloads**: baixar um arquivo pequeno, fechar e reabrir o app; o item deve continuar listado e "mostrar na
      pasta" deve funcionar. Com "limpar ao sair" ligado, a lista deve sumir.
- [ ] **Biblioteca**: favoritar uma página, buscar no histórico, abrir um favorito da barra.
- [ ] **Permissões**: um site pedindo localização deve abrir o diálogo (exceto Google em HTTPS, que é automático).
- [ ] **Limpar ao sair**: ligar, fechar, reabrir e confirmar que histórico/cookies sumiram e as extensões
      continuam configuradas.

## 2. Motor sem provedor (verificação de unidade já cobre; aqui é fumaça)

O motor só é exercitado pela tarefa do painel de IA ou pelo benchmark via MCP, e ambos precisam de provedor. Sem
chave, dá para validar o que é determinístico:

- [ ] `npm test` na pasta do projeto: **177/177**.
- [ ] `npm run test:electron` (integração Electron; requer build/GUI).
- [ ] Abrir o painel de IA, salvar uma chave (pode ser inválida), ver a dica mascarada e o catálogo falhar com
      mensagem clara — sem travar o app.

## 3. Motor com provedor (precisa de chave OpenRouter ou DeepSeek)

Use o benchmark local, que não gasta em sites externos:

```bash
# com o app aberto, perfil padrão
node bench/avaliar.js meu-teste --conjunto=dificeis --tarefas=44 --repeticoes=1
```

- [ ] Tarefa 44 passa e, no relatório, `coverage.complete` fecha no fim (a correção do salto 1).
- [ ] No JSON do resultado, `trace.pageReads` tem as seis filiais.

Flags novas, uma por vez (cada uma é opt-in):

```bash
node bench/avaliar.js j1 --conjunto=dificeis --tarefas=44 --journal
node bench/avaliar.js s1 --conjunto=dificeis --tarefas=33 --scripts
node bench/avaliar.js x1 --conjunto=basico --tarefas=01 --repeticoes=1   # structuredExtraction via run_task
```

- [ ] `--journal`: tarefa 44 passa; `trace.effectProofs` aparece quando a verificação fecha.
- [ ] `--scripts`: tarefa 33 (formulário) passa; se falhar uma pós-condição, o resultado diz qual passo.
- [ ] Contrato de verificação: rodar via MCP `run_task` com `verify: [{kind:'text', value:'...'}]` e
      `requireVerification: true` numa fixture; sem o texto, deve retornar `success:false`.
- [ ] Receitas: `recipe save` e `recipe run` numa fixture; a segunda execução não deve chamar o modelo.
- [ ] Mint: `run_task` via MCP com `saveRecipe: "fluxo"` numa tarefa que use `run_steps` estável + `verify`;
      o resultado deve trazer `minted` e `recipe list` deve mostrar a receita. Sem contrato aprovado, deve vir
      `mintSkipped` com o motivo.

### 3.1 Planilhas e canvas (sheets + clipboard + teclado)

Numa planilha de teste (sem dados reais):

- [ ] "Leia o intervalo A1:C5" → deve usar **`sheets read`**; confira `values`, `rows`, `cells` e passos ≤ 4.
- [ ] "Escreva 3 colunas e 5 linhas em A1" → **`sheets write`** com aprovação; leia de volta para confirmar.
- [ ] "Vá para B10" → **`sheets goto`**; confira a seleção.
- [ ] Se `sheets` disser que a caixa de nome não foi encontrada: testar `sheets_accessibility` e, depois,
      `see_page` + `visual_click` (0–1000).
- [ ] No trace: `sheetsReads`, `sheetsWrites`, `sheetsCells`; sem clique em célula.

## 4. O que ainda NÃO está pronto para "release"

Estes itens não são bug do build; são gates que faltam:

- [x] Integrações Electron na árvore instalada (27/10): `test:electron` exit 0, `test:bench-store` PASS,
      `test:agent-download` PASS.
- Benchmark pareado 0.1.4 × 0.1.5-dev em suíte difícil + básica, com dois modelos.
- Grounding visual (clicar por elemento visto) não foi implementado; depende de modelo com visão.
- Publicado em `origin/main` em 28/10/2026 (`c13447e`); a tag `motor-pre-leaps-2026-10-27` também está no remoto.

## 5. Se algo der errado

- Fechar o app e reinstalar o build anterior:
  `backups/2026-10-27-before-motor-leaps/app` (cópia da instalação) ou
  `backups/2026-10-27-before-0.1.5-dev/installer/Zero Browser Setup 0.1.4.exe` (release anterior).
- Código: `git reset --hard motor-pre-leaps-2026-10-27` (antes dos saltos) ou
  `git revert <commit>` do salto específico (lista em `docs/PONTOS_DE_RESTAURACAO.md`).
- Diagnóstico: `%APPDATA%\navegante\navegante-error.log`.
