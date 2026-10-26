export function requiredFields(
  pages: string[],
): {
  category: string;
  state: string;
  page: number | null;
  message: string;
  uncertain?: boolean;
}[];
