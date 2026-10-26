export type ReferenceCheck = {
  id: string;
  title: string;
  kind: string;
  phrase: string;
  correction: string;
};
export function normalizeText(value: unknown): string;
export function applyReferenceChecks(
  pages: string[],
  checks: ReferenceCheck[],
): {
  page: number | null;
  message: string;
  error?: boolean;
  uncertain?: boolean;
}[];
