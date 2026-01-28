<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ChartBar } from 'svelte-hero-icons';

  interface Props {
    assessments: Array<{
      id: number;
      subject: string;
      grade?: number;
      percentage?: number;
    }>;
    subject?: string;
  }

  let { assessments = [], subject }: Props = $props();

  // Filter assessments by subject if provided
  const filteredAssessments = $derived(() => {
    if (!subject) return assessments;
    return assessments.filter((a) => a.subject === subject);
  });

  // Calculate average
  const average = $derived(() => {
    const grades = filteredAssessments()
      .map((a) => a.percentage ?? a.grade)
      .filter((g): g is number => typeof g === 'number' && !isNaN(g));

    if (grades.length === 0) return null;

    const sum = grades.reduce((acc, g) => acc + g, 0);
    return Math.round((sum / grades.length) * 10) / 10;
  });

  const gradeCount = $derived(() => filteredAssessments().length);
</script>

{#if average !== null && gradeCount > 0}
  <div
    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
    <Icon src={ChartBar} class="w-5 h-5 text-blue-600 dark:text-blue-400" />
    <div class="flex flex-col">
      <span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
        {subject ? `${subject} Average` : 'Average Grade'}
      </span>
      <span class="text-lg font-bold text-blue-700 dark:text-blue-300">
        {average}%
      </span>
    </div>
    <span class="ml-auto text-xs text-blue-500 dark:text-blue-500">
      ({gradeCount} {gradeCount === 1 ? 'assessment' : 'assessments'})
    </span>
  </div>
{/if}

