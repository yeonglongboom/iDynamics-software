import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { extractArchive } from "../lib/archive.mjs";
test("extracts PDF files and skips non-PDF files", () => {
  const r = extractArchive(
    zipSync({
      "folder/a.pdf": strToU8("%PDF-test"),
      "notes.txt": strToU8("notes"),
    }),
  );
  assert.equal(r.files[0].name, "a.pdf");
  assert.equal(r.skipped.length, 1);
});
test("rejects traversal", () =>
  assert.throws(
    () => extractArchive(zipSync({ "../a.pdf": strToU8("x") })),
    /unsafe/,
  ));
test("caps PDF count", () =>
  assert.throws(
    () =>
      extractArchive(
        zipSync(
          Object.fromEntries(
            Array.from({ length: 51 }, (_, i) => [`${i}.pdf`, strToU8("x")]),
          ),
        ),
      ),
    /50 PDFs/,
  ));
test("rejects non-PDF-only archive", () =>
  assert.throws(
    () => extractArchive(zipSync({ "a.txt": strToU8("x") })),
    /No supported/,
  ));
test("caps extracted file size", () =>
  assert.throws(
    () =>
      extractArchive(
        zipSync({ "big.pdf": new Uint8Array(10 * 1024 * 1024 + 1) }),
      ),
    /10 MB/,
  ));
