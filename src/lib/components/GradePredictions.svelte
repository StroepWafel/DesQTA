<script lang="ts">
  import { GeminiService } from '../services/geminiService';
  import { notify } from '../../utils/notify';

  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    criteria?: any[];
    results?: any;
    finalGrade?: number;
  }

  interface Props {
    assessments: Assessment[];
    selectedYear: number;
    aiIntegrationsEnabled: boolean;
    gradeAnalyserEnabled: boolean;
    showInView: 'list' | 'board' | 'calendar';
    currentView: 'list' | 'board' | 'calendar';
  }

  let { assessments, selectedYear, aiIntegrationsEnabled, gradeAnalyserEnabled, showInView, currentView }: Props = $props();

  let gradePredictions = $state<Map<string, any>>(new Map());
  let generatingPredictions = $state<boolean>(false);
  let predictionError = $state<string | null>(null);

  async function generateGradePredictions() {
    generatingPredictions = true;
    predictionError = null;

    try {
      // Get assessments for the selected year
      const yearAssessments = assessments.filter((a: any) => {
        const assessmentYear = new Date(a.due).getFullYear();
        return assessmentYear === selectedYear;
      });

      // Add final grades to assessments that have been marked
      const assessmentsWithGrades = yearAssessments.map((a: any) => {
        let finalGrade = undefined;
        if (a.status === 'MARKS_RELEASED') {
          if (a.criteria && a.criteria[0]?.results?.percentage !== undefined) {
            finalGrade = a.criteria[0].results.percentage;
          } else if (a.results && a.results.percentage !== undefined) {
            finalGrade = a.results.percentage;
          }
        }
        return { ...a, finalGrade };
      });

      const predictions = await GeminiService.predictGrades(assessmentsWithGrades);
      
      // Store predictions in the map
      const predictionsMap = new Map();
      predictions.forEach(prediction => {
        predictionsMap.set(prediction.subject, prediction);
      });
      
      gradePredictions = predictionsMap;
      
      notify({
        title: 'Grade Predictions Generated',
        body: `Successfully generated predictions for ${predictions.length} subjects`,
      });
    } catch (error) {
      console.error('Error generating predictions:', error);
      predictionError = 'Failed to generate grade predictions. Please try again.';
      notify({
        title: 'Prediction Error',
        body: 'Failed to generate grade predictions',
      });
    } finally {
      generatingPredictions = false;
    }
  }

  function getPredictedGradeDisplay(subjectTitle: string) {
    const prediction = gradePredictions.get(subjectTitle);
    if (!prediction) return null;

    const grade = prediction.predictedGrade;
    const confidence = prediction.confidence;
    
    // Determine color based on grade
    let colorClass = 'text-gray-500';
    if (grade >= 90) colorClass = 'text-green-600 dark:text-green-400';
    else if (grade >= 80) colorClass = 'text-blue-600 dark:text-blue-400';
    else if (grade >= 70) colorClass = 'text-yellow-600 dark:text-yellow-400';
    else if (grade >= 60) colorClass = 'text-orange-600 dark:text-orange-400';
    else colorClass = 'text-red-600 dark:text-red-400';

    return {
      grade: Math.round(grade),
      confidence: Math.round(confidence),
      colorClass,
      reasoning: prediction.reasoning
    };
  }
</script>

{#if aiIntegrationsEnabled && gradeAnalyserEnabled && currentView === showInView}
  <div class="flex flex-col gap-4 p-4 rounded-xl border backdrop-blur-sm bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200/50 dark:border-purple-700/50">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">AI Grade Predictions</h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Generate AI-powered grade predictions for {selectedYear} based on your assessment performance
        </p>
      </div>
      <button
        class="px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={generateGradePredictions}
        disabled={generatingPredictions}>
        {#if generatingPredictions}
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Generating...
          </div>
        {:else}
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            Generate Predictions
          </div>
        {/if}
      </button>
    </div>
    
    {#if predictionError}
      <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
        <p class="text-sm text-red-700 dark:text-red-400">{predictionError}</p>
      </div>
    {/if}

    {#if gradePredictions.size > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each Array.from(gradePredictions.entries()) as [subject, prediction]}
          <div class="p-3 rounded-lg bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 relative group transition-all duration-200 hover:scale-[1.02] cursor-pointer">
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-slate-900 dark:text-white truncate">{subject}</span>
              <div class="text-right">
                <div class="text-lg font-bold {getPredictedGradeDisplay(subject)?.colorClass}">
                  {getPredictedGradeDisplay(subject)?.grade}%
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400">
                  Predicted
                </div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Confidence: {getPredictedGradeDisplay(subject)?.confidence}%
              </span>
            </div>
            <!-- Tooltip: appears when hovering over the entire card -->
            <div class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full mb-2 px-4 py-3 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 max-w-xs w-max whitespace-pre-line break-words shadow-lg border border-slate-700"
              style="min-width:220px; max-width:320px;">
              <div class="font-semibold mb-1">AI Reasoning:</div>
              <div style="white-space:pre-line; word-break:break-word;">{getPredictedGradeDisplay(subject)?.reasoning}</div>
              <div class="mt-1 text-slate-300">
                Confidence: {getPredictedGradeDisplay(subject)?.confidence}%
              </div>
              <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-slate-900"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if} 