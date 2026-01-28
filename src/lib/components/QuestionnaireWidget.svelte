<script lang="ts">
  import { questionnaireService, type QuestionnaireQuestion } from '../services/questionnaireService';
  import { cloudAuthService } from '../services/cloudAuthService';
  import { logger } from '../../utils/logger';
  import { onMount } from 'svelte';

  interface Props {
    onOpenModal: (question: QuestionnaireQuestion | null) => void;
  }

  let { onOpenModal }: Props = $props();

  let currentQuestion = $state<QuestionnaireQuestion | null>(null);
  let totalVotes = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function loadQuestion() {
    loading = true;
    error = null;
    try {
      const question = await questionnaireService.getCurrentQuestion();
      if (question) {
        currentQuestion = question;
        // Try to get results to show vote count (only if user has voted)
        const user = await cloudAuthService.getUser();
        if (user) {
          const hasVoted = await questionnaireService.hasVoted(question.id);
          if (hasVoted) {
            const results = await questionnaireService.getResults(question.id);
            if (results) {
              totalVotes = results.totalVotes;
            }
          }
        }
      } else {
        currentQuestion = null;
        totalVotes = 0;
      }
    } catch (err) {
      logger.error('QuestionnaireWidget', 'loadQuestion', `Failed to load question: ${err}`, { error: err });
      error = 'Failed to load question';
      currentQuestion = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadQuestion();
    // Refresh every 5 minutes
    const interval = setInterval(loadQuestion, 5 * 60 * 1000);
    return () => clearInterval(interval);
  });

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
</script>

{#if !loading && currentQuestion}
  <button
    class="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 bg-white/60 backdrop-blur-sm border-zinc-200/40 hover:accent-bg dark:bg-zinc-800/60 dark:border-zinc-700/40 focus:outline-none focus:ring-2 accent-ring hover:scale-[1.02]"
    onclick={() => onOpenModal(currentQuestion)}
    aria-label="Open questionnaire">
    <div class="flex flex-col items-start min-w-0 flex-1">
      <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate w-full">
        {truncateText(currentQuestion.question, 40)}
      </span>
      {#if totalVotes > 0}
        <span class="text-xs text-zinc-500 dark:text-zinc-500">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      {/if}
    </div>
  </button>
{/if}
