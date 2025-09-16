<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ChevronUpDown, ChevronUp, ChevronDown } from 'svelte-hero-icons';
  import AsyncWrapper from './AsyncWrapper.svelte';
  import type { Snippet } from 'svelte';

  interface Column {
    key: string;
    title: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    cell?: Snippet<[any, any]>; // (value, row)
  }

  interface Props {
    columns: Column[];
    data?: any[];
    loading?: boolean;
    error?: string | Error | null;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    striped?: boolean;
    hoverable?: boolean;
    compact?: boolean;
    selectable?: boolean;
    selectedRows?: Set<any>;
    onSort?: (column: string) => void;
    onRowSelect?: (row: any, selected: boolean) => void;
    onRowClick?: (row: any) => void;
    class?: string;
    emptyTitle?: string;
    emptyMessage?: string;
    rowKey?: string;
  }

  let {
    columns,
    data = [],
    loading = false,
    error = null,
    sortBy = '',
    sortOrder = 'asc',
    striped = true,
    hoverable = true,
    compact = false,
    selectable = false,
    selectedRows = new Set(),
    onSort,
    onRowSelect,
    onRowClick,
    class: className = '',
    emptyTitle = 'No data available',
    emptyMessage = 'There are no records to display.',
    rowKey = 'id'
  }: Props = $props();

  function handleSort(column: Column) {
    if (!column.sortable || !onSort) return;
    onSort(column.key);
  }

  function handleRowSelect(row: any, checked: boolean) {
    if (!onRowSelect) return;
    onRowSelect(row, checked);
  }

  function isRowSelected(row: any): boolean {
    return selectedRows.has(row[rowKey]);
  }

  function getSortIcon(column: Column) {
    if (!column.sortable) return null;
    if (sortBy !== column.key) return ChevronUpDown;
    return sortOrder === 'asc' ? ChevronUp : ChevronDown;
  }

  let tableClasses = $derived([
    'min-w-full divide-y divide-zinc-200 dark:divide-zinc-700',
    className
  ].filter(Boolean).join(' '));

  let headerClasses = $derived([
    'bg-zinc-50 dark:bg-zinc-800'
  ].join(' '));

  let bodyClasses = $derived([
    'bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700'
  ].join(' '));
</script>

<div class="overflow-x-auto">
  <AsyncWrapper 
    {loading} 
    {error} 
    {data}
    empty={data.length === 0}
    {emptyTitle}
    {emptyMessage}
    componentName="DataTable"
  >
    {#snippet children(tableData)}
      <table class={tableClasses}>
        <thead class={headerClasses}>
          <tr>
            {#if selectable}
              <th class="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  class="rounded-sm border-zinc-300 dark:border-zinc-600 text-accent-600 focus:ring-accent-500"
                  checked={tableData.every((row: any) => isRowSelected(row))}
                  onchange={(e) => {
                    const checked = e.currentTarget.checked;
                    tableData.forEach((row: any) => handleRowSelect(row, checked));
                  }}
                />
              </th>
            {/if}
            
            {#each columns as column}
              <th 
                class="px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider {column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}"
                style={column.width ? `width: ${column.width}` : ''}
              >
                {#if column.sortable}
                  <button
                    onclick={() => handleSort(column)}
                    class="group inline-flex items-center space-x-1 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    <span>{column.title}</span>
                    {#if getSortIcon(column)}
                      <Icon 
                        src={getSortIcon(column)} 
                        size="16" 
                        class="group-hover:text-zinc-500" 
                      />
                    {/if}
                  </button>
                {:else}
                  {column.title}
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        
        <tbody class={bodyClasses}>
          {#each tableData as row, index}
            <tr 
              class="{striped && index % 2 === 0 ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''} {hoverable ? 'hover:bg-zinc-100 dark:hover:bg-zinc-700/50' : ''} {onRowClick ? 'cursor-pointer' : ''} transition-colors duration-150"
              onclick={() => onRowClick?.(row)}
            >
              {#if selectable}
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    class="rounded-sm border-zinc-300 dark:border-zinc-600 text-accent-600 focus:ring-accent-500"
                    checked={isRowSelected(row)}
                    onchange={(e) => handleRowSelect(row, e.currentTarget.checked)}
                  />
                </td>
              {/if}
              
              {#each columns as column}
                <td 
                  class="px-6 {compact ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100 {column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}"
                >
                  {#if column.cell}
                    {@render column.cell(row[column.key], row)}
                  {:else}
                    {row[column.key] || '-'}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/snippet}
  </AsyncWrapper>
</div>
