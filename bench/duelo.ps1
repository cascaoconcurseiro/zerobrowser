# Duelo curto: as mesmas tarefas difíceis no Flame e depois no Zero Browser, com placar ao vivo e no máximo 150 s por tarefa.
param([string]$DataDir = "$env:TEMP\zero-browser-bench")
$tarefas = '31,32,33,34,35,36,37'
Write-Host "=== FLAME ===" -ForegroundColor Yellow
node bench/avaliar.js duelo-flame --motor=flame --tarefas=$tarefas --tempo=150 --data-dir=$DataDir
Write-Host "`n=== ZERO BROWSER ===" -ForegroundColor Cyan
node bench/avaliar.js duelo-zero-browser --motor=navegante --tarefas=$tarefas --tempo=150 --data-dir=$DataDir
Write-Host "`n=== FIM ===" -ForegroundColor Green
