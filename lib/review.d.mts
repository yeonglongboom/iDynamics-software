export function reviewText(
  pages: string[],
  months: number,
): {
  status: string;
  findings: {
    category?: string;
    state?: string;
    page: number | null;
    message: string;
    error?: boolean;
    uncertain?: boolean;
  }[];
};
