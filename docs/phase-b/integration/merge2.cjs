
const fs = require("fs");
const { execSync } = require("child_process");
process.chdir("C:\\Users\\25988\\Desktop\\.mindmap-test");
const run = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); } catch (e) { return "EXITERR:\n" + (e.stdout||"") + (e.stderr||""); } };
run("git add x.html");
console.log(run('git commit -m merge-canvas-manual').trim().slice(0,200));
for (const n of ["checkin","mobile"]) {
  const res = run("git merge " + n + " -m merge-" + n);
  const content = fs.readFileSync("x.html", "utf8");
  const lines = content.split("\n");
  const conflines = [];
  lines.forEach((l, i) => { if (l.startsWith("<<<<<<<")) conflines.push(i+1); });
  console.log("=== merge " + n + " conflicts=" + conflines.length + " at lines: " + conflines.join(",") + " size=" + content.length);
  if (conflines.length) {
    for (const ln of conflines) {
      console.log("--- conflict at " + ln + " context:");
      console.log(lines.slice(Math.max(0,ln-3), ln+34).map((l,i)=>(ln-3+i+1)+"\t"+l).join("\n"));
    }
    break;
  }
}
