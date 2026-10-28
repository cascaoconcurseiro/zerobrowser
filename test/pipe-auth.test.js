const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { AutomationService } = require('../src/automation/service');
const { pipeTokenPath } = require('../src/automation/pipe-path');

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.written = '';
    this.destroyed = false;
  }
  setEncoding() {}
  write(chunk) { this.written += chunk; return true; }
  destroy(error) { this.destroyed = true; this.destroyError = error; }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('the token file lives beside the profile automation data', () => {
  const target = pipeTokenPath('C:\\dados\\navegante');
  assert.match(target, /automation[\\/]pipe-token$/);
});

test('the pipe refuses a client that does not authenticate first', async () => {
  const service = new AutomationService();
  service.pipeToken = 'a'.repeat(64);
  service.handleMcpRequest = async () => ({ ok: true });

  const anonymous = new FakeSocket();
  service.acceptMcpPipeClient(anonymous);
  anonymous.emit('data', '{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
  await tick();
  assert.equal(anonymous.destroyed, true, 'JSON-RPC sem token derruba a conexão');
  assert.equal(anonymous.written, '');

  const wrong = new FakeSocket();
  service.acceptMcpPipeClient(wrong);
  wrong.emit('data', `${'b'.repeat(64)}\n`);
  await tick();
  assert.equal(wrong.destroyed, true, 'token divergente é recusado');
});

test('an authenticated client gets normal MCP answers', async () => {
  const service = new AutomationService();
  service.pipeToken = 'c'.repeat(64);
  const calls = [];
  service.handleMcpRequest = async (request) => { calls.push(request.method); return { answer: request.method }; };

  const socket = new FakeSocket();
  service.acceptMcpPipeClient(socket);
  socket.emit('data', `${'c'.repeat(64)}\n{"jsonrpc":"2.0","id":7,"method":"ping"}\n`);
  await tick();
  assert.equal(socket.destroyed, false);
  assert.deepEqual(calls, ['ping']);
  assert.match(socket.written, /"id":7/);
  assert.match(socket.written, /"answer":"ping"/);
});
