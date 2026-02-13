import { invoke } from '@tauri-apps/api/core';
import type { QuizQuestion, QuizFeedback } from '$lib/types/studyTools';

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

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

type AIProvider = 'gemini' | 'cerebras';

export class GeminiService {
  static async getProvider(): Promise<AIProvider> {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['ai_provider'] });
      return (subset?.ai_provider || 'gemini') as AIProvider;
    } catch {
      return 'gemini';
    }
  }

  static async getApiKey(provider?: AIProvider): Promise<string | null> {
    try {
      const currentProvider = provider || (await this.getProvider());
      const keys = currentProvider === 'cerebras' ? ['cerebras_api_key'] : ['gemini_api_key'];
      const subset = await invoke<any>('get_settings_subset', { keys });
      return currentProvider === 'cerebras'
        ? subset?.cerebras_api_key || null
        : subset?.gemini_api_key || null;
    } catch {
      return null;
    }
  }

  static async predictGrades(assessments: AssessmentData[]): Promise<GradePrediction[]> {
    const provider = await this.getProvider();
    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      const providerName = provider === 'cerebras' ? 'Cerebras' : 'Gemini';
      throw new Error(`No ${providerName} API key set. Please add your API key in Settings.`);
    }
    try {
      // Group assessments by subject
      const assessmentsBySubject = new Map<string, AssessmentData[]>();

      assessments.forEach((assessment) => {
        if (!assessmentsBySubject.has(assessment.subject)) {
          assessmentsBySubject.set(assessment.subject, []);
        }
        assessmentsBySubject.get(assessment.subject)!.push(assessment);
      });

      const predictions: GradePrediction[] = [];

      for (const [subject, subjectAssessments] of assessmentsBySubject) {
        // Filter for completed assessments with grades
        const completedAssessments = subjectAssessments.filter(
          (a) => a.status === 'MARKS_RELEASED' && a.finalGrade !== undefined,
        );

        if (completedAssessments.length === 0) {
          // No completed assessments, skip prediction
          continue;
        }

        // Prepare data for the AI
        const assessmentData = completedAssessments.map((a) => ({
          title: a.title,
          grade: a.finalGrade,
          dueDate: a.due,
          status: a.status,
        }));

        const prompt = this.buildPredictionPrompt(subject, assessmentData);

        const prediction = await this.callAIAPI(prompt, apiKey, provider);
        if (prediction) {
          predictions.push(prediction);
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

  private static async callAIAPI(
    prompt: string,
    apiKey: string,
    provider: AIProvider,
  ): Promise<GradePrediction | null> {
    if (provider === 'cerebras') {
      return this.callCerebrasAPI(prompt, apiKey);
    } else {
      return this.callGeminiAPI(prompt, apiKey);
    }
  }

  private static async callGeminiAPI(
    prompt: string,
    apiKey: string,
  ): Promise<GradePrediction | null> {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
      }

      const responseText = data.candidates[0].content.parts[0].text;

      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const prediction = JSON.parse(jsonMatch[0]);

      // Validate the prediction format
      if (
        !prediction.subject ||
        typeof prediction.predictedGrade !== 'number' ||
        typeof prediction.confidence !== 'number' ||
        !prediction.reasoning
      ) {
        throw new Error('Invalid prediction format');
      }

      return prediction as GradePrediction;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return null;
    }
  }

  private static async callCerebrasAPI(
    prompt: string,
    apiKey: string,
  ): Promise<GradePrediction | null> {
    try {
      const response = await fetch(CEREBRAS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'DesQTA/1.0',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1024,
          top_p: 0.95,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cerebras API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from Cerebras API');
      }

      const responseText = data.choices[0].message.content;

      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const prediction = JSON.parse(jsonMatch[0]);

      // Validate the prediction format
      if (
        !prediction.subject ||
        typeof prediction.predictedGrade !== 'number' ||
        typeof prediction.confidence !== 'number' ||
        !prediction.reasoning
      ) {
        throw new Error('Invalid prediction format');
      }

      return prediction as GradePrediction;
    } catch (error) {
      console.error('Error calling Cerebras API:', error);
      return null;
    }
  }

  static async summarizeLessonContent(lesson: {
    title: string;
    content: string;
    attachments: { name: string }[];
  }): Promise<LessonSummary | null> {
    const provider = await this.getProvider();
    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      const providerName = provider === 'cerebras' ? 'Cerebras' : 'Gemini';
      throw new Error(`No ${providerName} API key set. Please add your API key in Settings.`);
    }
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
      if (provider === 'cerebras') {
        const response = await fetch(CEREBRAS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'DesQTA/1.0',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1024,
            top_p: 0.95,
          }),
        });
        if (!response.ok) throw new Error(`Cerebras API error: ${response.status}`);
        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message)
          throw new Error('Invalid response from Cerebras API');
        const responseText = data.choices[0].message.content;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        const summaryObj = JSON.parse(jsonMatch[0]);
        if (!summaryObj.summary || !Array.isArray(summaryObj.steps))
          throw new Error('Invalid summary format');
        return summaryObj as LessonSummary;
      } else {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
          }),
        });
        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content)
          throw new Error('Invalid response from Gemini API');
        const responseText = data.candidates[0].content.parts[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        const summaryObj = JSON.parse(jsonMatch[0]);
        if (!summaryObj.summary || !Array.isArray(summaryObj.steps))
          throw new Error('Invalid summary format');
        return summaryObj as LessonSummary;
      }
    } catch (error) {
      console.error(
        `Error calling ${provider === 'cerebras' ? 'Cerebras' : 'Gemini'} API for lesson summary:`,
        error,
      );
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
    const provider = await this.getProvider();
    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      const providerName = provider === 'cerebras' ? 'Cerebras' : 'Gemini';
      throw new Error(`No ${providerName} API key set. Please add your API key in Settings.`);
    }
    const maxTokens = options?.maxTokens ?? 2048;
    try {
      if (provider === 'cerebras') {
        const response = await fetch(CEREBRAS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'DesQTA/1.0',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: maxTokens,
            top_p: 0.95,
          }),
        });
        if (!response.ok) throw new Error(`Cerebras API error: ${response.status}`);
        const data = await response.json();
        if (!data.choices?.[0]?.message?.content)
          throw new Error('Invalid response from Cerebras API');
        const text = data.choices[0].message.content;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        return JSON.parse(jsonMatch[0]) as T;
      } else {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: maxTokens,
            },
          }),
        });
        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text)
          throw new Error('Invalid response from Gemini API');
        const text = data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        return JSON.parse(jsonMatch[0]) as T;
      }
    } catch (error) {
      console.error('Error in callAIForJSON:', error);
      throw error;
    }
  }

  static async generateQuizContent(params: {
    topic: string;
    numQuestions: number;
    assessmentContext?: string;
  }): Promise<{ questions: QuizQuestion[] } | null> {
    const { topic, numQuestions, assessmentContext } = params;
    const contextBlock = assessmentContext
      ? `\nAdditional context from the assessment:\n${assessmentContext}\n`
      : '';

    const prompt = `You are an AI educational assistant creating a multiple-choice quiz for a student.

Topic to quiz on: ${topic}
${contextBlock}

Generate exactly ${numQuestions} multiple-choice questions. Each question must have exactly 4 options (A, B, C, D). The correct answer should be at correctIndex (0-3).

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "questions": [
    {
      "question": "The question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}

Rules:
- correctIndex must be 0, 1, 2, or 3 (index of the correct option)
- Each question must have exactly 4 options
- Questions should test understanding of the topic
- Vary difficulty appropriately`;

    const result = await this.callAIForJSON<{ questions: QuizQuestion[] }>(prompt, {
      maxTokens: 4096,
    });
    if (!result?.questions || !Array.isArray(result.questions)) return null;
    // Validate each question
    const valid = result.questions.every(
      (q) =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === 'number' &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4,
    );
    return valid ? result : null;
  }

  static async generateQuizFeedback(params: {
    questions: QuizQuestion[];
    userAnswers: number[];
    topic: string;
  }): Promise<QuizFeedback | null> {
    const { questions, userAnswers, topic } = params;
    const results = questions.map((q, i) => {
      const correct = userAnswers[i] === q.correctIndex;
      return {
        question: q.question,
        correctAnswer: q.options[q.correctIndex],
        userAnswer: q.options[userAnswers[i] ?? -1] ?? 'No answer',
        correct,
      };
    });
    const correctCount = results.filter((r) => r.correct).length;
    const total = questions.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    const prompt = `You are an AI educational assistant providing personalized feedback on a student's quiz results.

Topic: ${topic}
Score: ${correctCount}/${total} (${score}%)

Question-by-question results:
${results.map((r, i) => `${i + 1}. ${r.question}\n   Correct: ${r.correctAnswer}\n   Student: ${r.userAnswer}\n   ${r.correct ? 'Correct' : 'Incorrect'}`).join('\n\n')}

Provide encouraging, constructive feedback. Be specific about what they got right and what to review.

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "summary": "A 2-3 sentence overall summary of their performance",
  "suggestions": ["Specific suggestion 1", "Specific suggestion 2", "..."],
  "encouragement": "A brief encouraging closing message"
}`;

    return this.callAIForJSON<QuizFeedback>(prompt);
  }
}
