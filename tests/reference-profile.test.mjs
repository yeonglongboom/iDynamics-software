import { test } from "node:test";
import assert from "node:assert/strict";
import {
  referenceProfile,
  compareProfiles,
} from "../lib/reference-profile.mjs";
const text = "Qty Rate Tax% Amount Payment : Cash Terms & Conditions";
const ref = {
  id: "1",
  filename: "approved.pdf",
  profile: referenceProfile([text]),
};
test("profile stores only known feature names, not private text", () =>
  assert.ok(
    !JSON.stringify(
      referenceProfile([text + " Jane customer 999.00"]),
    ).includes("Jane"),
  ));
test("matching headings pass only presence comparison", () =>
  assert.equal(compareProfiles([text], [ref])[0].state, "Passed"));
test("missing sections require review, never rejection", () => {
  const f = compareProfiles(["Qty Rate Amount"], [ref])[0];
  assert.equal(f.state, "Needs review");
  assert.equal(f.error, undefined);
});
test("empty library never passes", () =>
  assert.equal(compareProfiles([text], [])[0].state, "Not checked"));
test("best matching reference is selected", () =>
  assert.match(
    compareProfiles(
      [text],
      [
        {
          ...ref,
          filename: "other.pdf",
          profile: referenceProfile([text + " Delivery : 3 days"]),
        },
        ref,
      ],
    )[0].message,
    /approved.pdf/,
  ));
