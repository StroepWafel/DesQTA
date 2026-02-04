<script lang="ts">
  import { onMount } from 'svelte';
  import { SeqtaMentionsServiceRust as SeqtaMentionsService } from '../../../services/seqtaMentionsServiceRust';
  import {
    Icon,
    ChevronDown,
    ChevronUp,
    DocumentText,
    PaperClip,
    ArrowTopRightOnSquare,
  } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';

  interface Props {
    programme: number | string | undefined;
    metaclass: number | string | undefined;
    lessonIndex?: number;
    termIndex?: number;
    title?: string;
  }

  let { programme, metaclass, lessonIndex, termIndex, title }: Props = $props();

  let lessonContent: any = $state(null);
  let loading = $state(true);
  let expanded = $state(false);
  let error = $state<string | null>(null);
  let contentPreview = $state<string>('');

  onMount(async () => {
    if (!programme || !metaclass) {
      error = 'Missing programme or metaclass';
      loading = false;
      return;
    }

    try {
      const content = await SeqtaMentionsService.fetchLessonContent(
        programme,
        metaclass,
        lessonIndex,
        termIndex,
      );

      if (!content) {
        error = 'No lesson content found';
        loading = false;
        return;
      }

      lessonContent = content;

      // Extract preview text
      if (content.document?.contents) {
        try {
          const doc = JSON.parse(content.document.contents);
          const modules = doc.document?.modules || doc.modules || [];
          const textParts: string[] = [];

          for (const mod of modules) {
            if (mod.content?.value && typeof mod.content.value === 'string') {
              textParts.push(mod.content.value);
            } else if (mod.content?.content?.blocks) {
              for (const block of mod.content.content.blocks) {
                if (block.text) textParts.push(block.text);
              }
            }
          }

          contentPreview = textParts.join(' ').substring(0, 200);
          if (textParts.join(' ').length > 200) contentPreview += '...';
        } catch (e) {
          console.error('Failed to parse lesson content:', e);
        }
      }

      if (content.h) {
        contentPreview = content.h.substring(0, 200);
        if (content.h.length > 200) contentPreview += '...';
      }
    } catch (e) {
      error = 'Failed to load lesson content';
      console.error('Failed to load lesson content:', e);
    } finally {
      loading = false;
    }
  });

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-AU', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  function openInApp() {
    if (programme && metaclass) {
      goto(`/courses?code=${title}&programme=${programme}&metaclass=${metaclass}`);
    } else {
      goto('/courses');
    }
  }
</script>

{#if loading}
  <div class="flex items-center justify-center py-4">
    <div class="w-6 h-6 rounded-full border-2 border-zinc-300 border-t-blue-600 animate-spin"></div>
  </div>
{:else if error}
  <div class="text-sm text-zinc-500 dark:text-zinc-400">{error}</div>
{:else if lessonContent}
  <div class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <button
      class="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      onclick={() => (expanded = !expanded)}
      type="button">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <Icon src={DocumentText} class="w-5 h-5 text-zinc-500 dark:text-zinc-400 shrink-0" />
        <div class="flex-1 min-w-0 text-left">
          <div class="text-sm font-medium text-zinc-900 dark:text-white truncate">
            {lessonContent.t || title || 'Lesson Content'}
          </div>
          {#if contentPreview}
            <div class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
              {contentPreview}
            </div>
          {/if}
        </div>
      </div>
      <Icon
        src={expanded ? ChevronUp : ChevronDown}
        class="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 transition-transform duration-300 ease-in-out {expanded
          ? 'rotate-180'
          : ''}" />
    </button>

    <!-- Expanded Content -->
    {#if expanded}
      <div
        class="p-4 bg-white dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-700 transition-all duration-300 ease-in-out"
        transition:fly={{ y: -10, duration: 300, easing: (t) => t * (2 - t) }}>
        <!-- Homework/Notes -->
        {#if lessonContent.h}
          <div class="mb-4">
            <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Homework/Notes
            </div>
            <div class="text-sm text-zinc-900 dark:text-white whitespace-pre-wrap">
              {lessonContent.h}
            </div>
          </div>
        {/if}

        <!-- Attachments -->
        {#if lessonContent.r && lessonContent.r.length > 0}
          <div class="mb-4">
            <div
              class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1">
              <Icon src={PaperClip} class="w-3 h-3" />
              Attachments ({lessonContent.r.length})
            </div>
            <div class="space-y-1">
              {#each lessonContent.r as attachment}
                <div
                  class="flex items-center gap-2 p-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                  <div class="text-sm text-zinc-900 dark:text-white flex-1 min-w-0 truncate">
                    {attachment.t || 'Attachment'}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Content Preview -->
        {#if contentPreview && contentPreview.length > 0}
          <div class="mb-4">
            <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Content</div>
            <div class="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
              {contentPreview}
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium transition-colors"
            onclick={openInApp}
            type="button">
            <Icon src={ArrowTopRightOnSquare} class="w-3.5 h-3.5" />
            View Full Lesson
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
