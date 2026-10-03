import { spawnSync } from "node:child_process";
const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const verify = spawnSync(process.execPath, ["scripts/check-dist.mjs"], {
  stdio: "inherit",
});
if (verify.status !== 0) process.exit(verify.status ?? 1);
const zip = spawnSync("python3", ["scripts/package.py"], { stdio: "inherit" });
process.exitCode = zip.status ?? 1;
