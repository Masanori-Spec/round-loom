import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
const root = resolve("dist");
const files = [
  "app.mjs",
  "worker.mjs",
  ...(await readdir("dist/src"))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => `src/${f}`),
];
let checked = 0;
for (const file of files) {
  const text = await readFile(`dist/${file}`, "utf8");
  for (const match of text.matchAll(
    /(?:from\s*|new URL\(\s*)["']([^"']+)["']/g,
  )) {
    const ref = match[1];
    if (!ref.startsWith("."))
      throw Error(`Unexpected runtime dependency: ${ref}`);
    const target = resolve(dirname(resolve(root, file)), ref);
    if (!target.startsWith(root + sep) || !(await stat(target)).isFile())
      throw Error(`Missing or escaping built module: ${file} -> ${ref}`);
    checked++;
  }
}
for (const file of ["index.html", "styles.css"])
  if (!(await stat(resolve(root, file))).isFile())
    throw Error(`Missing ${file}`);
console.log(`Verified ${checked} built local module references`);
