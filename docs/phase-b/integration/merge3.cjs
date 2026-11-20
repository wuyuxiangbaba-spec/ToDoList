
const fs = require("fs");
const { execSync } = require("child_process");
process.chdir("C:\\Users\\25988\\Desktop\\.mindmap-test");
const run = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); } catch (e) { return "EXITERR:\n" + (e.stdout||"") + (e.stderr||""); } };
run("git add x.html");
console.log(run('git commit -m merge-checkin-manual').trim().split("\n")[0]);
const res = run("git merge mobile -m merge-mobile");
const content = fs.readFileSync("x.html", "utf8");
const lines = content.split("\n");
const conflines = [];
lines.forEach((l, i) => { if (l.startsWith("<<<<<<<")) conflines.push(i+1); });
console.log("=== merge mobile conflicts=" + conflines.length + " at: " + conflines.join(",") + " size=" + content.length);
for (const ln of conflines) {
  console.log("--- conflict at " + ln + ":");
  console.log(lines.slice(Math.max(0,ln-2), Math.min(lines.length, ln+40)).map((l,i)=>(Math.max(0,ln-2)+i+1)+"\t"+l).join("\n"));
}
