import { requiredFields } from "./fields.mjs";
import { financialChecks } from "./financial.mjs";
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
  findings.push(...requiredFields(pages));
  let trainingFound = false;
  pages.forEach((text, index) => {
    for (const match of text.matchAll(
      /(?:training[^.\n]{0,100}?valid|(?:all\s+)?software training\s+valid)[^.\n]{0,30}?(\d+)\s*(?:\([^)]*\)\s*)?months?/gi,
    )) {
      trainingFound = true;
      if (Number(match[1]) !== months)
        findings.push({
          page: index + 1,
          message: `Training validity is ${match[1]} months; standard requires exactly ${months} month(s). Edit the quotation and upload again.`,
          category: "Training validity",
          state: "Failed",
          error: true,
        });
    }
  });
  if (!findings.some((f) => f.category === "Training validity"))
    findings.push({
      category: "Training validity",
      state: trainingFound ? "Passed" : "Needs review",
      page: null,
      message: trainingFound
        ? `Detected training duration matches ${months} month(s). Other contractual wording is not validated.`
        : "No supported training-validity wording was detected. Confirm applicability and wording manually.",
      ...(!trainingFound ? { uncertain: true } : {}),
    });
  findings.push(...financialChecks(pages));
  findings.push({
    page: null,
    category: "Remaining checks",
    state: "Not checked",
    message:
      "Visual layout, column placement, customer accuracy, unverified arithmetic and full contractual consistency still require human review. No automatic approval is issued.",
  });
  return {
    status: findings.some((f) => f.error) ? "Rejected" : "Human review",
    findings,
  };
}
