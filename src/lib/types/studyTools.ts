export type QuizQuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  /** For short_answer: the expected answer (options may be empty) */
  correctAnswer?: string;
  /** Question type - defaults to multiple_choice for backwards compat */
  type?: QuizQuestionType;
}

export interface QuizResult {
  questions: QuizQuestion[];
}

export interface QuizFeedback {
  summary: string;
  suggestions: string[];
  encouragement: string;
  /** Per-question scores: 1 = full marks, 0.5 = half marks, 0 = no marks. AI evaluates short answers. */
  questionScores?: number[];
}
