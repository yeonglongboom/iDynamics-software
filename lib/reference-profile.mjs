const markers = {
  quantity: /\bQty\b/i,
  rate: /\bRate\b/i,
  amount: /\bAmount\b/i,
  tax: /\bTax%/i,
  payment: /\bPayment\s*:/i,
  validity: /\bValidity\s*:/i,
  delivery: /\bDelivery\s*:/i,
  terms: /Terms\s*&\s*Conditions/i,
  acceptance: /Confirmed and Accepted by/i,
};
export function referenceProfile(pages) {
  const all = pages.join("\n");
  return {
    version: 1,
    features: Object.keys(markers).filter((k) => markers[k].test(all)),
  };
}
export function compareProfiles(pages, references) {
  const current = referenceProfile(pages),
    usable = references.filter(
      (r) =>
        r.profile?.version === 1 &&
        Array.isArray(r.profile.features) &&
        r.profile.features.length >= 4 &&
        r.profile.features.every(k=>typeof k === "string" && Object.hasOwn(markers,k)),
    );
  if (!usable.length)
    return [
      {
        category: "Reference comparison",
        state: "Not checked",
        page: null,
        message:
          "No confirmed Approved references with usable profiles. An admin must prepare reference profiles in the library.",
      },
    ];
  const ranked = usable
    .map((r) => ({
      ...r,
      missing: r.profile.features.filter(
        (k) => Object.hasOwn(markers, k) && !current.features.includes(k),
      ),
    }))
    .sort((a, b) => a.missing.length - b.missing.length);
  const best = ranked[0];
  return [
    {
      category: "Reference comparison",
      state: best.missing.length ? "Needs review" : "Passed",
      page: null,
      ...(best.missing.length ? { uncertain: true } : {}),
      message: best.missing.length
        ? `Compared with Approved reference ${best.filename}: section/headings not detected: ${best.missing.join(", ")}. Inspect the PDF; extraction or quotation type may differ.`
        : `Section/heading presence matches Approved reference ${best.filename}. This does not validate wording, values, layout or overall approval.`,
    },
    {
      category: "Reference comparison",
      state: "Coverage",
      page: null,
      message: `Compared ${usable.length} profiled Approved reference(s); selected the one with fewest missing section/headings. Customer values, prices and item counts are ignored. Standard-terms meaning and visual appearance are not compared.`,
    },
  ];
}
