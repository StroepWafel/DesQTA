<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText } from 'svelte-hero-icons';
  import FileCard from './FileCard.svelte';
  import StarRating from './StarRating.svelte';
  import { sanitizeHtml } from '../../utils/sanitization';
  import { seqtaFetch } from '../../utils/netUtil';
  import { logger } from '../../utils/logger';
  import { toastStore } from '../stores/toast';

  interface Resource {
    name: string;
    userfile: {
      mimetype: string;
      size: string;
      uuid: string;
    } | null;
    id?: number;
    path?: string | null;
    createdDate?: string;
  }

  interface Engagement {
    expectedRating?: number;
    expectedScore?: number | null;
    expectedFeeling?: string | null;
    reflectedRating?: number | null;
    reflectedFeeling?: string | null;
    expectedComment?: string | null;
    reflectedComment?: string | null;
    feedbackComment?: string | null;
    feedbackPrivateComment?: string | null;
    id?: number;
  }

  interface EngagementSettings {
    enabledOptions?: string[];
    reflectedCommentPrompt?: string | null;
    expectedCommentPrompt?: string | null;
  }

  interface AssessmentData {
    description?: string;
    resources?: Resource[];
    engagement?: Engagement | null;
    engagementSettings?: EngagementSettings;
  }

  interface Props {
    assessmentData: AssessmentData;
    assessmentId: number;
    onRatingUpdate?: () => void;
  }

  let { assessmentData, assessmentId, onRatingUpdate }: Props = $props();

  let savingRating = $state(false);

  const hasExpectedRating = $derived(
    assessmentData?.engagementSettings?.enabledOptions?.includes('EXPECTED_RATING') ?? false
  );

  const currentRating = $derived(assessmentData?.engagement?.expectedRating ?? 0);

  async function handleRatingChange(rating: number) {
    if (savingRating) return;

    savingRating = true;
    try {
      const response = await seqtaFetch('/seqta/student/assessment/engagement/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          assessmentId: assessmentId,
          criterionId: null,
          mode: 'expectedRating',
          value: rating,
        },
      });

      const result = JSON.parse(response);
      if (result.status === '200') {
        // Update local state optimistically
        if (!assessmentData.engagement) {
          assessmentData.engagement = { id: result.payload.id };
        }
        assessmentData.engagement.expectedRating = rating;
        assessmentData.engagement.id = result.payload.id;

        logger.info('AssessmentOverview', 'handleRatingChange', 'Rating saved successfully', {
          rating,
          engagementId: result.payload.id,
        });
        toastStore.success('Rating saved successfully');

        // Notify parent to reload if callback provided
        if (onRatingUpdate) {
          onRatingUpdate();
        }
      } else {
        throw new Error(result.error || 'Failed to save rating');
      }
    } catch (e) {
      logger.error('AssessmentOverview', 'handleRatingChange', 'Failed to save rating', { error: e });
      toastStore.error('Failed to save rating. Please try again.');
    } finally {
      savingRating = false;
    }
  }
</script>

<div class="grid gap-8 animate-fade-in">
  <div
    class="grid gap-6 p-6 rounded-2xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
    <h1 class="mb-2 text-2xl font-bold">Assessment Overview</h1>
    
    <!-- Engagement Rating Section -->
    {#if hasExpectedRating}
      <div class="p-4 rounded-xl border dark:bg-zinc-800 bg-zinc-200 dark:border-zinc-700 border-zinc-200">
        <h2 class="text-lg font-semibold mb-3 text-zinc-900 dark:text-white">Expected Rating</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Rate how difficult you expect this assessment to be.
        </p>
        <div class="flex items-center gap-4">
          <StarRating
            rating={currentRating}
            interactive={true}
            disabled={savingRating}
            onRatingChange={handleRatingChange}
          />
          {#if savingRating}
            <div class="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          {/if}
        </div>
      </div>
    {/if}
    
    <!-- Description Section -->
    {#if assessmentData.description}
      <h2 class="text-lg font-semibold mb-3">Description</h2>
      <div class="max-w-none prose prose-invert">
        <div class="whitespace-pre-line text-zinc-300">
          {@html sanitizeHtml(assessmentData.description)}
        </div>
      </div>
    {/if}
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
  
  {#if assessmentData.resources?.length}
    <div
      class="grid gap-6 p-6 rounded-2xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
      <h2 class="text-xl font-bold">Resources</h2>
      <div class="grid gap-4">
        {#each assessmentData.resources.filter((r): r is Resource & { userfile: NonNullable<Resource['userfile']> } => r.userfile !== null) as resource}
          <FileCard 
            file={{
              name: resource.name,
              mimetype: resource.userfile.mimetype,
              size: resource.userfile.size,
              uuid: resource.userfile.uuid
            }}
            variant="resource"
          />
        {/each}
        {#each assessmentData.resources.filter(r => r.userfile === null) as resource}
          <div
            class="flex items-center gap-4 p-4 rounded-xl dark:bg-zinc-800 bg-zinc-200 transition-all duration-300">
            <Icon src={DocumentText} class="w-6 h-6 text-accent-400" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {resource.name}
              </div>
              <div class="text-xs text-zinc-400">
                Resource (no file attached)
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div
      class="grid gap-6 p-6 rounded-2xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
      <h2 class="text-xl font-bold">Resources</h2>
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-zinc-400" />
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No Resources Available</h3>
        <p class="text-zinc-600 dark:text-zinc-400">
          This assessment doesn't have any attached resources or files.
        </p>
      </div>
    </div>
  {/if}
</div> 