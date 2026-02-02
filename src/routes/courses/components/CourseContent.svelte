<script lang="ts">
  import { getFileIcon, formatFileSize, fetchLinkPreview, isValidUrl } from '../utils';
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
    LinkPreview as LinkPreviewType,
  } from '../types';
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
  } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { fade, scale, fly } from 'svelte/transition';

  let {
    coursePayload,
    parsedDocument = null,
    selectedLessonContent = null,
    selectedStandaloneContent = null,
    showingOverview = true,
  }: {
    coursePayload: CoursePayload;
    parsedDocument?: ParsedDocument | null;
    selectedLessonContent?: WeeklyLessonContent | null;
    selectedStandaloneContent?: WeeklyLessonContent | null;
    showingOverview?: boolean;
  } = $props();

  let linkPreviews: Map<string, LinkPreviewType | null> = $state(new Map());
  let aiSummary: LessonSummary | null = $state(null);
  let aiSummaryLoading = $state(false);
  let aiSummaryError: string | null = $state(null);
  let aiIntegrationsEnabled = $state(false);
  let lessonSummaryAnalyserEnabled = $state(true);
  let settingsLoaded = $state(false);
  let contentCollapsed = $state(false);

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
      console.error('Failed to parse lesson document:', error);
      return null;
    }
  }

  async function handleResourceClick(resource: ResourceLink) {
    try {
      const url = await invoke('get_seqta_file', {
        fileType: 'resource',
        uuid: resource.uuid,
      });
      if (typeof url === 'string') {
        await openUrl(url);
      }
    } catch (e) {
      // Optionally handle error
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
              mod.type === '0d49d130-c197-421d-a56a-d1ba0a67cfc0' &&
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
              mod.type === '0d49d130-c197-421d-a56a-d1ba0a67cfc0' &&
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
        console.error('Error parsing lesson document:', e);
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

    // Collapse content with animation
    contentCollapsed = true;
    await tick();

    aiSummaryLoading = true;
    aiSummaryError = null;
    aiSummary = null;

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
    aiSummary = null;
    aiSummaryError = null;
  }

  $effect(() => {
    if (selectedLessonContent || selectedStandaloneContent) {
      aiSummary = null;
      aiSummaryError = null;
      contentCollapsed = false;
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
                  class="flex items-center p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-accent hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 text-left"
                  onclick={async () => {
                    try {
                      const url = await invoke('get_seqta_file', {
                        fileType: 'resource',
                        uuid: resource.uuid,
                      });
                      if (typeof url === 'string') {
                        await openUrl(url);
                      }
                    } catch (e) {
                      // Optionally handle error
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
              class="relative mb-6 transition-all duration-700 ease-in-out rounded-2xl border-2 {hasAIFeature
                ? 'border-accent-500/70 dark:border-accent-400/70'
                : 'border-zinc-200 dark:border-zinc-700'} bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm"
              style="overflow: hidden; transition: max-height 700ms cubic-bezier(0.4, 0, 0.2, 1); {contentCollapsed &&
              hasAIFeature &&
              !aiSummary
                ? 'max-height: 300px;'
                : contentCollapsed && hasAIFeature && aiSummary
                  ? 'max-height: 2000px;'
                  : ''}">
              {#if hasAIFeature}
                <!-- Summarize Button - Prominent Placement -->
                <div class="absolute top-4 right-4 z-20">
                  <button
                    class="relative flex items-center gap-3 px-6 py-3 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50 focus:ring-offset-2 text-white disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden glow-button"
                    onclick={contentCollapsed ? expandContent : generateLessonSummary}
                    disabled={aiSummaryLoading && !contentCollapsed}>
                    <span class="relative z-10 flex items-center gap-3">
                      {#if aiSummaryLoading}
                        <div class="flex items-center gap-3">
                          <div
                            class="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin">
                          </div>
                          <T key="courses.generating" fallback="Generating..." />
                        </div>
                      {:else if contentCollapsed && aiSummary}
                        <Icon src={ArrowsPointingOut} class="w-5 h-5" />
                        <T key="courses.expand_content" fallback="Expand Content" />
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
                class="p-6 transition-all duration-500 ease-in-out {contentCollapsed
                  ? 'opacity-30 blur-sm'
                  : 'opacity-100 blur-0'}">
                <ModuleList
                  modules={lessonDoc.document.modules}
                  enableLinkPreviews={true}
                  linkPreview={linkPreviews}
                  onResourceClick={handleResourceClick} />
              </div>

              <!-- AI Summary Overlay -->
              {#if contentCollapsed && (aiSummaryLoading || aiSummary || aiSummaryError)}
                <div
                  class="absolute inset-0 flex flex-col justify-start items-stretch bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
                  transition:scale={{ duration: 300, start: 0.95 }}>
                  <div class="flex-1 min-h-0 p-6">
                    {#if aiSummaryLoading}
                      <div
                        class="flex flex-col items-center gap-4"
                        transition:fade={{ duration: 200 }}>
                        <LoadingSpinner
                          size="md"
                          message={$_('courses.generating_summary') || 'Generating summary...'} />
                      </div>
                    {:else if aiSummaryError}
                      <div transition:fade={{ duration: 200 }}>
                        <Badge variant="danger" size="md" class="w-full justify-center py-2">
                          {aiSummaryError}
                        </Badge>
                      </div>
                    {:else if aiSummary}
                      <div class="space-y-6" transition:fade={{ duration: 600 }}>
                        <!-- Summary Card -->
                        <div
                          class="p-6 rounded-2xl border backdrop-blur-xl bg-white/90 dark:bg-zinc-800/90 border-zinc-200/60 dark:border-zinc-700/60 shadow-lg"
                          transition:fly={{ y: 20, duration: 800, delay: 200 }}>
                          <div class="flex items-center gap-3 mb-4">
                            <div
                              class="flex items-center justify-center w-10 h-10 rounded-xl accent-bg">
                              <Icon src={DocumentText} class="w-5 h-5 text-white" />
                            </div>
                            <h3 class="text-2xl font-bold text-zinc-900 dark:text-white">
                              <T key="courses.summary" fallback="Summary" />
                            </h3>
                          </div>
                          <p
                            class="text-lg leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-line"
                            transition:fly={{ y: 20, duration: 800, delay: 400 }}>
                            {aiSummary.summary}
                          </p>
                        </div>

                        <!-- Steps Card -->
                        <div
                          class="p-6 rounded-2xl border backdrop-blur-xl bg-white/90 dark:bg-zinc-800/90 border-zinc-200/60 dark:border-zinc-700/60 shadow-lg"
                          transition:fly={{ y: 20, duration: 800, delay: 600 }}>
                          <div class="flex items-center gap-3 mb-5">
                            <div
                              class="flex items-center justify-center w-10 h-10 rounded-xl accent-bg">
                              <Icon src={ClipboardDocumentCheck} class="w-5 h-5 text-white" />
                            </div>
                            <h3 class="text-2xl font-bold text-zinc-900 dark:text-white">
                              <T key="courses.steps" fallback="Action Steps" />
                            </h3>
                          </div>
                          <ol class="space-y-4">
                            {#each aiSummary.steps as step, stepIndex}
                              <li
                                class="flex gap-4 group"
                                transition:fly={{
                                  y: 20,
                                  duration: 800,
                                  delay: 800 + stepIndex * 100,
                                }}>
                                <div
                                  class="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg text-sm font-bold accent-bg text-white group-hover:scale-110 transition-transform duration-200">
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
  {:else}
    <div class="p-6">
      <h1 class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
        {coursePayload.t}
      </h1>

      {#if parsedDocument?.document?.modules}
        <ModuleList
          modules={parsedDocument.document.modules}
          enableLinkPreviews={true}
          linkPreview={linkPreviews}
          onResourceClick={async (resource) => {
            try {
              const url = await invoke('get_seqta_file', {
                fileType: 'resource',
                uuid: resource.uuid,
              });
              if (typeof url === 'string') {
                await openUrl(url);
              }
            } catch (e) {
              // Optionally handle error
            }
          }} />
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

  .glow-button {
    background: linear-gradient(
      135deg,
      #8b5cf6 0%,
      #6366f1 25%,
      #3b82f6 50%,
      #6366f1 75%,
      #8b5cf6 100%
    );
    background-size: 200% 200%;
    animation:
      ai-gradient-shift 4s ease infinite,
      inner-glow 3s ease-in-out infinite;
  }

  .glow-button:hover {
    animation-duration: 2s, 1.5s;
  }
</style>
