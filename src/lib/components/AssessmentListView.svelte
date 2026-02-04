<script lang="ts">
  import AssessmentCard from './AssessmentCard.svelte';
  import { Card, Badge, Button } from '$lib/components/ui';
  import Modal from './Modal.svelte';
  import { calculateWeightedGradePredictions } from '../services/gradeCalculationService';
  import {
    loadWeightedPrediction,
    saveWeightedPrediction,
  } from '../services/weightedGradeCacheService';
  import type { Assessment, Subject, WeightedGradePrediction } from '../types';
  import { Icon } from 'svelte-hero-icons';
  import { Sparkles, ChevronDown, ChevronUp, InformationCircle, Calendar } from 'svelte-hero-icons';
  import { seqtaFetch } from '../../utils/netUtil';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import T from './T.svelte';
  import { _ } from '../i18n';

  interface Props {
    assessments: Assessment[];
    subjects: Subject[];
    activeSubjects: Subject[];
    availableYears?: number[];
    selectedYear?: number;
    onYearChange?: (year: number) => void | Promise<void>;
  }

  let {
    assessments,
    subjects,
    activeSubjects,
    availableYears = [],
    selectedYear,
    onYearChange,
  }: Props = $props();

  // Store weighted predictions per subject (using Record for better reactivity)
  let weightedPredictions = $state<Record<string, WeightedGradePrediction>>({});
  let calculatingForSubject = $state<string | null>(null);
  let expandedSubjects = $state<Record<string, boolean>>({});
  let showDisclaimer = $state(false);

  function getLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 40) return 'D';
    return 'E';
  }

  function getWeightedGradeColor(grade: number): string {
    if (grade >= 90) return 'text-green-600 dark:text-green-400';
    else if (grade >= 80) return 'text-blue-600 dark:text-blue-400';
    else if (grade >= 70) return 'text-yellow-600 dark:text-yellow-400';
    else if (grade >= 60) return 'text-orange-600 dark:text-orange-400';
    else return 'text-red-600 dark:text-red-400';
  }

  async function calculateWeightedPredictionForSubject(subjectCode: string) {
    calculatingForSubject = subjectCode;
    try {
      // Get assessments for this subject
      const subjectAssessments = assessments.filter((a) => a.code === subjectCode) as Assessment[];

      // Fetch full assessment details for each assessment to get grades
      const assessmentsWithGrades: Assessment[] = [];

      for (const assessment of subjectAssessments) {
        try {
          // Fetch full assessment details
          const res = await seqtaFetch('/seqta/student/assessment/get?', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {
              assessment: assessment.id,
              student: 69,
              metaclass: assessment.metaclassID || 0,
            },
          });

          const assessmentData = JSON.parse(res).payload;

          // Check if marked (same logic as AssessmentDetails component)
          const isMarked = assessmentData.marked === true;
          const hasCriteria = assessmentData.criteria && assessmentData.criteria.length > 0;
          const firstCriterion = hasCriteria ? assessmentData.criteria[0] : null;
          const hasResults = firstCriterion?.results;

          if (isMarked && hasResults) {
            // Extract grade from criteria[0].results.percentage (same as AssessmentDetails)
            let finalGrade: number | undefined = undefined;

            if (firstCriterion.results.percentage !== undefined) {
              finalGrade = Number(firstCriterion.results.percentage);
            } else if (assessmentData.results?.percentage !== undefined) {
              finalGrade = Number(assessmentData.results.percentage);
            }

            if (finalGrade !== undefined && !isNaN(finalGrade)) {
              assessmentsWithGrades.push({
                ...assessment,
                status: 'MARKS_RELEASED' as const,
                finalGrade,
                metaclassID: assessment.metaclassID || 0,
              });
            }
          }
        } catch (e) {
          // Silently fail for individual assessments
        }
      }

      if (assessmentsWithGrades.length === 0) {
        alert(`No released assessments with grades found for ${subjectCode}`);
        return;
      }

      const predictions = await calculateWeightedGradePredictions(assessmentsWithGrades);
      const prediction = predictions.get(subjectCode);

      if (prediction) {
        // Update predictions using object spread for reactivity
        weightedPredictions = {
          ...weightedPredictions,
          [subjectCode]: prediction,
        };

        // Save to cache
        await saveWeightedPrediction(subjectCode, prediction);
      } else {
        alert(`Could not calculate weighted grade for ${subjectCode}.`);
      }
    } catch (error) {
      alert(
        `Error calculating weighted grade: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      calculatingForSubject = null;
    }
  }

  function scrollToSubject(event: MouseEvent, subjectCode: string) {
    event.preventDefault();
    const element = document.getElementById(`subject-${subjectCode}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Add highlight class
      element.classList.add('highlight-subject');
      // Remove highlight class after animation
      setTimeout(() => {
        element.classList.remove('highlight-subject');
      }, 1500);
    }
  }

  // Load cached predictions on mount and when assessments/year changes
  async function loadCachedPredictions() {
    const subjectCodes = new Set(
      subjects.filter((s) => assessments.some((a) => a.code === s.code)).map((s) => s.code),
    );

    // Clear existing predictions first
    weightedPredictions = {};

    for (const subjectCode of subjectCodes) {
      const cached = await loadWeightedPrediction(subjectCode);
      if (cached) {
        weightedPredictions = {
          ...weightedPredictions,
          [subjectCode]: cached,
        };
      }
    }
  }

  onMount(async () => {
    await loadCachedPredictions();
  });

  // Reload predictions when assessments or selectedYear changes
  $effect(() => {
    // Track dependencies
    assessments;
    selectedYear;

    // Reload predictions when they change
    loadCachedPredictions();
  });

  // Calculate latest year (first item since sorted descending)
  const latestYear = $derived(availableYears.length > 0 ? availableYears[0] : null);

  // Show "Change to Latest Year" button if:
  // - No assessments for current year
  // - Other years exist
  // - Current year is not the latest year
  const showChangeYearButton = $derived(
    assessments.length === 0 &&
      availableYears.length > 1 &&
      selectedYear !== undefined &&
      latestYear !== null &&
      selectedYear !== latestYear,
  );

  // Create unique key for assessments to force re-render with animations
  const assessmentsKey = $derived.by(() => {
    const ids = assessments.map((a) => a.id).join(',');
    return `${selectedYear}-${assessments.length}-${ids}`;
  });

  async function handleChangeToLatestYear() {
    if (latestYear !== null && onYearChange) {
      await onYearChange(latestYear);
    }
  }
</script>

<div class="flex flex-col gap-6 lg:flex-row">
  <!-- Quick Navigation Sidebar -->
  <div class="shrink-0 lg:w-48">
    <div
      class="sticky top-6 p-4 rounded-xl border backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
      <h3 class="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Quick Jump</h3>
      <div class="space-y-2">
        {#each subjects.filter( (subject) => assessments.some((a) => a.code === subject.code), ) as subject}
          <a
            href="#subject-{subject.code}"
            class="flex gap-2 items-center px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer hover:bg-zinc-200/80 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            onclick={(e) => scrollToSubject(e, subject.code)}>
            <div
              class="w-2 h-2 rounded-full"
              style="background-color: {subject.colour || '#8e8e8e'}">
            </div>
            <span class="text-sm truncate">{subject.code}</span>
            {#if activeSubjects && activeSubjects.some((as: any) => as.code === subject.code)}
              <span class="text-xs opacity-75">(Active)</span>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 space-y-6">
    <!-- Change to Latest Year Banner -->
    {#if showChangeYearButton}
      <div
        class="p-4 rounded-xl border backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <Icon src={Calendar} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <div>
              <p class="text-sm font-medium text-zinc-900 dark:text-white">
                <T
                  key="assessments.no_assessments_for_year"
                  fallback={`No assessments for ${selectedYear?.toString() || ''}`}
                  values={{ year: selectedYear?.toString() || '' }} />
              </p>
              <p class="text-xs text-zinc-600 dark:text-zinc-400">
                <T key="assessments.other_years_available" fallback="Other years are available" />
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            onclick={handleChangeToLatestYear}
            class="transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
            <T key="assessments.change_to_latest_year" fallback="Change to Latest Year" />
          </Button>
        </div>
      </div>
    {/if}

    {#key assessmentsKey}
      {#each subjects.filter( (subject) => assessments.some((a) => a.code === subject.code), ) as subject, subjectIndex}
        <div
          id="subject-{subject.code}"
          class="subject-group-animate"
          style="animation-delay: {subjectIndex * 100}ms;">
          <Card variant="default" padding="none" class="overflow-hidden">
            {#snippet header()}
              <div class="flex gap-3 items-center justify-between">
                <div class="flex gap-3 items-center flex-wrap">
                  <div
                    class="w-3 h-3 rounded-full"
                    style="background-color: {subject.colour || '#8e8e8e'}">
                  </div>
                  <h3 class="text-base font-bold sm:text-lg text-zinc-900 dark:text-white">
                    {subject.title}
                  </h3>
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">({subject.code})</span>
                  {#if activeSubjects && activeSubjects.some((as: any) => as.code === subject.code)}
                    <Badge variant="success" size="xs">Active</Badge>
                  {/if}

                  <!-- Calculate Grade Button -->
                  {#if !weightedPredictions[subject.code]}
                    <button
                      type="button"
                      onclick={() => {
                        calculateWeightedPredictionForSubject(subject.code);
                      }}
                      disabled={calculatingForSubject === subject.code}
                      class="ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all duration-200 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed">
                      {#if calculatingForSubject === subject.code}
                        <div
                          class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin">
                        </div>
                      {:else}
                        <Icon src={Sparkles} class="w-3 h-3" />
                      {/if}
                      <span class="ml-1">Calculate Grade</span>
                    </button>
                  {/if}
                </div>
              </div>
            {/snippet}

            <!-- Weighted Grade Prediction Bar (below header) -->
            {#if weightedPredictions[subject.code]}
              {@const prediction = weightedPredictions[subject.code]}
              {@const isExpanded = expandedSubjects[subject.code] || false}
              {@const letterGrade = getLetterGrade(prediction.predictedGrade)}
              <div class="px-4 pt-4 pb-2">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Weighted Grade Prediction
                  </span>
                  <button
                    type="button"
                    onclick={() => {
                      showDisclaimer = true;
                    }}
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all duration-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                    <Icon src={InformationCircle} class="w-3 h-3" />
                    <span>Disclaimer</span>
                  </button>
                </div>
                <button
                  type="button"
                  onclick={() => {
                    expandedSubjects[subject.code] = !isExpanded;
                    expandedSubjects = { ...expandedSubjects };
                  }}
                  class="w-full text-left">
                  <div
                    class="overflow-hidden relative w-full h-12 rounded-lg border transition-all duration-300 dark:bg-zinc-800 bg-zinc-200 dark:border-zinc-700 border-zinc-200 hover:shadow-lg hover:shadow-accent-500/10">
                    <div
                      class="absolute top-0 left-0 h-full bg-accent-600 transition-all duration-500"
                      style="width: {Math.min(prediction.predictedGrade, 100)}%">
                    </div>
                    <div class="flex relative z-10 justify-between items-center h-full px-4">
                      <div class="flex items-baseline gap-2">
                        <span
                          class="text-lg font-bold tracking-wide text-white drop-shadow-xs"
                          style="text-shadow: 0 2px 8px #000a">
                          {Math.round(prediction.predictedGrade)}%
                        </span>
                        <span
                          class="text-sm font-semibold text-white/90 drop-shadow-xs"
                          style="text-shadow: 0 2px 8px #000a">
                          ({letterGrade})
                        </span>
                      </div>
                      <div class="flex gap-2 items-center">
                        <span class="text-xs text-white/90">
                          {prediction.assessmentsCount} assessment{prediction.assessmentsCount !== 1
                            ? 's'
                            : ''}
                        </span>
                        <Icon
                          src={isExpanded ? ChevronUp : ChevronDown}
                          class="w-4 h-4 text-white/90 transition-transform duration-300 ease-in-out {isExpanded
                            ? 'rotate-180'
                            : ''}" />
                      </div>
                    </div>
                  </div>
                </button>
                {#if isExpanded}
                  <div
                    class="mt-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
                    <div class="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      Assessment Breakdown:
                    </div>
                    <div class="space-y-2">
                      {#each prediction.assessments as assessment}
                        <div
                          class="flex justify-between items-center p-2 rounded bg-white dark:bg-zinc-800">
                          <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-zinc-900 dark:text-white truncate">
                              {assessment.title}
                            </div>
                            <div class="text-xs text-zinc-500 dark:text-zinc-400">
                              Weight: {assessment.weighting}%
                            </div>
                          </div>
                          <div
                            class="ml-2 text-sm font-bold {getWeightedGradeColor(
                              assessment.grade,
                            )}">
                            {Math.round(assessment.grade)}%
                          </div>
                        </div>
                      {/each}
                    </div>
                    <div class="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <div class="flex justify-between items-center text-xs">
                        <span class="text-zinc-600 dark:text-zinc-400">Total Weight:</span>
                        <span class="font-semibold text-zinc-900 dark:text-white">
                          {prediction.totalWeight}%
                        </span>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="p-4 space-y-4">
              {#each assessments.filter((a) => a.code === subject.code) as assessment, cardIndex}
                <div class="assessment-card-animate" style="animation-delay: {cardIndex * 50}ms;">
                  <AssessmentCard {assessment} />
                </div>
              {/each}
            </div>
          </Card>
        </div>
      {/each}
    {/key}
  </div>
</div>

<!-- Disclaimer Modal -->
<Modal
  bind:open={showDisclaimer}
  title="Grade Prediction Disclaimer"
  maxWidth="max-w-2xl"
  onclose={() => {
    showDisclaimer = false;
  }}>
  <div class="px-8 pb-8">
    <div class="space-y-4 text-zinc-700 dark:text-zinc-300">
      <p class="text-sm leading-relaxed">
        <strong class="text-zinc-900 dark:text-white">Important:</strong> The weighted grade predictions
        displayed are estimates based on released assessment marks and their weightings extracted from
        assessment PDFs.
      </p>
      <p class="text-sm leading-relaxed">
        <strong class="text-zinc-900 dark:text-white">We cannot guarantee:</strong>
      </p>
      <ul class="ml-6 space-y-2 text-sm list-disc">
        <li>That all assessments have been accounted for</li>
        <li>That the weightings extracted from PDFs are accurate</li>
        <li>That your final grade will match this prediction</li>
        <li>That all assessment types are weighted equally or as displayed</li>
      </ul>
      <p class="text-sm leading-relaxed">
        These predictions are for informational purposes only and should not be used as a definitive
        indicator of your final grade. Always consult with your teachers or official grade reports
        for accurate information about your academic performance.
      </p>
      <div class="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-700">
        <Button
          variant="primary"
          onclick={() => {
            showDisclaimer = false;
          }}
          class="w-full">
          I Understand
        </Button>
      </div>
    </div>
  </div>
</Modal>

<style>
  @keyframes highlight {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 10px rgba(99, 102, 241, 0.2);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
  }

  :global(.highlight-subject) {
    animation: highlight 1.5s ease-out;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .subject-group-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }

  .assessment-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
