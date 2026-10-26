export function structureWarnings(items, box, page) {
  const cells = items.filter((i) => i.str?.trim()),
    findings = [];
  const warn = (message) =>
    findings.push({
      category: "PDF structure",
      state: "Needs review",
      page,
      message,
      uncertain: true,
    });
  const text = cells.map((c) => c.str).join(" ");
  if (text.replace(/\s/g, "").length < 100)
    warn(
      "This page contains very little extractable text. Check for an unnecessary page break or isolated acceptance section. Images/scans/signatures are not assessed; do not remove the page based on this warning alone.",
    );
  const supported = cells.filter(
    (c) =>
      Math.abs(c.transform[1]) < 0.01 &&
      Math.abs(c.transform[2]) < 0.01 &&
      c.transform[0] > 0 &&
      c.transform[3] > 0,
  );
  const outside = supported.filter(
    (c) =>
      c.transform[4] < box[0] - 2 ||
      c.transform[4] + c.width > box[2] + 2 ||
      c.transform[5] < box[1] - 2 ||
      c.transform[5] + c.height > box[3] + 2,
  );
  if (outside.length)
    warn(
      `${outside.length} text fragment(s) may extend beyond the PDF page box. Inspect for clipping; text metrics are approximate.`,
    );
  const qty = supported.find((c) => c.str.trim() === "Qty");
  if (qty) {
    const heads = supported.filter(
      (c) => Math.abs(c.transform[5] - qty.transform[5]) < 2,
    );
    const desc = heads.find((c) => c.str.trim() === "Description");
    const amount = heads.find((c) => c.str.trim() === "Amount");
    if (desc && amount) {
      const limit = (desc.transform[4] + desc.width + qty.transform[4]) / 2;
      const end = supported.filter(
        (c) =>
          c.transform[5] < qty.transform[5] &&
          /^(Sub Total|Confirmed and Accepted by|Thanks for your business)/i.test(
            c.str.trim(),
          ),
      );
      const bottom = end.length
        ? Math.max(...end.map((c) => c.transform[5]))
        : box[1] + 35;
      const spills = supported.filter(
        (c) =>
          c.transform[5] < qty.transform[5] - 3 &&
          c.transform[5] > bottom &&
          c.transform[4] >= desc.transform[4] - 2 &&
          c.transform[4] < limit &&
          c.transform[4] + c.width > limit + 4,
      );
      if (spills.length)
        warn(
          `${spills.length} description fragment(s) extend toward the quantity column. These may be legitimate full-width section headings; inspect for actual column overlap.`,
        );
    }
  }
  if (supported.length !== cells.length)
    warn(
      "Some text is rotated or uses unsupported transforms. Boundary and column checks did not cover those fragments.",
    );
  findings.push({
    category: "PDF structure",
    state: "Coverage",
    page,
    message:
      "Text-coordinate screening only. Logos, images, signatures, table borders, visual appearance and reference-template similarity are not checked. Absence of warnings is not a layout pass.",
  });
  return findings;
}
