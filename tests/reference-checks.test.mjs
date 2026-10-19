import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReferenceChecks } from "../lib/reference-checks.mjs";
const c = {
  id: "1",
  title: "Terms",
  kind: "required_phrase",
  phrase: "Payment : Cash",
  correction: "Use standard payment terms.",
};
test("normalizes whitespace and case without treating amounts as interchangeable", () => {
  assert.deepEqual(applyReferenceChecks(["PAYMENT :\n Cash"], [c]), []);
  assert.equal(
    applyReferenceChecks(["Payment : Credit"], [c])[0].uncertain,
    true,
  );
});
test("missing required text never creates certain rejection", () =>
  assert.equal(applyReferenceChecks(["other"], [c])[0].error, undefined));
test("prohibited phrase reports correct page", () => {
  const f = applyReferenceChecks(
    ["page one", "Payment : Cash"],
    [{ ...c, kind: "forbidden_phrase" }],
  )[0];
  assert.equal(f.page, 2);
  assert.equal(f.error, true);
});
test("empty library and unknown rule kinds cannot reject", () => {
  assert.deepEqual(applyReferenceChecks(["text"], []), []);
  assert.deepEqual(
    applyReferenceChecks(["text"], [{ ...c, kind: "unknown" }]),
    [],
  );
});
