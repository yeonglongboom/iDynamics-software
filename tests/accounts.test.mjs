import { test } from "node:test";
import assert from "node:assert/strict";
import { usernameEmail, validatePassword } from "../lib/accounts.mjs";
test("normalizes usernames to internal non-deliverable identifiers", () =>
  assert.equal(
    usernameEmail(" Sales.Jane "),
    "sales.jane@accounts.internal.invalid",
  ));
test("rejects email addresses and malformed usernames", () => {
  for (const n of [
    "a@company.com",
    "../admin",
    "",
    "ab",
    "1admin",
    "a".repeat(33),
  ])
    assert.throws(() => usernameEmail(n));
});
test("requires long bounded passwords", () => {
  assert.throws(() => validatePassword("short"));
  assert.throws(() => validatePassword("x".repeat(129)));
  assert.equal(validatePassword("x".repeat(12)), "x".repeat(12));
});
