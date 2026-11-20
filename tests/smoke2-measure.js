(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(400);
  const res = {};
  res.panelOpen = !!document.querySelector(".daily-aside:not(.collapsed)");
  const iso = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  const d0 = iso(new Date());
  const cell = document.querySelector('.cal-cell[data-date="' + d0 + '"]');
  res.todayFrac = cell ? (cell.querySelector(".cal-frac")||{}).textContent : null;
  res.todayFull = cell ? cell.classList.contains("full") : null;
  const a1 = document.querySelector('.mm-node[data-ref="a1"]');
  res.a1Badge = a1 ? (a1.querySelector(".daily-badge")||{}).textContent : null;
  res.a1Done = a1 ? a1.querySelector(".node-btn").classList.contains("done") : null;
  res.stats = [...document.querySelectorAll(".daily-stat")].map(e => e.textContent.trim().replace(/\s+/g," "));
  // click a1 -> check in today
  a1.querySelector(".node-btn").click();
  await sleep(700);
  const cell2 = document.querySelector('.cal-cell[data-date="' + d0 + '"]');
  res.afterClickFrac = cell2 ? (cell2.querySelector(".cal-frac")||{}).textContent : null;
  res.afterClickFull = cell2 ? cell2.classList.contains("full") : null;
  res.afterClickA1Done = document.querySelector('.mm-node[data-ref="a1"] .node-btn').classList.contains("done");
  const st = JSON.parse(localStorage.getItem("signin-tracker-v1"));
  res.savedChecks = st.catalogs[0].dailyChecks[d0];
  // streak text
  res.statsAfter = [...document.querySelectorAll(".daily-stat")].map(e => e.textContent.trim().replace(/\s+/g," "));
  // undo the check-in
  document.dispatchEvent(new KeyboardEvent("keydown", {key:"z", ctrlKey:true, bubbles:true, cancelable:true}));
  await sleep(700);
  res.afterUndoA1Done = document.querySelector('.mm-node[data-ref="a1"] .node-btn').classList.contains("done");
  const st2 = JSON.parse(localStorage.getItem("signin-tracker-v1"));
  res.afterUndoChecks = st2.catalogs[0].dailyChecks[d0];
  return res;
})()