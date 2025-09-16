<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch, getRandomDicebearAvatar } from '../../utils/netUtil';
  import { Icon } from 'svelte-hero-icons';
  import { MagnifyingGlass, Funnel, User, AcademicCap, MapPin } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import { AsyncWrapper, SearchInput, Badge } from '$lib/components/ui';
  import Input from '$lib/components/ui/Input.svelte';
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import * as Select from "$lib/components/ui/select/index.js";

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
  }

  let students: Student[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let search = $state('');
  let selectedYear = $state('all');
  let selectedSubSchool = $state('all');
  let selectedHouse = $state('all');
  let selectedCampus = $state('all');
  let devSensitiveInfoHider = $state(false);
  let currentPage = $state(1);
  let itemsPerPage = $state(24); // 6 rows of 4 cards on large screens

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
      const subset = await invoke<any>('get_settings_subset', { keys: ['dev_sensitive_info_hider'] });
      devSensitiveInfoHider = subset?.dev_sensitive_info_hider ?? false;
    } catch (e) {
      devSensitiveInfoHider = false;
    }
  }

  async function loadStudents() {
    loading = true;
    error = null;
    try {
      const cacheKey = 'directory_students_all';
      const cached = cache.get<Student[]>(cacheKey) || await getWithIdbFallback<Student[]>(cacheKey, cacheKey, () => cache.get<Student[]>(cacheKey));
      if (cached) {
        students = cached;
        // hydrate filters from cached too
        const uniqueYears = [...new Set(students.map(s => s.year))].sort();
        const uniqueSubSchools = [...new Set(students.map(s => s.sub_school))].sort();
        const uniqueHouses = [...new Set(students.map(s => s.house))].sort();
        const uniqueCampuses = [...new Set(students.map(s => s.campus))].sort();
        years = uniqueYears; subSchools = uniqueSubSchools; houses = uniqueHouses; campuses = uniqueCampuses;
        loading = false;
        return;
      }

      const res = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          mode: 'student'
        },
      });
      
      // Parse the response - it might be a string that needs parsing
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      
      // Handle different possible response structures
      let studentArray: Student[] = [];
      if (Array.isArray(data)) {
        studentArray = data;
      } else if (data && typeof data === 'object') {
        // Check if it's wrapped in a payload or other property
        if (data.payload && Array.isArray(data.payload)) {
          studentArray = data.payload;
        } else if (data.data && Array.isArray(data.data)) {
          studentArray = data.data;
        } else if (data.students && Array.isArray(data.students)) {
          studentArray = data.students;
        } else {
          // Try to find any array property
          const arrayProps = Object.values(data).filter(val => Array.isArray(val));
          if (arrayProps.length > 0) {
            studentArray = arrayProps[0];
          }
        }
      }
      
      students = studentArray;
      
      // Extract unique values for filters
      const uniqueYears = [...new Set(students.map(s => s.year))].sort();
      const uniqueSubSchools = [...new Set(students.map(s => s.sub_school))].sort();
      const uniqueHouses = [...new Set(students.map(s => s.house))].sort();
      const uniqueCampuses = [...new Set(students.map(s => s.campus))].sort();
      
      years = uniqueYears;
      subSchools = uniqueSubSchools;
      houses = uniqueHouses;
      campuses = uniqueCampuses;

      // Cache mem + IDB
      cache.set(cacheKey, students, 60);
      console.info('[IDB] directory cached (mem+idb)', { count: students.length });
      await setIdb(cacheKey, students);
      
      console.log('Loaded students:', students.length, 'students');
      console.log('Sample student:', students[0]);
      console.log('Response structure:', typeof res, res);
      
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error('Failed to load students:', e);
    } finally {
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
    const matchesSubSchool = selectedSubSchool === 'all' || student.sub_school === selectedSubSchool;
    const matchesHouse = selectedHouse === 'all' || student.house === selectedHouse;
    const matchesCampus = selectedCampus === 'all' || student.campus === selectedCampus;
    
    return matchesSearch && matchesYear && matchesSubSchool && matchesHouse && matchesCampus;
  }

  function clearFilters() {
    search = '';
    selectedYear = 'all';
    selectedSubSchool = 'all';
    selectedHouse = 'all';
    selectedCampus = 'all';
    currentPage = 1; // Reset to first page when clearing filters
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


  // Reset to first page when filters change
  $effect(() => {
    if (search || selectedYear !== 'all' || selectedSubSchool !== 'all' || selectedHouse !== 'all' || selectedCampus !== 'all') {
      currentPage = 1;
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
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">School Directory</h1>
      <p class="text-zinc-600 dark:text-zinc-400">Browse and search through all students</p>
    </div>
    
    <div class="flex items-center gap-2">
      <Popover.Root>
        <Popover.Trigger class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2">
          <Icon src={Funnel} class="w-4 h-4" />
          Filters
        </Popover.Trigger>
        
        <Popover.Content class="w-96 p-4 space-y-4">
          <h3 class="font-medium text-zinc-900 dark:text-white">Filter Students</h3>
          
          <div class="grid grid-cols-1 gap-4">
            <!-- Year Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Year Level</label>
              <Select.Root type="single" bind:value={selectedYear}>
                <Select.Trigger class="w-full">
                  <span class="truncate">{selectedYear === 'all' ? 'All Years' : `Year ${selectedYear}`}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Years</Select.Item>
                  {#each years as year}
                    <Select.Item value={year}>Year {year}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- Sub School Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sub School</label>
              <Select.Root type="single" bind:value={selectedSubSchool}>
                <Select.Trigger class="w-full">
                  <span class="truncate">{selectedSubSchool === 'all' ? 'All Sub Schools' : selectedSubSchool}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Sub Schools</Select.Item>
                  {#each subSchools as subSchool}
                    <Select.Item value={subSchool}>{subSchool}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- House Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">House</label>
              <Select.Root type="single" bind:value={selectedHouse}>
                <Select.Trigger class="w-full">
                  <span class="truncate">{selectedHouse === 'all' ? 'All Houses' : selectedHouse}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Houses</Select.Item>
                  {#each houses as house}
                    <Select.Item value={house}>{house}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <!-- Campus Filter -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Campus</label>
              <Select.Root type="single" bind:value={selectedCampus}>
                <Select.Trigger class="w-full">
                  <span class="truncate">{selectedCampus === 'all' ? 'All Campuses' : `Campus ${selectedCampus}`}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Campuses</Select.Item>
                  {#each campuses as campus}
                    <Select.Item value={campus}>Campus {campus}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
      
      <button
        class="px-4 py-2 text-sm font-medium text-white accent-bg rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        onclick={clearFilters}
      >
        Clear All
      </button>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="space-y-4">
    <!-- Search Bar -->
    <div class="relative">
      <Icon src={MagnifyingGlass} class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 z-10" />
      <Input
        bind:value={search}
        placeholder="Search by name, display name, or roll group..."
        fullWidth
        leftIcon
        size="lg"
      />
    </div>

  </div>

  <!-- Results -->
  <div class="space-y-4">
    <!-- Results Summary -->
    <div class="flex items-center justify-between">
      <p class="text-sm text-zinc-600 dark:text-zinc-400">
        Showing {getPaginatedStudents().length} of {getFilteredStudents().length} students (Page {currentPage} of {getTotalPages()})
      </p>
    </div>

    <AsyncWrapper
      loading={loading}
      error={error}
      data={getFilteredStudents()}
      empty={getFilteredStudents().length === 0}
      emptyTitle="No students found"
      emptyMessage="Try adjusting your search or filters to find what you're looking for."
      emptyIcon="👥"
      componentName="Directory"
    >
      {#snippet children()}
        <!-- Students Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {#each getPaginatedStudents() as student (student.id)}
          <div class="bg-white dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/50 rounded-lg p-4 transition-all duration-200 transform hover:scale-[1.02]">
            <!-- Student Avatar -->
            <div class="flex items-center gap-3 mb-3">
              {#if devSensitiveInfoHider}
                <img
                  src={getStudentAvatar(student)}
                  alt="Student avatar"
                  class="w-10 h-10 rounded-full object-cover border-2 border-white/60 dark:border-zinc-600/60"
                />
              {:else}
                <div 
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style="background-color: {student.house_colour}"
                >
                  {student.firstname.charAt(0)}{student.surname.charAt(0)}
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {student.xx_display}
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {student.firstname} {student.surname}
                </p>
              </div>
            </div>

            <!-- Student Details -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs">
                <Icon src={AcademicCap} class="w-3 h-3 text-zinc-400" />
                <span class="text-zinc-600 dark:text-zinc-400">Year {student.year}</span>
              </div>
              
               {#if student.sub_school && student.sub_school.trim() !== ""}
                 <div class="flex items-center gap-2 text-xs">
                 <Icon src={MapPin} class="w-3 h-3 text-zinc-400" />
                  <span class="text-zinc-600 dark:text-zinc-400">{student.sub_school}</span>
                 </div>
                {/if}

              <div class="flex items-center gap-2 text-xs">
                <div 
                  class="w-3 h-3 rounded-full"
                  style="background-color: {student.house_colour}"
                ></div>
                <span class="text-zinc-600 dark:text-zinc-400">{student.house}</span>
              </div>

              <div class="text-xs text-zinc-500 dark:text-zinc-400">
                {student.rollgroup}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      {#if getTotalPages() > 1}
        <div class="mt-6">
          <Pagination.Root count={getFilteredStudents().length} perPage={itemsPerPage} bind:page={currentPage}>
            {#snippet children({ pages, currentPage: paginationCurrentPage })}
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.PrevButton />
                </Pagination.Item>
                {#each pages as page (page.key)}
                  {#if page.type === "ellipsis"}
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