<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText } from 'svelte-hero-icons';
  import { decodeHtmlEntities, sanitizeHtml } from '../../utils/sanitization';
  import { formatAssessmentDetailGradeDisplay } from '$lib/utils/gradeDisplay';
  import T from './T.svelte';

  interface RubricDescriptor {
    id?: number;
    score?: number;
    grade?: string;
    content?: string;
  }

  interface RubricLine {
    id: number;
    title?: string | null;
    content?: string | null;
    weight?: number;
    deleted?: boolean;
    descriptors?: RubricDescriptor[];
  }

  interface Rubric {
    mode?: string;
    flexible?: boolean;
    id?: number;
    lines?: RubricLine[];
  }

  interface RubricScoreEntry {
    score?: number;
    grade?: string;
    id: number;
    content?: string;
  }

  interface Criterion {
    /** SEQTA letter scale for this criterion, e.g. ["A","B","C","D","E","UG","N/A"] */
    availableGrades?: string[];
    id?: number;
    label?: string;
    rubric?: Rubric;
    /** When marked, maps line id (string) → selected descriptor */
    rubricScore?: Record<string, RubricScoreEntry> | null;
    results?: {
      grade?: string;
      percentage?: number;
    } | null;
  }

  interface Engagement {
    feedbackComment?: string;
  }

  interface AssessmentData {
    marked?: boolean;
    /** Some payloads expose the scale at assessment level */
    availableGrades?: string[];
    criteria?: Criterion[];
    engagement?: Engagement | null;
  }

  interface Props {
    assessmentData: AssessmentData;
  }

  let { assessmentData }: Props = $props();

  const firstCriterion = $derived(assessmentData?.criteria?.[0] ?? null);
  const gradeBarPercent = $derived.by(() => {
    const p = firstCriterion?.results?.percentage;
    if (p == null) return 0;
    const n = Number(p);
    if (isNaN(n)) return 0;
    return Math.min(100, Math.max(0, n));
  });
  const availableGradesForDisplay = $derived(
    firstCriterion?.availableGrades ?? assessmentData?.availableGrades,
  );

  /** Criteria that include a rubric with at least one active line */
  const criteriaWithRubrics = $derived.by(() => {
    const list = assessmentData?.criteria ?? [];
    return list.filter((c) => {
      const lines = c.rubric?.lines?.filter((l) => !l.deleted) ?? [];
      return lines.length > 0;
    });
  });

  function getScoreForLine(
    rubricScore: Record<string, RubricScoreEntry> | null | undefined,
    lineId: number,
  ): RubricScoreEntry | undefined {
    if (!rubricScore) return undefined;
    return rubricScore[String(lineId)] ?? rubricScore[lineId as unknown as string];
  }

  function isDescriptorSelected(
    rubricScore: Record<string, RubricScoreEntry> | null | undefined,
    lineId: number,
    descriptorId: number | undefined,
  ): boolean {
    if (descriptorId == null) return false;
    const picked = getScoreForLine(rubricScore, lineId);
    return picked !== undefined && picked.id === descriptorId;
  }

  function descriptorLabel(d: RubricDescriptor, index: number): string {
    if (d.grade != null && String(d.grade).trim() !== '') return String(d.grade).trim();
    return String(index + 1);
  }
</script>

<div class="grid gap-4 animate-fade-in">
  <!-- Grade (only when marked and results exist) -->
  {#if assessmentData.marked && firstCriterion && firstCriterion.results}
    <div
      class="p-4 rounded-xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
      <div class="mb-1.5 text-lg font-bold text-zinc-900 dark:text-white">Grade</div>
      <div
        class="overflow-hidden relative w-full h-12 rounded-lg border transition-all duration-300 dark:bg-zinc-800 bg-zinc-200 dark:border-zinc-700 border-zinc-200 hover:shadow-lg hover:shadow-accent-500/10">
        <div
          class="absolute top-0 left-0 h-full bg-accent-600 transition-all duration-500"
          style="width: {gradeBarPercent}%">
        </div>
        <div class="flex relative z-10 justify-center items-center h-full">
          <span
            class="text-xl font-extrabold tracking-wide text-white drop-shadow-xs animate-fade-in"
            style="text-shadow: 0 2px 8px #000a">
            {formatAssessmentDetailGradeDisplay(
              firstCriterion.results.grade,
              firstCriterion.results.percentage,
              availableGradesForDisplay,
            )}
          </span>
        </div>
      </div>
    </div>
  {:else if assessmentData.marked && firstCriterion}
    <div
      class="p-4 rounded-xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
      <div class="mb-1.5 text-lg font-bold text-zinc-900 dark:text-white">Grade</div>
      <div
        class="p-3 rounded-lg border dark:bg-zinc-800 bg-zinc-200 dark:border-zinc-700 border-zinc-200">
        <div class="text-center text-zinc-600 dark:text-zinc-400">
          <T key="assessments.grade_not_yet_available" fallback="Grade not yet available" />
        </div>
      </div>
    </div>
  {/if}

  <!-- Rubric: show whenever SEQTA sends rubric lines (marked or not; scores optional) -->
  {#each criteriaWithRubrics as criterion}
    <div
      class="p-4 rounded-xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10 border border-zinc-200/50 dark:border-zinc-700/50">
      <div class="flex flex-col gap-0.5 mb-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 class="text-lg font-bold text-zinc-900 dark:text-white">
          <T key="assessments.rubric_title" fallback="Rubric" />
        </h2>
        {#if criterion.label}
          <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">{criterion.label}</span>
        {/if}
      </div>

      <div class="space-y-4">
        {#each criterion.rubric?.lines?.filter((l) => !l.deleted) ?? [] as line}
          {@const lineScore = getScoreForLine(criterion.rubricScore, line.id)}
          <div class="space-y-1.5">
            {#if line.title}
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                {line.title}
              </h3>
            {/if}
            <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {#each line.descriptors ?? [] as d, di}
                {@const selected = isDescriptorSelected(criterion.rubricScore, line.id, d.id)}
                <div
                  class="rounded-lg border p-2 transition-all duration-200 dark:bg-zinc-800/80 bg-white/80 border-zinc-200 dark:border-zinc-700 {selected
                    ? 'ring-1 ring-accent-500 ring-offset-1 ring-offset-zinc-100 dark:ring-offset-zinc-900 shadow-sm'
                    : 'hover:border-zinc-300 dark:hover:border-zinc-600'}">
                  <div class="flex items-center justify-between gap-1.5 mb-1">
                    <span
                      class="inline-flex items-center px-1.5 py-px text-[10px] font-bold rounded {selected
                        ? 'bg-accent-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'}">
                      {descriptorLabel(d, di)}
                    </span>
                    {#if selected && lineScore?.grade && String(lineScore.grade).trim() !== String(descriptorLabel(d, di)).trim()}
                      <span class="text-[10px] font-medium text-accent-600 dark:text-accent-400">
                        {lineScore.grade}
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs leading-snug text-zinc-700 dark:text-zinc-200">
                    {d.content ?? ''}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}

  <!-- Teacher feedback -->
  <div
    class="p-4 rounded-xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
    <div class="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
      <h1 class="text-lg font-bold text-zinc-900 dark:text-white">
        <T key="assessments.teacher_marking_feedback" fallback="Teacher marking and feedback" />
      </h1>
    </div>
    {#if assessmentData.marked && assessmentData.criteria?.length}
      <div class="mb-2 font-semibold text-zinc-800 dark:text-zinc-200">Achievement</div>
    {/if}
    {#if assessmentData.engagement?.feedbackComment}
      <div
        class="p-4 mb-4 rounded-xl transition-all duration-300 dark:bg-zinc-800 bg-zinc-200 hover:shadow-lg hover:shadow-accent-500/5">
        <div class="mb-1 font-semibold text-zinc-900 dark:text-white">Teacher feedback</div>
        <div class="dark:text-zinc-300 text-zinc-700">
          {@html sanitizeHtml(decodeHtmlEntities(assessmentData.engagement.feedbackComment ?? ''))}
        </div>
      </div>
    {:else if assessmentData.marked}
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div
          class="w-16 h-16 mb-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-zinc-400" />
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          <T key="assessments.no_feedback_title" fallback="No Feedback Available" />
        </h3>
        <p class="text-zinc-600 dark:text-zinc-400">
          <T
            key="assessments.no_feedback_body"
            fallback="This assessment has been marked but no detailed feedback is available yet." />
        </p>
      </div>
    {:else if !criteriaWithRubrics.length}
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div
          class="w-16 h-16 mb-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-zinc-400" />
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          <T key="assessments.not_marked_title" fallback="Assessment Not Yet Marked" />
        </h3>
        <p class="text-zinc-600 dark:text-zinc-400">
          <T
            key="assessments.not_marked_body"
            fallback="This assessment hasn't been marked yet. Check back later for grades and feedback." />
        </p>
      </div>
    {:else}
      <p class="text-sm text-zinc-600 dark:text-zinc-400">
        <T
          key="assessments.not_marked_feedback_pending"
          fallback="Teacher feedback will appear here once available." />
      </p>
    {/if}
  </div>
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style> 
