// Presence checks only: never imply customer identity or commercial validity.
export function requiredFields(pages) {
  const fields = [
    [
      "Quotation number",
      /(?:#\s*|Quotation\s+No[ \t]*:[ \t]*)QT\s*\/\s*\d{4}\s*\/\s*\d+[A-Z]*\b/i,
    ],
    [
      "Quotation date",
      /Quotation\s+Date[ \t]*:[ \t]*\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/i,
    ],
    ["Salesperson", /Sales\s+Person[ \t]*:[ \t]*[A-Za-z][^\n]{2,}/i],
    ["Sales contact number", /Work\s+Mobile[ \t]*:[ \t]*\+?[\d ()-]{7,}/i],
    ["Payment terms", /(?:^|\n)\s*Payment[ \t]*:[ \t]*\S[^\n]*/i],
    ["Quotation validity", /(?:^|\n)\s*Validity[ \t]*:[ \t]*\S[^\n]*/i],
    ["Delivery terms", /(?:^|\n)\s*Delivery[ \t]*:[ \t]*\S[^\n]*/i],
    ["Terms and conditions section", /Terms\s*&\s*Conditions\s*:/i],
  ];
  const findings = fields.map(([name, re]) => {
    const page = pages.findIndex((p) => re.test(p));
    return {
      category: "Required information",
      state: page >= 0 ? "Passed" : "Needs review",
      page: page >= 0 ? page + 1 : null,
      message:
        page >= 0
          ? `${name}: text detected. Presence only; correctness is not verified.`
          : `${name}: a readable labelled value was not detected. Check the PDF and add or correct it if missing.`,
      ...(page < 0 ? { uncertain: true } : {}),
    };
  });
  for (const [name,re] of [["Quantity column", /\bQty\b/i],["Rate column", /\bRate\b/i],["Amount column", /\bAmount\b/i]]) {
    const page=pages.findIndex(p=>re.test(p));
    findings.push({category:"Table headings",state:page>=0?"Passed":"Needs review",page:page>=0?page+1:null,message:`${name}: ${page>=0?"heading text detected; placement is not validated":"heading not detected; verify original PDF"}.`,...(page<0?{uncertain:true}:{})});
  }
  findings.push({
    category: "Required information",
    state: "Not checked",
    page: null,
    message:
      "Customer name, address and contact accuracy: not automatically verified. Unlabelled customer blocks cannot yet be distinguished reliably from supplier details. Check against your customer record.",
  });
  return findings;
}
