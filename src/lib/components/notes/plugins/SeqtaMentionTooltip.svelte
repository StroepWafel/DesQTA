<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { SeqtaMentionsService, type SeqtaMentionItem } from '../../../services/seqtaMentionsService';
  import { Icon, Clock, MapPin, User, Calendar } from 'svelte-hero-icons';

  interface Props {
    mentionId: string;
    mentionType: string;
    title: string;
    subtitle: string;
    x: number;
    y: number;
  }

  let { mentionId, mentionType, title, subtitle, x, y }: Props = $props();

  let mentionData: SeqtaMentionItem | null = $state(null);
  let loading = $state(true);
  let tooltipElement: HTMLElement | null = $state(null);

  // Position tooltip intelligently
  let tooltipX = $state(x);
  let tooltipY = $state(y);
  let tooltipPosition = $state<'above' | 'below'>('below');

  onMount(async () => {
    // Fetch fresh data for the mention
    try {
      const data = await SeqtaMentionsService.updateMentionData(mentionId, mentionType);
      mentionData = data;
    } catch (e) {
      console.error('Failed to load mention data:', e);
    } finally {
      loading = false;
    }

    // Position tooltip to avoid viewport edges
    if (tooltipElement) {
      const rect = tooltipElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 20) {
        tooltipX = viewportWidth - rect.width - 20;
      } else if (x < 20) {
        tooltipX = 20;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight - 20) {
        tooltipY = y - rect.height - 10;
        tooltipPosition = 'above';
      } else {
        tooltipY = y + 25;
        tooltipPosition = 'below';
      }
    }
  });

  function formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString();
  }

  function getStatusBadge(data: any): { text: string; color: string } | null {
    if (!data) return null;

    if (data.dueDate || data.due) {
      const dueDate = new Date(data.dueDate || data.due);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { text: 'Overdue', color: 'bg-red-500' };
      } else if (diffDays <= 1) {
        return { text: 'Due Soon', color: 'bg-orange-500' };
      } else if (diffDays <= 7) {
        return { text: 'Upcoming', color: 'bg-blue-500' };
      }
    }

    if (data.status === 'overdue') {
      return { text: 'Overdue', color: 'bg-red-500' };
    }

    return null;
  }
</script>

{#if !loading}
  <div
    bind:this={tooltipElement}
    class="fixed z-[9999] pointer-events-none"
    style="left: {tooltipX}px; top: {tooltipY}px;"
    transition:fade={{ duration: 150 }}>
    <div
      class="min-w-[240px] max-w-[320px] p-3 rounded-xl shadow-xl border backdrop-blur-xl bg-white/95 dark:bg-zinc-800/95 border-zinc-200/60 dark:border-zinc-700/60"
      style="box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);">
      <!-- Header -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {title}
            </h3>
            {#if mentionData?.data}
              {@const badge = getStatusBadge(mentionData.data)}
              {#if badge}
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium text-white {badge.color}">
                  {badge.text}
                </span>
              {/if}
            {/if}
          </div>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {subtitle}
          </p>
        </div>
      </div>

      <!-- Details -->
      {#if mentionData?.data}
        <div class="space-y-1.5 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
          {#if mentionData.data.dueDate || mentionData.data.due}
            <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Icon src={Clock} class="w-3.5 h-3.5 flex-shrink-0" />
              <span>Due: {formatDate(mentionData.data.dueDate || mentionData.data.due)}</span>
            </div>
          {/if}

          {#if mentionData.data.teacher}
            <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Icon src={User} class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{mentionData.data.teacher}</span>
            </div>
          {/if}

          {#if mentionData.data.room}
            <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Icon src={MapPin} class="w-3.5 h-3.5 flex-shrink-0" />
              <span>Room {mentionData.data.room}</span>
            </div>
          {/if}

          {#if mentionData.data.date}
            <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Icon src={Calendar} class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{formatDate(mentionData.data.date)}</span>
            </div>
          {/if}

          {#if mentionData.data.subject}
            <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span class="font-medium">{mentionData.data.subject}</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Quick Actions -->
      <div class="flex items-center gap-2 pt-2 mt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
        <button
          class="text-xs px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 transition-colors pointer-events-auto"
          onclick={(e) => {
            e.stopPropagation();
            // Dispatch event to open detail modal
            window.dispatchEvent(
              new CustomEvent('seqta-mention-click', {
                detail: { mentionId, mentionType, mentionData },
              }),
            );
          }}>
          View Details
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.line-clamp-2) {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

