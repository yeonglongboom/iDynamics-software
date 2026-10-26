// Only explicit labels and isolated numeric table rows are interpreted.
const money = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)\\.\\d{2}";
const cents = (s) => Math.round(Number(s.replaceAll(",", "")) * 100);
const display = (n) => (n / 100).toFixed(2);
export function financialChecks(pages) {
  const findings = [],
    totals = [],
    ids = [];
  let checked = 0,
    rows = 0;
  const add = (page, message, error = false) =>
    findings.push({
      page,
      message,
      ...(error ? { error: true } : { uncertain: true }),
    });
  pages.forEach((text, index) => {
    const page = index + 1;
    // Only document heading/label contexts, not arbitrary references in descriptions.
    for (const m of text.matchAll(
      /(?:Quotation\s*(?:No\s*:|#)|(?:^|\n)\s*#)\s*(QT\s*\/\s*\d{4}\s*\/\s*\d+[A-Z]*)\b/gi,
    ))
      ids.push({ page, value: m[1].replace(/\s/g, "").toUpperCase() });
    const read = (pattern) =>
      Array.from(text.matchAll(new RegExp(pattern, "gim")), (m) => cents(m[1]));
    const sub = read(`^\\s*Sub\\s*Total\\s*:?\\s*(?:RM\\s*)?(${money})\\s*$`);
    const taxMatches = Array.from(
      text.matchAll(
        new RegExp(
          `^\\s*SST Services Tax\\s*\\((\\d+(?:\\.\\d+)?)%\\)\\s*:?\\s*(?:RM\\s*)?(${money})\\s*$`,
          "gim",
        ),
      ),
    );
    const total = read(
      `^\\s*(?:Total|Grand Total)\\s*:?\\s*RM\\s*(${money})\\s*$`,
    );
    const repeat = read(`^\\s*Quotation Total\\s*:\\s*RM\\s*(${money})\\s*$`);
    totals.push(
      ...total.map((value) => ({ page, value })),
      ...repeat.map((value) => ({ page, value })),
    );
    if (sub.length === 1 && taxMatches.length === 1 && total.length === 1) {
      checked++;
      const tax = cents(taxMatches[0][2]);
      if (Math.abs(sub[0] + tax - total[0]) > 1)
        add(
          page,
          `Subtotal + SST = RM ${display(sub[0] + tax)}, but total is RM ${display(total[0])}. Correct the summary total.`,
          true,
        );
      const expected = Math.round((sub[0] * Number(taxMatches[0][1])) / 100);
      // Mixed tax bases/extra adjustments cannot safely be inferred from summary alone.
      if (Math.abs(expected - tax) > 1)
        add(
          page,
          `SST at the displayed ${taxMatches[0][1]}% on the full subtotal would be RM ${display(expected)}; displayed SST is RM ${display(tax)}. Verify taxable items, exemptions and rounding; this is not an automatic rejection.`,
        );
    }
    const lines = text.split(/\r?\n/).map((s) => s.trim());
    let mode = null;
    for (const line of lines) {
      if (
        /^#\s+Description\s+Qty\s+Rate\s+(?:Disc\s+)?Tax%\s+Amount$/i.test(line)
      ) {
        mode = /\bDisc\b/i.test(line) ? "discount" : "plain";
        continue;
      }
      if (/^(?:Confirmed|Terms|Thanks|Sub\s*Total|Total\b)/i.test(line))
        mode = null;
      if (!mode) continue;
      // Conservative fallback: only rows with all numeric columns on ONE line,
      // quantity and unit included; wrapped/positionally ambiguous rows are not guessed.
      const pattern = new RegExp(
        `^(\\d+\\.\\d{2})\\s+(?:unit|user|year)s?\\s+(${money})\\s+${mode === "discount" ? `(${money})(%)?\\s+` : ""}(\\d+\\.\\d{2})\\s+(${money})$`,
        "i",
      );
      const m = line.match(pattern);
      if (!m) continue;
      const qty = Number(m[1]),
        rate = cents(m[2]);
      let expected = qty * rate,
        amount;
      if (mode === "discount") {
        const discount = Number(m[3].replaceAll(",", ""));
        if (!m[4] && discount !== 0) {
          add(
            page,
            "A numeric discount has no % marker; confirm whether it is a fixed or percentage discount.",
          );
          continue;
        }
        if (discount < 0 || discount > 100) {
          add(
            page,
            "Discount is outside the supported percentage range. Verify this row.",
          );
          continue;
        }
        expected *= 1 - discount / 100;
        amount = cents(m[6]);
      } else amount = cents(m[4]);
      rows++;
      if (Math.abs(Math.round(expected) - amount) > 1)
        add(
          page,
          `Line calculation: ${qty} × RM ${display(rate)} after the displayed discount should be RM ${display(Math.round(expected))}, not RM ${display(amount)}. Correct the line amount.`,
          true,
        );
    }
  });
  if (new Set(ids.map((x) => x.value)).size > 1)
    add(
      ids.find((x) => x.value !== ids[0].value).page,
      `Quotation numbers differ: ${ids.map((x) => `${x.value} (page ${x.page})`).join("; ")}. Verify whether these identify this document or a referenced quotation.`,
    );
  if (!ids.length)
    add(
      null,
      "Quotation-number consistency could not be checked from explicit heading/number labels.",
    );
  if (new Set(totals.map((x) => x.value)).size > 1)
    add(
      totals.find((x) => x.value !== totals[0].value).page,
      `Document totals differ: ${totals.map((x) => `RM ${display(x.value)} (page ${x.page})`).join("; ")}. Verify whether these are document or page totals.`,
    );
  if (!checked)
    add(
      null,
      "Summary arithmetic could not be verified: an unambiguous subtotal, SST amount and RM total were not found together on one page.",
    );
  findings.push({
    page: null,
    message: `Arithmetic coverage: ${checked} summary block(s), ${rows} isolated line row(s) checked. Other rows, item-to-subtotal reconciliation, tax eligibility and adjustments require human review. A one-sen rounding tolerance is used.`,
  });
  return findings;
}
