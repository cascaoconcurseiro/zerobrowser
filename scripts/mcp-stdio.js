#!/usr/bin/env node
// MCP por stdio para clientes como Claude Code e Codex: repassa cada linha JSON-RPC ao pipe
// do Navegante aberto e devolve as respostas. O Navegante precisa estar rodando.
// Uso: claude mcp add navegante -- node C:\caminho\Navegante\scripts\mcp-stdio.js [--data-dir=PASTA]
const fs = require('fs');
const net = require('net');
const { automationPipePath, defaultDataDir, pipeTokenPath } = require('../src/automation/pipe-path');

const dataDir = process.argv.find((arg) => arg.startsWith('--data-dir='))?.slice('--data-dir='.length) || defaultDataDir();

let token = '';
try {
  token = fs.readFileSync(pipeTokenPath(dataDir), 'utf8').trim();
} catch {}
if (!token) {
  process.stderr.write('Token do Navegante não encontrado. Abra o Zero Browser (o token é criado ao iniciar) e tente de novo.\n');
  process.exit(1);
}

const socket = net.connect(automationPipePath(dataDir));

socket.on('connect', () => {
  // O pipe só aceita JSON-RPC depois desta linha de autenticação.
  socket.write(`${token}\n`);
  process.stdin.pipe(socket);
});
socket.on('error', (error) => {
  process.stderr.write(`Navegante não respondeu no pipe local (${error.code || error.message}). Abra o Navegante e tente de novo.\n`);
  process.exit(1);
});
socket.on('close', () => process.exit(0));
socket.pipe(process.stdout);
