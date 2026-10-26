# Duelo curto: as mesmas tarefas difíceis no Flame e depois no Navegante, com placar ao vivo e no máximo 150 s por tarefa.
param([string]$DataDir = "$env:TEMP\claude\C--Users-Wesley-Documents-Navegante\84970b2c-d834-4a02-ba2d-d60198c3c199\scratchpad\dados-teste")
$tarefas = '31,32,33,34,35,36,37'
Write-Host "=== FLAME ===" -ForegroundColor Yellow
node bench/avaliar.js duelo-flame --motor=flame --tarefas=$tarefas --tempo=150 --data-dir=$DataDir
Write-Host "`n=== NAVEGANTE ===" -ForegroundColor Cyan
node bench/avaliar.js duelo-navegante --motor=navegante --tarefas=$tarefas --tempo=150 --data-dir=$DataDir
Write-Host "`n=== FIM ===" -ForegroundColor Green
