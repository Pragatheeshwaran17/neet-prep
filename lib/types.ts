export const SUBJECTS = ['Physics', 'Chemistry', 'Biology'] as const;
export type Subject = (typeof SUBJECTS)[number];

export type Mode = 'subject' | 'mock' | 'paper';

/** Question as students see it — never contains answer/solution */
export interface PublicQuestion {
  id: string;
  number: number;
  subject: Subject;
  question: string;
  options: string[];
  display: 'text' | 'image';
  imageUrl: string | null;
}

export interface ReviewQuestion extends PublicQuestion {
  answer: number;
  solution: string;
  solutionImageUrl: string | null;
  note: string;
  chosen: number | null;
}

export interface AttemptSummary {
  id: string;
  mode: Mode;
  subject: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  maxScore: number;
  time_taken: number;
  submitted_at: string;
  created: string;
}

export const MARKS = { correct: 4, wrong: -1 };
export const SECONDS_PER_QUESTION = 60; // NEET: 180 questions in 180 minutes
