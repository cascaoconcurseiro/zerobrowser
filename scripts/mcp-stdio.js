#!/usr/bin/env node
// MCP por stdio para clientes como Claude Code e Codex: repassa cada linha JSON-RPC ao pipe
// do Navegante aberto e devolve as respostas. O Navegante precisa estar rodando.
// Uso: claude mcp add navegante -- node C:\caminho\Navegante\scripts\mcp-stdio.js [--data-dir=PASTA]
const net = require('net');
const { automationPipePath, defaultDataDir } = require('../src/automation/pipe-path');

const dataDir = process.argv.find((arg) => arg.startsWith('--data-dir='))?.slice('--data-dir='.length) || defaultDataDir();
const socket = net.connect(automationPipePath(dataDir));

socket.on('error', (error) => {
  process.stderr.write(`Navegante não respondeu no pipe local (${error.code || error.message}). Abra o Navegante e tente de novo.\n`);
  process.exit(1);
});
socket.on('close', () => process.exit(0));
process.stdin.pipe(socket);
socket.pipe(process.stdout);
