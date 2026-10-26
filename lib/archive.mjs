import { Unzip, UnzipInflate } from "fflate";
const MB = 1024 * 1024;
export function extractArchive(bytes) {
  if (bytes.length > 50 * MB)
    throw Error("ZIP exceeds 50 MB compressed limit.");
  const files = [],
    skipped = [];
  let entries = 0,
    total = 0,
    failure;
  const unzip = new Unzip((entry) => {
    if (++entries > 500) {
      failure = Error("ZIP exceeds 500 entries.");
      return;
    }
    const name = entry.name;
    if (name.includes("..") || name.startsWith("/") || name.includes("\\")) {
      failure = Error("ZIP contains unsafe paths.");
      return;
    }
    if (!/\.pdf$/i.test(name) || name.startsWith("__MACOSX/")) {
      skipped.push(name);
      return;
    }
    if (files.length >= 50) {
      failure = Error(
        "ZIP contains more than 50 PDFs. Split it into smaller batches.",
      );
      return;
    }
    if (entry.originalSize > 10 * MB) {
      failure = Error("A ZIP member exceeds 10 MB.");
      return;
    }
    const chunks = [];
    let size = 0;
    entry.ondata = (error, data, final) => {
      if (error) {
        failure = Error(
          "ZIP is corrupt or uses unsupported encryption/compression.",
        );
        return;
      }
      size += data.length;
      total += data.length;
      if (size > 10 * MB || total > 100 * MB) {
        failure = Error(
          "ZIP exceeds extracted size limits (10 MB per PDF / 100 MB total).",
        );
        entry.terminate();
        return;
      }
      chunks.push(data);
      if (final) {
        const output = new Uint8Array(size);
        let pos = 0;
        for (const chunk of chunks) {
          output.set(chunk, pos);
          pos += chunk.length;
        }
        files.push({ name: name.split("/").at(-1), data: output });
      }
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  for (let i = 0; i < bytes.length; i += 65536) {
    unzip.push(bytes.subarray(i, i + 65536), i + 65536 >= bytes.length);
    if (failure) throw failure;
  }
  if (!files.length) throw Error("No supported PDFs found in ZIP.");
  return { files, skipped };
}
