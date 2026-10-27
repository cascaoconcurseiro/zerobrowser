# Plano: trocar o nome interno "navegante" e criar perfis

Status: PLANO. Nada disto foi implementado, porque mexe em dados do usuário e só se valida com o app instalado rodando.

## 1. Onde "navegante" ainda vive

| Item | Valor atual | Arquivo | Efeito de trocar sem migrar |
|---|---|---|---|
| Nome do app / pasta de dados | `app.setName('navegante')` → `%APPDATA%\navegante` | `src/main/main.js:18` | Perfil novo e vazio: perde logins, histórico, favoritos, configurações, chaves de provedor. |
| Partição do navegador | `persist:navegante` | `src/main/main.js:52` | Cookies, logins e localStorage somem. |
| `appId` | `com.wesley.navegante` | `package.json:43` | O instalador deixa de reconhecer a instalação atual (duplica atalhos e desinstalador, quebra a atualização). |
| Pipe MCP | `\\.\pipe\navegante-automation-<hash>` | `src/automation/pipe-path.js` | Clientes MCP e o benchmark deixam de achar o app. |
| Variáveis | `NAVEGANTE_USER_DATA`, `NAVEGANTE_DATA_DIR`, `NAVEGANTE_AGENT_DIAGNOSTICS` | main, pipe-path, service | Scripts e testes quebram. |
| Esquema interno | `navegante://newtab` | renderer, main | Abas salvas e favoritos com esse endereço quebram. |
| Log de erro | `navegante-error.log` | main | Só cosmético. |

## 2. Estratégia recomendada (migração em duas fases)

Fase A — aceitar os dois nomes, sem mover dados:
1. Aceitar `ZERO_*` além de `NAVEGANTE_*` nas variáveis (lê o novo primeiro, cai no antigo).
2. Aceitar `zero://newtab` e `navegante://newtab` (já existe) e gravar só `zero://` daqui em diante.
3. Pipe: abrir o novo nome `zero-automation-<hash>` e manter o antigo por 2 versões; `scripts/mcp-stdio.js` e o benchmark tentam o novo e caem no antigo.
4. Só rótulos visíveis mudam (produto já é "Zero Browser").

Fase B — mover a pasta de dados, com rede de segurança:
1. No primeiro start da versão nova: se `%APPDATA%\zero-browser` não existe e `%APPDATA%\navegante` existe, COPIAR (não mover) a pasta inteira e gravar um marcador `migrado-de-navegante.json` com data e contagem de arquivos/bytes.
2. Conferir contagem e tamanho da cópia; só então apontar `userData` para a nova pasta. Se algo falhar, seguir com a pasta antiga e registrar no log.
3. Partição: renomear `persist:navegante` para `persist:zero` ao mesmo tempo copia a pasta `Partitions\navegante`; se a cópia falhar, manter `persist:navegante`.
4. Manter a pasta antiga intacta por pelo menos 2 versões (backup natural); oferecer limpeza só com confirmação do usuário.
5. `appId`: manter `com.wesley.navegante` até existir um instalador de transição. Trocar o appId exige instalar a versão nova por cima e remover a antiga (atenção ao efeito colateral já registrado no HANDOFF: instalador com mesmo appId substitui a instalação).

Antes da Fase B: fazer backup completo do perfil (padrão de `backups/2026-10-26-before-0.1.4`, 762 MB) e testar a migração numa cópia com `NAVEGANTE_USER_DATA` apontando para uma pasta de teste.

Critérios de aceite: depois de atualizar, o usuário continua logado nos sites, com favoritos, histórico, downloads, chaves e configurações; MCP e benchmark continuam achando o app; atualização automática continua funcionando.

## 3. Perfis (como o Chrome)

Hoje há um único perfil. O app já aceita `NAVEGANTE_USER_DATA`, e o Electron trava instância única por pasta de dados, então dois perfis podem rodar ao mesmo tempo como processos separados.

Desenho mínimo:
1. Lista de perfis num arquivo `perfis.json` na pasta base (nome, pasta, cor). O perfil atual vira "Principal".
2. Menu "Perfis": trocar/abrir perfil = iniciar nova instância do app com `NAVEGANTE_USER_DATA=<pasta do perfil>` (`child_process.spawn` do próprio executável, destacado).
3. Cada perfil tem partição, histórico, favoritos, downloads e chaves próprios; o pipe MCP já é único por pasta de dados (hash inclui o diretório), então não há conflito.
4. Indicador do perfil na janela (cor/nome no título) para não agir no perfil errado.
5. Criar/renomear/excluir perfil: excluir apaga a pasta, portanto exige confirmação explícita e nunca age no perfil em uso.

Riscos: duas janelas de processos diferentes disputando a mesma pasta se o travamento falhar; chaves de provedor ficam por perfil (aviso na criação); exclusão é irreversível.

Ordem sugerida: Fase A (barata e reversível) → perfis (usam a infraestrutura de `NAVEGANTE_USER_DATA`) → Fase B (a mais arriscada, por último e com backup).

## 4. Validação necessária (precisa do app rodando)

- Migração numa cópia do perfil real; conferir logins em 2 ou 3 sites, favoritos, histórico, downloads e chave do provedor.
- Atualizar por cima da instalação 0.1.4 e conferir atalhos e desinstalador.
- Abrir dois perfis ao mesmo tempo e rodar `npm run bench` em cada um com `--data-dir`.
