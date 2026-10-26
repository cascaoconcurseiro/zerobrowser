const WebSocket = require('ws');
const { randomUUID } = require('crypto');

class AutomationClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.pending = new Map();
    this.reconnectTimer = null;
    this.url = null;
    this.token = '';
    this.shouldReconnect = true;
  }

  connect(url, token = this.token) {
    this.url = url;
    this.token = token;
    this.shouldReconnect = true;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });

      this.ws.on('open', () => {
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('[AutomationClient] Parse error:', err);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        if (this.shouldReconnect) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        reject(err);
      });
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.url) this.connect(this.url).catch(console.error);
    }, 3000);
  }

  handleMessage(message) {
    if (message.type === 'connected') {
      this.emit('connected', message.clientId);
    } else if (message.type === 'result') {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        pending.resolve(message.data);
        this.pending.delete(message.requestId);
      }
    } else if (message.type === 'error') {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        pending.reject(new Error(message.error));
        this.pending.delete(message.requestId);
      }
    } else if (message.type === 'event') {
      this.emit(message.event, message.data);
    }
  }

  send(type, data) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('Not connected'));
      const requestId = randomUUID();
      this.pending.set(requestId, { resolve, reject });
      this.ws.send(JSON.stringify({ type, requestId, data }));
      setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async executeAction(action) {
    return await this.send('executeAction', action);
  }

  async getTabState(tabId) {
    return await this.send('getTabState', { tabId });
  }

  async cdpCommand(tabId, method, params) {
    return await this.send('cdpCommand', { tabId, method, params });
  }

  async listTools() {
    return await this.send('listTools', {});
  }

  async getAccessibilityTree(tabId, options) {
    return await this.send('getAccessibilityTree', { tabId, options });
  }

  async executeAXAction(tabId, action) {
    return await this.send('executeAXAction', { tabId, action });
  }

  on(event, handler) {
    if (!this._events) this._events = {};
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
  }

  off(event, handler) {
    if (!this._events || !this._events[event]) return;
    this._events[event] = this._events[event].filter(h => h !== handler);
  }

  emit(event, data) {
    if (!this._events || !this._events[event]) return;
    this._events[event].forEach(h => h(data));
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

module.exports = { AutomationClient };
