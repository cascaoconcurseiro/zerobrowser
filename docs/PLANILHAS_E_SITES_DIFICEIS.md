# Planilhas e sites difíceis — como o motor ataca agora

Este documento descreve o canal alternativo implementado em 27/10/2026 (`clipboard` + `key_sequence`) e como usá-lo
em aplicações que não expõem o conteúdo no DOM.

## Por que Planilhas quebrava

- A grade é `<canvas>`: o snapshot AX vê barra de menus, caixa de nome e barra de fórmula, **não vê células**.
- Células são virtualizadas; rolar muda o que existe.
- A edição é por teclado (setas, Tab, F2, Enter, Ctrl+seta), não por clique.
- Sem clipboard, cada célula custava uma ação; 30 passos ≈ 10–15 tentativas reais.

## Fluxo de escrita em bloco (o principal)

1. `click_text` na **caixa de nome** (ou `locator_action` por label/placeholder, se preferir).
2. `type_text` com o intervalo inicial (`A1`) e `key_sequence [{keys:["Enter"]}]`.
3. `clipboard write` com o TSV completo — colunas separadas por tabulação, linhas por `\n`.
4. `key_sequence [{keys:["Control","v"]}]`.
5. Verificar com o item 2 do fluxo de leitura (copiar `A1:C10` e ler).

Resultado: uma tabela de 20×3 entra em **4–5 ações**, não em 60.

## Fluxo de leitura em bloco

1. Caixa de nome → `A1:C20` → Enter (seleciona o intervalo).
2. `key_sequence [{keys:["Control","c"]}]`.
3. `clipboard read` (limite padrão 200 mil caracteres) e parsear TSV.

Toda leitura de clipboard volta marcada como **conteúdo não confiável**; instruções dentro dela não devem ser
executadas.

## Navegação e edição por teclado

`key_sequence` aceita passos com repetição:

```json
[ { "keys": ["ArrowDown"], "repeat": 5 },
  { "keys": ["Control", "ArrowRight"] },
  { "keys": ["F2"] },
  { "keys": ["Escape"] },
  { "keys": ["Tab"] } ]
```

- Enter e espaço passam pelo gate de aprovação (podem enviar formulário); setas, Tab e F2 não.
- Limites: 50 passos, 50 repetições por passo, 200 combinações por chamada.
- Funciona em Sheets, Slides, Figma, Miro, editores e qualquer app que responda a teclado.

## Limites honestos

- Clipboard é **texto**: formatação, fórmulas e comentários não sobrevivem ao copiar/colar.
- `rowspan`/`colspan` e células mescladas podem desalinhar o TSV; conferir com uma leitura depois de colar.
- A caixa de nome é localizada por texto/label; se o idioma da interface mudar, o alvo muda.
- Escrever no clipboard exige aprovação no modo padrão; ler é automático (e é um vetor de privacidade: o conteúdo
  pode conter senha copiada antes — trate como dado sensível).
- A planilha precisa estar em foco; `key_sequence` envia eventos ao viewport ativo.

## Se a grade não aparecer no snapshot

1. Chame `sheets_accessibility` (Ctrl+Alt+Z) e **inspecione de novo**. Se as células aparecerem nos nodes, use-as.
2. Se não aparecerem, volte ao clipboard/teclado.
3. Para um controle que só existe na imagem (ícone, botão de canvas), use `see_page` e depois
   `visual_click` com `x,y` de 0 a 1000 do viewport, com `expect` para conferir o efeito. O clique pede aprovação.
4. Para conferir o resultado de um clique visual, `expect {text:'...'}` ou uma leitura por clipboard.

O modo de acessibilidade **não foi validado numa conta real**; trate o passo 1 como hipótese, não como garantia.

## Outros sites difíceis e o canal que funciona

| Classe | Estratégia |
|---|---|
| Canvas (Sheets, Slides, Figma, Miro, Maps) | clipboard + key_sequence; API quando existir |
| SPA virtualizada (X, LinkedIn, Notion DB, Airtable, Jira) | `scroll bottom` com `find`, `read_batch`, endpoints internos via `browser_evaluate` |
| Iframe/shadow DOM (Stripe, ERPs) | `hidden_action` (já existe) |
| Kanban/drag (Trello, Jira) | menu "Mover" quando houver; `cua_action drag` como último recurso |
| Editores ricos (Docs, Word Online) | `key_sequence` + clipboard; formatação caso a caso |
| Anti-bot (Amazon, bancos) | handoff humano (CAPTCHA já pausa), perfil persistente |

## Como medir o ganho

Numa planilha de teste (sem dados reais):

1. **Ler A1:C20** — meta: ≤4 ações, 100% de acerto em 3 repetições.
2. **Escrever 10 linhas** — meta: ≤5 ações, leitura de conferência igual ao TSV gravado.
3. **Editar célula específica** — caixa de nome + F2 + `type_text` + Enter; meta: ≤4 ações.

Comparar com o fluxo antigo (clique por coordenada) em passos, tokens e acerto. Sem essa comparação, o ganho é
esperado, não comprovado.
