<script lang="ts">
  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    colour: string;
    metaclass: number;
  }

  interface Props {
    assessment: Assessment;
    showSubject?: boolean;
  }

  let { assessment, showSubject = false }: Props = $props();

  function getStatusBadge(status: string, due: string) {
    const dueDate = new Date(due);
    const now = new Date();

    if (status === 'MARKS_RELEASED') {
      return { text: 'Marked', color: 'bg-green-500' };
    } else if (dueDate < now) {
      return { text: 'Overdue', color: 'bg-red-500' };
    } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      // Within 7 days
      return { text: 'Due Soon', color: 'bg-yellow-500' };
    } else {
      return { text: 'Upcoming', color: 'bg-blue-500' };
    }
  }
</script>

<a
  href="/assessments/{assessment.id}/{assessment.metaclass}"
  class="block bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border-l-8 border border-slate-300/50 dark:border-slate-700/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
  style="border-color: {assessment.colour};">
  <div class="flex gap-2 items-center">
    <div class="text-sm font-semibold text-slate-600 dark:text-slate-400">
      {new Date(assessment.due).toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}
    </div>
    <span
      class="px-2 py-0.5 rounded text-xs text-white {getStatusBadge(
        assessment.status,
        assessment.due,
      ).color}">
      {getStatusBadge(assessment.status, assessment.due).text}
    </span>
  </div>
  <h4 class="mt-1 font-bold truncate text-slate-900 dark:text-white">
    {assessment.title}
  </h4>
  {#if showSubject}
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
      {assessment.code}
    </p>
  {/if}
</a> 