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
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';

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
    if (lessonContent.h) lessonText += lessonContent.h + '\n';
    if (lessonContent.document && lessonContent.document.contents) {
      try {
        const doc = JSON.parse(lessonContent.document.contents);
        if (doc.modules && Array.isArray(doc.modules)) {
          for (const mod of doc.modules) {
            if (mod.content && typeof mod.content.value === 'string') {
              lessonText += mod.content.value + '\n';
            } else if (mod.content && mod.content.content && mod.content.content.blocks) {
              for (const block of mod.content.content.blocks) {
                if (block.text) lessonText += block.text + '\n';
              }
            }
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    return lessonText.trim();
  }

  async function generateLessonSummary() {
    aiSummaryLoading = true;
    aiSummaryError = null;
    aiSummary = null;
    try {
      if (!selectedLessonContent) return;
      const lessonTitle = selectedLessonContent.t || 'Lesson';
      const lessonText = extractLessonText(selectedLessonContent);
      const attachments = (selectedLessonContent.r || []).map(r => ({ name: r.t }));
      aiSummary = await GeminiService.summarizeLessonContent({
        title: lessonTitle,
        content: lessonText,
        attachments
      });
    } catch (e) {
      aiSummaryError = e instanceof Error ? e.message : String(e);
    } finally {
      aiSummaryLoading = false;
    }
  }

  $effect(() => {
    if (selectedLessonContent) {
      aiSummary = null;
      aiSummaryError = null;
    }
  });

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['ai_integrations_enabled','lesson_summary_analyser_enabled'] });
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
  {#if settingsLoaded && !showingOverview && selectedLessonContent && aiIntegrationsEnabled && lessonSummaryAnalyserEnabled}
    <div class="px-2 sm:px-4 md:px-8 py-2 sm:py-4 md:py-6">
      <div class="p-4 mb-6 flex flex-col gap-4 rounded-xl border backdrop-blur-xs bg-linear-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200/50 dark:border-purple-700/50">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="courses.ai_lesson_summary" fallback="AI Lesson Summary" />
            </h3>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              <T key="courses.ai_summary_desc" fallback="Generate an AI-powered summary and actionable steps for this lesson's content and resources." />
            </p>
          </div>
          <button
            class="px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={generateLessonSummary}
            disabled={aiSummaryLoading}
          >
            {#if aiSummaryLoading}
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <T key="courses.generating" fallback="Generating..." />
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <T key="courses.generate_summary" fallback="Generate Summary" />
              </div>
            {/if}
          </button>
        </div>
        {#if aiSummaryError}
          <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
            <p class="text-sm text-red-700 dark:text-red-400">{aiSummaryError}</p>
          </div>
        {/if}
        {#if aiSummary}
          <div class="p-4 rounded-xl border bg-white/80 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 shadow-md mb-2">
            <div class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="courses.summary" fallback="Summary" />
            </div>
            <div class="mb-4 text-zinc-800 dark:text-zinc-200">{aiSummary.summary}</div>
            <div class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="courses.steps" fallback="Steps" />
            </div>
            <ol class="list-decimal list-inside space-y-1 text-zinc-800 dark:text-zinc-200">
              {#each aiSummary.steps as step}
                <li>{step}</li>
              {/each}
            </ol>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#if !showingOverview && selectedLessonContent}
    <div class="p-6">
      <h1
        class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
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
          <h2
            class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
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
          <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
            {#each sortedModules as module, i}
              {@const renderedModule = renderModule(module)}
              {#if renderedModule}
                {#if renderedModule.type === 'title'}
                  <h2
                    class="px-6 py-4 my-4 text-xl font-bold text-white rounded-lg accent-bg">
                    {renderedModule.content}
                  </h2>
                {:else if renderedModule.type === 'text'}
                  <div
                    class="p-4 my-4 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 animate-slide-in hover:shadow-lg hover:scale-[1.01] active:scale-95 transition-all duration-300"
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
        {/if}
      {/if}
    </div>
  {:else}
    <div class="p-6">
      <h1
        class="px-6 py-4 mb-6 text-2xl font-bold text-white rounded-lg accent-bg">
        {coursePayload.t}
      </h1>

      {#if parsedDocument?.document?.modules}
        {@const sortedModules = sortModules(parsedDocument.document.modules)}
        <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
          {#each sortedModules as module, i}
            {@const renderedModule = renderModule(module)}
            {#if renderedModule}
              {#if renderedModule.type === 'title'}
                <h2
                  class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
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
