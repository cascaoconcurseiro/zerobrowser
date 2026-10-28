// Texto da página para o modelo: prioriza o conteúdo principal em vez do body inteiro (menu, banner, rodapé).
// Heavy pages gastam o orçamento de texto com navegação; escolher main/article deixa o alvo visível.

function mainContentScript(limit = 3200) {
  const cap = Math.max(500, Math.min(20000, Number(limit) || 3200));
  return `(() => {
    const limit = ${cap};
    const candidates = ['main', '[role="main"]', '#content', '#main', 'article', '.main-content', '#primary', '.post-content'];
    let chosen = null;
    for (const selector of candidates) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const value = String(element.innerText || '').trim();
      if (value.length > 400) { chosen = { text: value, source: selector }; break; }
    }
    const body = String(document.body?.innerText || '');
    const text = (chosen ? chosen.text : body).slice(0, limit);
    const headings = [...document.querySelectorAll('h1,h2,h3')]
      .map((heading) => String(heading.innerText || '').replace(/\\s+/g, ' ').trim())
      .filter((name) => name && name.length <= 120)
      .slice(0, 12);
    return { text, headings, source: chosen ? chosen.source : 'body' };
  })()`;
}

module.exports = { mainContentScript };
