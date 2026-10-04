/**
 * PocketBase collection names, all in one place.
 * Change the prefix with NEXT_PUBLIC_PB_PREFIX (default: none — uses users, papers, questions, attempts).
 */
const P = process.env.NEXT_PUBLIC_PB_PREFIX ?? '';

export const C = {
  users: `${P}users`,
  papers: `${P}papers`,
  questions: `${P}questions`,
  attempts: `${P}attempts`,
} as const;
