(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const card = id => {
    const el = document.querySelector('.mm-node[data-ref="' + id + '"]');
    const btn = el && el.querySelector('.node-btn');
    return el && btn ? { x: el.offsetLeft, y: el.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight, right: el.offsetLeft + btn.offsetWidth, left: el.offsetLeft, top: el.offsetTop - btn.offsetHeight / 2, bottom: el.offsetTop + btn.offsetHeight / 2 } : null;
  };
  const link = (a, b) => {
    const p = document.querySelector('.mindmap-link-hit[data-link-a="' + a + '"][data-link-b="' + b + '"]');
    if (!p) return null;
    const len = p.getTotalLength();
    const s = p.getPointAtLength(0), e = p.getPointAtLength(len);
    return { d: p.getAttribute('d'), a: { x: s.x, y: s.y }, b: { x: e.x, y: e.y }, len };
  };
  const before = { a1: card('a1'), b1: card('b1'), link: link('a1','b1') };
  document.querySelector('.mm-node[data-ref="a1"] .node-btn').click();
  await sleep(1200);
  const after = { a1: card('a1'), b1: card('b1'), link: link('a1','b1') };
  return { before, after };
})()