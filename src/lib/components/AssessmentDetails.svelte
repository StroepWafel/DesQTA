<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText } from 'svelte-hero-icons';

  interface Criterion {
    results?: {
      grade?: string;
      percentage?: number;
    };
  }

  interface Engagement {
    feedbackComment?: string;
  }

  interface AssessmentData {
    marked?: boolean;
    criteria?: Criterion[];
    engagement?: Engagement;
  }

  interface Props {
    assessmentData: AssessmentData;
  }

  let { assessmentData }: Props = $props();

  const firstCriterion = assessmentData?.criteria?.[0] ?? null;
</script>

<div class="grid gap-8 animate-fade-in">
  <div
    class="p-6 rounded-2xl transition-all duration-300 dark:bg-slate-900 bg-slate-100 hover:shadow-lg hover:shadow-accent-500/10">
    <!-- Grade Bar -->
    {#if assessmentData.marked && firstCriterion && firstCriterion.results}
      <div class="mb-4">
        <div class="mb-2 text-2xl font-bold">Grade</div>
        <div
          class="overflow-hidden relative w-full h-16 rounded-xl border transition-all duration-300 dark:bg-slate-800 bg-slate-200 dark:border-slate-700 border-slate-200 hover:shadow-lg hover:shadow-accent-500/10">
          <div
            class="absolute top-0 left-0 h-full bg-accent-600 transition-all duration-500"
            style="width: {firstCriterion.results.percentage || 0}%">
          </div>
          <div class="flex relative z-10 justify-center items-center h-full">
            <span
              class="text-3xl font-extrabold tracking-wide text-white drop-shadow animate-fade-in"
              style="text-shadow: 0 2px 8px #000a">
              {firstCriterion.results.grade ||
                (firstCriterion.results.percentage ? firstCriterion.results.percentage.toFixed(2) + '%' : 'No Grade')}
            </span>
          </div>
        </div>
      </div>
    {:else if assessmentData.marked && firstCriterion}
      <div class="mb-4">
        <div class="mb-2 text-2xl font-bold">Grade</div>
        <div class="p-4 rounded-xl border dark:bg-slate-800 bg-slate-200 dark:border-slate-700 border-slate-200">
          <div class="text-center text-slate-600 dark:text-slate-400">
            Grade not yet available
          </div>
        </div>
      </div>
    {/if}
    <!-- End Grade Bar -->
    <div class="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
      <h1 class="text-2xl font-bold">Teacher marking and feedback</h1>
    </div>
    {#if assessmentData.marked && assessmentData.criteria?.length}
      <div class="mb-2 font-semibold">Achievement</div>
    {/if}
    {#if assessmentData.marked && assessmentData.engagement?.feedbackComment}
      <div
        class="p-4 mb-4 rounded-xl transition-all duration-300 dark:bg-slate-800 bg-slate-200 hover:shadow-lg hover:shadow-accent-500/5">
        <div class="mb-1 font-semibold">Teacher feedback</div>
        <div class="dark:text-slate-300 text-slate-700">
          {assessmentData.engagement.feedbackComment}
        </div>
      </div>
    {:else if assessmentData.marked}
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-slate-400" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Feedback Available</h3>
        <p class="text-slate-600 dark:text-slate-400">
          This assessment has been marked but no detailed feedback is available yet.
        </p>
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-slate-400" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Assessment Not Yet Marked</h3>
        <p class="text-slate-600 dark:text-slate-400">
          This assessment hasn't been marked yet. Check back later for grades and feedback.
        </p>
      </div>
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