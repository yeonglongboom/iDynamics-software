import { test } from "node:test";
import assert from "node:assert/strict";
import { requiredFields } from "../lib/fields.mjs";
test("detects labelled values with their page", () => {
  const f = requiredFields([
    "# QT/2610/0055A",
    "Quotation Date : 14.10.2026\nSales Person : Jane Doe\nWork Mobile : 012-345 6789\nPayment : Cash\nValidity : 7 days\nDelivery : 3 days\nTerms & Conditions:",
  ]);
  assert.equal(f.filter((x) => x.state === "Passed").length, 8);
  assert.equal(f.find((x) => x.message.startsWith("Payment terms")).page, 2);
});
test("labels without values are not passed", () => {
  const f = requiredFields([
    "Sales Person :\nWork Mobile :\nPayment :\nValidity :\nDelivery :",
  ]);
  assert.equal(f.filter((x) => x.state === "Passed").length, 0);
});
test("supplier contact never validates customer accuracy", () =>
  assert.equal(
    requiredFields(["Supplier contact jane@example.com"]).find(f=>f.message.startsWith("Customer name")).state,
    "Not checked",
  ));
test("missing fields produce uncertainty not rejection", () =>
  assert.ok(requiredFields([""]).every((x) => !x.error)));
