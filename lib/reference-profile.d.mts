export type Profile = { version: number; features: string[] };
export function referenceProfile(pages: string[]): Profile;
export function compareProfiles(
  pages: string[],
  references: { id: string; filename: string; profile: Profile }[],
): {
  category: string;
  state: string;
  page: null;
  message: string;
  uncertain?: boolean;
}[];
