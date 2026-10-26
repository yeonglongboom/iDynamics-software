import { test } from "node:test";
import assert from "node:assert/strict";
import { financialChecks } from "../lib/financial.mjs";
const summary = (sub, tax, total) =>
  `Sub Total ${sub}\nSST Services Tax (8%) ${tax}\nTotal RM ${total}`;
const errors = (p) => financialChecks(p).filter((f) => f.error);
test("valid 8% and rounded tax examples", () => {
  for (const s of [
    summary("1,080.00", "86.40", "1,166.40"),
    summary("1,168.20", "93.46", "1,261.66"),
  ])
    assert.equal(errors([s]).length, 0);
});
test("wrong grand total rejected with expected value", () =>
  assert.match(
    errors([summary("100.00", "8.00", "109.00")])[0].message,
    /108.00/,
  ));
test("mixed taxable base mismatch is uncertain, not rejected", () => {
  const f = financialChecks([summary("100.00", "4.00", "104.00")]);
  assert.equal(f.filter((x) => x.error).length, 0);
  assert.ok(f.some((x) => x.uncertain && x.message.includes("taxable")));
});
test("one-sen rounding tolerance", () =>
  assert.equal(errors([summary("100.00", "8.00", "108.01")]).length, 0));
test("cross-page totals and revision suffix mismatch are review notes", () => {
  const f = financialChecks([
    "Quotation\n# QT/2610/0001A\nTotal RM 100.00",
    "Quotation No : QT/2610/0001B\nQuotation Total : RM 200.00",
  ]);
  assert.ok(f.some((x) => x.message.includes("numbers differ")));
  assert.ok(f.some((x) => x.message.includes("totals differ")));
  assert.equal(f.filter((x) => x.error).length, 0);
});
test("no numeric guessing from descriptions", () =>
  assert.equal(
    errors(["Buy 2 units for 900.00, old invoice total 100.00"]).length,
    0,
  ));
const head = "# Description Qty Rate Disc Tax% Amount\n";
test("percentage discount and full waiver", () =>
  assert.equal(
    errors([
      head +
        "1.00 unit 1,200.00 10.00% 8.00 1,080.00\n1.00 unit 300.00 100.00% 8.00 0.00",
    ]).length,
    0,
  ));
test("incorrect line amount rejected", () =>
  assert.equal(
    errors([head + "2.00 user 900.00 0.00 8.00 1,700.00"]).length,
    1,
  ));
test("no discount column supported", () =>
  assert.equal(
    errors(["# Description Qty Rate Tax% Amount\n2.00 unit 100.00 8.00 100.00"])
      .length,
    1,
  ));
test("unmarked nonzero discount remains ambiguous", () =>
  assert.equal(errors([head + "1.00 unit 100.00 10.00 8.00 75.00"]).length, 0));
test("wrapped rows disclose incomplete coverage", () =>
  assert.ok(
    financialChecks([head + "1.00\nunit\n100.00 0.00 8.00 100.00"]).some((f) =>
      f.message.includes("0 isolated"),
    ),
  ));
