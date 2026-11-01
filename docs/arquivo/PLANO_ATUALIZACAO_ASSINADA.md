# Plano de atualização verificável do Zero Browser

**Estado em 28/10/2026:** não há updater no app nem feed de publicação. O alvo Windows é NSIS (`package.json`, electron-builder `26.15.7`; consulta npm mostrou `26.18.0` como última versão publicada e `electron-builder@27` retorna E404). Não configurar URL de produção nem chave de assinatura até o proprietário escolher/fornecer esses recursos.

## Decisão técnica

- NSIS é alvo suportado pelo `electron-updater`; usar esse pacote em vez do `autoUpdater` embutido no Electron para o instalador atual. Fonte: https://www.electron.build/v26/docs/features/auto-update/.
- Não usar o canal de updates com manifesto unsigned. O `electron-updater` verifica SHA-512 do artefato conforme o manifesto, mas um atacante que altere simultaneamente manifesto e arquivo poderia substituir ambos. A proteção documentada de manifestos Ed25519 assina `latest*.yml` e verifica antes de iniciar download, mas a documentação a identifica como recurso do electron-builder v27, ainda não publicado no npm na consulta feita. Fontes: https://www.electron.build/docs/features/signed-update-manifests/ e https://www.electron.build/docs/migration/v27-build-changes/.
- Publicação exige canal/feed, geração de metadata de release e chave privada fora do repositório (CI secret ou signing service); o app recebe somente a chave pública confiável. Nunca incluir a chave privada em `package.json`, arquivos versionados, `app.asar` ou artefatos.

## Implementação local assim que assinatura estável estiver disponível

1. Atualizar para uma versão publicada do electron-builder que implemente assinatura/verificação Ed25519 e instalar `electron-updater` como dependência de produção; confirmar documentação e API contra as versões exatas.
2. Criar módulo no processo principal que inicializa updater apenas em builds empacotados com feed configurado; manter `autoDownload=false`, expor status limitado via IPC confiável e exigir ação explícita para download/instalação. Mostrar versão atual, versão candidata, canal, progresso, erro e reinício pendente sem revelar URL com credenciais.
3. Configurar feed `generic` ou provider escolhido pelo proprietário somente em ambiente de release. Configuração local usa `dev-app-update.yml` e `forceDevUpdateConfig` apenas no build de teste; build local não consulta canal real.
4. Gerar chave Ed25519 descartável fora do workspace para QA; assinar manifestos de uma fixture local e embutir somente a chave pública de QA nesse build. Não reutilizar essa chave em produção.

## Aceite local obrigatório

- Construir dois instaladores NSIS de teste com `appId` de teste distinto do app de produção, duas versões, chave e diretório de dados efêmeros. Instalar ambos em diretório temporário, configurar `ZERO_USER_DATA` temporário e servir metadata/artifact somente em loopback.
- Confirmar que consulta sem atualização, consulta com update, download, cancelamento, usuário não consentindo reinício e reinício após consentimento se comportam corretamente.
- Alterar cada campo protegido do manifesto, substituir assinatura, remover assinatura, assinar com chave não confiável, alterar bytes/sha512 do artefato e interromper o download; todos devem falhar sem executar instalador e sem trocar a versão ativa.
- Revalidar Authenticode/identidade do NSIS quando assinatura de código for configurada; validar que o updater não exige nem lê credenciais de feed no cliente.
- Testar rollback/recovery com reinstalação manual da versão anterior e restauração de perfil de QA. Não alegar rollback automático até demonstrá-lo; manter release anterior e procedimento de recuperação.
- Remover chave privada de QA, feed local e diretórios temporários ao encerrar; confirmar que nenhum segredo foi escrito no workspace. A chave de produção e feed permanecem responsabilidade de release/CI.

## Gates de produção

1. Proprietário define domínio/provider do feed, canal stable/beta, política de assinatura de código Windows e procedimento de rollback.
2. Publicar uma release ponte assinada manualmente, após backup restaurável do perfil: a instalação existente 0.1.42-dev ainda não contém updater nem chave pública confiável, portanto não pode receber uma primeira atualização automática autenticada. Essa primeira migração deve ser manual e validada como instalador isolado.
3. Executar testes de tamper e upgrade/rollback na instalação isolada, revisar CI para provar que a chave privada não aparece em logs/artifacts e só então habilitar o feed ao público.

## Dependências ainda abertas

- Versão publicada de electron-builder com signed update manifests e uma versão compatível de electron-updater.
- Decisão do proprietário sobre provider/domínio de feed, política de code signing e canal de release.
- Segredos configurados por equipe de release no CI; não são lidos nem criados por esta implementação local.
- Backup verificável do perfil real antes de qualquer migração da instalação para cookie encryption já habilitada no candidato.
