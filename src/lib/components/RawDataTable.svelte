<script lang="ts">
  import type { Assessment } from '$lib/types';
  import { Badge } from '$lib/components/ui';
  import * as Table from "$lib/components/ui/table/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Icon, ChevronUp, ChevronDown } from 'svelte-hero-icons';
  import T from './T.svelte';
  import { _ } from '../i18n';

  let { data }: { data: Assessment[] } = $props();

  // Pagination state
  let currentPage = $state(0);
  let itemsPerPage = $state(10);
  let itemsPerPageValue = $state("10");
  
  // Items per page options
  const itemsPerPageOptions = [5, 10, 20, 50, 100];
  
  function handleItemsPerPageChange(value: string) {
    itemsPerPage = parseInt(value);
    itemsPerPageValue = value;
    currentPage = 0; // Reset to first page when changing page size
  }
  
  // Sorting state
  let sortColumn = $state<keyof Assessment | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  function getLetterGrade(assessment: Assessment): string {
    // Use letter grade from assessment if available
    if (assessment.letterGrade) {
      return assessment.letterGrade;
    }
    
    // Fallback to custom scale based on percentage
    const percentage = assessment.finalGrade;
    if (percentage === undefined) return '';
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 40) return 'D';
    return 'E';
  }

  function getStatusVariant(status: string) {
    switch (status) {
      case 'MARKS_RELEASED':
        return 'success';
      case 'OVERDUE':
        return 'danger';
      case 'PENDING':
        return 'warning';
      default:
        return 'secondary';
    }
  }

  function formatStatus(status: string): string {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  function handleSort(column: keyof Assessment) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
    currentPage = 0; // Reset to first page when sorting
  }

  // Derived sorted and paginated data
  const sortedData = $derived(() => {
    if (!sortColumn) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn as keyof Assessment];
      const bVal = b[sortColumn as keyof Assessment];
      
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (sortColumn === 'due') {
        // Handle dates as strings
        const dateA = new Date(aVal as string);
        const dateB = new Date(bVal as string);
        comparison = dateA.getTime() - dateB.getTime();
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  const paginatedData = $derived(() => {
    const start = currentPage * itemsPerPage;
    return sortedData().slice(start, start + itemsPerPage);
  });

  const totalPages = $derived(() => Math.ceil(data.length / itemsPerPage));
  const canPreviousPage = $derived(() => currentPage > 0);
  const canNextPage = $derived(() => currentPage < totalPages() - 1);

  function previousPage() {
    if (canPreviousPage()) currentPage--;
  }

  function nextPage() {
    if (canNextPage()) currentPage++;
  }

  function getSortIcon(column: keyof Assessment) {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ChevronUp : ChevronDown;
  }
</script>

<div class="w-full">
  <div class="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-clip">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4 border-tr-lg" onclick={() => handleSort('title')}>
            <div class="flex items-center gap-2">
              <T key="analytics.assessment" fallback="Assessment" />
              {#if getSortIcon('title')}
                <Icon size="16" src={getSortIcon('title')} class="text-zinc-400" />
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4" onclick={() => handleSort('subject')}>
            <div class="flex items-center gap-2">
              <T key="analytics.subject" fallback="Subject" />
              {#if getSortIcon('subject')}
                <Icon size="16" src={getSortIcon('subject')} class="text-zinc-400" />
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4" onclick={() => handleSort('due')}>
            <div class="flex items-center gap-2">
              <T key="analytics.due_date" fallback="Due Date" />
              {#if getSortIcon('due')}
                <Icon size="16" src={getSortIcon('due')} class="text-zinc-400" />
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4" onclick={() => handleSort('status')}>
            <div class="flex items-center gap-2">
              <T key="analytics.status" fallback="Status" />
              {#if getSortIcon('status')}
                <Icon size="16" src={getSortIcon('status')} class="text-zinc-400" />
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="text-right cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4" onclick={() => handleSort('finalGrade')}>
            <div class="flex items-center justify-end gap-2">
              <T key="analytics.grade" fallback="Grade" />
              {#if getSortIcon('finalGrade')}
                <Icon size="16" src={getSortIcon('finalGrade')} class="text-zinc-400" />
              {/if}
            </div>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each paginatedData() as assessment (assessment.id)}
          <Table.Row class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <Table.Cell>
              <div>
                <div class="font-medium text-zinc-900 dark:text-zinc-100">{assessment.title}</div>
                <div class="text-sm text-zinc-500 dark:text-zinc-400">{assessment.code}</div>
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="text-zinc-900 dark:text-zinc-100">{assessment.subject}</div>
            </Table.Cell>
            <Table.Cell>
              <div class="text-zinc-900 dark:text-zinc-100">
                {new Date(assessment.due).toLocaleDateString()}
              </div>
            </Table.Cell>
            <Table.Cell>
              <Badge variant={getStatusVariant(assessment.status)}>
                {formatStatus(assessment.status)}
              </Badge>
            </Table.Cell>
            <Table.Cell class="text-right pr-4">
              {#if assessment.finalGrade !== undefined}
                <div>
                  <div class="font-medium text-zinc-900 dark:text-zinc-100">{assessment.finalGrade}%</div>
                  <div class="text-xs text-zinc-500 dark:text-zinc-400">{getLetterGrade(assessment)}</div>
                </div>
              {:else}
                <span class="text-zinc-500 dark:text-zinc-400">—</span>
              {/if}
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={5} class="h-24 text-center">
              <T key="analytics.no_assessments_found" fallback="No assessments found." />
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  
  <!-- Pagination -->
  <div class="flex items-center justify-between space-x-2 pt-4">
    <div class="text-sm text-zinc-600 dark:text-zinc-400">
      <T key="analytics.showing_assessments" fallback="Showing assessments" values={{ start: currentPage * itemsPerPage + 1, end: Math.min((currentPage + 1) * itemsPerPage, data.length), total: data.length }} />
    </div>
    <div class="space-x-2 flex place-items-center">
      <div class="flex items-center gap-2">
        <span class="text-sm text-zinc-600 dark:text-zinc-400">
          <T key="analytics.rows_per_page" fallback="Rows per page:" />
        </span>
        <Select.Root type="single" bind:value={itemsPerPageValue} onValueChange={handleItemsPerPageChange}>
          <Select.Trigger>
            <span>{itemsPerPage}</span>
          </Select.Trigger>
          <Select.Content>
            {#each itemsPerPageOptions as option}
              <Select.Item value={option.toString()} label={option.toString()}>{option}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <Button
        variant="outline"
        size="sm"
        onclick={previousPage}
        disabled={!canPreviousPage()}
      >
        <T key="analytics.previous" fallback="Previous" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={nextPage}
        disabled={!canNextPage()}
      >
        <T key="analytics.next" fallback="Next" />
      </Button>
    </div>
  </div>
</div>