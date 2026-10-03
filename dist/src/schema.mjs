export const isDenseArray = (value) =>
  Array.isArray(value) &&
  Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(
    Boolean,
  );
export const LIMITS = Object.freeze({
  participants: 24,
  rounds: 6,
  tables: 6,
  budget: 250000,
  bytes: 262144,
});
export class InputError extends Error {
  constructor(message, code = "invalid-input") {
    super(message);
    this.name = "InputError";
    this.code = code;
  }
}
const fail = (message) => {
  throw new InputError(message);
};
const object = (v, path) => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    fail(`${path}: expected object`);
};
const keys = (v, allowed, path) => {
  for (const k of Object.keys(v))
    if (!allowed.includes(k)) fail(`${path}: unknown field ${k}`);
};
const integer = (v, min, max, path) => {
  if (!Number.isSafeInteger(v) || v < min || v > max)
    fail(`${path}: integer ${min}–${max} required`);
  return v;
};
function labels(v, path, roster = null) {
  if (!Array.isArray(v) || v.length > 24 || !isDenseArray(v))
    fail(`${path}: expected at most 24 labels`);
  const copy = v.map((x) => {
    if (
      typeof x !== "string" ||
      !x.trim() ||
      x !== x.trim() ||
      x.length > 32 ||
      /[\x00-\x1f\x7f]/.test(x)
    )
      fail(
        `${path}: labels must be trimmed, nonempty, ≤32 characters, without control characters`,
      );
    if (roster && !roster.has(x)) fail(`${path}: unknown label ${x}`);
    return x;
  });
  if (new Set(copy).size !== copy.length) fail(`${path}: duplicate label`);
  return copy;
}
export function normalizeInput(raw) {
  object(raw, "input");
  keys(
    raw,
    [
      "schemaVersion",
      "participants",
      "tableCount",
      "roundCount",
      "maxPerTable",
      "keepApart",
      "absences",
      "frozenRounds",
      "seed",
      "workBudget",
    ],
    "input",
  );
  if (raw.schemaVersion !== 1) fail("schemaVersion: expected 1");
  const participants = labels(raw.participants, "participants");
  if (participants.length < 4) fail("participants: 4–24 labels required");
  const roster = new Set(participants);
  const tableCount = integer(raw.tableCount, 2, 6, "tableCount"),
    roundCount = integer(raw.roundCount, 1, 6, "roundCount");
  const maxPerTable = integer(raw.maxPerTable ?? 24, 1, 24, "maxPerTable");
  const seed = integer(raw.seed ?? 1, 0, 4294967295, "seed"),
    workBudget = integer(
      raw.workBudget ?? 20000,
      1,
      LIMITS.budget,
      "workBudget",
    );
  const apart = raw.keepApart ?? [];
  if (!Array.isArray(apart) || apart.length > 276 || !isDenseArray(apart))
    fail("keepApart: at most 276 pairs");
  const pairKeys = new Set();
  const keepApart = apart.map((p, i) => {
    const pair = labels(p, `keepApart[${i}]`, roster);
    if (pair.length !== 2)
      fail("keepApart: exactly two different labels required");
    const k = JSON.stringify([...pair].sort());
    if (pairKeys.has(k)) fail("keepApart: duplicate pair");
    pairKeys.add(k);
    return pair;
  });
  const frozen = raw.frozenRounds ?? [];
  if (
    !Array.isArray(frozen) ||
    frozen.length > roundCount ||
    !isDenseArray(frozen)
  )
    fail("frozenRounds: too many rounds");
  const frozenRounds = frozen.map((r, i) => {
    object(r, `frozenRounds[${i}]`);
    keys(r, ["attendees", "tables"], `frozenRounds[${i}]`);
    const attendees = labels(
      r.attendees,
      `frozenRounds[${i}].attendees`,
      roster,
    );
    if (
      !Array.isArray(r.tables) ||
      r.tables.length !== tableCount ||
      !isDenseArray(r.tables)
    )
      fail("frozenRounds: table count mismatch");
    const tables = r.tables.map((t, j) =>
      labels(t, `frozenRounds[${i}].tables[${j}]`, roster),
    );
    const flat = tables.flat();
    if (
      flat.length !== attendees.length ||
      new Set(flat).size !== flat.length ||
      flat.some((p) => !attendees.includes(p))
    )
      fail("frozenRounds: every historical attendee must occur once");
    if (
      tables.some((t) => !t.length) ||
      Math.max(...tables.map((t) => t.length)) -
        Math.min(...tables.map((t) => t.length)) >
        1
    )
      fail("frozenRounds: nonempty balanced tables required");
    return { attendees, tables };
  });
  const a = raw.absences ?? [];
  if (!Array.isArray(a) || a.length > 24 || !isDenseArray(a))
    fail("absences: at most 24 entries");
  const seenAbsences = new Set();
  const absences = a.map((x, i) => {
    object(x, `absences[${i}]`);
    keys(x, ["participant", "fromRound"], `absences[${i}]`);
    if (!roster.has(x.participant)) fail("absences: unknown participant");
    if (seenAbsences.has(x.participant))
      fail("absences: duplicate participant");
    seenAbsences.add(x.participant);
    return {
      participant: x.participant,
      fromRound: integer(
        x.fromRound,
        frozenRounds.length + 1,
        roundCount,
        "absences.fromRound (future only)",
      ),
    };
  });
  return {
    schemaVersion: 1,
    participants,
    tableCount,
    roundCount,
    maxPerTable,
    keepApart,
    absences,
    frozenRounds,
    seed,
    workBudget,
  };
}
export function attendeesFor(input, roundNumber) {
  return input.participants.filter(
    (p) =>
      !input.absences.some(
        (a) => a.participant === p && a.fromRound <= roundNumber,
      ),
  );
}
export function parseJSON(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > LIMITS.bytes
  )
    throw new InputError("JSON file exceeds 256 KiB");
  try {
    return JSON.parse(text);
  } catch {
    throw new InputError("Invalid JSON");
  }
}
