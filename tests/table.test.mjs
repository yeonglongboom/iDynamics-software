import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTable, tableFindings } from "../lib/table.mjs";
const cell = (str, x, y, width = 15) => ({
  str,
  transform: [1, 0, 0, 1, x, y],
  width,
});
const header = [
  cell("#", 10, 500, 5),
  cell("Description", 40, 500, 70),
  cell("Qty", 300, 500),
  cell("Rate", 360, 500),
  cell("Disc", 420, 500),
  cell("Tax%", 460, 500),
  cell("Amount", 520, 500, 35),
];
const row = [
  cell("1", 10, 450, 5),
  cell("Wrapped description", 40, 450, 150),
  cell("continued text", 40, 438, 150),
  cell("2.00", 300, 450),
  cell("Unit", 300, 438),
  cell("100.00", 350, 450, 25),
  cell("0.00", 420, 450),
  cell("8.00", 460, 450),
  cell("200.00", 520, 450, 35),
];
test("extracts wrapped descriptions without flattening numeric columns", () => {
  const t = extractTable([...header, ...row]);
  assert.equal(t.complete, true);
  assert.equal(t.rows[0].Amount, "200.00");
});
test("missing numeric cell prevents complete reconciliation", () => {
  const t = extractTable([...header, ...row.filter((c) => c.str !== "100.00")]);
  assert.equal(t.complete, false);
  assert.equal(t.rows.length, 0);
});
test("long description spanning numeric columns is not a numeric row", () =>
  assert.equal(
    extractTable([
      ...header,
      cell("1", 10, 450, 5),
      cell("2.00 100.00 8.00 200.00", 40, 450, 500),
    ]).rows.length,
    0,
  ));
test("bad line amount produces rejection", () => {
  const t = extractTable([
    ...header,
    ...row.map((c) => (c.str === "200.00" ? { ...c, str: "190.00" } : c)),
  ]);
  assert.ok(tableFindings([t], ["Sub Total 190.00"]).some((f) => f.error));
});
test("subtotal mismatch is uncertain due to possible adjustments", () => {
  const t = extractTable([...header, ...row]);
  assert.ok(
    tableFindings([t], ["Sub Total 300.00"]).some(
      (f) => f.uncertain && f.message.includes("subtotal"),
    ),
  );
});
test("split or multi-page tables never reconcile as complete", () => {
  const t = extractTable([...header, ...row]);
  assert.ok(
    tableFindings([t, t], ["Sub Total 400.00", ""]).some((f) =>
      f.message.includes("not performed"),
    ),
  );
});
