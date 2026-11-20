
const fs = require("fs");
const { execSync } = require("child_process");
const root = "C:\\Users\\25988\\Desktop\\.mindmap-test";
process.chdir(root);
const run = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); } catch (e) { return "EXITERR:\n" + (e.stdout||"") + (e.stderr||""); } };
const names = ["pwa","undo","canvas","checkin","mobile"];
for (const n of names) {
  const res = run("git merge " + n + " -m merge-" + n);
  const content = fs.readFileSync("x.html", "utf8");
  const markers = content.split("\n").filter(l => l.startsWith("<<<<<<<") || l.startsWith(">>>>>>>") || l.startsWith("=======")).length;
  console.log("=== merge " + n + " markers=" + markers + " size=" + content.length);
  if (markers > 0) {
    const lines = content.split("\n");
    lines.forEach((l, i) => { if (l.startsWith("<<<<<<<")) console.log("conflict at line " + (i+1) + ": " + l); });
    break; // stop for manual resolution
  }
}
