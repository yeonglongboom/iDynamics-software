export function reviewText(pages, months) {
  const findings = [];
  const all = pages.join("\n");
  if (all.replace(/\s/g, "").length < 100)
    return {
      status: "Human review",
      findings: [
        {
          page: 1,
          message:
            "PDF text could not be read reliably. Scanned PDFs require visual/OCR review.",
        },
      ],
    };
  const required = [
    ["quotation number", /QT\s*\/\s*\d{4}\s*\/\s*\d+/i],
    ["quotation date", /Quotation Date/i],
    ["quantity column", /\bQty\b/i],
    ["rate column", /\bRate\b/i],
    ["amount column", /\bAmount\b/i],
    ["terms and conditions", /Terms\s*&\s*Conditions/i],
  ];
  for (const [name, re] of required)
    if (!re.test(all))
      findings.push({
        page: 1,
        message: `Required ${name} was not found in extracted text. Verify the PDF and correct if missing.`,
        uncertain: true,
      });
  pages.forEach((text, index) => {
    for (const match of text.matchAll(
      /(?:training[^.\n]{0,100}?valid|(?:all\s+)?software training\s+valid)[^.\n]{0,30}?(\d+)\s*(?:\([^)]*\)\s*)?months?/gi,
    )) {
      if (Number(match[1]) !== months)
        findings.push({
          page: index + 1,
          message: `Training validity is ${match[1]} months; standard requires exactly ${months} month(s). Edit the quotation and upload again.`,
          error: true,
        });
    }
  });
  findings.push({
    page: null,
    message:
      "Visual layout, column placement, customer accuracy, line-item arithmetic and full contractual consistency still require human review. No automatic approval is issued.",
  });
  return {
    status: findings.some((f) => f.error) ? "Rejected" : "Human review",
    findings,
  };
}
