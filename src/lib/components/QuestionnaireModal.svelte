<script lang="ts">
  import Modal from './Modal.svelte';
  import { questionnaireService, type QuestionnaireQuestion, type QuestionnaireResults } from '../services/questionnaireService';
  import { cloudAuthService } from '../services/cloudAuthService';
  import { logger } from '../../utils/logger';
  import { Icon, CheckCircle } from 'svelte-hero-icons';
  import { _ } from '../i18n';

  interface Props {
    open: boolean;
    question: QuestionnaireQuestion | null;
    onclose?: () => void;
  }

  let { open = $bindable(false), question, onclose }: Props = $props();

  let hasVoted = $state(false);
  let results = $state<QuestionnaireResults | null>(null);
  let selectedOption = $state<number | null>(null);
  let voting = $state(false);
  let loadingResults = $state(false);
  let isAuthenticated = $state(false);

  async function checkAuth() {
    const user = await cloudAuthService.getUser();
    isAuthenticated = !!user;
  }

  async function checkVoteStatus() {
    if (!question) return;
    
    hasVoted = await questionnaireService.hasVoted(question.id);
    
    if (hasVoted) {
      await loadResults();
    }
  }

  async function loadResults() {
    if (!question) return;
    
    loadingResults = true;
    try {
      const res = await questionnaireService.getResults(question.id);
      if (res) {
        results = res;
        totalVotes = res.totalVotes;
      }
    } catch (error) {
      logger.error('QuestionnaireModal', 'loadResults', `Failed to load results: ${error}`, { error });
    } finally {
      loadingResults = false;
    }
  }

  async function handleVote(optionIndex: number) {
    if (!question || !isAuthenticated || hasVoted || voting) return;

    voting = true;
    try {
      const success = await questionnaireService.vote(question.id, optionIndex);
      if (success) {
        hasVoted = true;
        selectedOption = optionIndex;
        await loadResults();
      }
    } catch (error) {
      logger.error('QuestionnaireModal', 'handleVote', `Failed to vote: ${error}`, { error });
      alert(error instanceof Error ? error.message : 'Failed to vote');
    } finally {
      voting = false;
    }
  }

  let totalVotes = $state(0);

  $effect(() => {
    if (open && question) {
      checkAuth();
      checkVoteStatus();
      if (results) {
        totalVotes = results.totalVotes;
      } else {
        totalVotes = 0;
      }
    }
  });

  $effect(() => {
    if (open && question && hasVoted && !results) {
      loadResults();
    }
  });

  function closeModal() {
    onclose?.();
  }
</script>

<Modal bind:open onclose={closeModal} title={question?.question || 'Questionnaire'} maxWidth="max-w-2xl">
  {#if question}
    <div class="p-6 space-y-6">
      {#if question.cover_image}
        <img
          src={question.cover_image.startsWith('http') ? question.cover_image : `https://betterseqta.org${question.cover_image}`}
          alt="Question cover"
          class="w-full h-48 object-cover rounded-lg" />
      {/if}

      <div class="space-y-4">
        {#if !hasVoted && isAuthenticated}
          <!-- Voting options -->
          {#each question.options as option, index}
            <button
              type="button"
              disabled={voting}
              class="flex items-center justify-between w-full p-4 text-left rounded-lg border transition-all duration-200 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:accent-bg hover:scale-[1.02] focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
              onclick={() => handleVote(index + 1)}>
              <span class="text-sm font-medium text-zinc-900 dark:text-white">{option}</span>
              {#if voting && selectedOption === index + 1}
                <div class="w-5 h-5 rounded-full border-2 animate-spin border-accent/30 border-t-accent"></div>
              {/if}
            </button>
          {/each}
        {:else if !hasVoted && !isAuthenticated}
          <!-- Show options but indicate login required -->
          <div class="p-4 mb-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              Sign in to BetterSEQTA Plus to vote on this question.
            </p>
          </div>
          {#each question.options as option}
            <div
              class="flex items-center justify-between w-full p-4 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700 opacity-60">
              <span class="text-sm font-medium text-zinc-600 dark:text-zinc-400">{option}</span>
            </div>
          {/each}
        {:else if hasVoted && results}
          <!-- Results view -->
          <div class="space-y-3">
            <div class="flex items-center gap-2 mb-4">
              <Icon src={CheckCircle} class="w-5 h-5 text-green-500" />
              <span class="text-sm font-medium text-green-600 dark:text-green-400">You've voted!</span>
              <span class="text-sm text-zinc-500 dark:text-zinc-500">
                {totalVotes} {totalVotes === 1 ? 'total vote' : 'total votes'}
              </span>
            </div>
            {#each results.options as optionResult}
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-zinc-900 dark:text-white">
                    {optionResult.text}
                  </span>
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">
                    {optionResult.count} ({optionResult.percentage}%)
                  </span>
                </div>
                <div class="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    class="h-full transition-all duration-500 accent-bg"
                    style="width: {optionResult.percentage}%"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else if hasVoted && loadingResults}
          <div class="flex justify-center items-center py-8">
            <div class="w-6 h-6 rounded-full border-2 animate-spin border-accent/30 border-t-accent"></div>
          </div>
        {:else if hasVoted}
          <!-- Voted but results not available -->
          <div class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div class="flex items-center gap-2">
              <Icon src={CheckCircle} class="w-5 h-5 text-green-500" />
              <p class="text-sm font-medium text-green-800 dark:text-green-200">
                You've already voted on this question.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="p-6 text-center text-zinc-500 dark:text-zinc-400">
      <p>No active question available.</p>
    </div>
  {/if}
</Modal>
