(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const res = {};
  // seed: mixed tree with daily nodes, links, collapsed branch
  const today = new Date();
  const iso = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  const d0 = iso(today), d1 = iso(new Date(today.getTime()-864e5)), d2 = iso(new Date(today.getTime()-2*864e5));
  const mk = (id,name,parentId,extra) => Object.assign({id,name,parentId,done:false,completedAt:"",note:""},extra||{});
  const nodes = [
    mk("p","父节点",null),
    mk("a","子节点A","p",{collapsed:true}),
    mk("a1","每日喝水","a",{kind:"daily"}),
    mk("a2","每日锻炼","a",{kind:"daily"}),
    mk("b","子节点B","p"),
    mk("b1","孙B1","b"),
    mk("c","子节点C","p"),
    mk("c1","孙C1","c",{done:true,completedAt:"2026-11-19 08:00"})
  ];
  const dailyChecks = {};
  dailyChecks[d2] = { a1: {done:true, at:"2026-11-18 07:00"}, a2: {done:true, at:"2026-11-18 07:05"} };
  dailyChecks[d1] = { a1: {done:true, at:"2026-11-19 07:00"} };
  dailyChecks[d0] = {};
  localStorage.setItem("signin-tracker-v1", JSON.stringify({
    treeVersion:2, sidebarOpen:false, neurCrossHidden:true, catalogInserts:[],
    catalogs:[{id:"cat_t",name:"测试",archVersion:0,nodes,links:[{a:"b1",b:"c1"}],linkDone:{},dailyChecks,calendarOpen:true}],
    currentCatalogId:"cat_t"
  }));
  location.reload();
})()