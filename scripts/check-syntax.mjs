import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "artifacts") continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith(".mjs")) out.push(p);
  }
  return out;
}
const files = (
  await Promise.all(["src", "web", "scripts", "tests"].map(walk))
).flat();
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
}
console.log(`Syntax checked ${files.length} JavaScript modules`);
