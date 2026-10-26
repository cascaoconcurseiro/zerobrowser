function scrollSearchInPage(direction, wanted, maxRounds = 12, maxMs = 12000, stepWaitMs = 850) {
  const strip = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  wanted = strip(wanted);
  const root = document.scrollingElement || document.documentElement;
  const candidates = [...document.querySelectorAll('body *')].filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return /(auto|scroll)/.test(style.overflowY) && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
      && rect.width > 0 && rect.height > 0 && element.clientHeight > 80 && element.scrollHeight > element.clientHeight + 20;
  });
  const scroller = candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0] || root;
  if (!wanted) {
    const top = direction === 'bottom' ? scroller.scrollHeight : scroller.scrollTop + (direction === 'up' ? -600 : 600);
    scroller.scrollTo({ top: Math.max(0, Math.min(scroller.scrollHeight, top)), behavior: 'instant' });
    return { success: true, scroller: scroller === root ? 'document' : 'element' };
  }

  const started = Date.now();
  let rounds = 0;
  let boundarySignature = '';
  let boundaryRepeats = 0;
  const locate = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      if (!element || element.closest('script,style,noscript')) continue;
      const block = element.closest('tr,[role=row],li,p,dd,dt,blockquote,figcaption,h1,h2,h3,h4,h5,h6') || element;
      if (strip(block.innerText || block.textContent).includes(wanted)) return block;
    }
    return null;
  };
  const signature = () => strip(scroller.innerText || scroller.textContent || document.body?.innerText || '').slice(0, 3000);
  const finish = (found, reason) => {
    if (found) found.scrollIntoView({ block: 'center', inline: 'nearest' });
    return { success: true, found: Boolean(found), matches: found ? [String(found.innerText || found.textContent).replace(/\s+/g, ' ').slice(0, 420)] : [], rounds, reason, scroller: scroller === root ? 'document' : 'element' };
  };
  const waitForTarget = () => new Promise((resolve) => {
    let finished = false;
    let checkScheduled = false;
    let quietTimer;
    const observer = new MutationObserver(() => {
      if (finished || checkScheduled) return;
      checkScheduled = true;
      quietTimer = setTimeout(() => {
        checkScheduled = false;
        const found = locate();
        if (found) complete(found);
      }, 150);
    });
    const complete = (found) => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(deadline);
      clearTimeout(quietTimer);
      resolve(found);
    };
    const deadline = setTimeout(() => complete(locate()), stepWaitMs);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const immediate = locate();
    if (immediate) complete(immediate);
  });

  return new Promise((resolve) => {
    const step = () => {
      const found = locate();
      if (found) return resolve(finish(found, 'found'));
      if (rounds >= maxRounds || Date.now() - started >= maxMs) return resolve(finish(null, 'budget'));
      const beforeTop = scroller.scrollTop;
      const beforeSignature = signature();
      const distance = Math.max(300, scroller.clientHeight * 0.8);
      const target = direction === 'up' ? Math.max(0, beforeTop - distance) : Math.min(scroller.scrollHeight, beforeTop + distance);
      rounds++;
      scroller.scrollTo({ top: target, behavior: 'instant' });
      waitForTarget().then((match) => {
        if (match) return resolve(finish(match, 'found'));
        const afterTop = scroller.scrollTop;
        const afterSignature = signature();
        const atBoundary = direction === 'up' ? afterTop <= 1 : afterTop + scroller.clientHeight >= scroller.scrollHeight - 4;
        const noMovement = Math.abs(afterTop - beforeTop) < 1;
        if (atBoundary && noMovement && afterSignature === beforeSignature) {
          if (boundarySignature === afterSignature) boundaryRepeats++;
          else { boundarySignature = afterSignature; boundaryRepeats = 1; }
          if (boundaryRepeats >= 2) return resolve(finish(null, 'end'));
        } else {
          boundarySignature = '';
          boundaryRepeats = 0;
        }
        step();
      });
    };
    step();
  });
}

module.exports = { scrollSearchInPage };
