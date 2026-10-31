# Inventário de Compatibilidade de Extensões do Chrome no Zero Browser (Electron)

> **Data:** 31/10/2026
> **Regra do plano (`PLANO_NAVEGADOR_NATIVO_IA.md` §Fase 6):** Não prometer "compatibilidade com extensões do Chrome" sem esta tabela pública. Electron suporta apenas um subconjunto das APIs Manifest V3 (`chrome.*`).

## 1. Status das APIs `chrome.*` no Electron (`session.extensions`)

| API / Recurso | Status no Zero Browser | Observações e Limitações |
|---|---|---|
| `chrome.runtime` (`sendMessage`, `onMessage`, `getURL`, `getManifest`) | Suportado | Comunicação entre background service worker, content scripts e popup funciona em extensões unpacked. |
| `chrome.storage.local` / `chrome.storage.session` | Suportado | Isolado por perfil (`persist:profile-*`). `chrome.storage.sync` não sincroniza na nuvem. |
| `chrome.tabs` (`query`, `create`, `update`, `remove`, `sendMessage`) | Parcialmente suportado | Funciona nas abas da janela ativa; propriedades exclusivas do Chrome desktop (`groupId` nativo, `discarded`) têm cobertura limitada. |
| `chrome.scripting` (`executeScript`, `insertCSS`) | Suportado com concessão `activeTab` | Integrado ao gerenciador de extensões do Zero Browser (`extensions:invoke-action`). |
| `chrome.webRequest` / `declarativeNetRequest` | Parcialmente suportado | Filtros básicos funcionam; o Guardian do Zero Browser já aplica bloqueio nativo de rastreadores (`AdTrackerListFilter`). |
| `chrome.cookies` | Suportado (restrito ao perfil) | Isolado por sessão de Bot/perfil; nunca exposto sem permissão declarada no `manifest.json`. |
| `chrome.alarms`, `chrome.i18n`, `chrome.Idle` | Suportado | Operam normalmente em service workers MV3. |
| `chrome.identity` (OAuth Chrome Web Store / conta Google do navegador) | Não suportado | Extensões que exigem login integrado à conta Google do Chrome não funcionam. |
| Instalação direta da Chrome Web Store (`.crx`) | Não suportado | Apenas extensões em pasta descompactada (*unpacked*) auditáveis localmente. |

## 2. Teste de Extensões Comuns (Manifest V3 Unpacked)

| Categoria | Exemplo testado / perfil de API | Resultado | Alternativa nativa no Zero Browser |
|---|---|---|---|
| Bloqueador de anúncios / rastreadores (ex.: uBlock Origin Lite MV3) | `declarativeNetRequest` + `storage.local` | Compatível (unpacked) | Filtro nativo `AdTrackerListFilter` integrado ao Guardian com contador por página e exceção por site. |
| Gerenciador de senhas (ex.: Bitwarden MV3 unpacked) | `runtime`, `storage.local`, `tabs`, `scripting`, `contextMenus` | Compatível para preenchimento via popup/atalho (`activeTab`) | Cofre local com `safeStorage` + importador seguro de CSV (`SecureCsvPasswordImporter`). |
| Leitor / Tradutor de página / Injetor de CSS (ex.: Dark Reader unpacked) | `scripting`, `tabs`, `storage.local` | Compatível | Modo escuro nativo + resumo/tradução via modo Delegar. |
| Web Clippers / Capturadores de notas | `activeTab`, `scripting`, `storage` | Compatível | Bot de leitura / Conector de Arquivos Locais (`NativeConnectorsHub`). |
| Extensões dependentes de `chrome.identity` ou DRM Widevine proprietário | `identity.getAuthToken`, `tabCapture` | Incompatível | Usar login web padrão na aba isolada do perfil/Bot. |

