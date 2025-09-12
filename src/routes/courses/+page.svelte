<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import CourseContent from './components/CourseContent.svelte';
  import type {
    Subject,
    Folder,
    CoursePayload,
    ParsedDocument,
    Lesson,
    TermSchedule,
    WeeklyLessonContent,
  } from './types';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';

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
    try {
      const cacheKey = 'courses_subjects_folders';
      const cached = cache.get<Folder[]>(cacheKey) || await getWithIdbFallback<Folder[]>(cacheKey, cacheKey, () => cache.get<Folder[]>(cacheKey));
      if (cached) {
        folders = cached;
        const activeFolder = folders.find((f: Folder) => f.active === 1);
        activeSubjects = activeFolder ? activeFolder.subjects : [];
        otherFolders = folders.filter((f: Folder) => f.active !== 1);
        loading = false;
        return;
      }

      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const data = JSON.parse(res);
      folders = data.payload;
      const activeFolder = folders.find((f: Folder) => f.active === 1);
      activeSubjects = activeFolder ? activeFolder.subjects : [];
      otherFolders = folders.filter((f: Folder) => f.active !== 1);

      cache.set(cacheKey, folders, 60);
      console.info('[IDB] courses folders cached (mem+idb)', { count: folders.length });
      await setIdb(cacheKey, folders);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
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

    try {
      const cacheKey = `course_${subject.programme}_${subject.metaclass}`;
      const cached = cache.get<CoursePayload>(cacheKey) || await getWithIdbFallback<CoursePayload>(cacheKey, cacheKey, () => cache.get<CoursePayload>(cacheKey));
      if (cached) {
        coursePayload = cached;
        if (coursePayload?.document) {
          try { parsedDocument = JSON.parse(coursePayload.document); } catch {}
        }
        loadingCourse = false;
        return;
      }

      const res = await seqtaFetch('/seqta/student/load/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          programme: subject.programme.toString(),
          metaclass: subject.metaclass.toString(),
        },
      });
      const data = JSON.parse(res);
      coursePayload = data.payload;

      // Parse the main document JSON string
      if (coursePayload?.document) {
        try {
          parsedDocument = JSON.parse(coursePayload.document);
        } catch (e) {
          console.error('Failed to parse document JSON:', e);
        }
      }
      cache.set(cacheKey, coursePayload, 60);
      console.info('[IDB] course payload cached (mem+idb)', { key: cacheKey });
      await setIdb(cacheKey, coursePayload);
    } catch (e) {
      courseError = e instanceof Error ? e.message : String(e);
    } finally {
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
    return (
      subj.title.toLowerCase().includes(q) ||
      subj.code.toLowerCase().includes(q) ||
      subj.description.toLowerCase().includes(q)
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
    try {
      const res = await seqtaFetch('/seqta/student/load/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          programme: subject.programme.toString(),
          metaclass: subject.metaclass.toString(),
        },
      });
      const data = JSON.parse(res);
      coursePayload = data.payload;
      if (coursePayload?.document) {
        try {
          parsedDocument = JSON.parse(coursePayload.document);
        } catch (e) {
          console.error('Failed to parse document JSON:', e);
        }
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

<div class="flex w-full h-full overflow-hidden">
  <!-- Unified Navigation Sidebar -->
  <div class="flex flex-col w-80 h-full border-r border-gray-200 dark:border-gray-700 transition-all duration-300">
    
    <!-- Navigation Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">
        {selectedSubject ? selectedSubject.title : 'Courses'}
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
          class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-accent dark:hover:text-accent transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          title="Back to subjects"
          aria-label="Back to subjects"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Content Area with Transition -->
    <div class="flex-1 overflow-hidden relative">
      <!-- Subject Selection View -->
      <div class="absolute inset-0 transition-all duration-500 ease-in-out {!selectedSubject ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}">
        <div class="h-full flex flex-col">
          <!-- Search Bar -->
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div class="relative">
              <input
                type="text"
                placeholder="Search subjects..."
                class="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                bind:value={search}
              />
              <svg class="absolute right-3 top-1/2 w-5 h-5 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>

          <!-- Subject List -->
          <div class="flex-1 overflow-y-auto">
            {#if loading}
              <div class="flex justify-center items-center p-8">
                <div class="w-8 h-8 rounded-full border-4 animate-spin border-accent/30 border-t-accent"></div>
                <span class="ml-3 text-gray-600 dark:text-gray-400">Loading subjects...</span>
              </div>
            {:else if error}
              <div class="p-6 text-red-500 text-center">⚠️ {error}</div>
            {:else}
              <!-- Active Subjects -->
              <div class="px-4 py-3">
                <h3 class="px-2 py-1 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Subjects</h3>
                <div class="space-y-2 mt-2">
                  {#each activeSubjects.filter(subjectMatches) as subject}
                    <button
                      class="w-full px-4 py-3 text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-accent hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] group"
                      onclick={() => selectSubject(subject)}
                    >
                      <div class="font-semibold text-gray-900 dark:text-white group-hover:text-accent transition-colors duration-200">
                        {subject.title}
                      </div>
                      <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {subject.description}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {subject.code}
                      </div>
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Other Folders -->
              {#if otherFolders.length > 0}
                <div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                  <h3 class="px-2 py-1 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Other Years</h3>
                  <div class="space-y-2 mt-2">
                    {#each otherFolders.filter(folderMatches) as folder}
                      <div>
                        <button
                          class="w-full px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 flex items-center justify-between border-l-4 border-transparent hover:border-accent/50"
                          onclick={() => (expandedFolders[folder.code] = !expandedFolders[folder.code])}
                        >
                          <span>{folder.code}</span>
                          <svg
                            class="w-4 h-4 transition-transform duration-200"
                            style="transform: rotate({expandedFolders[folder.code] ? 90 : 0}deg)"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                          </svg>
                        </button>
                        {#if expandedFolders[folder.code]}
                          <div class="ml-4 mt-2 space-y-2">
                            {#each folder.subjects.filter(subjectMatches) as subject}
                              <button
                                class="w-full px-4 py-3 text-left bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-sm border-l-4 border-transparent hover:border-accent/50"
                                onclick={() => selectSubject(subject)}
                              >
                                <div class="font-medium text-gray-800 dark:text-gray-200">{subject.title}</div>
                                <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">{subject.code}</div>
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
      <div class="absolute inset-0 transition-all duration-500 ease-in-out {selectedSubject ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}">
        <div class="h-full flex flex-col">
          {#if loadingCourse}
            <div class="flex-1 flex justify-center items-center">
              <div class="w-8 h-8 rounded-full border-4 animate-spin border-accent/30 border-t-accent"></div>
              <span class="ml-3 text-gray-600 dark:text-gray-400">Loading course...</span>
            </div>
          {:else if courseError}
            <div class="flex-1 flex justify-center items-center text-red-500">
              ⚠️ {courseError}
            </div>
          {:else if coursePayload}
            <!-- Quick Actions -->
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div class="space-y-2">
                <button
                  class="w-full px-4 py-3 text-left rounded-lg border transition-all duration-200 {showingOverview ? 'bg-accent text-white border-accent' : 'bg-accent/10 border-accent/20 hover:bg-accent/20'}"
                  onclick={() => selectOverview()}
                >
                  <div class="font-semibold">📚 Course Overview</div>
                  <div class="text-sm opacity-80 mt-1">Main course content and resources</div>
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
                      class="w-full px-4 py-3 text-left bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200"
                      onclick={() => selectLesson(jumpTarget.termSchedule, jumpTarget.lesson, jumpTarget.lessonIndex)}
                    >
                      <div class="font-semibold text-green-800 dark:text-green-300">
                        🕐 {jumpTarget.type === 'today' ? "Today's Lesson" : 'Latest Lesson'}
                      </div>
                      <div class="text-sm text-green-600 dark:text-green-400 mt-1">
                        {jumpTarget.lesson.p}
                      </div>
                    </button>
                  {/if}
                {/if}
              </div>
            </div>

            <!-- Lesson Schedule -->
            <div class="flex-1 overflow-y-auto">
              {#each coursePayload.d as termSchedule}
                <div>
                  <div class="sticky top-0 px-4 py-3 text-sm font-semibold text-white accent-bg border-b border-gray-200 dark:border-gray-700">
                    Term {termSchedule.t} - Week {termSchedule.w}
                  </div>
                  {#each termSchedule.l as lesson, lessonIndex}
                    {@const isSelected = selectedLesson === lesson && !showingOverview}
                    <button
                      class="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 transition-all duration-200 {isSelected ? 'bg-gray-100 dark:bg-gray-800 border-accent' : 'border-transparent hover:border-accent/50'}"
                      onclick={() => selectLesson(termSchedule, lesson, lessonIndex)}
                    >
                      <div class="font-semibold text-gray-900 dark:text-white">
                        {lesson.p}
                      </div>
                      <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {new Date(lesson.d).toLocaleDateString('en-AU', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
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
  <div class="flex-1 overflow-y-auto" bind:this={contentScrollContainer}>
    {#if loadingCourse}
      <div class="flex justify-center items-center h-full">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto rounded-full border-4 animate-spin border-accent/30 border-t-accent mb-4"></div>
          <div class="text-lg text-gray-600 dark:text-gray-300">Loading course content...</div>
        </div>
      </div>
    {:else if courseError}
      <div class="flex justify-center items-center h-full">
        <div class="text-center text-red-500">
          <div class="text-6xl mb-4">⚠️</div>
          <div class="text-lg">Error loading course: {courseError}</div>
        </div>
      </div>
    {:else if coursePayload}
      <div class="h-full">
        <div class="course-content h-full overflow-y-auto">
          <CourseContent {coursePayload} {parsedDocument} {selectedLessonContent} {showingOverview} />
        </div>
      </div>
    {:else}
      <div class="flex justify-center items-center h-full">
        <div class="text-center text-gray-500 dark:text-gray-400">
          <div class="text-6xl mb-4">🎓</div>
          <div class="text-xl mb-2">Welcome to Courses</div>
          <div class="text-lg">Select a subject from the sidebar to get started</div>
        </div>
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
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
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
  }

  :global(.course-content video) {
    width: 100%;
    border-radius: 0.5rem;
  }
</style>
