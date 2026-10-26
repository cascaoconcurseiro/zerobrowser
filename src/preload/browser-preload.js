const { contextBridge } = require('electron');

function injectAccessibilityAPI() {
  if (window.naveganteAccessibility) return;

  const getAccessibilityTree = (options = {}) => {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ error: 'timeout', nodes: [] });
      }, 5000);

      const handler = (event) => {
        if (event.data?.type === 'ax-tree-response' && event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data.tree);
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'ax-tree-request', requestId, options }, '*');
    });
  };

  const click = async (elementIndex, options = {}) => {
    return sendAction('click', { elementIndex, ...options });
  };

  const dblclick = async (elementIndex, options = {}) => {
    return sendAction('dblclick', { elementIndex, ...options });
  };

  const drag = async (fromIndex, toIndex) => {
    return sendAction('drag', { fromIndex, toIndex });
  };

  const performSecondaryAction = async (elementIndex, action) => {
    return sendAction('perform_secondary_action', { elementIndex, action });
  };

  const pressKey = async (elementIndex, key, duration) => {
    return sendAction('press_key', { elementIndex, key, duration });
  };

  const scroll = async (target, direction, pages) => {
    return sendAction('scroll', { target, direction, pages });
  };

  const selectText = async (elementIndex, prefix, suffix, selectionType) => {
    return sendAction('select_text', { elementIndex, prefix, suffix, selectionType });
  };

  const setValue = async (elementIndex, value) => {
    return sendAction('set_value', { elementIndex, value });
  };

  const typeText = async (elementIndex, text) => {
    return sendAction('type_text', { elementIndex, text });
  };

  const paste = async (elementIndex, text) => {
    return sendAction('paste', { elementIndex, text });
  };

  const sendAction = (kind, params) => {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7);
      const handler = (event) => {
        if (event.data?.type === 'ax-action-response' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          resolve(event.data.result);
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'ax-action-request', requestId, kind, params }, '*');
    });
  };

  const write = async (mode = 'state', options = {}) => {
    const tree = await getAccessibilityTree(options);
    if (mode === 'screenshot' || mode === 'both') {
      return new Promise((resolve) => {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event) => {
          if (event.data?.type === 'screenshot-response' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            resolve({ tree, screenshot: event.data.screenshot });
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'screenshot-request', requestId }, '*');
      });
    }
    return tree;
  };

  const get = async (options = {}) => {
    return getAccessibilityTree(options);
  };

  window.naveganteAccessibility = {
    click,
    dblclick,
    drag,
    performSecondaryAction,
    pressKey,
    scroll,
    selectText,
    setValue,
    typeText,
    paste,
    write,
    get
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectAccessibilityAPI);
} else {
  injectAccessibilityAPI();
}

contextBridge.exposeInMainWorld('naveganteBrowser', {
  accessibility: () => window.naveganteAccessibility,
  getUrl: () => window.location.href,
  getTitle: () => document.title,
  getFavicon: () => {
    const link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    return link ? link.href : null;
  },
  executeScript: (script) => eval(script)
});
