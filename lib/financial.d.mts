export function financialChecks(
  pages: string[],
): {
  page: number | null;
  message: string;
  error?: boolean;
  uncertain?: boolean;
}[];
