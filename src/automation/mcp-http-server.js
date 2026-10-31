'use strict';

const http = require('node:http');

class McpLoopbackHttpServer {
  constructor({ registry } = {}) {
    if (!registry) throw new TypeError('McpClientRegistry é obrigatório para o servidor MCP loopback.');
    this.registry = registry;
    this.server = null;
    this.port = null;
  }

  async start(port = 0) {
    if (this.server) return { host: '127.0.0.1', port: this.port };
    this.server = http.createServer((req, res) => this._handleRequest(req, res));
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve();
      });
    });
    return { host: '127.0.0.1', port: this.port };
  }

  async stop() {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;
    this.port = null;
    await new Promise((resolve) => srv.close(() => resolve()));
  }

  _extractBearer(req) {
    const authHeader = String(req.headers?.authorization || '');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
  }

  _sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  }

  _handleRequest(req, res) {
    const remoteAddress = req.socket?.remoteAddress || '';
    if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::ffff:127.0.0.1' && remoteAddress !== '::1') {
      return this._sendJson(res, 403, { error: 'LOOPBACK_ONLY', message: 'Conexões externas são proibidas.' });
    }

    const token = this._extractBearer(req);
    if (!token) {
      return this._sendJson(res, 401, { error: 'MISSING_BEARER_TOKEN', message: 'Informe Authorization: Bearer <token>.' });
    }

    if (req.method === 'GET' && req.url === '/cdp/info') {
      const auth = this.registry.authorizeCall({ token, tool: 'browser_cdp_send', args: {} });
      if (!auth.allowed) {
        return this._sendJson(res, 403, auth);
      }
      return this._sendJson(res, 200, {
        allowed: true,
        host: '127.0.0.1',
        wsEndpoint: `ws://127.0.0.1:${this.port}/devtools/browser/${auth.clientId}`,
        level: auth.level
      });
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 1_000_000) req.destroy();
      });
      req.on('end', () => {
        let body = {};
        try {
          body = JSON.parse(raw || '{}');
        } catch {
          return this._sendJson(res, 400, { error: 'INVALID_JSON' });
        }
        const tool = String(body.tool || '');
        const args = body.args || {};
        const result = this.registry.executeDiagnosticTool({ token, tool, args });
        const status = result.allowed ? 200 : 403;
        return this._sendJson(res, status, result);
      });
      return;
    }

    return this._sendJson(res, 404, { error: 'NOT_FOUND' });
  }
}

module.exports = { McpLoopbackHttpServer };

