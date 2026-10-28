// Nome acessível (accname) reduzido, seguindo a ordem do algoritmo W3C: aria-labelledby, aria-label, rótulo nativo,
// title, placeholder e conteúdo. Implementação própria inspirada na especificação; nenhuma linha copiada do
// Playwright. Usada no snapshot AX e nos locators para nomear controles de forma consistente.

function accessibleName(element, options = {}) {
  if (!element || options.seen?.has(element)) return '';
  const seen = options.seen || new Set();
  seen.add(element);
  const depth = Number(options.depth) || 0;
  if (depth > 8) return '';
  const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const attr = (name) => {
    try { return element.getAttribute ? element.getAttribute(name) : null; } catch { return null; }
  };
  const isHidden = (node) => {
    if (!node) return false;
    try {
      if (node.hidden === true || (node.getAttribute && node.getAttribute('aria-hidden') === 'true')) return true;
      const doc = node.ownerDocument;
      const view = doc && doc.defaultView;
      if (view && typeof view.getComputedStyle === 'function') {
        const style = view.getComputedStyle(node);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return true;
      }
    } catch {}
    return false;
  };
  const doc = element.ownerDocument;

  // 1. aria-labelledby (ids em ordem, texto alternativo de cada alvo)
  const labelledBy = attr('aria-labelledby');
  if (labelledBy && doc && typeof doc.getElementById === 'function') {
    const parts = String(labelledBy).split(/\s+/).map((id) => {
      const target = doc.getElementById(id);
      if (!target || isHidden(target)) return '';
      return accessibleName(target, { ...options, seen, depth: depth + 1, fromContent: true });
    }).filter(Boolean);
    if (norm(parts.join(' '))) return norm(parts.join(' '));
  }

  // 2. aria-label
  const ariaLabel = attr('aria-label');
  if (norm(ariaLabel)) return norm(ariaLabel);

  const tag = String(element.tagName || '').toLowerCase();
  const type = String(element.type || '').toLowerCase();

  // 3. Rótulo nativo
  if (tag === 'img' || tag === 'area') {
    const alt = attr('alt');
    if (norm(alt)) return norm(alt);
  }
  if (tag === 'input' && ['button', 'submit', 'reset'].includes(type)) {
    if (norm(element.value)) return norm(element.value);
  }
  if (['input', 'textarea', 'select'].includes(tag)) {
    const labels = element.labels ? Array.from(element.labels) : [];
    if (labels.length) {
      const text = labels
        .map((label) => accessibleName(label, { ...options, seen, depth: depth + 1, fromContent: true }))
        .filter(Boolean)
        .join(' ');
      if (norm(text)) return norm(text);
    }
  }
  if (tag === 'button') {
    const content = norm(element.textContent);
    if (content) return content;
  }

  // 4. title
  const title = attr('title');
  if (norm(title)) return norm(title);

  // 5. placeholder
  const placeholder = attr('placeholder');
  if (norm(placeholder)) return norm(placeholder);

  // 6. Nome a partir do conteúdo (papéis e elementos nomeáveis por conteúdo)
  const role = String(attr('role') || '').toLowerCase();
  const contentRoles = ['button', 'link', 'heading', 'cell', 'gridcell', 'rowheader', 'columnheader', 'tab', 'menuitem', 'option', 'checkbox', 'radio', 'switch', 'treeitem'];
  const contentTags = ['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary', 'label', 'legend', 'caption'];
  if (options.fromContent || contentRoles.includes(role) || contentTags.includes(tag)) {
    const content = norm(element.textContent);
    if (content) return content;
  }

  // 7. Valor de campo de texto (sem campos sensíveis)
  if (['input', 'textarea'].includes(tag) && !options.sensitive && norm(element.value)) return norm(element.value);
  return '';
}

module.exports = { accessibleName };
