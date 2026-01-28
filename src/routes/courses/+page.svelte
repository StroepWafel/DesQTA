<script lang="ts">
  // Svelte imports
  import { onMount } from 'svelte';

  // $lib/ imports
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import { SearchInput, LoadingSpinner, EmptyState, Button } from '$lib/components/ui';
  import {
    Icon,
    ChevronLeft,
    ChevronRight,
    ExclamationTriangle,
    DocumentText,
    Clock,
    BookOpen,
    AcademicCap,
  } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';

  // Relative imports
  import { invoke } from '@tauri-apps/api/core';
  import { cache } from '../../utils/cache';
  import { logger } from '../../utils/logger';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import CourseContent from './components/CourseContent.svelte';

  // Types
  import type {
    Subject,
    Folder,
    CoursePayload,
    ParsedDocument,
    Lesson,
    TermSchedule,
    WeeklyLessonContent,
  } from './types';

  let folders: Folder[] = $state([]);
  let activeSubjects: Subject[] = $state([]);
  let otherFolders: Folder[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  let expandedFolders: Record<string, boolean> = $state({});
  let selectedSubject: Subject | null = $state(null);
  let coursePayload: CoursePayload | null = $state(null);
  let parsedDocument: ParsedDocument | null = $state(null);
  let loadingCourse = $state(false);
  let courseError: string | null = $state(null);
  let search = $state('');

  // Schedule navigation state
  let selectedLesson: Lesson | null = $state(null);
  let selectedLessonContent: WeeklyLessonContent | null = $state(null);
  let showingOverview = $state(true); // Start with overview by default
  let contentScrollContainer: HTMLElement;

  async function loadSubjects() {
    loading = true;
    error = null;

    const cacheKey = 'courses_subjects_folders';

    const processFolders = (foldersData: Folder[]) => {
      folders = foldersData;
      const activeFolders = folders.filter((f: Folder) => f.active);
      activeSubjects = activeFolders.flatMap((f: Folder) => f.subjects || []);
      otherFolders = folders.filter((f: Folder) => !f.active);
    };

    try {
      const data = await useDataLoader<Folder[]>({
        cacheKey,
        ttlMinutes: 60,
        context: 'courses',
        functionName: 'loadSubjects',
        fetcher: async () => {
          return await invoke<Folder[]>('get_courses_subjects');
        },
        onDataLoaded: (foldersData) => {
          processFolders(foldersData);
          loading = false;
        },
        shouldSyncInBackground: (foldersData) => {
          // Don't sync if cached data has no active subjects
          const testFolders = foldersData;
          const testActiveFolders = testFolders.filter((f: Folder) => f.active);
          const testActiveSubjects = testActiveFolders.flatMap((f: Folder) => f.subjects || []);
          return testActiveSubjects.length > 0;
        },
      });

      if (!data) {
        error = 'Failed to load subjects';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
    }
  }

  async function loadCourseContent(subject: Subject) {
    loadingCourse = true;
    courseError = null;
    coursePayload = null;
    parsedDocument = null;
    selectedLesson = null;
    selectedLessonContent = null;

    const cacheKey = `course_${subject.programme}_${subject.metaclass}`;

    const data = await useDataLoader<CoursePayload>({
      cacheKey,
      ttlMinutes: 60,
      context: 'courses',
      functionName: 'loadCourseContent',
      fetcher: async () => {
        return await invoke<CoursePayload>('get_course_content', {
          programme: subject.programme,
          metaclass: subject.metaclass,
        });
      },
      onDataLoaded: async (payload) => {
        coursePayload = payload;
        if (payload?.document) {
          try {
            parsedDocument = JSON.parse(payload.document);
          } catch (e) {
            logger.error('courses', 'loadCourseContent', 'Failed to parse document JSON', {
              error: e,
            });
          }
        }
        loadingCourse = false;
      },
    });

    if (!data) {
      const errorMessage = 'Failed to load course content';
      courseError = errorMessage;
      loadingCourse = false;
    }
  }

  async function selectSubject(subject: Subject) {
    selectedSubject = subject;
    showingOverview = true; // Reset to overview when selecting a new subject
    selectedLesson = null;
    selectedLessonContent = null;
    await loadCourseContent(subject);
  }

  function selectLesson(termSchedule: TermSchedule, lesson: Lesson, lessonIndex: number) {
    selectedLesson = lesson;
    showingOverview = false;

    // Find the corresponding weekly lesson content
    if (coursePayload?.w?.[termSchedule.n]?.[lessonIndex]) {
      selectedLessonContent = coursePayload.w[termSchedule.n][lessonIndex];
    } else {
      selectedLessonContent = null;
    }

    // Scroll content area to top when new lesson is selected
    if (contentScrollContainer) {
      contentScrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function selectOverview() {
    showingOverview = true;
    selectedLesson = null;
    selectedLessonContent = null;

    // Scroll content area to top when overview is selected
    if (contentScrollContainer) {
      contentScrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function subjectMatches(subj: Subject) {
    const q = search.trim().toLowerCase();
    if (!q) return true; // Show all if search is empty
    return (
      subj.title?.toLowerCase().includes(q) ||
      subj.code?.toLowerCase().includes(q) ||
      subj.description?.toLowerCase().includes(q)
    );
  }

  function folderMatches(folder: Folder) {
    const q = search.trim().toLowerCase();
    return folder.code.toLowerCase().includes(q) || folder.subjects.some(subjectMatches);
  }

  function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get('code'),
      date: params.get('date'),
    };
  }

  async function autoSelectFromQuery() {
    const { code, date } = getQueryParams();
    if (!code || !date) return;
    // Find the subject by code
    const subject = activeSubjects.find((s) => s.code === code);
    if (!subject) return;
    // Load course content for the subject
    loadingCourse = true;
    courseError = null;
    coursePayload = null;
    parsedDocument = null;
    selectedLesson = null;
    selectedLessonContent = null;
    const cacheKey = `course_${subject.programme}_${subject.metaclass}`;
    const isOnline = navigator.onLine;

    // Only use cache when offline - always fetch fresh data when online
    if (!isOnline) {
      const cached =
        cache.get<CoursePayload>(cacheKey) ||
        (await getWithIdbFallback<CoursePayload>(cacheKey, cacheKey, () =>
          cache.get<CoursePayload>(cacheKey),
        ));
      if (cached) {
        coursePayload = cached;
        if (coursePayload?.document) {
          try {
            parsedDocument = JSON.parse(coursePayload.document);
          } catch (e) {
            logger.error('courses', 'autoSelectFromQuery', 'Failed to parse document JSON', {
              error: e,
            });
          }
        }
        loadingCourse = false;
        // Still need to find the lesson closest to date
        if (coursePayload?.d && coursePayload?.w) {
          // Continue with lesson finding logic below
        } else {
          return;
        }
      }
    }

    // Fetch fresh data if online or if cache miss when offline
    try {
      const data = await useDataLoader<CoursePayload>({
        cacheKey,
        ttlMinutes: 60,
        context: 'courses',
        functionName: 'autoSelectFromQuery',
        fetcher: async () => {
          return await invoke<CoursePayload>('get_course_content', {
            programme: subject.programme,
            metaclass: subject.metaclass,
          });
        },
        onDataLoaded: async (payload) => {
          coursePayload = payload;
          if (payload?.document) {
            try {
              parsedDocument = JSON.parse(payload.document);
            } catch (e) {
              logger.error('courses', 'autoSelectFromQuery', 'Failed to parse document JSON', {
                error: e,
              });
            }
          }
        },
        shouldSyncInBackground: () => false, // Always fetch fresh when online
      });

      if (!data) {
        courseError = 'Failed to load course content';
        loadingCourse = false;
        return;
      }

      // Find the lesson closest to the date
      if (coursePayload?.d && coursePayload?.w) {
        let closest: {
          termSchedule: TermSchedule | null;
          lesson: Lesson | null;
          lessonIndex: number;
          diff: number;
        } = {
          termSchedule: null,
          lesson: null,
          lessonIndex: -1,
          diff: Infinity,
        };
        const targetDate = new Date(date);
        coursePayload.d.forEach((termSchedule, termIdx) => {
          termSchedule.l.forEach((lesson, lessonIndex) => {
            const lessonDate = new Date(lesson.d);
            const diff = Math.abs(lessonDate.getTime() - targetDate.getTime());
            if (diff < closest.diff) {
              closest = { termSchedule, lesson, lessonIndex, diff };
            }
          });
        });
        if (closest.lesson && closest.termSchedule) {
          selectedSubject = subject;
          selectLesson(closest.termSchedule, closest.lesson, closest.lessonIndex);
        }
      }
    } catch (e) {
      courseError = e instanceof Error ? e.message : String(e);
    } finally {
      loadingCourse = false;
    }
  }

  onMount(() => {
    loadSubjects();
    autoSelectFromQuery();
  });
</script>

<div class="flex overflow-hidden w-full h-full">
  <!-- Unified Navigation Sidebar -->
  <div
    class="flex flex-col w-80 h-full border-r border-zinc-200 transition-all duration-300 dark:border-zinc-700">
    <!-- Navigation Header -->
    <div
      class="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700">
      <h2 class="text-xl font-bold text-zinc-900 dark:text-white">
        {#if selectedSubject}
          {selectedSubject.title}
        {:else}
          <T key="navigation.courses" fallback="Courses" />
        {/if}
      </h2>
      {#if selectedSubject}
        <button
          onclick={() => {
            // Always go back to subject selection, but keep course content visible
            selectedSubject = null;
            // Don't clear coursePayload, parsedDocument to keep content visible
            selectedLesson = null;
            selectedLessonContent = null;
            showingOverview = true;
          }}
          class="p-2 text-zinc-600 rounded-lg transition-all duration-200 transform dark:text-zinc-400 hover:text-accent dark:hover:text-accent hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          title={$_('courses.back_to_subjects') || 'Back to subjects'}
          aria-label={$_('courses.back_to_subjects') || 'Back to subjects'}>
          <Icon src={ChevronLeft} class="w-5 h-5" />
        </button>
      {/if}
    </div>

    <!-- Content Area with Transition -->
    <div class="overflow-hidden relative flex-1">
      <!-- Subject Selection View -->
      <div
        class="absolute inset-0 transition-all duration-500 ease-in-out {!selectedSubject
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 -translate-x-full pointer-events-none'}">
        <div class="flex flex-col h-full">
          <!-- Search Bar -->
          <div class="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <SearchInput
              bind:value={search}
              placeholder={$_('courses.search_subjects') || 'Search subjects...'}
              size="sm"
              class="w-full" />
          </div>

          <!-- Subject List -->
          <div class="overflow-y-auto flex-1">
            {#if loading}
              <div class="flex justify-center items-center p-8">
                <LoadingSpinner
                  size="sm"
                  message={$_('courses.loading_subjects') || 'Loading subjects...'} />
              </div>
            {:else if error}
              <div class="p-6">
                <EmptyState
                  title={$_('courses.error_loading_subjects') || 'Error loading subjects'}
                  message={error}
                  icon={ExclamationTriangle}
                  size="sm" />
              </div>
            {:else}
              <!-- Active Subjects -->
              <div class="px-4 py-3">
                <h3
                  class="px-1 py-1 text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  <T key="courses.current_subjects" fallback="Current Subjects" />
                </h3>
                <div class="mt-2 space-y-1">
                  {#if activeSubjects.length === 0}
                    <div class="py-4">
                      <EmptyState
                        title={$_('courses.no_subjects_available') || 'No subjects available'}
                        message={$_('courses.no_subjects_message') ||
                          'There are no active subjects to display.'}
                        icon={BookOpen}
                        size="sm" />
                    </div>
                  {:else}
                    {#each activeSubjects.filter(subjectMatches) as subject}
                      <button
                        class="py-3 w-full text-left group"
                        onclick={() => selectSubject(subject)}>
                        <div
                          class="font-semibold text-zinc-900 transition-colors duration-100 dark:text-white group-hover:text-accent">
                          {subject.title}
                        </div>
                      </button>
                    {/each}
                  {/if}
                </div>
              </div>

              <!-- Other Folders -->
              {#if otherFolders.length > 0}
                <div class="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                  <h3
                    class="px-2 py-1 text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    <T key="courses.other_years" fallback="Other Years" />
                  </h3>
                  <div class="mt-2 space-y-2">
                    {#each otherFolders.filter(folderMatches) as folder}
                      <div>
                        <button
                          class="flex justify-between items-center px-4 py-3 w-full font-medium text-left text-zinc-700 rounded-lg border-l-4 border-transparent transition-all duration-200 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-accent/50"
                          onclick={() =>
                            (expandedFolders[folder.code] = !expandedFolders[folder.code])}>
                          <span>{folder.code}</span>
                          <Icon
                            src={ChevronRight}
                            class="w-4 h-4 transition-transform duration-200"
                            style="transform: rotate({expandedFolders[folder.code] ? 90 : 0}deg)" />
                        </button>
                        {#if expandedFolders[folder.code]}
                          <div class="mt-2 ml-4 space-y-2">
                            {#each folder.subjects.filter(subjectMatches) as subject}
                              <button
                                class="px-4 py-3 w-full text-sm text-left bg-zinc-50 rounded-lg border-l-4 border-transparent transition-all duration-200 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-accent/50"
                                onclick={() => selectSubject(subject)}>
                                <div class="font-medium text-zinc-800 dark:text-zinc-200">
                                  {subject.title}
                                </div>
                                <div class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                  {subject.code}
                                </div>
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>

      <!-- Course Content Navigation View -->
      <div
        class="absolute inset-0 transition-all duration-500 ease-in-out {selectedSubject
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-full pointer-events-none'}">
        <div class="flex flex-col h-full">
          {#if loadingCourse}
            <div class="flex flex-1 justify-center items-center">
              <LoadingSpinner
                size="sm"
                message={$_('courses.loading_course') || 'Loading course...'} />
            </div>
          {:else if courseError}
            <div class="flex flex-1 justify-center items-center p-6">
              <EmptyState
                title={$_('courses.error_loading_course') || 'Error loading course'}
                message={courseError}
                icon={ExclamationTriangle}
                size="sm" />
            </div>
          {:else if coursePayload}
            <!-- Quick Actions -->
            <div class="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div class="space-y-2">
                <button
                  class="w-full px-4 py-3 text-left rounded-lg border transition-all duration-200 {showingOverview
                    ? 'bg-accent text-white border-accent'
                    : 'bg-accent/10 border-accent/20 hover:bg-accent/20'}"
                  onclick={() => selectOverview()}>
                  <div class="flex items-center gap-2 font-semibold">
                    <Icon src={BookOpen} class="w-5 h-5" />
                    <T key="courses.course_overview" fallback="Course Overview" />
                  </div>
                  <div class="mt-1 text-sm opacity-80">
                    <T
                      key="courses.course_overview_desc"
                      fallback="Main course content and resources" />
                  </div>
                </button>

                <!-- Jump to Today/Latest -->
                {#if coursePayload?.d}
                  {@const jumpTarget = (() => {
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];

                    for (const termSchedule of coursePayload.d) {
                      for (let i = 0; i < termSchedule.l.length; i++) {
                        const lesson = termSchedule.l[i];
                        if (lesson.d === todayStr) {
                          return { termSchedule, lesson, lessonIndex: i, type: 'today' };
                        }
                      }
                    }

                    // Find latest lesson
                    let latest = null;
                    for (const termSchedule of coursePayload.d) {
                      for (let i = 0; i < termSchedule.l.length; i++) {
                        const lesson = termSchedule.l[i];
                        if (!latest || new Date(lesson.d) > new Date(latest.lesson.d)) {
                          latest = { termSchedule, lesson, lessonIndex: i, type: 'latest' };
                        }
                      }
                    }
                    return latest;
                  })()}

                  {#if jumpTarget}
                    <button
                      class="px-4 py-3 w-full text-left bg-green-50 rounded-lg border border-green-200 transition-all duration-200 dark:bg-green-900/20 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30"
                      onclick={() =>
                        selectLesson(
                          jumpTarget.termSchedule,
                          jumpTarget.lesson,
                          jumpTarget.lessonIndex,
                        )}>
                      <div
                        class="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
                        <Icon src={Clock} class="w-5 h-5" />
                        {jumpTarget.type === 'today'
                          ? $_('courses.todays_lesson') || "Today's Lesson"
                          : $_('courses.latest_lesson') || 'Latest Lesson'}
                      </div>
                      <div class="mt-1 text-sm text-green-600 dark:text-green-400">
                        {jumpTarget.lesson.p}
                      </div>
                    </button>
                  {/if}
                {/if}
              </div>
            </div>

            <!-- Lesson Schedule -->
            <div class="overflow-y-auto flex-1">
              {#each coursePayload.d as termSchedule}
                <div>
                  <div
                    class="sticky top-0 px-4 py-3 text-sm font-semibold text-white border-b border-zinc-200 accent-bg dark:border-zinc-700">
                    <T
                      key="courses.term_week"
                      fallback={`Term ${termSchedule.t} - Week ${termSchedule.w}`}
                      values={{ term: termSchedule.t, week: termSchedule.w }} />
                  </div>
                  {#each termSchedule.l as lesson, lessonIndex}
                    {@const isSelected = selectedLesson === lesson && !showingOverview}
                    {@const lessonContent = coursePayload?.w?.[termSchedule.n]?.[lessonIndex]}
                    {@const lessonTopic = lessonContent?.t}
                    <button
                      class="w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l-4 transition-all duration-200 {isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-accent'
                        : 'border-transparent hover:border-accent/50'}"
                      onclick={() => selectLesson(termSchedule, lesson, lessonIndex)}>
                      <div class="font-semibold text-zinc-900 dark:text-white">
                        {lesson.p}
                      </div>
                      {#if lessonTopic}
                        <div class="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {lessonTopic}
                        </div>
                      {/if}
                      <div class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {new Date(lesson.d).toLocaleDateString('en-AU', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                        {lesson.s} - {lesson.e}
                      </div>
                    </button>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="overflow-y-auto flex-1" bind:this={contentScrollContainer}>
    {#if loadingCourse}
      <div class="flex justify-center items-center h-full">
        <LoadingSpinner
          size="md"
          message={$_('courses.loading_content') || 'Loading course content...'} />
      </div>
    {:else if courseError}
      <div class="flex justify-center items-center h-full p-6">
        <EmptyState
          title={$_('courses.error_loading_title') || 'Error loading course'}
          message={courseError}
          icon={ExclamationTriangle}
          size="md" />
      </div>
    {:else if coursePayload}
      <div class="h-full">
        <div class="overflow-y-auto h-full course-content">
          <CourseContent
            {coursePayload}
            {parsedDocument}
            {selectedLessonContent}
            {showingOverview} />
        </div>
      </div>
    {:else}
      <div class="flex justify-center items-center h-full p-6">
        <EmptyState
          title={$_('courses.welcome') || 'Welcome to Courses'}
          message={$_('courses.select_subject') ||
            'Select a subject from the sidebar to get started'}
          icon={AcademicCap}
          size="lg" />
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.course-content) {
    width: 100%;
    height: 100%;
  }

  /* Headings styled with accent background and white text in dark mode */
  :global(.course-content h1) {
    font-size: 1.875rem;
    line-height: 2.25rem;
    font-weight: 700;
    color: var(--text-color);
    padding: 1.5rem 1rem 0.75rem 1rem;
    margin: 0 1rem 0.25rem 1rem;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  :global(.course-content h2) {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    color: var(--text-color);
    padding: 0.75rem 1rem;
    margin: 0.5rem 1rem 0.5rem 1rem;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  :global(.course-content p) {
    color: var(--text-color);
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    line-height: 1.625;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  /* dark mode inherits text-color via theming */

  :global(.course-content .section) {
    margin: 1rem;
    background-color: transparent;
    border-radius: 0.75rem;
    overflow: hidden;
    border-width: 1px;
    border-color: rgb(229 231 235 / 0.3);
    box-shadow: none;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  /* dark mode inherits transparent background via theming */

  :global(.course-content a) {
    color: var(--accent-color);
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  :global(.course-content a:hover) {
    color: var(--accent-color-hover);
  }

  :global(.course-content img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
  }

  /* File/document styling */
  :global(.course-content .file-item) {
    border-width: 1px;
    border-color: rgb(229 231 235 / 0.3);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 0.5rem;
    cursor: pointer;
    transition-property: all;
    transition-duration: 200ms;
  }

  :global(.course-content .file-item:hover) {
    transform: scale(1.02);
    border-color: var(--accent-color);
  }

  /* dark mode inherits border via theming */

  :global(.course-content .file-grid) {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 1rem;
    padding: 1rem;
    padding: 1rem;
  }

  @media (min-width: 768px) {
    :global(.course-content .file-grid) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    :global(.course-content .file-grid) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  /* Make embedded content responsive */
  :global(.course-content iframe) {
    width: 100%;
    border-radius: 0.5rem;
    border: none;
  }

  :global(.course-content video) {
    width: 100%;
    border-radius: 0.5rem;
  }
</style>
