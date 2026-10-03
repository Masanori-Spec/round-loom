import { normalizeInput, parseJSON } from "../src/schema.mjs";
import { verifyDocument } from "../src/validate.mjs";
import { exportsFor } from "../src/export.mjs";
const $ = (id) => document.getElementById(id);
let language = "ja",
  plan = null,
  frozen = [],
  worker = null,
  generation = 0,
  importTicket = 0;
const original = new Map(
  [...document.querySelectorAll("[data-i]")].map((el) => [
    el.dataset.i,
    el.innerHTML,
  ]),
);
const en = {
  local: "LOCAL · NO UPLOAD",
  eyebrow: "SMALL GROUPS, MORE CONNECTIONS",
  heading: "Meet new people.<br>Keep the thread.",
  lead: "Table rotations for small adult workshops. Keep completed rounds intact, then reweave the conversations still to come.",
  tag1: "4–24 anonymous labels",
  tag2: "2–6 tables",
  tag3: "1–6 rounds",
  setup: "Your workshop",
  privacy:
    "Use synthetic adult labels only. No account, upload, or autosave. Save JSON before closing this tab.",
  people: "Participant labels (one per line)",
  tables: "Tables",
  rounds: "Rounds",
  capacity: "Seats / table",
  constraints: "Constraints, absences & reproducibility",
  apart: "Keep apart (one P01,P02 pair per line)",
  absences: "Future absences (P09:3 → absent from round 3)",
  futureOnly:
    "New conditions apply only to future rounds. Historical attendance and encounters stay intact.",
  seed: "Random seed",
  budget: "Work budget",
  generate: "Weave a plan ↗",
  cancel: "Cancel",
  sample: "Reset to sample",
  import: "Import JSON",
  ready: "Ready. Try the 9-person sample to start.",
  historyHint:
    "Keep the roster labels and table count consistent with the historical record.",
  resetHistory: "Unfreeze history",
  resultTitle: "A map of new connections",
  best: "BEST FOUND",
  emptyTitle: "The next connection starts here.",
  emptyText:
    "Build a plan to inspect every table, personal route, and pair encounter in one place.",
  honesty:
    "Optimality is not guaranteed. Exhausting the work budget never means “impossible.”",
  freeze: "Completed rounds to freeze",
  freezeButton: "Freeze through here",
  matrixTitle: "Encounter matrix & participant audit",
  routesTitle: "Personal route cards",
  exportTitle: "Take it with you",
  tableCSV: "Tables CSV",
  routeCSV: "Routes CSV",
  matrixCSV: "Encounters CSV",
  printHTML: "Print-ready HTML",
  print: "Print tables & routes",
  principle1: "Preserve what happened",
  principleText1:
    "Freeze completed rounds and replan the rest. An absence never rewrites an earlier encounter.",
  principle2: "Check the result",
  principleText2:
    "An independent validator checks attendance, duplicates, capacity, and constraints. Repeats stay visible.",
  principle3: "Small, local, inspectable",
  principleText3:
    "All computation stays in this browser. Do not use personal data or run large events with this prototype.",
  footer: "Local prototype · demand & novelty unvalidated · v0.1.0",
};
const t = (ja, en) => (language === "ja" ? ja : en);
function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
function stop() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  generation++;
  $("generate").disabled = false;
  $("cancel").hidden = true;
}
function invalidate(message = true) {
  stop();
  plan = null;
  importTicket++;
  $("output").hidden = true;
  $("empty").hidden = false;
  $("best-badge").hidden = true;
  if (message)
    status(
      t(
        "入力が変わりました。再作成すると最新の結果を保存できます。",
        "Inputs changed. Rebuild before exporting a current plan.",
      ),
    );
}
function historyView() {
  $("history-box").hidden = !frozen.length;
  $("history-title").textContent = t(
    `${frozen.length}回を確定済み`,
    `${frozen.length} rounds frozen`,
  );
}
function lines(id) {
  return $(id)
    .value.split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function readInput() {
  return normalizeInput({
    schemaVersion: 1,
    participants: lines("people"),
    tableCount: Number($("tables").value),
    roundCount: Number($("rounds").value),
    maxPerTable: Number($("capacity").value),
    seed: Number($("seed").value),
    workBudget: Number($("budget").value),
    keepApart: lines("apart").map((x) =>
      x.startsWith("[") ? JSON.parse(x) : x.split(",").map((v) => v.trim()),
    ),
    absences: lines("absences").map((x) => {
      const pos = x.lastIndexOf(":");
      if (pos < 0) throw Error("Absence format: P09:3");
      return {
        participant: x.slice(0, pos).trim(),
        fromRound: Number(x.slice(pos + 1)),
      };
    }),
    frozenRounds: frozen,
  });
}
function populate(input) {
  $("people").value = input.participants.join("\n");
  $("tables").value = input.tableCount;
  $("rounds").value = input.roundCount;
  $("capacity").value = input.maxPerTable;
  $("seed").value = input.seed;
  $("budget").value = input.workBudget;
  $("apart").value = input.keepApart.map((p) => JSON.stringify(p)).join("\n");
  $("absences").value = input.absences
    .map((a) => `${a.participant}:${a.fromRound}`)
    .join("\n");
  frozen = structuredClone(input.frozenRounds);
  historyView();
}
function el(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function render() {
  if (!plan) return;
  const a = plan.audit;
  $("output").hidden = false;
  $("empty").hidden = true;
  $("best-badge").hidden = false;
  $("stats").replaceChildren(
    ...[
      [a.uniquePairs, t("一度以上同席したペア", "unique pairs"), ""],
      [a.repeatEncounters, t("2回目以降の同席", "repeat encounters"), "repeat"],
      [
        a.totalPairEncounters,
        t("同席ペアの総回数", "total pair encounters"),
        "",
      ],
    ].map(([n, label, cls]) => {
      const d = el("div", undefined, `stat ${cls}`);
      d.append(el("strong", n), el("span", label));
      return d;
    }),
  );
  $("audit-note").textContent = t(
    `独立検証済み。最適性保証なし。シード ${plan.input.seed} · 探索 ${plan.search.workUsed}/${plan.input.workBudget}。繰り返し下界 ${a.repeatLowerBound} = max(0, 同席総回数 − 全${a.possiblePairs}ペア)。全履歴を含む固定名簿での控えめな下界であり、欠席や条件によって実際の最小値は増えます。`,
    `Independently validated; no optimality guarantee. Seed ${plan.input.seed} · work ${plan.search.workUsed}/${plan.input.workBudget}. Conservative repeat lower bound ${a.repeatLowerBound} = max(0, total encounters − ${a.possiblePairs} roster pairs), including history. Absences and constraints may raise the actual minimum.`,
  );
  $("freeze-count").replaceChildren(
    ...plan.rounds.map((r, i) => {
      const option = el(
        "option",
        t(`第${i + 1}回まで`, `Through round ${i + 1}`),
      );
      option.value = i + 1;
      option.disabled = i + 1 < frozen.length;
      return option;
    }),
  );
  $("freeze-count").value = Math.min(
    plan.rounds.length,
    Math.max(frozen.length + 1, 1),
  );
  $("round-cards").replaceChildren(
    ...plan.rounds.map((r) => {
      const section = el("section", undefined, "round-card"),
        head = el("div", undefined, "round-heading");
      head.append(
        el("h3", t(`第 ${r.number} 回`, `Round ${r.number}`)),
        el(
          "span",
          r.frozen ? t("確定済み", "FROZEN") : t("再計画可能", "PLANNED"),
        ),
      );
      const grid = el("div", undefined, "table-grid");
      for (let i = 0; i < r.tables.length; i++) {
        const table = el("div", undefined, "table-card");
        table.append(el("h4", `TABLE ${i + 1}`));
        const ul = el("ul");
        ul.append(...r.tables[i].map((p) => el("li", p)));
        table.append(ul);
        grid.append(table);
      }
      section.append(head, grid);
      return section;
    }),
  );
  const head = el("thead"),
    tr = el("tr");
  tr.append(
    el("th", t("ラベル", "Label")),
    ...plan.input.participants.map((p) => el("th", p)),
  );
  head.append(tr);
  const body = el("tbody");
  for (let i = 0; i < plan.input.participants.length; i++) {
    const row = el("tr"),
      th = el("th", plan.input.participants[i]);
    th.scope = "row";
    row.append(
      th,
      ...a.matrix[i].map((n, j) =>
        el("td", i === j ? "—" : n, n > 1 ? "repeated" : ""),
      ),
    );
    body.append(row);
  }
  $("matrix").replaceChildren(head, body);
  $("person-audit").replaceChildren(
    ...a.perParticipant.map((p) =>
      el(
        "li",
        t(
          `${p.participant}：${p.uniquePeople}人と同席 / 繰り返し ${p.repeatEncounters}回`,
          `${p.participant}: ${p.uniquePeople} unique people / ${p.repeatEncounters} repeats`,
        ),
      ),
    ),
  );
  $("route-cards").replaceChildren(
    ...plan.input.participants.map((p) => {
      const card = el("article", undefined, "route-card"),
        ol = el("ol");
      ol.append(
        ...plan.rounds.map((r) => {
          const table = r.tables.findIndex((t) => t.includes(p));
          return el(
            "li",
            `${t("第", "Round ")}${r.number}${t("回", "")}: ${table < 0 ? t("欠席", "Absent") : `Table ${table + 1}`}`,
          );
        }),
      );
      card.append(el("h3", p), ol);
      return card;
    }),
  );
}
$("lang").addEventListener("click", () => {
  language = language === "ja" ? "en" : "ja";
  document.documentElement.lang = language;
  $("lang").textContent = language === "ja" ? "English" : "日本語";
  for (const node of document.querySelectorAll("[data-i]")) {
    if (node.id === "status") continue;
    node.innerHTML =
      language === "ja" ? original.get(node.dataset.i) : en[node.dataset.i];
  }
  historyView();
  render();
});
$("planner-form").addEventListener("input", () => invalidate());
$("planner-form").addEventListener("submit", (event) => {
  event.preventDefault();
  invalidate(false);
  let input;
  try {
    input = readInput();
  } catch (e) {
    status(
      t("入力を確認してください: ", "Check the input: ") + e.message,
      true,
    );
    return;
  }
  status(
    t(
      "探索中… このブラウザだけで計算しています。",
      "Searching locally in this browser…",
    ),
  );
  $("generate").disabled = true;
  $("cancel").hidden = false;
  const id = ++generation;
  try {
    worker = new Worker(new URL("./worker.mjs", import.meta.url), {
      type: "module",
    });
  } catch (e) {
    stop();
    status(
      t(
        "起動できません。ローカルHTTPサーバーで開いてください: ",
        "Could not start. Open through the local HTTP server: ",
      ) + e.message,
      true,
    );
    return;
  }
  worker.onmessage = ({ data }) => {
    if (data.id !== generation) return;
    stop();
    if (data.error) {
      status(data.error, true);
      return;
    }
    if (data.result.status !== "best-found") {
      status(
        (data.result.status === "contradiction"
          ? t("条件の矛盾を確認: ", "Proven constraint contradiction: ")
          : t(
              "探索上限までに案が見つかりませんでした。不可能という意味ではありません。 ",
              "Budget exhausted without a plan; this is not proof of impossibility. ",
            )) + data.result.reasons.join(" "),
        true,
      );
      return;
    }
    try {
      plan = verifyDocument(data.result.plan);
      render();
      status(
        t(
          "検証済みの案ができました。終了した回を確定してから、今後の欠席を追加できます。",
          "A validated plan is ready. Freeze completed rounds before adding future absences.",
        ),
      );
    } catch (e) {
      plan = null;
      status(e.message, true);
    }
  };
  worker.onerror = () => {
    if (id !== generation) return;
    invalidate(false);
    status(
      t(
        "計算を完了できませんでした。入力は保持されています。",
        "Computation failed. Your inputs are preserved.",
      ),
      true,
    );
  };
  worker.postMessage({ id, input });
});
$("cancel").addEventListener("click", () => {
  invalidate(false);
  status(
    t(
      "探索を中止しました。古い案は保存されません。",
      "Search cancelled. No stale plan can be exported.",
    ),
  );
});
$("sample").addEventListener("click", () => {
  invalidate(false);
  populate(
    normalizeInput({
      schemaVersion: 1,
      participants: Array.from(
        { length: 9 },
        (_, i) => `P${String(i + 1).padStart(2, "0")}`,
      ),
      tableCount: 3,
      roundCount: 4,
      maxPerTable: 3,
      seed: 42,
      workBudget: 20000,
    }),
  );
  status(t("サンプルを読み込みました。", "Sample loaded."));
});
$("freeze").addEventListener("click", () => {
  if (!plan) return;
  const count = Number($("freeze-count").value);
  const input = structuredClone(plan.input);
  input.frozenRounds = plan.rounds
    .slice(0, count)
    .map((r) => ({ attendees: r.attendees, tables: r.tables }));
  input.absences =
    count === input.roundCount
      ? []
      : input.absences.map((a) => ({
          ...a,
          fromRound: Math.max(a.fromRound, count + 1),
        }));
  invalidate(false);
  populate(input);
  status(
    t(
      `${count}回を確定しました。残りを再計画してください。`,
      `${count} rounds frozen. Rebuild to plan the remaining rounds.`,
    ),
  );
});
$("reset-history").addEventListener("click", () => {
  frozen = [];
  invalidate(false);
  historyView();
  status(
    t(
      "履歴の固定を解除しました。すべての回を再計画できます。",
      "History unfrozen. All rounds can now be replanned.",
    ),
  );
});
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  invalidate(false);
  const ticket = ++importTicket;
  try {
    if (file.size > 262144) throw Error("JSON file exceeds 256 KiB");
    const text = await file.text();
    if (ticket !== importTicket) return;
    const raw = parseJSON(text);
    const imported =
      raw.kind === "round-loom-plan" ? verifyDocument(raw) : null;
    const input = imported?.input ?? normalizeInput(raw);
    populate(input);
    plan = imported;
    if (plan) render();
    status(
      t(
        "JSONを検証して読み込みました。監査値は再計算しています。",
        "JSON validated and imported. Audit values are recomputed.",
      ),
    );
  } catch (e) {
    if (ticket === importTicket)
      status(t("読み込みエラー: ", "Import error: ") + e.message, true);
  } finally {
    event.target.value = "";
  }
});
function download(name, key, type) {
  if (!plan) return;
  try {
    const verified = exportsFor(plan),
      url = URL.createObjectURL(new Blob([verified[key]], { type }));
    const link = el("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) {
    invalidate(false);
    status(e.message, true);
  }
}
for (const [id, name, key, type] of [
  ["download-json", "round-loom-plan.json", "json", "application/json"],
  [
    "download-tables",
    "round-loom-tables.csv",
    "tablesCSV",
    "text/csv;charset=utf-8",
  ],
  [
    "download-routes",
    "round-loom-routes.csv",
    "routesCSV",
    "text/csv;charset=utf-8",
  ],
  [
    "download-matrix",
    "round-loom-encounters.csv",
    "matrixCSV",
    "text/csv;charset=utf-8",
  ],
  [
    "download-print",
    "round-loom-print.html",
    "printHTML",
    "text/html;charset=utf-8",
  ],
])
  $(id).addEventListener("click", () => download(name, key, type));
let detailState = [];
$("print").addEventListener("click", () => {
  if (!plan) return;
  verifyDocument(plan);
  detailState = [...document.querySelectorAll(".audit-section")].map((x) => [
    x,
    x.open,
  ]);
  document.querySelector(".audit-section:has(#route-cards)").open = true;
  window.print();
});
window.addEventListener("afterprint", () => {
  for (const [d, open] of detailState) d.open = open;
  detailState = [];
});
