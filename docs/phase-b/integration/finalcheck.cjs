
const fs = require("fs");
const { execSync } = require("child_process");
process.chdir("C:\\Users\\25988\\Desktop\\.mindmap-test");
const run = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); } catch (e) { return "EXITERR:\n" + (e.stdout||"") + (e.stderr||""); } };
run("git add x.html");
console.log(run('git commit -m merge-mobile-manual').trim().split("\n")[0]);
// syntax check integrated file
const c = fs.readFileSync("x.html", "utf8");
const m = c.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
console.log("script blocks:", m.length);
let i = 0;
for (const blk of m) {
  i++;
  const body = blk.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
  fs.writeFileSync("check-" + i + ".js", body);
  const res = run("node --check check-" + i + ".js");
  console.log("block", i, "bytes", body.length, "->", res === "" ? "SYNTAX OK" : res.trim().split("\n")[0]);
}
