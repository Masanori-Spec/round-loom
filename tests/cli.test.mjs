import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const cli = resolve("src/cli.mjs"),
  fixture = resolve("fixtures/workshop.json");
const run = (args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
test("CLI creates all exports, audits independently, and refuses overwrite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "round-loom-"));
  try {
    const out = join(dir, "out");
    const first = run(["solve", fixture, out]);
    assert.equal(first.status, 0, first.stderr);
    for (const file of [
      "plan.json",
      "tables.csv",
      "routes.csv",
      "encounters.csv",
      "print.html",
    ])
      assert.ok((await readFile(join(out, file))).length > 0);
    const audit = run(["audit", join(out, "plan.json")]);
    assert.equal(audit.status, 0, audit.stderr);
    assert.equal(JSON.parse(audit.stdout).valid, true);
    assert.equal(run(["solve", fixture, out]).status, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("CLI reports usage, malformed input, contradiction, and budget exhaustion distinctly", async () => {
  assert.equal(run([]).status, 2);
  const dir = await mkdtemp(join(tmpdir(), "round-loom-"));
  try {
    const input = JSON.parse(await readFile(fixture, "utf8"));
    for (const [patch, code] of [
      [{ maxPerTable: 1 }, 3],
      [{ workBudget: 1 }, 4],
      [{ tableCount: 99 }, 2],
    ]) {
      const p = join(dir, "input.json");
      await writeFile(p, JSON.stringify({ ...input, ...patch }));
      assert.equal(run(["solve", p, join(dir, "out")]).status, code);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
