export type TableRow = {
  number: number;
  Qty: string;
  Rate: string;
  Disc?: string;
  "Tax%": string;
  Amount: string;
};
export type Table = { rows: TableRow[]; complete: boolean; reason: string };
export function extractTable(
  items: { str?: string; transform: number[]; width: number }[],
): Table;
export function tableFindings(
  tables: Table[],
  pages: string[],
): {
  page: number | null;
  message: string;
  error?: boolean;
  uncertain?: boolean;
}[];
