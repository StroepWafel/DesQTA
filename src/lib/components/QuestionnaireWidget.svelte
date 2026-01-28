<script lang="ts">
  import { questionnaireService, type QuestionnaireQuestion } from '../services/questionnaireService';
  import { cloudAuthService } from '../services/cloudAuthService';
  import { logger } from '../../utils/logger';
  import { onMount } from 'svelte';

  interface Props {
    onOpenModal: (question: QuestionnaireQuestion | null) => void;
  }

  interface CachedQuestion {
    question: QuestionnaireQuestion | null;
    totalVotes: number;
    timestamp: number;
  }

  let { onOpenModal }: Props = $props();

  const CACHE_KEY = 'questionnaire_current_question';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

  let currentQuestion = $state<QuestionnaireQuestion | null>(null);
  let totalVotes = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);

  function getCachedQuestion(): CachedQuestion | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const parsed: CachedQuestion = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - parsed.timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return parsed;
    } catch (err) {
      logger.error('QuestionnaireWidget', 'getCachedQuestion', `Failed to read cache: ${err}`, { error: err });
      return null;
    }
  }

  function setCachedQuestion(question: QuestionnaireQuestion | null, votes: number) {
    try {
      const cached: CachedQuestion = {
        question,
        totalVotes: votes,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch (err) {
      logger.error('QuestionnaireWidget', 'setCachedQuestion', `Failed to write cache: ${err}`, { error: err });
    }
  }

  async function loadQuestion(forceRefresh = false) {
    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = getCachedQuestion();
      if (cached) {
        currentQuestion = cached.question;
        totalVotes = cached.totalVotes;
        loading = false;
        return;
      }
    }

    loading = true;
    error = null;
    try {
      const question = await questionnaireService.getCurrentQuestion();
      if (question) {
        currentQuestion = question;
        let votes = 0;
        
        // Try to get results to show vote count (only if user has voted)
        const user = await cloudAuthService.getUser();
        if (user) {
          const hasVoted = await questionnaireService.hasVoted(question.id);
          if (hasVoted) {
            const results = await questionnaireService.getResults(question.id);
            if (results) {
              votes = results.totalVotes;
            }
          }
        }
        
        totalVotes = votes;
        setCachedQuestion(question, votes);
      } else {
        currentQuestion = null;
        totalVotes = 0;
        setCachedQuestion(null, 0);
      }
    } catch (err) {
      logger.error('QuestionnaireWidget', 'loadQuestion', `Failed to load question: ${err}`, { error: err });
      error = 'Failed to load question';
      currentQuestion = null;
    } finally {
      loading = false;
    }
  }

  function handleClick() {
    // Check if cache is expired before opening modal
    const cached = getCachedQuestion();
    if (!cached) {
      // Cache expired, refresh before opening
      loadQuestion(true).then(() => {
        onOpenModal(currentQuestion);
      });
    } else {
      // Cache is still valid, just open modal
      onOpenModal(currentQuestion);
    }
  }

  onMount(() => {
    // Load from cache or fetch fresh on mount
    loadQuestion(false);
  });

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
</script>

{#if !loading && currentQuestion}
  <button
    class="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 bg-white/60 backdrop-blur-sm border-zinc-200/40 hover:accent-bg dark:bg-zinc-800/60 dark:border-zinc-700/40 focus:outline-none focus:ring-2 accent-ring hover:scale-[1.02]"
    onclick={handleClick}
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
