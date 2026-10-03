import { mkdir, copyFile, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/src", { recursive: true });
for (const f of ["schema.mjs", "validate.mjs", "solver.mjs", "export.mjs"])
  await copyFile(`src/${f}`, `dist/src/${f}`);
for (const f of ["index.html", "app.mjs", "styles.css", "worker.mjs"])
  await copyFile(`web/${f}`, `dist/${f}`);
// Source and deployed worker use the same sibling src/ directory contract.
for (const f of ["app.mjs", "worker.mjs"]) {
  const { readFile, writeFile } = await import("node:fs/promises");
  await writeFile(
    `dist/${f}`,
    (await readFile(`dist/${f}`, "utf8")).replace(
      /(["'])\.\.\/src\//g,
      "$1./src/",
    ),
  );
}
console.log("Built dist/ (static, no external requests)");
