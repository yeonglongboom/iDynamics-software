export function extractArchive(bytes: Uint8Array): {
  files: { name: string; data: Uint8Array }[];
  skipped: string[];
};
