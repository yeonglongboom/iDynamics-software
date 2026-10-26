export function structureWarnings(
  items: { str?: string; transform: number[]; width: number; height: number }[],
  box: number[],
  page: number,
): {
  category: string;
  state: string;
  page: number;
  message: string;
  uncertain?: boolean;
}[];
