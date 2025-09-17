<script lang="ts">
  import type { Assessment } from '$lib/types';
  import { Input, Button } from '$lib/components/ui';
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Card from "$lib/components/ui/card/index.js";

  interface Props {
    data: Assessment[];
    filterSubjects: string[];
    filterStatus: string;
    filterMinGrade: number | null;
    filterMaxGrade: number | null;
    filterSearch: string;
    onFilter: (filters: {
      subject: string[];
      status: string;
      minGrade: number | null;
      maxGrade: number | null;
      search: string;
    }) => void;
  }

  let {
    data,
    filterSubjects = $bindable([] as string[]),
    filterStatus = $bindable(),
    filterMinGrade = $bindable(),
    filterMaxGrade = $bindable(),
    filterSearch = $bindable(),
    onFilter
  }: Props = $props();

  // Convert null values to empty strings for input compatibility
  let minGradeValue = $derived(filterMinGrade?.toString() ?? '');
  let maxGradeValue = $derived(filterMaxGrade?.toString() ?? '');

  const uniqueSubjects = $derived([...new Set(data.map(a => a.subject))]);
  const uniqueStatuses = $derived([...new Set(data.map(a => a.status))]);

  function clearFilters() {
    filterSubjects = [];
    filterStatus = '';
    filterMinGrade = null;
    filterMaxGrade = null;
    filterSearch = '';
    onFilter({
      subject: [],
      status: '',
      minGrade: null,
      maxGrade: null,
      search: ''
    });
  }

  function applyFilters() {
    onFilter({
      subject: filterSubjects,
      status: filterStatus,
      minGrade: filterMinGrade,
      maxGrade: filterMaxGrade,
      search: filterSearch
    });
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Filters</Card.Title>
    <Card.Description>Filter assessments by subject, status, grade range, or search term</Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
    <!-- Subject Filter -->
    <div>
      <label for="subject-filter" class="block mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Subject</label>
      <Select.Root type="multiple" bind:value={filterSubjects} onValueChange={applyFilters}>
        <Select.Trigger id="subject-filter" class="w-full">
          {#if filterSubjects.length === 0}
            All Subjects
          {:else if filterSubjects.length === 1}
            {filterSubjects[0]}
          {:else}
            {filterSubjects.length} selected
          {/if}
        </Select.Trigger>
        <Select.Content>
          {#each uniqueSubjects as subject}
            <Select.Item value={subject} label={subject} />
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <!-- Status Filter -->
    <div>
      <label for="status-filter" class="block mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
      <Select.Root type="single" bind:value={filterStatus} onValueChange={applyFilters}>
        <Select.Trigger id="status-filter" class="w-full">
          {filterStatus || "All Statuses"}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="" label="All Statuses" />
          {#each uniqueStatuses as status}
            <Select.Item value={status} label={status} />
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <!-- Min Grade -->
    <div>
      <Input
        label="Min Grade"
        type="number"
        min={0}
        max={100}
        value={minGradeValue}
        placeholder="0"
        onchange={(e) => {
          const val = (e.target as HTMLInputElement).value;
          filterMinGrade = val ? parseInt(val) : null;
          applyFilters();
        }}
      />
    </div>

    <!-- Max Grade -->
    <div>
      <Input
        label="Max Grade"
        type="number"
        min={0}
        max={100}
        value={maxGradeValue}
        placeholder="100"
        onchange={(e) => {
          const val = (e.target as HTMLInputElement).value;
          filterMaxGrade = val ? parseInt(val) : null;
          applyFilters();
        }}
      />
    </div>

    <!-- Search -->
    <div>
      <Input
        label="Search"
        type="text"
        bind:value={filterSearch}
        placeholder="Search assessments..."
        oninput={applyFilters}
      />
    </div>
    </div>
    
    <div class="flex justify-end mt-4">
      <Button variant="ghost" onclick={clearFilters}>
        Clear Filters
      </Button>
    </div>
  </Card.Content>
</Card.Root>
