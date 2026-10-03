#!/usr/bin/env node
import { mkdir, writeFile, access, open } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseJSON, InputError } from "./schema.mjs";
import { solve } from "./solver.mjs";
import { verifyDocument } from "./validate.mjs";
import { exportsFor } from "./export.mjs";
export async function main(args) {
  const [command, file, out, ...rest] = args;
  if (
    rest.length ||
    !file ||
    !["solve", "audit"].includes(command) ||
    (command === "solve" && !out) ||
    (command === "audit" && out)
  ) {
    console.error(
      "Usage: node src/cli.mjs solve input.json NEW_OUTPUT_DIR\n       node src/cli.mjs audit plan.json",
    );
    return 2;
  }
  try {
    const handle = await open(
      file,
      constants.O_RDONLY | (constants.O_NONBLOCK ?? 0),
    );
    let raw;
    try {
      const info = await handle.stat();
      if (!info.isFile())
        throw new InputError("Input must be a regular JSON file");
      if (info.size > 262144) throw new InputError("JSON file exceeds 256 KiB");
      const bytes = Buffer.alloc(262145);
      let length = 0;
      while (length < bytes.length) {
        const { bytesRead } = await handle.read(
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 262144) throw new InputError("JSON file exceeds 256 KiB");
      raw = parseJSON(bytes.subarray(0, length).toString("utf8"));
    } finally {
      await handle.close();
    }
    if (command === "audit") {
      const plan = verifyDocument(raw);
      console.log(JSON.stringify({ valid: true, audit: plan.audit }, null, 2));
      return 0;
    }
    const result = solve(raw);
    if (result.status !== "best-found") {
      console.error(JSON.stringify(result, null, 2));
      return result.status === "contradiction" ? 3 : 4;
    }
    const dir = resolve(out);
    try {
      await access(dir);
      throw new InputError(
        "Output path already exists; choose a new directory",
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await mkdir(dir, { recursive: false });
    const files = exportsFor(result.plan);
    for (const [name, key] of [
      ["plan.json", "json"],
      ["tables.csv", "tablesCSV"],
      ["routes.csv", "routesCSV"],
      ["encounters.csv", "matrixCSV"],
      ["print.html", "printHTML"],
    ])
      await writeFile(join(dir, name), files[key], { flag: "wx" });
    console.log(
      JSON.stringify(
        {
          status: result.status,
          output: dir,
          uniquePairs: result.plan.audit.uniquePairs,
          repeatEncounters: result.plan.audit.repeatEncounters,
          workUsed: result.plan.search.workUsed,
        },
        null,
        2,
      ),
    );
    return 0;
  } catch (e) {
    console.error(e.message);
    return 2;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = await main(process.argv.slice(2));
