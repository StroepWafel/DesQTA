<script lang="ts">
  import { getFileIcon, formatFileSize, formatLessonDate, fetchLinkPreview, isValidUrl } from '../utils';
  import { MODULE_TYPE_UUIDS } from '../constants';
  import { logger } from '../../../utils/logger';
  import ModuleList from '$lib/components/ModuleList.svelte';
  import { renderModule, sortModules } from '$lib/utils/moduleUtils';
  import { sanitizeHtml } from '../../../utils/sanitization';
  import LinkPreview from './LinkPreview.svelte';
  import type {
    CoursePayload,
    ParsedDocument,
    WeeklyLessonContent,
    Module,
    ResourceLink,
    FileItem,
    LinkPreview as LinkPreviewType,
  } from '../types';
  import type { Lesson } from '../types';
  import { GeminiService } from '../../../lib/services/geminiService';
  import type { LessonSummary } from '../../../lib/services/geminiService';
  import { onMount, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { LoadingSpinner, Button, Badge } from '$lib/components/ui';
  import {
    Icon,
    ArrowsPointingOut,
    Sparkles,
    DocumentText,
    ClipboardDocumentCheck,
    ArrowPath,
  } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { toastStore } from '$lib/stores/toast';

  let {
    coursePayload,
    parsedDocument = null,
    documentParseError = false,
    onRetryCourse,
    selectedLessonContent = null,
    selectedStandaloneContent = null,
    showingOverview = true,
    lessonWithoutContent = false,
    selectedLesson = null,
    onRefreshLesson,
    onGoToOverview,
  }: {
    coursePayload: CoursePayload;
    parsedDocument?: ParsedDocument | null;
    documentParseError?: boolean;
    onRetryCourse?: () => void;
    selectedLessonContent?: WeeklyLessonContent | null;
    selectedStandaloneContent?: WeeklyLessonContent | null;
    showingOverview?: boolean;
    lessonWithoutContent?: boolean;
    selectedLesson?: Lesson | null;
    onRefreshLesson?: () => void;
    onGoToOverview?: () => void;
  } = $props();

  let linkPreviews: Map<string, LinkPreviewType | null> = $state(new Map());
  let aiSummary: LessonSummary | null = $state(null);
  let aiSummaryLoading = $state(false);
  let aiSummaryError: string | null = $state(null);
  let aiIntegrationsEnabled = $state(false);
  let lessonSummaryAnalyserEnabled = $state(true);
  let settingsLoaded = $state(false);
  let contentCollapsed = $state(false);
  let summaryContainerEl: HTMLDivElement | null = $state(null);
  let containerMaxHeight = $state(5000);
  let failedResourceIds = $state<Set<string>>(new Set());

  async function loadLinkPreview(url: string) {
    if (!linkPreviews.has(url)) {
      linkPreviews.set(url, null);
      const preview = await fetchLinkPreview(url);
      linkPreviews.set(url, preview);
      linkPreviews = linkPreviews;
    }
  }

  function parseLessonDocument(lessonContent: WeeklyLessonContent) {
    if (!lessonContent.document) return null;
    if (!lessonContent.document.contents) return null;
    try {
      return JSON.parse(lessonContent.document.contents);
    } catch (error) {
      logger.error('courses', 'parseLessonDocument', 'Failed to parse lesson document', { error });
      return null;
    }
  }

  async function handleResourceClick(resource: ResourceLink) {
    failedResourceIds.delete(resource.uuid);
    failedResourceIds = failedResourceIds;
    try {
      const url = await invoke('get_seqta_file', {
        fileType: 'resource',
        uuid: resource.uuid,
      });
      if (typeof url === 'string') {
        await openUrl(url);
      }
    } catch (e) {
      failedResourceIds.add(resource.uuid);
      failedResourceIds = failedResourceIds;
      toastStore.error($_('courses.resource_download_failed') || 'Failed to download resource. Please try again.');
    }
  }

  async function handleCourseFileClick(file: FileItem) {
    failedResourceIds.delete(file.uuid);
    failedResourceIds = failedResourceIds;
    try {
      const url = await invoke('get_seqta_file', {
        fileType: 'resource',
        uuid: file.uuid,
      });
      if (typeof url === 'string') {
        await openUrl(url);
      }
    } catch (e) {
      failedResourceIds.add(file.uuid);
      failedResourceIds = failedResourceIds;
      toastStore.error($_('courses.resource_download_failed') || 'Failed to download resource. Please try again.');
    }
  }

  // Preload link previews for modules
  $effect(() => {
    const activeContent = selectedLessonContent || selectedStandaloneContent;
    if (activeContent?.document) {
      const lessonDoc = parseLessonDocument(activeContent);
      if (lessonDoc?.document?.modules) {
        lessonDoc.document.modules.forEach((module: Module) => {
          if ('content' in module && module.content && typeof module.content === 'object') {
            const content = module.content as { url?: string };
            if ('url' in content && content.url) {
              const url = content.url;
              if (isValidUrl(url)) {
                loadLinkPreview(url);
              }
            }
          }
        });
      }
    }
    if (parsedDocument?.document?.modules) {
      parsedDocument.document.modules.forEach((module: Module) => {
        if ('content' in module && module.content && typeof module.content === 'object') {
          const content = module.content as { url?: string };
          if ('url' in content && content.url) {
            const url = content.url;
            if (isValidUrl(url)) {
              loadLinkPreview(url);
            }
          }
        }
      });
    }
  });

  function extractLessonText(lessonContent: WeeklyLessonContent): string {
    let lessonText = '';

    // Add homework/notes
    if (lessonContent.h) {
      lessonText += `Homework/Notes: ${lessonContent.h}\n\n`;
    }

    // Extract from document modules
    if (lessonContent.document && lessonContent.document.contents) {
      try {
        const doc = JSON.parse(lessonContent.document.contents);
        if (doc.document && doc.document.modules && Array.isArray(doc.document.modules)) {
          for (const mod of doc.document.modules) {
            // Title modules
            if (mod.content && typeof mod.content.value === 'string') {
              lessonText += `${mod.content.value}\n\n`;
            }
            // Text block modules (DraftJS format)
            else if (mod.content && mod.content.content && mod.content.content.blocks) {
              for (const block of mod.content.content.blocks) {
                if (block.text) {
                  lessonText += block.text + '\n';
                }
                // Handle nested entities if present
                if (block.entityRanges && block.entityRanges.length > 0) {
                  // Extract link text if available
                  if (block.entityMap) {
                    for (const key in block.entityMap) {
                      const entity = block.entityMap[key];
                      if (entity.data && entity.data.url) {
                        lessonText += `\nLink: ${entity.data.url}\n`;
                      }
                    }
                  }
                }
              }
              lessonText += '\n';
            }
            // Lexical editor content
            else if (
              mod.content &&
              mod.content.editor === 'lexical' &&
              typeof mod.content.html === 'string'
            ) {
              // For AI summary, we can just use the raw HTML and let the LLM process it
              lessonText += mod.content.html + '\n\n';
            }
            // Table modules
            else if (
              mod.type === MODULE_TYPE_UUIDS.LEGACY_EDITOR &&
              mod.content &&
              typeof mod.content.content === 'string'
            ) {
              // Extract text from table HTML for AI summary
              const tableText = mod.content.content
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (tableText) {
                lessonText += `Table: ${tableText}\n\n`;
              }
            }
          }
        }
        // Also check top-level modules
        else if (doc.modules && Array.isArray(doc.modules)) {
          for (const mod of doc.modules) {
            if (mod.content && typeof mod.content.value === 'string') {
              lessonText += `${mod.content.value}\n\n`;
            } else if (mod.content && mod.content.content && mod.content.content.blocks) {
              for (const block of mod.content.content.blocks) {
                if (block.text) lessonText += block.text + '\n';
              }
              lessonText += '\n';
            } else if (
              mod.content &&
              mod.content.editor === 'lexical' &&
              typeof mod.content.html === 'string'
            ) {
              lessonText += mod.content.html + '\n\n';
            } else if (
              mod.type === MODULE_TYPE_UUIDS.LEGACY_EDITOR &&
              mod.content &&
              typeof mod.content.content === 'string'
            ) {
              const tableText = mod.content.content
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (tableText) {
                lessonText += `Table: ${tableText}\n\n`;
              }
            }
          }
        }
      } catch (e) {
        logger.error('courses', 'parseLessonDocument', 'Error parsing lesson document', { error: e });
      }
    }

    const extracted = lessonText.trim();

    // If no content extracted, return a message
    if (!extracted || extracted.length < 10) {
      return `Lesson: ${lessonContent.t || 'Untitled'}. No detailed content available.`;
    }

    return extracted;
  }

  async function generateLessonSummary() {
    const activeContent = selectedLessonContent || selectedStandaloneContent;
    if (!activeContent) return;

    contentCollapsed = true;
    aiSummaryLoading = true;
    aiSummaryError = null;
    aiSummary = null;
    containerMaxHeight = 320;

    try {
      const lessonTitle = activeContent.t || 'Lesson';
      const lessonText = extractLessonText(activeContent);
      const attachments = (activeContent.r || []).map((r) => ({ name: r.t }));
      aiSummary = await GeminiService.summarizeLessonContent({
        title: lessonTitle,
        content: lessonText,
        attachments,
      });
    } catch (e) {
      aiSummaryError = e instanceof Error ? e.message : String(e);
    } finally {
      aiSummaryLoading = false;
    }
  }

  function expandContent() {
    contentCollapsed = false;
    aiSummaryError = null;
    containerMaxHeight = 5000;
  }

  function showAISummary() {
    contentCollapsed = true;
  }

  $effect(() => {
    if (aiSummary && !aiSummaryLoading && contentCollapsed) {
      tick().then(() => {
        if (summaryContainerEl) {
          const h = summaryContainerEl.scrollHeight + 48;
          containerMaxHeight = Math.max(h, 320);
        }
      });
    }
    if (aiSummaryError && contentCollapsed) {
      containerMaxHeight = 280;
    }
  });

  $effect(() => {
    if (selectedLessonContent || selectedStandaloneContent) {
      aiSummary = null;
      aiSummaryError = null;
      contentCollapsed = false;
      containerMaxHeight = 5000;
    }
  });

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['ai_integrations_enabled', 'lesson_summary_analyser_enabled'],
      });
      aiIntegrationsEnabled = subset?.ai_integrations_enabled ?? false;
      lessonSummaryAnalyserEnabled = subset?.lesson_summary_analyser_enabled ?? true;
      settingsLoaded = true;
    } catch (e) {
      aiIntegrationsEnabled = false;
      lessonSummaryAnalyserEnabled = true;
      settingsLoaded = true;
    }
  });
</script>

<div class="overflow-y-auto relative flex-1">
  {#if !showingOverview && (selectedLessonContent || selectedStandaloneContent)}
    {@const activeContent = selectedLessonContent || selectedStandaloneContent}
    {#if activeContent}
      {@const content = activeContent}
      <div class="p-6">
        <h1 class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
          {content.t}
        </h1>

        {#if content.h}
          <div
            class="p-4 mb-4 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-900/50 border-zinc-300/50 dark:border-zinc-800/50 animate-slide-in animate-delay-1">
            <h3 class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="courses.homework_notes" fallback="Homework/Notes" />
            </h3>
            <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
              <p class="text-zinc-700 dark:text-zinc-300">
                {content.h}
              </p>
            </div>
          </div>
        {/if}

        {#if content.r && content.r.length > 0}
          <div class="mb-6 animate-slide-in animate-delay-2">
            <h2 class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
              <T key="courses.lesson_resources" fallback="Lesson Resources" />
            </h2>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {#each content.r as resource}
                <button
                  type="button"
                  class="flex items-center p-4 bg-white dark:bg-zinc-800 border rounded-lg hover:border-accent hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 text-left {failedResourceIds.has(resource.uuid)
                    ? 'border-red-500 dark:border-red-600'
                    : 'border-zinc-200 dark:border-zinc-700'}"
                  onclick={async () => {
                    failedResourceIds.delete(resource.uuid);
                    failedResourceIds = failedResourceIds;
                    try {
                      const url = await invoke('get_seqta_file', {
                        fileType: 'resource',
                        uuid: resource.uuid,
                      });
                      if (typeof url === 'string') {
                        await openUrl(url);
                      }
                    } catch (e) {
                      failedResourceIds.add(resource.uuid);
                      failedResourceIds = failedResourceIds;
                      toastStore.error($_('courses.resource_download_failed') || 'Failed to download resource. Please try again.');
                    }
                  }}>
                  <div class="flex items-center w-full">
                    <span class="mr-3 text-2xl">{getFileIcon(resource.mimetype)}</span>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold truncate text-zinc-900 dark:text-white">
                        {resource.t}
                      </div>
                      <div class="text-sm text-zinc-600 dark:text-zinc-400">
                        {formatFileSize(resource.size)}
                      </div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if content.document}
          {@const lessonDoc = parseLessonDocument(content)}
          {#if lessonDoc?.document?.modules}
            {@const hasAIFeature =
              settingsLoaded && aiIntegrationsEnabled && lessonSummaryAnalyserEnabled}
            <div
              class="relative mb-6 overflow-hidden rounded-2xl border-2 {hasAIFeature
                ? 'border-accent-500/70 dark:border-accent-400/70'
                : 'border-zinc-200 dark:border-zinc-700'} bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm {aiSummaryLoading
                ? 'ai-summarising-glow'
                : ''}"
              style="max-height: {containerMaxHeight}px; transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
              {#if hasAIFeature}
                <!-- Summarize Button - Prominent Placement -->
                <div class="absolute top-4 right-4 z-20">
                  <button
                    class="relative flex items-center gap-3 px-6 py-3 text-base font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-accent focus:ring-offset-2 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden accent-bg hover:opacity-90"
                    onclick={() => {
                      if (contentCollapsed) {
                        expandContent();
                      } else if (aiSummary) {
                        showAISummary();
                      } else {
                        generateLessonSummary();
                      }
                    }}
                    disabled={aiSummaryLoading && !contentCollapsed}>
                    <span class="relative z-10 flex items-center gap-3">
                      {#if aiSummaryLoading}
                        <div class="flex items-center gap-3">
                          <div
                            class="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"
                            style="animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
                          </div>
                          <T key="courses.generating" fallback="Generating..." />
                        </div>
                      {:else if contentCollapsed && aiSummary}
                        <Icon src={DocumentText} class="w-5 h-5" />
                        <T key="courses.view_original" fallback="View Original" />
                      {:else if aiSummary}
                        <Icon src={Sparkles} class="w-5 h-5" />
                        <T key="courses.view_ai_summary" fallback="View AI Summary" />
                      {:else}
                        <Icon src={Sparkles} class="w-5 h-5" />
                        <T key="courses.summarize" fallback="Summarize" />
                      {/if}
                    </span>
                  </button>
                </div>
              {/if}

              <!-- Lesson Content -->
              <div
                class="p-6 transition-all duration-400 ease-out {contentCollapsed
                  ? 'opacity-20 blur-[2px] scale-[0.98]'
                  : 'opacity-100 blur-0 scale-100'}"
                style="transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
                <ModuleList
                  modules={lessonDoc.document.modules}
                  enableLinkPreviews={true}
                  linkPreview={linkPreviews}
                  onResourceClick={handleResourceClick}
                  failedResourceIds={failedResourceIds}
                  compact={true} />
              </div>

              <!-- AI Summary Overlay -->
              {#if contentCollapsed && (aiSummaryLoading || aiSummary || aiSummaryError)}
                <div
                  class="absolute inset-0 flex flex-col justify-start items-stretch bg-white/98 dark:bg-zinc-900/98 backdrop-blur-xl"
                  transition:fly={{ y: 8, duration: 350, easing: cubicOut }}
                  style="transform-origin: top center;">
                  <div class="flex-1 min-h-0 p-6 overflow-y-auto">
                    {#if aiSummaryLoading}
                      <!-- Custom AI Loading State -->
                      <div
                        class="flex flex-col items-center justify-center min-h-[280px] gap-8"
                        transition:fade={{ duration: 250 }}>
                        <div class="flex flex-col items-center gap-6">
                          <div
                            class="relative flex items-center justify-center w-20 h-20 rounded-2xl accent-bg shadow-lg shadow-accent-500/25">
                            <Icon src={Sparkles} class="w-10 h-10 text-white/90" />
                            <div
                              class="absolute inset-0 rounded-2xl animate-pulse bg-white/20"
                              style="animation-duration: 2s;"></div>
                          </div>
                          <div class="flex flex-col items-center gap-2">
                            <p class="text-lg font-medium text-zinc-900 dark:text-white">
                              {$_('courses.generating_summary') || 'Generating summary...'}
                            </p>
                            <p class="text-sm text-zinc-500 dark:text-zinc-400">
                              <T key="courses.analyzing_content" fallback="Analyzing lesson content" />
                            </p>
                          </div>
                        </div>
                        <div class="flex gap-1.5">
                          {#each [0, 1, 2] as i}
                            <div
                              class="w-2 h-2 rounded-full accent-bg animate-bounce"
                              style="animation-delay: {i * 150}ms; animation-duration: 0.6s;"></div>
                          {/each}
                        </div>
                      </div>
                    {:else if aiSummaryError}
                      <div
                        class="flex flex-col items-center justify-center min-h-[200px] gap-6"
                        transition:fade={{ duration: 300 }}>
                        <div
                          class="flex flex-col items-center gap-4 p-8 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30">
                          <p class="text-center text-red-700 dark:text-red-300 font-medium">
                            {aiSummaryError}
                          </p>
                          <div class="flex flex-wrap items-center justify-center gap-3">
                            <button
                              type="button"
                              class="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-red-500 hover:bg-red-600 text-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
                              onclick={generateLessonSummary}>
                              <Icon src={ArrowPath} class="w-4 h-4" />
                              <T key="common.retry" fallback="Retry" />
                            </button>
                            <button
                              type="button"
                              class="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                              onclick={expandContent}>
                              <Icon src={DocumentText} class="w-4 h-4" />
                              <T key="courses.view_original" fallback="View Original" />
                            </button>
                          </div>
                        </div>
                      </div>
                    {:else if aiSummary}
                      <div class="space-y-6" bind:this={summaryContainerEl}>
                        <!-- Summary Card -->
                        <div
                          class="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-800/95 shadow-lg shadow-zinc-200/50 dark:shadow-zinc-900/50 backdrop-blur-sm"
                          transition:fly={{ y: 16, duration: 400, delay: 50, easing: cubicOut }}
                          style="transform-origin: top center;">
                          <div class="flex items-center justify-between gap-4 mb-4">
                            <div class="flex items-center gap-3">
                              <div
                                class="flex items-center justify-center w-10 h-10 rounded-xl accent-bg shadow-md">
                                <Icon src={DocumentText} class="w-5 h-5 text-white" />
                              </div>
                              <h3 class="text-xl font-bold text-zinc-900 dark:text-white">
                                <T key="courses.summary" fallback="Summary" />
                              </h3>
                            </div>
                            <button
                              type="button"
                              class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-accent hover:bg-accent/10 transition-all duration-200"
                              onclick={generateLessonSummary}
                              title={$_('courses.regenerate') || 'Generate again'}>
                              <Icon src={ArrowPath} class="w-4 h-4" />
                              <T key="courses.regenerate" fallback="Regenerate" />
                            </button>
                          </div>
                          <p
                            class="text-base leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-line"
                            transition:fade={{ duration: 300, delay: 150 }}>
                            {aiSummary.summary}
                          </p>
                        </div>

                        <!-- Steps Card -->
                        <div
                          class="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-800/95 shadow-lg shadow-zinc-200/50 dark:shadow-zinc-900/50 backdrop-blur-sm"
                          transition:fly={{ y: 16, duration: 400, delay: 150, easing: cubicOut }}
                          style="transform-origin: top center;">
                          <div class="flex items-center gap-3 mb-5">
                            <div
                              class="flex items-center justify-center w-10 h-10 rounded-xl accent-bg shadow-md">
                              <Icon src={ClipboardDocumentCheck} class="w-5 h-5 text-white" />
                            </div>
                            <h3 class="text-xl font-bold text-zinc-900 dark:text-white">
                              <T key="courses.steps" fallback="Action Steps" />
                            </h3>
                          </div>
                          <ol class="space-y-4">
                            {#each aiSummary.steps as step, stepIndex}
                              <li
                                class="flex gap-4 group"
                                transition:fly={{
                                  y: 12,
                                  duration: 350,
                                  delay: 250 + stepIndex * 60,
                                  easing: cubicOut,
                                }}
                                style="transform-origin: left center;">
                                <div
                                  class="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg text-sm font-bold accent-bg text-white shadow-sm group-hover:scale-105 transition-transform duration-200">
                                  {stepIndex + 1}
                                </div>
                                <p
                                  class="flex-1 text-base leading-relaxed text-zinc-700 dark:text-zinc-200 pt-1">
                                  {step}
                                </p>
                              </li>
                            {/each}
                          </ol>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  {:else if lessonWithoutContent}
    <div class="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div
        class="max-w-md p-8 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm text-center">
        <div
          class="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full accent-bg/20">
          <Icon src={DocumentText} class="w-8 h-8 text-accent" />
        </div>
        <h2 class="mb-2 text-xl font-bold text-zinc-900 dark:text-white">
          <T key="courses.no_lesson_content" fallback="No lesson content available yet" />
        </h2>
        {#if selectedLesson}
          <p class="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            {selectedLesson.p} · {formatLessonDate(selectedLesson.d, {
              today: $_('courses.today') || 'Today',
              tomorrow: $_('courses.tomorrow') || 'Tomorrow',
              yesterday: $_('courses.yesterday') || 'Yesterday',
            })}
          </p>
        {/if}
        <p class="mb-6 text-zinc-600 dark:text-zinc-400">
          {$_('courses.no_lesson_content_desc') ||
            'Content for this lesson may not have been published yet. Try refreshing to check for updates.'}
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          {#if onRefreshLesson}
            <Button variant="primary" onclick={onRefreshLesson}>
              <Icon src={ArrowPath} class="w-4 h-4 mr-2" />
              <T key="courses.refresh_from_api" fallback="Refresh from server" />
            </Button>
          {/if}
          {#if onGoToOverview}
            <Button variant="secondary" onclick={onGoToOverview}>
              <Icon src={DocumentText} class="w-4 h-4 mr-2" />
              <T key="courses.go_to_overview" fallback="Go to Course Overview" />
            </Button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="p-6">
      <h1 class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
        {coursePayload.t}
      </h1>

      {#if documentParseError}
        <div
          class="p-6 rounded-xl border border-red-500/50 dark:border-red-500/50 bg-red-500/10 dark:bg-red-500/10">
          <p class="text-zinc-900 dark:text-white mb-4">
            {$_('courses.document_parse_error') || 'Unable to load course content. The document may be corrupted.'}
          </p>
          {#if onRetryCourse}
            <Button variant="primary" onclick={onRetryCourse}>
              <Icon src={ArrowPath} class="w-4 h-4 mr-2" />
              <T key="common.retry" fallback="Retry" />
            </Button>
          {/if}
        </div>
      {:else if parsedDocument?.document?.modules}
        <ModuleList
          modules={parsedDocument.document.modules}
          enableLinkPreviews={true}
          linkPreview={linkPreviews}
          failedResourceIds={failedResourceIds}
          compact={true}
          onResourceClick={handleResourceClick} />
      {/if}

      {#if coursePayload.cf && coursePayload.cf.length > 0}
        <div class="mt-8">
          <h2 class="px-6 py-3 mb-4 text-lg font-bold text-white rounded-lg accent-bg">
            <T key="courses.course_files" fallback="Course Files" />
          </h2>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {#each coursePayload.cf as file}
              <button
                type="button"
                class="flex items-center p-4 bg-white dark:bg-zinc-800 border rounded-lg hover:border-accent hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 text-left {failedResourceIds.has(file.uuid)
                  ? 'border-red-500 dark:border-red-600'
                  : 'border-zinc-200 dark:border-zinc-700'}"
                onclick={() => handleCourseFileClick(file)}>
                <span class="mr-3 text-2xl">{getFileIcon(file.mimetype)}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold truncate text-zinc-900 dark:text-white">
                    {file.filename}
                  </div>
                  <div class="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatFileSize(file.size)}
                  </div>
                  {#if failedResourceIds.has(file.uuid)}
                    <p class="text-sm text-red-400 dark:text-red-400 mt-1">
                      <T key="common.retry" fallback="Retry" />
                    </p>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  @keyframes ai-gradient-shift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @keyframes inner-glow {
    0%,
    100% {
      box-shadow:
        inset 0 0 30px rgba(139, 92, 246, 0.4),
        inset 0 0 60px rgba(99, 102, 241, 0.2);
    }
    50% {
      box-shadow:
        inset 0 0 40px rgba(139, 92, 246, 0.6),
        inset 0 0 80px rgba(99, 102, 241, 0.4);
    }
  }

  @keyframes ai-summarising-glow {
    0%,
    100% {
      box-shadow:
        0 0 30px rgba(251, 146, 60, 0.4),
        0 0 60px rgba(236, 72, 153, 0.3),
        inset 0 0 20px rgba(251, 146, 60, 0.08);
    }
    50% {
      box-shadow:
        0 0 50px rgba(251, 146, 60, 0.6),
        0 0 90px rgba(236, 72, 153, 0.45),
        inset 0 0 30px rgba(251, 146, 60, 0.12);
    }
  }

  .ai-summarising-glow {
    animation: ai-summarising-glow 2s ease-in-out infinite;
  }
</style>
