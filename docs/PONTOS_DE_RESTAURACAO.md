# Pontos de restauração

Regra daqui em diante: **cada evolução do motor entra em um commit próprio, com testes e documentação, e o estado
anterior fica recuperável por tag, commit ou backup**. Nada de mudanças acumuladas sem volta.

## Estado de referência (antes dos saltos do motor)

- Tag: **`motor-pre-leaps-2026-10-27`** → commit `5015071` (`docs: record 0.1.5-dev build and production install`).
- O que havia nesse ponto: 0.1.5-dev integrado, `npm test` 127/127, build instalado em produção
  (`app.asar` `3658148c…f606401`) e backup do 0.1.4 em `backups/2026-10-27-before-0.1.5-dev/`.

### Voltar o código para esse ponto

```bash
git reset --hard motor-pre-leaps-2026-10-27
```

Se houver trabalho novo que precise ser preservado, use `git branch resgate/<data>` antes do reset.

### Voltar o aplicativo instalado para 0.1.4

```bash
# com o Zero Browser fechado
backups/2026-10-27-before-0.1.5-dev/installer/"Zero Browser Setup 0.1.4.exe"
```

O `LEIA-ME.md` da pasta traz os hashes esperados e como restaurar o perfil.

## Histórico de saltos

| Data | Salto | Commit | Testes | Reversão |
|---|---|---|---:|---|
| 2026-10-27 | Pós-condições verificadas em `run_steps` (`expect: {url,text,absent}`), com espera de até 3 s e falha que interrompe o roteiro | ver `git log --oneline --grep="postconditions"` | 133/133 | `git revert <commit>` ou reset para a tag acima |

Ao adicionar um salto, acrescente a linha aqui **no mesmo commit** da mudança.

## O que um ponto de restauração precisa conter

1. Commit (ou tag) com o código exato.
2. Resultado da suíte no commit.
3. Se houve build/instalação: hash do `app.asar` e do instalador, mais o backup do app anterior.
4. O que não foi verificado, para ninguém tratar como pronto.

## Builds e instaladores

- O build instalado hoje é `0.1.5-dev` (`dist/Zero Browser Setup 0.1.5-dev.exe`, SHA-256
  `4769f4eb2905f7710a4cd426fd1d9121d49603a821596e289ab8bdc5ce82bcc4`).
- Mudanças de motor em `src/` **não** alteram o app instalado até um novo build. Enquanto isso, o código mais novo
  só existe no repositório; o app em produção continua no build de 27/10.
- Antes de qualquer novo build: `npm test`, `npm run build`, validação do `win-unpacked` em perfil isolado, backup
  do app atual e só então instalar.
