<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch, getRandomDicebearAvatar } from '../../utils/netUtil';
  import { Icon } from 'svelte-hero-icons';
  import { MagnifyingGlass, Funnel, User, AcademicCap, MapPin } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { cache } from '../../utils/cache';
  import { setIdb } from '$lib/services/idbCache';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import { AsyncWrapper, SearchInput, Badge } from '$lib/components/ui';
  import Input from '$lib/components/ui/Input.svelte';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as Pagination from '$lib/components/ui/pagination/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';
  import { forumPhotoService } from '../../lib/services/forumPhotoService';
  import Modal from '../../lib/components/Modal.svelte';

  interface Student {
    id: number;
    firstname: string;
    surname: string;
    xx_display: string;
    year: string;
    sub_school: string;
    house: string;
    house_colour: string;
    campus: string;
    rollgroup: string;
    personUUID?: string; // May be available from API
  }

  let students: Student[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let search = $state('');
  let selectedYear = $state('all');
  let selectedSubSchool = $state('all');
  let selectedHouse = $state('all');
  let selectedCampus = $state('all');
  let filterHasPhoto = $state(false);
  let devSensitiveInfoHider = $state(false);
  let currentPage = $state(1);
  let itemsPerPage = $state(24); // 6 rows of 4 cards on large screens

  // Cache for student photos: Map<studentId, photoDataUrl>
  let studentPhotos = $state<Map<number, string>>(new Map());
  // Track which students have photos available
  let studentsWithPhotos = $state<Set<number>>(new Set());

  // Image viewer modal state
  let showImageModal = $state(false);
  let selectedImageUrl = $state<string | null>(null);
  let selectedStudentName = $state<string>('');

  let years: string[] = $state([]);
  let subSchools: string[] = $state([]);
  let houses: string[] = $state([]);
  let campuses: string[] = $state([]);

  // Generate random avatars for each student when in sensitive content hider mode
  function getStudentAvatar(student: Student): string {
    if (devSensitiveInfoHider) {
      // Use student ID as seed for consistent avatar per student
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}`;
    }
    return '';
  }

  async function checkSensitiveInfoHider() {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['dev_sensitive_info_hider'],
      });
      devSensitiveInfoHider = subset?.dev_sensitive_info_hider ?? false;
    } catch (e) {
      devSensitiveInfoHider = false;
    }
  }

  const hydrateFilters = (studentsData: Student[]) => {
    const uniqueYears = [...new Set(studentsData.map((s) => s.year))].sort();
    const uniqueSubSchools = [...new Set(studentsData.map((s) => s.sub_school))].sort();
    const uniqueHouses = [...new Set(studentsData.map((s) => s.house))].sort();
    const uniqueCampuses = [...new Set(studentsData.map((s) => s.campus))].sort();
    years = uniqueYears;
    subSchools = uniqueSubSchools;
    houses = uniqueHouses;
    campuses = uniqueCampuses;
  };

  async function loadStudents() {
    loading = true;
    error = null;

    const cacheKey = 'directory_students_all';

    try {
      const data = await useDataLoader<Student[]>({
        cacheKey,
        ttlMinutes: 60,
        context: 'directory',
        functionName: 'loadStudents',
        fetcher: async () => {
          logger.debug(
            'directory',
            'loadStudents',
            'fetching directory from API (cache expired/missing)',
          );
          const res = await seqtaFetch('/seqta/student/load/message/people', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {
              mode: 'student',
            },
          });

          // Parse the response - it might be a string that needs parsing
          const parsedData = typeof res === 'string' ? JSON.parse(res) : res;

          // Handle different possible response structures
          let studentArray: Student[] = [];
          if (Array.isArray(parsedData)) {
            studentArray = parsedData;
          } else if (parsedData && typeof parsedData === 'object') {
            // Check if it's wrapped in a payload or other property
            if (parsedData.payload && Array.isArray(parsedData.payload)) {
              studentArray = parsedData.payload;
            } else if (parsedData.data && Array.isArray(parsedData.data)) {
              studentArray = parsedData.data;
            } else if (parsedData.students && Array.isArray(parsedData.students)) {
              studentArray = parsedData.students;
            } else {
              // Try to find any array property
              const arrayProps = Object.values(parsedData).filter((val) => Array.isArray(val));
              if (arrayProps.length > 0) {
                studentArray = arrayProps[0];
              }
            }
          }

          return studentArray;
        },
        onDataLoaded: (studentArray) => {
          students = studentArray;
          hydrateFilters(studentArray);
          loading = false;
        },
      });

      if (!data) {
        error = 'Failed to load students';
        loading = false;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('directory', 'loadStudents', `Failed to load students: ${e}`, { error: e });
      loading = false;
    }
  }

  function studentMatches(student: Student): boolean {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      student.firstname.toLowerCase().includes(searchLower) ||
      student.surname.toLowerCase().includes(searchLower) ||
      student.xx_display.toLowerCase().includes(searchLower) ||
      student.rollgroup.toLowerCase().includes(searchLower);

    const matchesYear = selectedYear === 'all' || student.year === selectedYear;
    const matchesSubSchool =
      selectedSubSchool === 'all' || student.sub_school === selectedSubSchool;
    const matchesHouse = selectedHouse === 'all' || student.house === selectedHouse;
    const matchesCampus = selectedCampus === 'all' || student.campus === selectedCampus;
    const matchesPhoto = !filterHasPhoto || studentsWithPhotos.has(student.id);

    return (
      matchesSearch &&
      matchesYear &&
      matchesSubSchool &&
      matchesHouse &&
      matchesCampus &&
      matchesPhoto
    );
  }

  function clearFilters() {
    search = '';
    selectedYear = 'all';
    selectedSubSchool = 'all';
    selectedHouse = 'all';
    selectedCampus = 'all';
    filterHasPhoto = false;
    currentPage = 1; // Reset to first page when clearing filters
  }

  // Normalize name for matching (remove titles, trim, lowercase)
  function normalizeName(name: string): string {
    return name
      .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+/i, '') // Remove titles
      .trim()
      .toLowerCase();
  }

  // Track which students are currently loading photos
  let loadingPhotos = $state<Set<number>>(new Set());
  // Track which page we've already loaded photos for (to prevent re-loading)
  let loadedPageKey = $state<string>('');

  // Load photo for a single student
  async function loadStudentPhoto(student: Student): Promise<void> {
    if (devSensitiveInfoHider) return; // Skip if sensitive info hider is enabled
    if (studentPhotos.has(student.id)) return; // Already loaded
    if (loadingPhotos.has(student.id)) return; // Already loading

    loadingPhotos = new Set(loadingPhotos);
    loadingPhotos.add(student.id);

    try {
      let uuid: string | null = null;

      // If student has personUUID, use it directly
      if (student.personUUID) {
        uuid = student.personUUID.trim();
      } else {
        // Try multiple name matching strategies
        const nameVariants = [
          student.xx_display, // Display name (e.g., "Alice Smith")
          `${student.firstname} ${student.surname}`, // First + Last (e.g., "Alice Smith")
        ];

        // Try exact matches first
        for (const name of nameVariants) {
          if (name) {
            uuid = await forumPhotoService.getUUIDByName(name);
            if (uuid) break;
          }
        }

        // If no exact match, try normalized matching (case-insensitive, without titles)
        if (!uuid) {
          for (const name of nameVariants) {
            if (name) {
              const normalized = normalizeName(name);
              uuid = await forumPhotoService.getUUIDByName(normalized);
              if (uuid) break;
            }
          }
        }
      }

      if (uuid) {
        try {
          const photoUrl = await forumPhotoService.getPhotoDataUrl(uuid);
          if (photoUrl) {
            studentPhotos = new Map(studentPhotos);
            studentPhotos.set(student.id, photoUrl);
            studentsWithPhotos = new Set(studentsWithPhotos);
            studentsWithPhotos.add(student.id);
          }
        } catch (e) {
          logger.debug(
            'directory',
            'loadStudentPhoto',
            `Failed to load photo for student ${student.id}: ${e}`,
            {
              error: e,
              studentId: student.id,
              uuid,
            },
          );
        }
      }
    } finally {
      loadingPhotos = new Set(loadingPhotos);
      loadingPhotos.delete(student.id);
    }
  }

  // Load photos for a list of students (used for current page)
  async function loadStudentPhotos(studentsToLoad: Student[]): Promise<void> {
    if (devSensitiveInfoHider) return; // Skip if sensitive info hider is enabled

    // Filter out students that already have photos loaded
    const studentsNeedingPhotos = studentsToLoad.filter(
      (student) => !studentPhotos.has(student.id) && !loadingPhotos.has(student.id),
    );

    if (studentsNeedingPhotos.length === 0) {
      return; // All photos already loaded
    }

    // Load photos in parallel with a small delay between batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < studentsNeedingPhotos.length; i += batchSize) {
      const batch = studentsNeedingPhotos.slice(i, i + batchSize);
      await Promise.allSettled(batch.map((student) => loadStudentPhoto(student)));

      // Small delay between batches to prevent resource overload
      if (i + batchSize < studentsNeedingPhotos.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.debug(
      'directory',
      'loadStudentPhotos',
      `Loaded photos for ${studentsNeedingPhotos.length} students on current page`,
    );
  }

  function getFilteredStudents() {
    return students.filter(studentMatches);
  }

  function getPaginatedStudents() {
    const filtered = getFilteredStudents();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }

  function getTotalPages() {
    return Math.ceil(getFilteredStudents().length / itemsPerPage);
  }

  // Create unique key for students to force re-render with animations
  const studentsKey = $derived.by(() => {
    const paginated = getPaginatedStudents();
    const ids = paginated.map((s) => s.id).join(',');
    return `${search}-${selectedYear}-${selectedSubSchool}-${selectedHouse}-${selectedCampus}-${filterHasPhoto}-${currentPage}-${ids}`;
  });

  // Create a stable key for the current page to track if we've loaded photos
  const currentPageKey = $derived.by(() => {
    const paginated = getPaginatedStudents();
    const ids = paginated
      .map((s) => s.id)
      .sort()
      .join(',');
    return `${currentPage}-${ids}`;
  });

  function openImageModal(student: Student) {
    const photoUrl = studentPhotos.get(student.id);
    if (photoUrl) {
      selectedImageUrl = photoUrl;
      selectedStudentName = student.xx_display || `${student.firstname} ${student.surname}`;
      showImageModal = true;
    }
  }

  function closeImageModal() {
    showImageModal = false;
    selectedImageUrl = null;
    selectedStudentName = '';
  }

  // Handle scroll wheel navigation through pages (only when hovering over pagination)
  function handlePaginationWheel(event: WheelEvent) {
    const totalPages = getTotalPages();

    if (totalPages <= 1) return; // No pagination needed

    event.preventDefault();

    if (event.deltaY > 0 && currentPage < totalPages) {
      // Scroll down - next page
      currentPage = Math.min(currentPage + 1, totalPages);
    } else if (event.deltaY < 0 && currentPage > 1) {
      // Scroll up - previous page
      currentPage = Math.max(currentPage - 1, 1);
    }
  }

  // Reset to first page when filters change
  $effect(() => {
    if (
      search ||
      selectedYear !== 'all' ||
      selectedSubSchool !== 'all' ||
      selectedHouse !== 'all' ||
      selectedCampus !== 'all' ||
      filterHasPhoto
    ) {
      currentPage = 1;
    }
  });

  // Load photos for students on the current page only (only when page changes)
  let isLoadingPhotosForPage = $state(false);

  $effect(() => {
    if (students.length === 0 || devSensitiveInfoHider || isLoadingPhotosForPage) {
      return;
    }

    const pageKey = currentPageKey;

    // Only load if this is a new page we haven't loaded yet
    if (pageKey && pageKey !== loadedPageKey) {
      isLoadingPhotosForPage = true;
      loadedPageKey = pageKey;
      const paginatedStudents = getPaginatedStudents();

      if (paginatedStudents.length > 0) {
        loadStudentPhotos(paginatedStudents)
          .then(() => {
            isLoadingPhotosForPage = false;
          })
          .catch((e) => {
            logger.error('directory', 'effect', 'Failed to load student photos', { error: e });
            isLoadingPhotosForPage = false;
          });
      } else {
        isLoadingPhotosForPage = false;
      }
    }
  });

  onMount(async () => {
    await checkSensitiveInfoHider();
    await loadStudents();
  });
</script>

<div class="px-6 py-7 space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
        <T key="navigation.directory" fallback="Directory" />
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        <T key="directory.description" fallback="Browse and search through all students" />
      </p>
    </div>

    <div class="flex items-center gap-2">
      <Popover.Root>
        <Popover.Trigger
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2">
          <Icon src={Funnel} class="w-4 h-4" />
          <T key="directory.filters" fallback="Filters" />
        </Popover.Trigger>

        <Popover.Content class="w-96 p-4 space-y-4">
          <h3 class="font-medium text-zinc-900 dark:text-white">
            <T key="directory.filter_students" fallback="Filter Students" />
          </h3>

          <div class="grid grid-cols-1 gap-4">
            <!-- Year Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <T key="directory.year_level" fallback="Year Level" />
              </label>
              <Select.Root type="single" bind:value={selectedYear}>
                <Select.Trigger class="w-full">
                  <span class="truncate"
                    >{selectedYear === 'all'
                      ? $_('directory.all_years') || 'All Years'
                      : `${$_('directory.year') || 'Year'} ${selectedYear}`}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">
                    <T key="directory.all_years" fallback="All Years" />
                  </Select.Item>
                  {#each years as year}
                    <Select.Item value={year}>
                      <T key="directory.year_number" fallback="Year" values={{ number: year }} />
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- Sub School Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <T key="directory.sub_school" fallback="Sub School" />
              </label>
              <Select.Root type="single" bind:value={selectedSubSchool}>
                <Select.Trigger class="w-full">
                  <span class="truncate"
                    >{selectedSubSchool === 'all'
                      ? $_('directory.all_sub_schools') || 'All Sub Schools'
                      : selectedSubSchool}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">
                    <T key="directory.all_sub_schools" fallback="All Sub Schools" />
                  </Select.Item>
                  {#each subSchools as subSchool}
                    <Select.Item value={subSchool}>{subSchool}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- House Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <T key="directory.house" fallback="House" />
              </label>
              <Select.Root type="single" bind:value={selectedHouse}>
                <Select.Trigger class="w-full">
                  <span class="truncate"
                    >{selectedHouse === 'all'
                      ? $_('directory.all_houses') || 'All Houses'
                      : selectedHouse}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">
                    <T key="directory.all_houses" fallback="All Houses" />
                  </Select.Item>
                  {#each houses as house}
                    <Select.Item value={house}>{house}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- Campus Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <T key="directory.campus" fallback="Campus" />
              </label>
              <Select.Root type="single" bind:value={selectedCampus}>
                <Select.Trigger class="w-full">
                  <span class="truncate"
                    >{selectedCampus === 'all'
                      ? $_('directory.all_campuses') || 'All Campuses'
                      : `${$_('directory.campus') || 'Campus'} ${selectedCampus}`}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">
                    <T key="directory.all_campuses" fallback="All Campuses" />
                  </Select.Item>
                  {#each campuses as campus}
                    <Select.Item value={campus}>
                      <T
                        key="directory.campus_name"
                        fallback="Campus {name}"
                        values={{ name: campus }} />
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- Has Photo Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <T key="directory.has_photo" fallback="Has Photo" />
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={filterHasPhoto}
                  class="w-4 h-4 text-accent-600 bg-zinc-100 border-zinc-300 rounded focus:ring-accent-500 focus:ring-2 dark:bg-zinc-700 dark:border-zinc-600" />
                <span class="text-sm text-zinc-600 dark:text-zinc-400">
                  <T
                    key="directory.show_only_with_photos"
                    fallback="Show only students with photos" />
                </span>
              </label>
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>

      <button
        class="px-4 py-2 text-sm font-medium text-white accent-bg rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        onclick={clearFilters}>
        <T key="directory.clear_all" fallback="Clear All" />
      </button>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="space-y-4">
    <!-- Search Bar -->
    <div class="relative">
      <Icon
        src={MagnifyingGlass}
        class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 z-10" />
      <Input
        bind:value={search}
        placeholder={$_('directory.search_placeholder') ||
          'Search by name, display name, or roll group...'}
        fullWidth
        leftIcon
        size="lg" />
    </div>
  </div>

  <!-- Results -->
  <div class="space-y-4">
    <!-- Results Summary -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-zinc-600 dark:text-zinc-400">
        <T
          key="directory.showing_students"
          fallback="Showing students"
          values={{
            showing: getPaginatedStudents().length,
            total: getFilteredStudents().length,
            currentPage,
            totalPages: getTotalPages(),
          }} />
      </p>
    </div>

    <AsyncWrapper
      {loading}
      {error}
      data={getFilteredStudents()}
      empty={getFilteredStudents().length === 0}
      emptyTitle={$_('directory.no_students_found') || 'No students found'}
      emptyMessage={$_('directory.no_students_message') ||
        "Try adjusting your search or filters to find what you're looking for."}
      emptyIcon="👥"
      componentName="Directory">
      {#snippet children()}
        <!-- Students Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {#key studentsKey}
            {#each getPaginatedStudents() as student, i (student.id)}
              <div
                class="bg-white dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/50 rounded-lg p-4 transition-all duration-200 transform hover:scale-[1.02] directory-card-animate"
                style="animation-delay: {i * 50}ms;">
                <!-- Student Avatar -->
                <div class="flex items-center gap-3 mb-3">
                  {#if devSensitiveInfoHider}
                    <img
                      src={getStudentAvatar(student)}
                      alt={$_('directory.student_avatar') || 'Student avatar'}
                      class="w-10 h-10 rounded-full object-cover border-2 border-white/60 dark:border-zinc-600/60" />
                  {:else if studentPhotos.has(student.id)}
                    {@const photoUrl = studentPhotos.get(student.id)}
                    {#if photoUrl}
                      <button
                        type="button"
                        onclick={() => openImageModal(student)}
                        class="w-10 h-10 rounded-full overflow-hidden border-2 border-white/60 dark:border-zinc-600/60 cursor-pointer hover:ring-2 hover:ring-accent-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
                        aria-label={$_('directory.view_photo') ||
                          `View photo of ${student.xx_display || student.firstname}`}>
                        <img
                          src={photoUrl}
                          alt={$_('directory.student_avatar') || 'Student avatar'}
                          class="w-full h-full object-cover"
                          onerror={(e) => {
                            // Fallback to initials on error
                            const img = e.currentTarget;
                            const fallback = document.createElement('div');
                            fallback.className =
                              'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm';
                            fallback.style.backgroundColor = student.house_colour;
                            fallback.innerHTML = `<span>${student.firstname.charAt(0)}${student.surname.charAt(0)}</span>`;
                            img.parentNode?.replaceChild(fallback, img);
                            // Remove from photos map on error
                            studentPhotos = new Map(studentPhotos);
                            studentPhotos.delete(student.id);
                          }} />
                      </button>
                    {:else}
                      <div
                        class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                        style="background-color: {student.house_colour}">
                        {student.firstname.charAt(0)}{student.surname.charAt(0)}
                      </div>
                    {/if}
                  {:else}
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      style="background-color: {student.house_colour}">
                      {student.firstname.charAt(0)}{student.surname.charAt(0)}
                    </div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {student.xx_display}
                    </h3>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {student.firstname}
                      {student.surname}
                    </p>
                  </div>
                </div>

                <!-- Student Details -->
                <div class="space-y-2">
                  <div class="flex items-center gap-2 text-xs">
                    <Icon src={AcademicCap} class="w-3 h-3 text-zinc-400" />
                    <span class="text-zinc-600 dark:text-zinc-400">
                      <T
                        key="directory.year_number"
                        fallback="Year"
                        values={{ number: student.year }} />
                    </span>
                  </div>

                  {#if student.sub_school && student.sub_school.trim() !== ''}
                    <div class="flex items-center gap-2 text-xs">
                      <Icon src={MapPin} class="w-3 h-3 text-zinc-400" />
                      <span class="text-zinc-600 dark:text-zinc-400">{student.sub_school}</span>
                    </div>
                  {/if}

                  <div class="flex items-center gap-2 text-xs">
                    <div
                      class="w-3 h-3 rounded-full"
                      style="background-color: {student.house_colour}">
                    </div>
                    <span class="text-zinc-600 dark:text-zinc-400">{student.house}</span>
                  </div>

                  <div class="text-xs text-zinc-500 dark:text-zinc-400">
                    {student.rollgroup}
                  </div>
                </div>
              </div>
            {/each}
          {/key}
        </div>

        <!-- Pagination -->
        {#if getTotalPages() > 1}
          <div class="mt-6" onwheel={handlePaginationWheel}>
            <Pagination.Root
              count={getFilteredStudents().length}
              perPage={itemsPerPage}
              bind:page={currentPage}>
              {#snippet children({ pages, currentPage: paginationCurrentPage })}
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.PrevButton />
                  </Pagination.Item>
                  {#each pages as page (page.key)}
                    {#if page.type === 'ellipsis'}
                      <Pagination.Item>
                        <Pagination.Ellipsis />
                      </Pagination.Item>
                    {:else}
                      <Pagination.Item>
                        <Pagination.Link {page} isActive={paginationCurrentPage === page.value}>
                          {page.value}
                        </Pagination.Link>
                      </Pagination.Item>
                    {/if}
                  {/each}
                  <Pagination.Item>
                    <Pagination.NextButton />
                  </Pagination.Item>
                </Pagination.Content>
              {/snippet}
            </Pagination.Root>
          </div>
        {/if}
      {/snippet}
    </AsyncWrapper>
  </div>
</div>

<!-- Image Viewer Modal -->
<Modal
  bind:open={showImageModal}
  onclose={closeImageModal}
  maxWidth="max-w-4xl"
  className="p-0"
  ariaLabel={$_('directory.student_photo') || 'Student Photo'}>
  {#if selectedImageUrl}
    <div class="flex flex-col items-center justify-center p-8">
      <h2 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
        {selectedStudentName}
      </h2>
      <div class="relative w-full max-w-2xl">
        <img
          src={selectedImageUrl}
          alt={$_('directory.student_photo') || `Photo of ${selectedStudentName}`}
          class="w-full h-auto rounded-lg shadow-2xl object-contain max-h-[70vh]" />
      </div>
    </div>
  {/if}
</Modal>

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .directory-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
