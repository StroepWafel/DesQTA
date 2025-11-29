<script lang="ts">
  import {
    renderDraftJSText,
    sanitizeHtml,
    getFileIcon,
    getFileColor,
    formatFileSize,
    fetchLinkPreview,
    isValidUrl,
  } from '../utils';
  import LinkPreview from './LinkPreview.svelte';
  import type {
    CoursePayload,
    ParsedDocument,
    WeeklyLessonContent,
    Module,
    TitleModule,
    TextBlockModule,
    ResourceModule,
    LinkModule,
    ResourceLink,
    LinkPreview as LinkPreviewType,
  } from '../types';
  import { GeminiService } from '../../../lib/services/geminiService';
  import type { LessonSummary } from '../../../lib/services/geminiService';
  import { onMount, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { fade, scale, fly } from 'svelte/transition';

  let {
    coursePayload,
    parsedDocument = null,
    selectedLessonContent = null,
    showingOverview = true,
  }: {
    coursePayload: CoursePayload;
    parsedDocument?: ParsedDocument | null;
    selectedLessonContent?: WeeklyLessonContent | null;
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

  function isModule<T extends Module>(
    module: Module,
    contentCheck: (content: any) => boolean,
  ): module is T {
    return 'content' in module && contentCheck(module.content);
  }

  function isTitleModule(module: Module): module is TitleModule {
    return isModule(module, (content) => content && typeof content.value === 'string');
  }

  function isTextBlockModule(module: Module): module is TextBlockModule {
    return isModule(module, (content) => content && content.content && content.content.blocks);
  }

  function isResourceModule(module: Module): module is ResourceModule {
    return isModule(module, (content) => content && content.value && content.value.resources);
  }

  function isLinkModule(module: Module): module is LinkModule {
    return isModule(module, (content) => content && content.url);
  }

  async function loadLinkPreview(url: string) {
    if (!linkPreviews.has(url)) {
      linkPreviews.set(url, null);
      const preview = await fetchLinkPreview(url);
      linkPreviews.set(url, preview);
      linkPreviews = linkPreviews;
    }
  }

  type RenderedModule =
    | { type: 'title'; content: string }
    | { type: 'text'; content: string }
    | { type: 'resources'; content: ResourceLink[] }
    | { type: 'link'; content: string };

  function renderModule(module: Module): RenderedModule | null {
    if (isTitleModule(module)) {
      return { type: 'title', content: module.content.value };
    } else if (isTextBlockModule(module)) {
      return {
        type: 'text',
        content: renderDraftJSText(module.content.content),
      };
    } else if (isResourceModule(module)) {
      return {
        type: 'resources',
        content: module.content.value.resources.filter((r) => r.selected),
      };
    } else if (isLinkModule(module)) {
      const url = module.content.url;
      if (isValidUrl(url)) {
        loadLinkPreview(url);
      }
      return { type: 'link', content: url };
    }
    return null;
  }

  function parseLessonDocument(lessonContent: WeeklyLessonContent) {
    if (!lessonContent.document) return null;
    try {
      return JSON.parse(lessonContent.document.contents);
    } catch (error) {
      console.error('Failed to parse lesson document:', error);
      return null;
    }
  }

  function sortModules(modules: Module[]): Module[] {
    if (!modules || modules.length === 0) return [];

    const moduleMap = new Map<string, Module>();
    modules.forEach((module) => {
      moduleMap.set(module.uuid, module);
    });

    const firstModule = modules.find(
      (module) => !module.prevModule || !moduleMap.has(module.prevModule),
    );

    if (!firstModule) {
      return modules;
    }

    const orderedModules: Module[] = [];
    let currentModule: Module | undefined = firstModule;

    while (currentModule && orderedModules.length < modules.length) {
      orderedModules.push(currentModule);
      currentModule = currentModule.nextModule
        ? moduleMap.get(currentModule.nextModule)
        : undefined;
    }

    modules.forEach((module) => {
      if (!orderedModules.includes(module)) {
        orderedModules.push(module);
      }
    });

    return orderedModules;
  }

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
    if (!selectedLessonContent) return;

    // Collapse content with animation
    contentCollapsed = true;
    await tick();

    aiSummaryLoading = true;
    aiSummaryError = null;
    aiSummary = null;

    try {
      const lessonTitle = selectedLessonContent.t || 'Lesson';
      const lessonText = extractLessonText(selectedLessonContent);
      const attachments = (selectedLessonContent.r || []).map((r) => ({ name: r.t }));
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
    if (selectedLessonContent) {
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
  {#if !showingOverview && selectedLessonContent}
    <div class="p-6">
      <h1 class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
        {selectedLessonContent.t}
      </h1>

      {#if selectedLessonContent.h}
        <div
          class="p-4 mb-4 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-900/50 border-zinc-300/50 dark:border-zinc-800/50 animate-slide-in animate-delay-1">
          <h3 class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <T key="courses.homework_notes" fallback="Homework/Notes" />
          </h3>
          <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
            <p class="text-zinc-700 dark:text-zinc-300">
              {selectedLessonContent.h}
            </p>
          </div>
        </div>
      {/if}

      {#if selectedLessonContent.r && selectedLessonContent.r.length > 0}
        <div class="mb-6 animate-slide-in animate-delay-2">
          <h2 class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
            <T key="courses.lesson_resources" fallback="Lesson Resources" />
          </h2>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {#each selectedLessonContent.r as resource}
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

      {#if selectedLessonContent.document}
        {@const lessonDoc = parseLessonDocument(selectedLessonContent)}
        {#if lessonDoc?.document?.modules}
          {@const sortedModules = sortModules(lessonDoc.document.modules)}
          {@const hasAIFeature =
            settingsLoaded && aiIntegrationsEnabled && lessonSummaryAnalyserEnabled}
          <div
            class="relative mb-6 transition-all duration-700 ease-in-out rounded-2xl border-2 {hasAIFeature
              ? 'border-accent-500/70 dark:border-accent-400/70'
              : 'border-zinc-200 dark:border-zinc-700'} bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm"
            style="overflow: hidden; transition: max-height 700ms ease-in-out; {contentCollapsed &&
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
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        ></path>
                      </svg>
                      <T key="courses.expand_content" fallback="Expand Content" />
                    {:else}
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        ></path>
                      </svg>
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
              <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
                {#each sortedModules as module, i}
                  {@const renderedModule = renderModule(module)}
                  {#if renderedModule}
                    {#if renderedModule.type === 'title'}
                      <h2 class="px-6 py-4 my-4 text-xl font-bold text-white rounded-lg accent-bg">
                        {renderedModule.content}
                      </h2>
                    {:else if renderedModule.type === 'text'}
                      <div
                        class="p-4 my-4 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 hover:shadow-lg hover:scale-[1.01] active:scale-95 transition-all duration-300"
                        style="--animation-delay: {0.2 + i * 0.05}s;">
                        {@html sanitizeHtml(renderedModule.content)}
                      </div>
                    {:else if renderedModule.type === 'link'}
                      <div class="animate-slide-in" style="--animation-delay: {0.2 + i * 0.05}s;">
                        <LinkPreview
                          url={renderedModule.content}
                          preview={linkPreviews.get(renderedModule.content)} />
                      </div>
                    {/if}
                  {/if}
                {/each}
              </div>
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
                      <div
                        class="w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full animate-spin">
                      </div>
                      <p class="text-base font-medium text-zinc-700 dark:text-zinc-300">
                        <T key="courses.generating_summary" fallback="Generating summary..." />
                      </p>
                    </div>
                  {:else if aiSummaryError}
                    <div
                      class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700"
                      transition:fade={{ duration: 200 }}>
                      <p class="text-sm text-red-700 dark:text-red-400">{aiSummaryError}</p>
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
                            <svg
                              class="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              ></path>
                            </svg>
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
                            <svg
                              class="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                              ></path>
                            </svg>
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
  {:else}
    <div class="p-6">
      <h1 class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
        {coursePayload.t}
      </h1>

      {#if parsedDocument?.document?.modules}
        {@const sortedModules = sortModules(parsedDocument.document.modules)}
        <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
          {#each sortedModules as module, i}
            {@const renderedModule = renderModule(module)}
            {#if renderedModule}
              {#if renderedModule.type === 'title'}
                <h2 class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
                  {renderedModule.content}
                </h2>
              {:else if renderedModule.type === 'text'}
                <div
                  class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 animate-slide-in"
                  style="--animation-delay: {0.1 + i * 0.05}s;">
                  {@html sanitizeHtml(renderedModule.content)}
                </div>
              {:else if renderedModule.type === 'resources'}
                <div class="mb-6">
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {#each renderedModule.content as resource}
                      {@const fileDetails = coursePayload.cf.find((f) => f.uuid === resource.uuid)}
                      {#if fileDetails}
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
                            <span class="mr-3 text-2xl">{getFileIcon(fileDetails.mimetype)}</span>
                            <div class="flex-1 min-w-0">
                              <div class="font-semibold truncate text-zinc-900 dark:text-white">
                                {fileDetails.filename}
                              </div>
                              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                                {formatFileSize(fileDetails.size)}
                              </div>
                            </div>
                          </div>
                        </button>
                      {/if}
                    {/each}
                  </div>
                </div>
              {:else if renderedModule.type === 'link'}
                <div class="animate-slide-in" style="--animation-delay: {0.1 + i * 0.05}s;">
                  <LinkPreview
                    url={renderedModule.content}
                    preview={linkPreviews.get(renderedModule.content)} />
                </div>
              {/if}
            {/if}
          {/each}
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
