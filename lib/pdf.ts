export async function extractPdf(file: File) {
  if (file.size > 10 * 1024 * 1024) throw Error("Maximum PDF size is 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
    throw Error("File is not a PDF.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const doc = await task.promise;
    if (doc.numPages > 30) throw Error("Maximum length is 30 pages.");
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) =>
            "str" in item
              ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
              : "",
          )
          .join(""),
      );
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
