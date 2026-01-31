<script lang="ts">
  import AssessmentCard from './AssessmentCard.svelte';
  import { Card, Badge, Button } from '$lib/components/ui';

  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    colour: string;
    metaclass: number;
  }

  interface Subject {
    title: string;
    code: string;
    colour: string;
    metaclass: number;
  }

  interface Props {
    assessments: Assessment[];
    subjects: Subject[];
    activeSubjects: Subject[];
    groupBy: 'subject' | 'month' | 'status';
    onGroupByChange: (group: 'subject' | 'month' | 'status') => void;
  }

  let { assessments, subjects, activeSubjects, groupBy }: Props = $props();

  // Create unique key for assessments to force re-render with animations
  const assessmentsKey = $derived.by(() => {
    const ids = assessments.map((a) => a.id).join(',');
    return `${groupBy}-${assessments.length}-${ids}`;
  });

  function getStatusBadge(status: string, due: string) {
    const dueDate = new Date(due);
    const now = new Date();

    if (status === 'MARKS_RELEASED') {
      return { text: 'Marked', color: 'bg-green-500' };
    } else if (dueDate < now) {
      return { text: 'Overdue', color: 'bg-red-500' };
    } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return { text: 'Due Soon', color: 'bg-yellow-500' };
    } else {
      return { text: 'Upcoming', color: 'bg-blue-500' };
    }
  }

  function getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function getAssessmentsByMonth() {
    const grouped = new Map<string, Assessment[]>();
    assessments.forEach((assessment) => {
      const date = new Date(assessment.due);
      const monthKey = getMonthName(date);
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)?.push(assessment);
    });
    return Array.from(grouped.entries()).sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    });
  }

  function getAssessmentsByStatus() {
    const grouped = new Map<string, Assessment[]>();
    assessments.forEach((assessment) => {
      const status = getStatusBadge(assessment.status, assessment.due).text;
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)?.push(assessment);
    });
    return Array.from(grouped.entries()).sort((a, b) => {
      const order = ['Overdue', 'Due Soon', 'Upcoming', 'Marked'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
  }
</script>

<div class="space-y-6">
  <div
    class="flex overflow-x-auto gap-4 pb-4 scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-zinc-300/20 dark:scrollbar-track-zinc-800/10">
    {#key assessmentsKey}
      {#if groupBy === 'subject'}
        {#each subjects.filter( (subject) => assessments.some((a) => a.code === subject.code), ) as subject, columnIndex}
          <div
            class="shrink-0 w-72 sm:w-80 board-column-animate"
            style="animation-delay: {columnIndex * 100}ms;">
            <div
              class="p-4 mb-4 rounded-xl border border-l-8 backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50"
              style="border-color: {subject.colour || '#8e8e8e'};">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="text-base font-bold sm:text-lg text-zinc-900 dark:text-white">
                    {subject.title}
                  </h3>
                  <p class="text-sm text-zinc-600 dark:text-zinc-400">
                    {subject.code}
                    {#if activeSubjects && activeSubjects.some((as: any) => as.code === subject.code)}
                      <Badge variant="success" size="xs" class="ml-2">Active</Badge>
                    {/if}
                  </p>
                </div>
              </div>
            </div>
            <div class="space-y-4">
              {#each assessments.filter((a) => a.code === subject.code) as assessment, cardIndex}
                <div class="board-card-animate" style="animation-delay: {cardIndex * 50}ms;">
                  <AssessmentCard {assessment} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {:else if groupBy === 'month'}
        {#each getAssessmentsByMonth() as [month, monthAssessments], columnIndex}
          <div
            class="shrink-0 w-72 sm:w-80 board-column-animate"
            style="animation-delay: {columnIndex * 100}ms;">
            <div
              class="p-4 mb-4 rounded-xl border border-l-8 backdrop-blur-xs bg-zinc-800/50 border-zinc-700/50">
              <h3 class="text-base font-bold sm:text-lg text-zinc-900 dark:text-white">
                {month}
              </h3>
              <p class="text-sm text-zinc-600 dark:text-zinc-400">
                {monthAssessments.length} assessment{monthAssessments.length === 1 ? '' : 's'}
              </p>
            </div>
            <div class="space-y-4">
              {#each monthAssessments as assessment, cardIndex}
                <div class="board-card-animate" style="animation-delay: {cardIndex * 50}ms;">
                  <AssessmentCard {assessment} showSubject={true} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {:else if groupBy === 'status'}
        {#each getAssessmentsByStatus() as [status, statusAssessments], columnIndex}
          <div
            class="shrink-0 w-72 sm:w-80 board-column-animate"
            style="animation-delay: {columnIndex * 100}ms;">
            <div
              class="p-4 mb-4 rounded-xl border border-l-8 backdrop-blur-xs bg-zinc-800/50 border-zinc-700/50"
              style="border-color: {getStatusBadge(
                statusAssessments[0].status,
                statusAssessments[0].due,
              ).color};">
              <h3 class="text-base font-bold sm:text-lg text-zinc-900 dark:text-white">
                {status}
              </h3>
              <p class="text-sm text-zinc-600 dark:text-zinc-400">
                {statusAssessments.length} assessment{statusAssessments.length === 1 ? '' : 's'}
              </p>
            </div>
            <div class="space-y-4">
              {#each statusAssessments as assessment, cardIndex}
                <div class="board-card-animate" style="animation-delay: {cardIndex * 50}ms;">
                  <AssessmentCard {assessment} showSubject={true} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    {/key}
  </div>
</div>

<style>
  .scrollbar-thin::-webkit-scrollbar {
    height: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
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

  .board-column-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }

  .board-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
