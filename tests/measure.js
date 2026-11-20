(() => {
  const cards = {};
  document.querySelectorAll(".mm-node").forEach(el => {
    const btn = el.querySelector(".node-btn");
    if (!btn) return;
    cards[el.dataset.ref] = {
      x: el.offsetLeft, y: el.offsetTop,
      w: btn.offsetWidth, h: btn.offsetHeight,
      cx: el.offsetLeft + btn.offsetWidth / 2,
      cy: el.offsetTop,
      right: el.offsetLeft + btn.offsetWidth,
      left: el.offsetLeft,
      top: el.offsetTop - btn.offsetHeight / 2,
      bottom: el.offsetTop + btn.offsetHeight / 2
    };
  });
  const paths = [...document.querySelectorAll(".mindmap-link")].map(p => {
    const len = p.getTotalLength();
    const a = p.getPointAtLength(0), b = p.getPointAtLength(len);
    const hit = document.querySelector('.mindmap-link-hit[data-link-a="' + p.dataset.dummy + '"]');
    return { d: p.getAttribute("d"), len, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
  });
  const hits = [...document.querySelectorAll(".mindmap-link-hit")].map(p => ({ a: p.dataset.linkA, b: p.dataset.linkB, d: p.getAttribute("d") }));
  const branches = [...document.querySelectorAll(".mindmap-branch")].map(p => ({ d: p.getAttribute("d"), fill: p.getAttribute("fill"), bbox: p.getBBox() }));
  return { cards, paths, hits, branches, svg: document.getElementById("mindSvg").getAttribute("viewBox"), scale: (() => { const t = getComputedStyle(document.getElementById("catTree")).transform; return t; })() };
})()