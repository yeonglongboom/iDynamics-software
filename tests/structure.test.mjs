import { test } from "node:test";
import assert from "node:assert/strict";
import { structureWarnings } from "../lib/structure.mjs";
const cell = (str, x, y, width = 30) => ({
  str,
  transform: [10, 0, 0, 10, x, y],
  width,
  height: 10,
});
const box = [0, 0, 600, 800];
test("near-empty acceptance page warns without rejecting", () => {
  const f = structureWarnings(
    [cell("Confirmed and Accepted by", 40, 300)],
    box,
    2,
  );
  assert.ok(f.some((x) => x.message.includes("little extractable")));
  assert.ok(f.every((x) => !x.error));
  assert.equal(f[0].page, 2);
});
test("out of bounds text warns", () =>
  assert.ok(
    structureWarnings([cell("text", 590, 300)], box, 1).some((f) =>
      f.message.includes("beyond"),
    ),
  ));
test("column spillover warning is tentative", () => {
  const f = structureWarnings(
    [
      cell("Description", 40, 500, 60),
      cell("Qty", 300, 500),
      cell("Amount", 520, 500),
      cell("long description", 40, 450, 300),
    ],
    box,
    1,
  );
  assert.ok(f.some((x) => x.message.includes("legitimate full-width")));
});
test("rotated text explicitly excluded", () => {
  const c = cell("rotated", 10, 10);
  c.transform = [0, 10, -10, 0, 10, 10];
  assert.ok(
    structureWarnings([c], box, 1).some((x) =>
      x.message.includes("unsupported"),
    ),
  );
});
test("absence of warnings never claims layout passed", () => {
  const f = structureWarnings([cell("text ".repeat(40), 40, 300, 200)], box, 1);
  assert.ok(f.every((x) => x.state !== "Passed"));
  assert.ok(f.some((x) => x.message.includes("not a layout pass")));
});
