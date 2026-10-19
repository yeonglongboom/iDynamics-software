export function reviewText(
  pages: string[],
  months: number,
): {
  status: string;
  findings: {
    page: number | null;
    message: string;
    error?: boolean;
    uncertain?: boolean;
  }[];
};
