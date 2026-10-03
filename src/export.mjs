import { verifyDocument } from "./validate.mjs";
export const csvCell = (value) => {
  let s = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
const csv = (rows) =>
  "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
export const escapeHTML = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export function exportsFor(document) {
  const plan = verifyDocument(document);
  const tableRows = [["round", "frozen", "table", "participant"]],
    routeRows = [["participant", "round", "table", "status"]];
  for (const r of plan.rounds)
    for (let i = 0; i < r.tables.length; i++)
      for (const p of r.tables[i])
        tableRows.push([r.number, r.frozen, i + 1, p]);
  for (const p of plan.input.participants)
    for (const r of plan.rounds) {
      const table = r.tables.findIndex((t) => t.includes(p));
      routeRows.push([
        p,
        r.number,
        table < 0 ? "" : table + 1,
        table < 0 ? "absent" : "attending",
      ]);
    }
  const matrixRows = [
    ["participant", ...plan.input.participants],
    ...plan.input.participants.map((p, i) => [p, ...plan.audit.matrix[i]]),
  ];
  const h = escapeHTML;
  const rounds = plan.rounds
    .map(
      (r) =>
        `<section><h2>Round ${r.number}${r.frozen ? " · frozen / 確定済み" : ""}</h2><div class="grid">${r.tables.map((t, i) => `<article><h3>Table ${i + 1}</h3><ul>${t.map((p) => `<li>${h(p)}</li>`).join("")}</ul></article>`).join("")}</div></section>`,
    )
    .join("");
  const routes = plan.input.participants
    .map(
      (p) =>
        `<article><h3>${h(p)}</h3><ol>${plan.rounds
          .map((r) => {
            const t = r.tables.findIndex((t) => t.includes(p));
            return `<li>Round ${r.number}: ${t < 0 ? "Absent / 欠席" : `Table ${t + 1}`}</li>`;
          })
          .join("")}</ol></article>`,
    )
    .join("");
  const printHTML = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Round Loom · Table plan and route cards</title><style>body{font:15px system-ui,sans-serif;color:#173b32;margin:28px;line-height:1.6}h1,h2,h3{line-height:1.2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}article{border:1px solid #86998f;padding:14px;break-inside:avoid}section{margin:24px 0}li{overflow-wrap:anywhere}.routes{break-before:page}@page{size:auto;margin:14mm}@media print{body{margin:0}.grid{grid-template-columns:repeat(3,1fr)}}</style><h1>Round Loom</h1><p>Best found, not guaranteed optimal / 探索内の最良案・最適性保証なし</p><p>${plan.audit.uniquePairs} unique pairs · ${plan.audit.repeatEncounters} repeat encounters · seed ${plan.input.seed} · work ${plan.search.workUsed}/${plan.input.workBudget}</p>${rounds}<section class="routes"><h2>Personal routes / 個人ルート</h2><div class="grid">${routes}</div></section></html>`;
  return {
    json: JSON.stringify(plan, null, 2) + "\n",
    tablesCSV: csv(tableRows),
    routesCSV: csv(routeRows),
    matrixCSV: csv(matrixRows),
    printHTML,
  };
}
