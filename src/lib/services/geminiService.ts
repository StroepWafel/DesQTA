/**
 * GeminiService — thin backwards-compat wrapper around the generic AIService.
 *
 * Historically this file talked to Gemini/Cerebras directly via inline fetch.
 * The provider-specific HTTP now lives in src/lib/services/ai/providers/* and
 * the dispatch happens through AIService. Callers' public method signatures
 * are preserved so no other code needs to change.
 */
import type { QuizQuestion, QuizFeedback } from '$lib/types/studyTools';
import { resolveNumericGradeFromAssessmentPayload } from '$lib/utils/letterGradeScale';
import { AIService } from '$lib/services/ai/AIService';
import type { AIProviderId } from '$lib/services/ai/types';

interface AssessmentData {
  id: number;
  title: string;
  subject: string;
  status: string;
  due: string;
  code: string;
  metaclassID: number;
  programmeID: number;
  graded: boolean;
  overdue: boolean;
  hasFeedback: boolean;
  expectationsEnabled: boolean;
  expectationsCompleted: boolean;
  reflectionsEnabled: boolean;
  reflectionsCompleted: boolean;
  availability: string;
  finalGrade?: number;
}

interface GradePrediction {
  subject: string;
  predictedGrade: number;
  confidence: number;
  reasoning: string;
}

export interface LessonSummary {
  summary: string;
  steps: string[];
}

async function resolveProviderAndKey(): Promise<{
  provider: AIProviderId;
  apiKey: string;
  model: string;
}> {
  const provider = await AIService.getActiveProvider();
  const apiKey = await AIService.getApiKey(provider);
  if (!apiKey) {
    const adapter = AIService.getProvider(provider);
    throw new Error(`No ${adapter.displayName} API key set. Please add your API key in Settings.`);
  }
  const model = await AIService.getModel(provider);
  return { provider, apiKey, model };
}

export class GeminiService {
  /** @deprecated Use AIService.getActiveProvider() instead. */
  static async getProvider(): Promise<AIProviderId> {
    return AIService.getActiveProvider();
  }

  /** @deprecated Use AIService.getApiKey(provider) instead. */
  static async getApiKey(provider?: AIProviderId): Promise<string | null> {
    const p = provider ?? (await AIService.getActiveProvider());
    return AIService.getApiKey(p);
  }

  static async predictGrades(assessments: AssessmentData[]): Promise<GradePrediction[]> {
    const { provider, apiKey, model } = await resolveProviderAndKey();
    try {
      const assessmentsBySubject = new Map<string, AssessmentData[]>();
      assessments.forEach((assessment) => {
        if (!assessmentsBySubject.has(assessment.subject)) {
          assessmentsBySubject.set(assessment.subject, []);
        }
        assessmentsBySubject.get(assessment.subject)!.push(assessment);
      });

      const predictions: GradePrediction[] = [];
      for (const [subject, subjectAssessments] of assessmentsBySubject) {
        const completedAssessments = subjectAssessments.filter((a) => {
          if (a.status !== 'MARKS_RELEASED') return false;
          const n = resolveNumericGradeFromAssessmentPayload(a as any);
          return n !== undefined && !isNaN(n);
        });
        if (completedAssessments.length === 0) continue;

        const assessmentData = completedAssessments.map((a) => ({
          title: a.title,
          grade: resolveNumericGradeFromAssessmentPayload(a as any),
          due: a.due,
          status: a.status,
        }));
        const prompt = this.buildPredictionPrompt(subject, assessmentData);
        try {
          const prediction = await AIService.completeJSON<GradePrediction>({
            provider,
            apiKey,
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            maxTokens: 1024,
            topP: 0.95,
          });
          if (
            prediction &&
            typeof prediction.predictedGrade === 'number' &&
            typeof prediction.confidence === 'number' &&
            prediction.reasoning
          ) {
            predictions.push(prediction);
          }
        } catch (e) {
          console.error('Error in predictGrades for subject', subject, e);
        }
      }
      return predictions;
    } catch (error) {
      console.error('Error predicting grades:', error);
      throw new Error('Failed to generate grade predictions');
    }
  }

  private static buildPredictionPrompt(subject: string, assessments: any[]): string {
    const assessmentList = assessments
      .map((a) => `- ${a.title}: ${a.grade}% (due: ${new Date(a.due).toLocaleDateString()})`)
      .join('\n');
    const averageGrade = assessments.reduce((sum, a) => sum + a.grade, 0) / assessments.length;
    return `You are an AI educational assistant analyzing student performance data.

Given the following assessment results for ${subject}:

${assessmentList}

Current average: ${averageGrade.toFixed(1)}%

Based on this data, predict the student's final grade for ${subject} this year. Consider:
- Performance trends
- Consistency of grades
- Subject difficulty patterns
- Recent performance improvements or declines

Respond with ONLY a JSON object in this exact format:
{
  "subject": "${subject}",
  "predictedGrade": [number between 0-100],
  "confidence": [number between 0-100 representing confidence level],
  "reasoning": "[brief explanation of prediction]"
}

Be realistic and consider that the prediction should be based on demonstrated performance patterns.`;
  }

  static async summarizeLessonContent(lesson: {
    title: string;
    content: string;
    attachments: { name: string }[];
  }): Promise<LessonSummary | null> {
    const { provider, apiKey, model } = await resolveProviderAndKey();
    const attachmentList =
      lesson.attachments.length > 0
        ? lesson.attachments.map((a) => `- ${a.name}`).join('\n')
        : 'No attachments';

    const prompt = `You are an AI assistant for students. Analyze the following lesson content and provide a personalized summary and action steps based on the ACTUAL content provided. Do NOT use placeholders like [Topic of the lesson] or [Key concept 1]. Use the specific information from the lesson content.

Lesson Title: ${lesson.title}

Lesson Content:
${lesson.content || 'No content provided'}

Attachments:
${attachmentList}

IMPORTANT:
- Base your summary on the ACTUAL content provided above
- Use specific details, topics, and concepts mentioned in the lesson
- Do NOT use generic placeholders or template text
- If the content is minimal, provide a brief summary based on what is available
- Make the steps specific to the actual lesson content

Respond ONLY in this JSON format (no markdown, no code blocks):
{
  "summary": "A concise 2-3 sentence summary based on the actual lesson content",
  "steps": ["Specific step 1 based on the content", "Specific step 2 based on the content", ...]
}`;
    try {
      const summaryObj = await AIService.completeJSON<LessonSummary>({
        provider,
        apiKey,
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 1024,
        topP: 0.95,
      });
      if (!summaryObj?.summary || !Array.isArray(summaryObj?.steps)) {
        return null;
      }
      return summaryObj;
    } catch (error) {
      console.error('Error calling AI for lesson summary:', error);
      return null;
    }
  }

  /**
   * Generic AI call that returns parsed JSON. Used by study tools (quiz, feedback).
   */
  static async callAIForJSON<T>(
    prompt: string,
    options?: { maxTokens?: number },
  ): Promise<T | null> {
    const { provider, apiKey, model } = await resolveProviderAndKey();
    return AIService.completeJSON<T>({
      provider,
      apiKey,
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: options?.maxTokens ?? 2048,
      topP: 0.95,
    });
  }

  static async generateQuizContent(params: {
    topic: string;
    numQuestions: number;
    assessmentContext?: string;
    yearLevel?: string;
    questionTypes?: ('multiple_choice' | 'true_false' | 'short_answer')[];
  }): Promise<{ questions: QuizQuestion[] } | null> {
    const { topic, numQuestions, assessmentContext, yearLevel, questionTypes } = params;
    const contextBlock = assessmentContext
      ? `\nAdditional context from the assessment:\n${assessmentContext}\n`
      : '';
    const yearBlock = yearLevel
      ? `\nTarget year level: ${yearLevel}. Adjust difficulty and vocabulary accordingly.\n`
      : '';
    const types = questionTypes?.length
      ? questionTypes
      : ['multiple_choice', 'true_false', 'short_answer'];
    const typesDesc = types.join(', ');

    const prompt = `You are an AI educational assistant creating a quiz for a student.

Topic to quiz on: ${topic}
${contextBlock}${yearBlock}

Generate exactly ${numQuestions} questions. Include a MIX of these types: ${typesDesc}.

For each question, use the appropriate format:

1. multiple_choice: "type": "multiple_choice", "options": [4 options], "correctIndex": 0-3
2. true_false: "type": "true_false", "options": ["True", "False"], "correctIndex": 0 or 1
3. short_answer: "type": "short_answer", "options": [], "correctIndex": 0, "correctAnswer": "the expected answer (accept minor variations)"

Respond ONLY with a JSON object (no markdown, no code blocks):
{
  "questions": [
    {
      "question": "The question text",
      "type": "multiple_choice" | "true_false" | "short_answer",
      "options": [...],
      "correctIndex": <number>,
      "correctAnswer": "<only for short_answer>"
    }
  ]
}`;

    try {
      return await this.callAIForJSON<{ questions: QuizQuestion[] }>(prompt, { maxTokens: 3000 });
    } catch (e) {
      console.error('generateQuizContent failed', e);
      return null;
    }
  }

  static async generateQuizFeedback(params: {
    topic: string;
    questions: QuizQuestion[];
    /** Same shape as the original studyToolsService.GenerateFeedbackParams. */
    userAnswers: (number | string)[];
  }): Promise<QuizFeedback | null> {
    const { topic, questions, userAnswers: answers } = params;
    const lines = questions.map((q, i) => {
      const ans = answers[i];
      const correctStr =
        q.type === 'short_answer'
          ? q.correctAnswer ?? ''
          : (q.options?.[q.correctIndex ?? 0] ?? '');
      const userStr =
        q.type === 'short_answer'
          ? (typeof ans === 'string' ? ans : '')
          : (q.options?.[typeof ans === 'number' ? ans : -1] ?? 'No answer');
      return `Q${i + 1}: ${q.question}\nUser: ${userStr}\nCorrect: ${correctStr}`;
    });
    const prompt = `You are an AI tutor giving feedback on a quiz the student just took.\nTopic: ${topic}\n\n${lines.join('\n\n')}\n\nRespond ONLY in this JSON:\n{\n  "summary": "Short overall feedback",\n  "perQuestion": ["Per-question feedback Q1", "...", "...Qn"],\n  "improvements": ["Actionable improvement 1", "Actionable improvement 2"]\n}`;
    try {
      return await this.callAIForJSON<QuizFeedback>(prompt, { maxTokens: 2000 });
    } catch (e) {
      console.error('generateQuizFeedback failed', e);
      return null;
    }
  }
}
