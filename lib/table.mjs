// PDF coordinates increase upwards. Text must fit inside its column, not merely
// start there; this prevents long descriptions being mistaken for numeric cells.
export function extractTable(items) {
  const cells = items
    .filter((i) => i.str?.trim())
    .map((i) => ({
      text: i.str.trim(),
      x: i.transform[4],
      y: i.transform[5],
      width: i.width,
    }));
  const qty = cells.find((c) => c.text === "Qty");
  if (!qty)
    return {
      rows: [],
      complete: false,
      reason: "No quantity column header found.",
    };
  const header = cells.filter((c) => Math.abs(c.y - qty.y) < 2);
  const labels = ["#", "Description", "Qty", "Rate", "Disc", "Tax%", "Amount"];
  const cols = labels
    .map((label) => header.find((c) => c.text === label))
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);
  if (
    !["#", "Description", "Qty", "Rate", "Tax%", "Amount"].every((l) =>
      cols.some((c) => c.text === l),
    )
  )
    return {
      rows: [],
      complete: false,
      reason: "Table headers could not be separated.",
    };
  const boundaries = cols.map((c, i) =>
    i === 0 ? c.x - 10 : (cols[i - 1].x + cols[i - 1].width + c.x) / 2,
  );
  // Stop at summary/acceptance labels, ignoring table descriptions containing "Total".
  const stops = cells.filter(
    (c) =>
      c.y < qty.y &&
      /^(Sub Total|Confirmed and Accepted by|Thanks for your business)/i.test(
        c.text,
      ),
  );
  const bottom = stops.length ? Math.max(...stops.map((c) => c.y)) : 35;
  const body = cells.filter((c) => c.y < qty.y - 3 && c.y > bottom + 2);
  const colOf = (c) => {
    let index = -1;
    for (let i = 0; i < cols.length; i++)
      if (c.x >= boundaries[i] - 2) index = i;
    if (index < 0) return "";
    const right =
      index + 1 < cols.length
        ? boundaries[index + 1]
        : cols[index].x + cols[index].width + 12;
    return c.x + c.width <= right + 2 ? cols[index].text : "";
  };
  const anchors = body
    .filter((c) => colOf(c) === "#" && /^\d+$/.test(c.text))
    .sort((a, b) => b.y - a.y);
  const rows = [];
  let complete = anchors.length > 0;
  for (const anchor of anchors) {
    const row = { number: Number(anchor.text) };
    let valid = true;
    for (const label of [
      "Qty",
      "Rate",
      ...(cols.some((c) => c.text === "Disc") ? ["Disc"] : []),
      "Tax%",
      "Amount",
    ]) {
      const hits = body.filter(
        (c) => colOf(c) === label && Math.abs(c.y - anchor.y) < 2.5,
      );
      if (hits.length !== 1 || !/^\d[\d,]*\.\d{2}%?$/.test(hits[0].text)) {
        valid = false;
        break;
      }
      row[label] = hits[0].text;
    }
    if (valid) rows.push(row);
    else complete = false;
  }
  // A numeric amount with no anchor means a continuation/split row was missed.
  const amounts = body.filter(
    (c) => colOf(c) === "Amount" && /^\d[\d,]*\.\d{2}$/.test(c.text),
  );
  if (amounts.length !== anchors.length) complete = false;
  return {
    rows,
    complete,
    reason: complete
      ? ""
      : "Some numbered rows or amount cells could not be paired reliably.",
  };
}
export function tableFindings(tables, pages) {
  const findings = [],
    rows = tables.flatMap((t, p) => t.rows.map((r) => ({ ...r, page: p + 1 })));
  let checked = 0;
  const number = (s) => Number(s.replaceAll(",", ""));
  for (const r of rows) {
    let discount = 0;
    if (r.Disc) {
      if (!r.Disc.endsWith("%") && number(r.Disc) !== 0) {
        findings.push({
          page: r.page,
          message: `Row ${r.number}: discount lacks a % marker; verify its meaning.`,
          uncertain: true,
        });
        continue;
      }
      discount = number(r.Disc.replace("%", ""));
      if (discount > 100) continue;
    }
    checked++;
    const expected = Math.round(
        number(r.Qty) * number(r.Rate) * (1 - discount / 100) * 100,
      ),
      actual = Math.round(number(r.Amount) * 100);
    if (Math.abs(expected - actual) > 1)
      findings.push({
        page: r.page,
        message: `Row ${r.number}: expected RM ${(expected / 100).toFixed(2)} after discount, but amount is RM ${r.Amount}. Correct the line amount.`,
        error: true,
      });
  }
  // Only reconcile a single-table document with a complete sequential item set.
  const active = tables.filter((t) => t.rows.length || t.complete);
  const sequential = rows.every((r, i) => r.number === i + 1);
  const subtotal = [];
  pages.forEach((p, i) => {
    for (const m of p.matchAll(
      /^\s*Sub\s*Total\s*:?\s*(?:RM\s*)?([\d,]+\.\d{2})\s*$/gim,
    ))
      subtotal.push({ value: number(m[1]), page: i + 1 });
  });
  let reconciled = false;
  if (
    active.length === 1 &&
    active[0].complete &&
    sequential &&
    subtotal.length === 1
  ) {
    reconciled = true;
    const sum = rows.reduce(
        (n, r) => n + Math.round(number(r.Amount) * 100),
        0,
      ),
      expected = Math.round(subtotal[0].value * 100);
    if (Math.abs(sum - expected) > 1)
      findings.push({
        page: subtotal[0].page,
        message: `Sum of all ${rows.length} line amounts is RM ${(sum / 100).toFixed(2)}, but subtotal is RM ${subtotal[0].value.toFixed(2)}. Verify adjustments or correct the subtotal.`,
        uncertain: true,
      });
  }
  findings.push({
    page: null,
    message: `Position-based coverage: ${rows.length} row(s) extracted; ${checked} line calculation(s) checked; subtotal reconciliation ${reconciled ? "performed" : "not performed (incomplete, multi-table or ambiguous extraction)"}. Unread or split rows still require human review.`,
  });
  return findings;
}
