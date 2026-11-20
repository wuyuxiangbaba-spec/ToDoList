
const fs = require("fs");
const { execSync } = require("child_process");
const root = "C:\\Users\\25988\\Desktop\\.mindmap-test";
process.chdir(root);
fs.rmSync(".git", { recursive: true, force: true });
const run = (cmd) => { try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"] }); } catch (e) { return "ERR:" + (e.stdout||"") + (e.stderr||""); } };

run("git init -b main");
run("git config core.autocrlf true");
run("git config user.name lead");
run("git config user.email lead@local");

fs.copyFileSync("base.html", "x.html");
run("git add x.html");
console.log("base blob:", run('git ls-files -s x.html').trim());
run("git commit -m base");

const names = ["pwa","undo","canvas","checkin","mobile"];
for (const n of names) {
  run("git checkout -b " + n + " main");
  fs.copyFileSync("b/" + n + "/" + n + ".html", "x.html");
  run("git add x.html");
  console.log(n + " blob:", run('git ls-files -s x.html').trim());
  run('git commit -m ' + n);
}
run("git checkout main");
console.log("branches:", run("git branch --list").trim().split("\n").join(" "));
