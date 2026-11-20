
const fs = require("fs");
const { execSync } = require("child_process");
const root = "C:\\Users\\25988\\Desktop\\.mindmap-test";
process.chdir(root);
const run = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", stdio: ["ignore","pipe","pipe"], ...opts });

// 1. init repo if needed
if (!fs.existsSync(".git")) { run("git init"); }
run("git config core.autocrlf false");
run("git config user.name lead");
run("git config user.email lead@local");

// 2. base commit with blob b5cf6a1
fs.copyFileSync("base.html", "x.html");
const hash = run("git hash-object x.html").trim();
console.log("x.html blob:", hash);
if (hash.indexOf("b5cf6a1") !== 0) { console.log("WARNING: base blob mismatch vs patch pre-image b5cf6a1"); }
run("git add x.html");
try { run("git commit -m base"); } catch(e) { console.log("commit base:", e.stdout, e.stderr); }

// 3. rewrite + apply each patch with 3way
const names = ["pwa","undo","canvas","checkin","mobile"];
for (const n of names) {
  const raw = fs.readFileSync("b/" + n + "/" + n + ".patch", "utf8");
  const lines = raw.split("\n");
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    if (lines[i].startsWith("diff --git ")) lines[i] = "diff --git a/x.html b/x.html";
    else if (lines[i].startsWith("--- ")) lines[i] = "--- a/x.html";
    else if (lines[i].startsWith("+++ ")) lines[i] = "+++ b/x.html";
  }
  const fixed = "integ-" + n + ".patch";
  fs.writeFileSync(fixed, lines.join("\n"));
  let out = "", code = 0;
  try {
    run("git apply --3way --whitespace=nowarn " + fixed);
  } catch (e) {
    code = 1; out = (e.stdout || "") + (e.stderr || "");
  }
  const content = fs.readFileSync("x.html", "utf8");
  const conflicts = (content.match(/^(<<<<<<<|>>>>>>>)/gm) || []).length;
  console.log("APPLIED " + n + " exit=" + code + " conflictMarkers=" + conflicts + (out ? " OUT: " + out.split("\n").slice(0,6).join(" | ") : ""));
  if (code === 0 || conflicts > 0 || content !== "") {
    run("git add x.html");
    try { run("git commit -m integrate-" + n); } catch(e) { console.log("commit " + n + ":", (e.stderr||"").split("\n")[0]); }
  }
}
console.log("final size:", fs.statSync("x.html").size);
