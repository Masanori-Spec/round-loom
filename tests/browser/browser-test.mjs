import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { verifyDocument } from "../../src/validate.mjs";
const dir = process.env.BROWSER_ARTIFACT_DIR ?? "tests/browser/artifacts",
  base = process.env.BASE_URL ?? "http://127.0.0.1:4173";
await mkdir(dir, { recursive: true });
const results = [],
  errors = [],
  requests = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
} catch (e) {
  await writeFile(
    `${dir}/results.json`,
    JSON.stringify(
      {
        status: "blocked",
        stage: "browser-launch",
        testsRun: 0,
        sandbox: true,
        error: e.message,
      },
      null,
      2,
    ),
  );
  throw e;
}
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url()));
const scenario = async (name, fn) => {
  try {
    await fn();
    results.push({ name, status: "passed" });
  } catch (e) {
    results.push({ name, status: "failed", error: e.message });
    throw e;
  }
};
const generate = async () => {
  await page.locator("#generate").click();
  await page.locator("#output").waitFor({ state: "visible" });
};
const download = async (id) => {
  const waiting = page.waitForEvent("download");
  await page.locator(id).click();
  const d = await waiting;
  const stream = await d.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return {
    name: d.suggestedFilename(),
    text: Buffer.concat(chunks).toString("utf8"),
  };
};
const planDownload = async () =>
  JSON.parse((await download("#download-json")).text);
try {
  await scenario(
    "Japanese and English interface, keyboard skip link",
    async () => {
      await page.goto(base);
      assert.equal(await page.locator("html").getAttribute("lang"), "ja");
      await page.keyboard.press("Tab");
      assert.ok(
        await page
          .locator(".skip")
          .evaluate((e) => e === document.activeElement),
      );
      await page.locator("#lang").click();
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
      assert.match(await page.locator("h1").innerText(), /Meet new people/);
    },
  );
  let initial;
  await scenario("Generate sample and validate JSON download", async () => {
    await generate();
    initial = await planDownload();
    verifyDocument(initial);
    assert.equal(initial.rounds.length, 4);
    assert.equal(await page.locator(".round-card").count(), 4);
    await page.screenshot({ path: `${dir}/desktop.png`, fullPage: true });
  });
  await scenario("Repeated generation is deterministic", async () => {
    await generate();
    assert.deepEqual(await planDownload(), initial);
  });
  await scenario("Freeze 2, absent P09 from 3, preserve history", async () => {
    await page.locator("#freeze-count").selectOption("2");
    await page.locator("#freeze").click();
    assert.equal(await page.locator("#output").isVisible(), false);
    await page.locator(".setup details summary").click();
    await page.locator("#absences").fill("P09:3");
    await generate();
    const next = await planDownload();
    assert.deepEqual(
      next.rounds.slice(0, 2).map((r) => r.tables),
      initial.rounds.slice(0, 2).map((r) => r.tables),
    );
    assert.ok(next.rounds.slice(2).every((r) => !r.attendees.includes("P09")));
    assert.ok(await page.locator("#history-box").isVisible());
  });
  await scenario(
    "All download formats, absent personal route, print view",
    async () => {
      for (const [id, suffix] of [
        ["#download-tables", "tables.csv"],
        ["#download-routes", "routes.csv"],
        ["#download-matrix", "encounters.csv"],
        ["#download-print", "print.html"],
      ]) {
        const d = await download(id);
        assert.ok(d.name.endsWith(suffix));
        if (id === "#download-routes")
          assert.ok(d.text.includes('"P09","3","","absent"'));
        if (id === "#download-print")
          assert.ok(d.text.includes("Personal routes"));
      }
      await page
        .locator("details:has(#route-cards)")
        .evaluate((e) => (e.open = true));
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator(".setup").isVisible(), false);
      assert.equal(await page.locator("#route-cards").isVisible(), true);
      await page.pdf({
        path: `${dir}/print.pdf`,
        format: "A4",
        printBackground: true,
      });
      await page.emulateMedia({ media: "screen" });
    },
  );
  await scenario(
    "Editing invalidates export and cancellation cannot resurrect stale results",
    async () => {
      await page.locator("#seed").fill("99");
      assert.equal(await page.locator("#output").isVisible(), false);
      await page.evaluate(() => {
        document.querySelector("#planner-form").requestSubmit();
        document.querySelector("#cancel").click();
      });
      assert.equal(await page.locator("#output").isVisible(), false);
      assert.match(await page.locator("#status").innerText(), /cancelled/);
      await page.waitForTimeout(150);
      assert.equal(await page.locator("#output").isVisible(), false);
      await generate();
    },
  );
  await scenario(
    "Malformed import hides previous export and repeat import recovers",
    async () => {
      await page
        .locator("#import-file")
        .setInputFiles({
          name: "bad.json",
          mimeType: "application/json",
          buffer: Buffer.from("{broken"),
        });
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.includes("Import error"),
      );
      assert.equal(await page.locator("#output").isVisible(), false);
      const buffer = Buffer.from(JSON.stringify(initial));
      for (let i = 0; i < 2; i++) {
        await page
          .locator("#import-file")
          .setInputFiles({
            name: "plan.json",
            mimeType: "application/json",
            buffer,
          });
        await page.locator("#output").waitFor({ state: "visible" });
        assert.deepEqual((await planDownload()).rounds, initial.rounds);
      }
    },
  );
  await scenario(
    "Oversized import rejected; duplicate attendee import rejected",
    async () => {
      await page
        .locator("#import-file")
        .setInputFiles({
          name: "large.json",
          mimeType: "application/json",
          buffer: Buffer.alloc(262145, 32),
        });
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.includes("256 KiB"),
      );
      const bad = structuredClone(initial);
      bad.rounds[0].tables[0][0] = bad.rounds[0].tables[0][1];
      await page
        .locator("#import-file")
        .setInputFiles({
          name: "bad-plan.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(bad)),
        });
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.includes("Import error"),
      );
      assert.equal(await page.locator("#output").isVisible(), false);
    },
  );
  await scenario("Contradiction differs from budget exhaustion", async () => {
    await page.locator("#sample").click();
    await page.locator("#capacity").fill("2");
    await page.locator("#generate").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("Proven constraint"),
    );
    await page.locator("#capacity").fill("3");
    await page.locator("#budget").fill("1");
    await page.locator("#generate").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("Budget exhausted"),
    );
    assert.equal(await page.locator("#output").isVisible(), false);
  });
  await scenario(
    "Hostile labels render only as text and safe spreadsheet data",
    async () => {
      await page.locator("#sample").click();
      await page
        .locator("#people")
        .fill("<img src=x onerror=alert(1)>\n=SUM(1)\n@evil\nP04");
      await page.locator("#tables").fill("2");
      await page.locator("#rounds").fill("2");
      await generate();
      assert.equal(await page.locator("#output img").count(), 0);
      assert.ok((await download("#download-tables")).text.includes("'=SUM(1)"));
      assert.ok((await download("#download-print")).text.includes("&lt;img"));
    },
  );
  await scenario(
    "Imported comma labels and constraints survive UI round-trip",
    async () => {
      const input = {
        schemaVersion: 1,
        participants: ["A,1", "B", "C", "D"],
        tableCount: 2,
        roundCount: 2,
        maxPerTable: 2,
        keepApart: [["A,1", "B"]],
        seed: 1,
        workBudget: 20000,
      };
      await page
        .locator("#import-file")
        .setInputFiles({
          name: "comma.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(input)),
        });
      await page.waitForFunction(() =>
        document
          .querySelector("#status")
          .textContent.includes("JSON validated"),
      );
      await generate();
      assert.deepEqual((await planDownload()).input.keepApart, input.keepApart);
    },
  );
  await scenario(
    "Mobile 390 px has no document overflow and remains usable",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#sample").click();
      await generate();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.locator("#lang").click();
      assert.equal(await page.locator("html").getAttribute("lang"), "ja");
      await page.screenshot({ path: `${dir}/mobile.png`, fullPage: true });
    },
  );
  await scenario(
    "Reload clears transient state; no external network or page errors",
    async () => {
      await page.reload();
      assert.equal(await page.locator("#output").isVisible(), false);
      assert.equal(await page.locator("#history-box").isVisible(), false);
      assert.deepEqual(errors, []);
      assert.deepEqual(
        requests.filter((u) => !u.startsWith(base) && !u.startsWith("blob:")),
        [],
      );
    },
  );
  await writeFile(
    `${dir}/results.json`,
    JSON.stringify(
      {
        status: "passed",
        testsRun: results.length,
        sandbox: true,
        results,
        pageErrors: errors,
        externalRequests: requests.filter(
          (u) => !u.startsWith(base) && !u.startsWith("blob:"),
        ),
      },
      null,
      2,
    ),
  );
  console.log(`${results.length} browser scenarios passed`);
} catch (e) {
  await writeFile(
    `${dir}/results.json`,
    JSON.stringify(
      {
        status: "failed",
        testsRun: results.length,
        sandbox: true,
        results,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
