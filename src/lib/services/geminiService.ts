import { invoke } from '@tauri-apps/api/core';

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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

export class GeminiService {
  static async getApiKey(): Promise<string | null> {
    try {
    const subset = await invoke<any>('get_settings_subset', { keys: ['gemini_api_key'] });
    return subset?.gemini_api_key || null;
    } catch {
      return null;
    }
  }

  static async predictGrades(assessments: AssessmentData[]): Promise<GradePrediction[]> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key set. Please add your API key in Settings.');
    }
    try {
      // Group assessments by subject
      const assessmentsBySubject = new Map<string, AssessmentData[]>();
      
      assessments.forEach(assessment => {
        if (!assessmentsBySubject.has(assessment.subject)) {
          assessmentsBySubject.set(assessment.subject, []);
        }
        assessmentsBySubject.get(assessment.subject)!.push(assessment);
      });

      const predictions: GradePrediction[] = [];

      for (const [subject, subjectAssessments] of assessmentsBySubject) {
        // Filter for completed assessments with grades
        const completedAssessments = subjectAssessments.filter(a => 
          a.status === 'MARKS_RELEASED' && a.finalGrade !== undefined
        );

        if (completedAssessments.length === 0) {
          // No completed assessments, skip prediction
          continue;
        }

        // Prepare data for the AI
        const assessmentData = completedAssessments.map(a => ({
          title: a.title,
          grade: a.finalGrade,
          dueDate: a.due,
          status: a.status
        }));

        const prompt = this.buildPredictionPrompt(subject, assessmentData);
        
        const prediction = await this.callGeminiAPI(prompt, apiKey);
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
    const assessmentList = assessments.map(a => 
      `- ${a.title}: ${a.grade}% (due: ${new Date(a.due).toLocaleDateString()})`
    ).join('\n');

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

  private static async callGeminiAPI(prompt: string, apiKey: string): Promise<GradePrediction | null> {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
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
      if (!prediction.subject || typeof prediction.predictedGrade !== 'number' || 
          typeof prediction.confidence !== 'number' || !prediction.reasoning) {
        throw new Error('Invalid prediction format');
      }

      return prediction as GradePrediction;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return null;
    }
  }

  static async summarizeLessonContent(lesson: { title: string; content: string; attachments: { name: string }[] }): Promise<LessonSummary | null> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key set. Please add your API key in Settings.');
    }
    const attachmentList = lesson.attachments.length > 0 
      ? lesson.attachments.map(a => `- ${a.name}`).join('\n')
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
          }
        })
      });
      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
      const data = await response.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) throw new Error('Invalid response from Gemini API');
      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      const summaryObj = JSON.parse(jsonMatch[0]);
      if (!summaryObj.summary || !Array.isArray(summaryObj.steps)) throw new Error('Invalid summary format');
      return summaryObj as LessonSummary;
    } catch (error) {
      console.error('Error calling Gemini API for lesson summary:', error);
      return null;
    }
  }
} 