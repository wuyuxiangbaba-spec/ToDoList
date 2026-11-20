(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(400);
  const de = document.documentElement;
  return {
    innerWidth: window.innerWidth,
    clientWidth: de.clientWidth,
    scrollWidth: de.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    hasHScrollbar: de.clientWidth < de.scrollWidth && getComputedStyle(document.body).overflowX !== "hidden",
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    hamburger: !!document.querySelector(".sidebar-drawer-toggle, #sidebarToggleBtn, [data-drawer-toggle], .nav-drawer-btn, #mobileMenuBtn") || [...document.querySelectorAll("button")].some(b => /目录|☰|菜单/.test((b.title||"") + (b.textContent||""))),
    stageOverflow: getComputedStyle(document.querySelector(".mindmap-stage") || document.body).overflow,
    toolbarVisible: !!document.querySelector(".canvas-toolbar")
  };
})()