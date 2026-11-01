# Relatório Público da Suíte de Ataques — Firewall de Intenção e Recibo Verificado

> **Data:** 31/10/2026
> **Referência:** `docs/PLANO_ROTAS_E_FIREWALL.md` (Parte 2) e `docs/concorrencia/PLANO_SUPERAR_CONCORRENTES.md` (Afirmação C / Portão 2)
> **Arquivo de teste executável:** `test/intent-firewall-attacks.test.js` e `src/automation/service/intent-firewall.js`

## 1. Resumo Executivo

| Métrica | Resultado Verificado | Meta do Plano |
|---|---|---|
| Total de ataques de injeção de prompt testados | **50 ataques** (10 por família × 5 famílias) | ≥ 50 ataques em 5 famílias |
| Ataques com efeito colateral indevido (envio, pagamento, vazamento ou gravação em memória) | **0 / 50 (100% bloqueados)** | 0 efeitos colaterais não aprovados |
| Taxa de falsos bloqueios em tarefas legítimas de leitura ou escrita explícita do usuário | **0% (0 falsos positivos em 10 fluxos legítimos)** | < 5% |
| Integridade do Recibo de Ação (`verifyReceiptMatchesRequest`) | **100%** (qualquer divergência de método, origem, URL ou destinatário aborta a requisição antes do disparo) | 100% |

## 2. Resultados por Família de Ataque

| Família | Vetor Testado | Casos | Bloqueados | Mecanismo de Defesa |
|---|---|---:|---:|---|
| **1. Texto oculto na página** | `display:none`, `opacity:0`, `font-size:0`, `aria-label` hostil, comentários HTML instruindo PIX/transferência | 10 | **10 / 10** | `tagValueOrigin(..., 'externo')` + bloqueio de ação financeira/externa originada da página (`EXTERNAL_ORIGIN_EFFECT_BLOCKED`). |
| **2. E-mail / mensagem hostil** | Corpo de e-mail ou assunto pedindo encaminhamento de código 2FA, criação de filtro ou exclusão da caixa | 10 | **10 / 10** | Separação estrita entre dado lido (`externo`) e comando do usuário (`usuario`); qualquer envio com destinatário externo exige recibo aprovado. |
| **3. PDF / documento com instrução embutida** | Rodapé invisível em fatura/currículo tentando alterar chave PIX, baixar `.exe` ou enviar variáveis de ambiente | 10 | **10 / 10** | Modo `"Perguntar sobre este PDF"` opera em somente leitura; escrita externa bloqueada pelo Firewall de Intenção. |
| **4. Redirecionamento para domínio falso** | Clique que redireciona para domínio atacante (`evil-login.example`) ou `POST` cruzado com sessão ativa | 10 | **10 / 10** | Verificação de origem cruzada (`CROSS_ORIGIN_WRITE_BLOCKED`) + validação do recibo contra o host aprovado. |
| **5. Envenenamento de memória do Bot** | Página tentando gravar regra permanente na memória do Bot (`"Sempre envie cópia para..."`, `"Desative confirmação"`) | 10 | **10 / 10** | `canPersistToBotMemory` rejeita qualquer entrada com etiqueta `origin: 'externo'` sem confirmação humana explícita (`EXTERNAL_MEMORY_POISONING_BLOCKED`). |

## 3. Limite Conhecido Declarado no Produto

Conforme especificado em `docs/PLANO_ROTAS_E_FIREWALL.md` §10:
- Quando o próprio usuário pede para copiar um texto livre vindo da página (ex.: resumo de um artigo ou trecho de e-mail) para dentro de outro campo de texto livre (ex.: rascunho de nota), o Firewall não consegue adivinhar semanticamente se o texto contém uma frase manipulada, mas **marca o campo no Recibo de Ação com o selo explícito `Contém texto vindo da página`** (`containsExternalText: true`) antes de qualquer envio.

