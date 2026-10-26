import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewText } from "../lib/review.mjs";
const base =
  "Quotation Date QT/2610/0144 Qty Rate Amount Terms & Conditions " +
  "description ".repeat(20);
test("rejects conflicting training validity", () =>
  assert.equal(
    reviewText(
      [base + "All software training valid for 3 (Three) months only"],
      1,
    ).status,
    "Rejected",
  ));
test("never approves unchecked layout", () =>
  assert.equal(
    reviewText(
      [base + "Training is only valid for 1 month from the invoice date."],
      1,
    ).status,
    "Human review",
  ));
test("handles unreadable PDF", () =>
  assert.match(reviewText([""], 1).findings[0].message, /could not be read/));
test("uses edited rule", () =>
  assert.equal(
    reviewText([base + "All software training valid for 3 months"], 3).status,
    "Human review",
  ));
