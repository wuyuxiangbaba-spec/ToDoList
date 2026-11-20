(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(300);
  const res = { elems: {}, flow: {} };
  for (const id of ["undoBtn","redoBtn","themeToggleBtn","zoomInBtn","zoomOutBtn","zoomLabelBtn","fitViewBtn","expandAllBtn","searchInput","dailyRail","calGrid"]) {
    const el = document.getElementById(id);
    res.elems[id] = !!el;
  }
  res.elems.dailyAside = !!document.querySelector(".daily-aside:not(.collapsed)");
  // collapsed branch a -> children hidden, badge shown
  res.flow.nodeCount = document.querySelectorAll(".mm-node").length;
  const badge = document.querySelector(".node-fold-badge");
  res.flow.collapseBadge = badge ? badge.textContent : null;
  // calendar cells with fraction for today
  const todayIso = (() => { const t=new Date(); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0"); })();
  const cellToday = document.querySelector('.cal-cell[data-date="' + todayIso + '"]');
  res.flow.todayCellFrac = cellToday ? (cellToday.querySelector(".cal-frac")||{}).textContent : null;
  // streak + rate text
  const stats = [...document.querySelectorAll(".daily-stat")].map(e => e.textContent.trim().replace(/\s+/g," "));
  res.flow.dailyStats = stats;
  // link still drawn and attached
  const hits = [...document.querySelectorAll(".mindmap-link-hit")].map(p => ({a:p.dataset.linkA,b:p.dataset.linkB}));
  res.flow.links = hits;
  // daily node visual: find node a1 badge
  const a1 = document.querySelector('.mm-node[data-ref="a1"]');
  res.flow.dailyBadge = a1 ? (a1.querySelector(".daily-badge")||{}).textContent : null;
  // theme toggle
  const tb = document.getElementById("themeToggleBtn");
  const before = document.documentElement.getAttribute("data-theme") || "light";
  tb.click(); await sleep(250);
  const after = document.documentElement.getAttribute("data-theme");
  tb.click(); await sleep(250);
  const restored = document.documentElement.getAttribute("data-theme") || "light";
  res.flow.theme = { before, after, restored, key: localStorage.getItem("signin-tracker-theme") };
  // search
  const si = document.getElementById("searchInput");
  const cs = document.getElementById("canvasSearch");
  if (cs) cs.classList.add("open");
  si.value = "孙"; si.dispatchEvent(new Event("input",{bubbles:true}));
  await sleep(400);
  res.flow.searchCount = (document.getElementById("searchCount")||{}).textContent || null;
  res.flow.searchDim = document.querySelectorAll(".mm-node.search-dim").length;
  si.value = ""; si.dispatchEvent(new Event("input",{bubbles:true}));
  await sleep(200);
  // zoom toolbar
  const zl = document.getElementById("zoomLabelBtn");
  res.flow.zoomLabel = zl ? zl.textContent : null;
  // undo: toggle b1 (once node), then Ctrl+Z
  const b1btn = document.querySelector('.mm-node[data-ref="b1"] .node-btn');
  const doneBefore = b1btn.classList.contains("done");
  b1btn.click(); await sleep(500);
  const doneAfter = b1btn && document.querySelector('.mm-node[data-ref="b1"] .node-btn').classList.contains("done");
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"z", ctrlKey:true, bubbles:true, cancelable:true}));
  await sleep(600);
  const doneUndone = document.querySelector('.mm-node[data-ref="b1"] .node-btn').classList.contains("done");
  const undoBtn = document.getElementById("undoBtn");
  res.flow.undo = { doneBefore, doneAfter, doneUndone, undoDisabledAfterUse: undoBtn.disabled };
  // viewport metrics for mobile later
  res.flow.viewport = { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.scrollingElement.scrollWidth };
  return res;
})()