export function normalizeText(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
export function applyReferenceChecks(pages, checks) {
  const normalized = pages.map(normalizeText),
    all = normalized.join(" "),
    findings = [];
  for (const c of checks) {
    const phrase = normalizeText(c.phrase);
    if (phrase.length < 3) continue;
    if (c.kind === "forbidden_phrase") {
      const page = normalized.findIndex((p) => p.includes(phrase));
      if (page >= 0)
        findings.push({
          page: page + 1,
          message: `${c.title}: prohibited wording found. ${c.correction}`,
          error: true,
        });
    } else if (c.kind === "required_phrase" && !all.includes(phrase))
      findings.push({
        page: null,
        message: `${c.title}: required wording not found in extracted text. ${c.correction} Verify the original PDF before deciding.`,
        uncertain: true,
      });
  }
  return findings;
}
