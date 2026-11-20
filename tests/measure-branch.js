(() => {
  const pairs = [
    ["", "p"], ["p", "a"], ["p", "b"], ["p", "c"],
    ["a", "a1"], ["a", "a2"], ["a", "a3"],
    ["b", "b1"], ["c", "c1"], ["c", "c2"]
  ];
  const cards = {};
  document.querySelectorAll(".mm-node").forEach(el => {
    const btn = el.querySelector(".node-btn");
    if (!btn) return;
    cards[el.dataset.ref] = {
      x: el.offsetLeft, y: el.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight,
      right: el.offsetLeft + btn.offsetWidth,
      top: el.offsetTop - btn.offsetHeight / 2,
      bottom: el.offsetTop + btn.offsetHeight / 2
    };
  });
  const branches = [...document.querySelectorAll(".mindmap-branch")].map((p, i) => {
    const b = p.getBBox();
    return { i, x: b.x, y: b.y, w: b.width, h: b.height, fill: p.getAttribute("fill"), d: p.getAttribute("d") };
  });
  const results = [];
  for (const [pa, ch] of pairs) {
    const P = cards[pa], C = cards[ch];
    if (!P || !C) { results.push({ pa, ch, ok: false, why: "missing card" }); continue; }
    const ex1 = P.right - 1, ey1 = P.y;
    const ex2 = C.x + 1, ey2 = C.y;
    // 分支 ribbon 的水平范围应恰好覆盖 x1..x2；y 范围应覆盖两点中心
    const hit = branches.find(b => Math.abs(b.x - Math.min(ex1, ex2)) <= 2 && Math.abs((b.x + b.w) - Math.max(ex1, ex2)) <= 2 && b.y <= Math.min(ey1, ey2) + 1 && (b.y + b.h) >= Math.max(ey1, ey2) - 1);
    results.push({ pa, ch, ok: !!hit, branches: branches.filter(b => Math.abs(b.x - Math.min(ex1, ex2)) <= 2).length, expected: { x1: ex1, y1: ey1, x2: ex2, y2: ey2 }, hit: hit ? { x: hit.x, w: hit.w, y: hit.y, h: hit.h } : null });
  }
  const verticalSpines = branches.filter(b => b.w < 20 && b.h > 40);
  return {
    branchCount: branches.length,
    edgeCount: pairs.length,
    matched: results.filter(r => r.ok).length,
    verticalSpines: verticalSpines.length,
    results,
    branches: branches.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }))
  };
})()