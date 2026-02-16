import { seqtaFetch } from '../../utils/netUtil';
import { GeminiService } from './geminiService';
import type { QuizQuestion, QuizFeedback } from '$lib/types/studyTools';

const STUDENT_ID = 69;

export interface GenerateQuizParams {
  topic: string;
  numQuestions: number;
  assessmentContext?: string;
  /** Optional year level hint for AI (e.g. "Year 10") */
  yearLevel?: string;
  /** Question types to include - mix by default */
  questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer')[];
}

export interface GenerateFeedbackParams {
  questions: QuizQuestion[];
  userAnswers: (number | string)[];
  topic: string;
}

/**
 * Fetches assessment details for AI context. Returns a condensed string with title, description, and expectations.
 */
export async function fetchAssessmentContext(
  assessmentId: number,
  metaclass: number,
): Promise<string> {
  try {
    const res = await seqtaFetch('/seqta/student/assessment/get?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: {
        assessment: assessmentId,
        student: STUDENT_ID,
        metaclass,
      },
    });
    const payload = JSON.parse(res).payload;
    const parts: string[] = [];
    if (payload?.title) parts.push(`Title: ${payload.title}`);
    if (payload?.description) parts.push(`Description: ${payload.description}`);
    if (payload?.expectations?.length) {
      const expText = payload.expectations
        .map((e: { name?: string; description?: string }) =>
          [e.name, e.description].filter(Boolean).join(': '),
        )
        .join('\n');
      if (expText) parts.push(`Expectations:\n${expText}`);
    }
    if (payload?.criteria?.length) {
      const critText = payload.criteria
        .map((c: { name?: string; description?: string }) =>
          [c.name, c.description].filter(Boolean).join(': '),
        )
        .join('\n');
      if (critText) parts.push(`Criteria:\n${critText}`);
    }
    return parts.join('\n\n') || payload?.title || 'Assessment';
  } catch (error) {
    console.error('Failed to fetch assessment context:', error);
    return '';
  }
}

/**
 * Generates a quiz using the configured AI provider (Gemini or Cerebras).
 */
export async function generateQuiz(params: GenerateQuizParams): Promise<QuizQuestion[]> {
  const { topic, numQuestions, assessmentContext, yearLevel, questionTypes } = params;
  const result = await GeminiService.generateQuizContent({
    topic,
    numQuestions,
    assessmentContext,
    yearLevel,
    questionTypes,
  });
  if (!result?.questions?.length) {
    throw new Error('Failed to generate quiz. Please try again.');
  }
  return result.questions;
}

/**
 * Generates personalized AI feedback based on quiz results.
 */
export async function generateFeedback(params: GenerateFeedbackParams): Promise<QuizFeedback | null> {
  return GeminiService.generateQuizFeedback(params);
}
