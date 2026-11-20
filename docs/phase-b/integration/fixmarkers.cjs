
const fs = require("fs");
const path = "C:\\Users\\25988\\Desktop\\.mindmap-test\\x.html";
let lines = fs.readFileSync(path, "utf8").split("\n");
// remove marker lines: 488, 691, 797, 3560, 3576, 3782 (1-based)
const kill = new Set([488, 691, 797, 3560, 3576, 3782]);
const out = lines.filter((l, i) => !kill.has(i + 1));
fs.writeFileSync(path, out.join("\n"));
console.log("removed", lines.length - out.length, "marker lines; new total", out.length);
