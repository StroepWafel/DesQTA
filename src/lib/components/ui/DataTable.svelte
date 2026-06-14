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
    striped = false,
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
    'min-w-full divide-y divide-border-subtle',
    className
  ].filter(Boolean).join(' '));

  // Lo-fi table: clean header row, hairline dividers, no zebra by default.
  let headerClasses = 'bg-surface-muted/60';
  let bodyClasses = 'bg-card divide-y divide-border-subtle';
</script>

<!-- min-w-0 + max-w-full so a wide table inside a flex/grid cell scrolls
     locally instead of pushing siblings off-screen. -->
<div class="overflow-hidden rounded-xl border border-border bg-card min-w-0 max-w-full">
  <div class="overflow-x-auto min-w-0 max-w-full">
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
                <th class="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    class="rounded-sm border-border text-accent-600 focus:ring-accent-500"
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
                  class="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em] {column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}"
                  style={column.width ? `width: ${column.width}` : ''}
                >
                  {#if column.sortable}
                    <button
                      onclick={() => handleSort(column)}
                      class="group inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <span>{column.title}</span>
                      {#if getSortIcon(column)}
                        <Icon
                          src={getSortIcon(column)}
                          size="14"
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
                class="{striped && index % 2 === 1 ? 'bg-surface-muted/40' : ''} {hoverable ? 'hover:bg-surface-muted/60' : ''} {onRowClick ? 'cursor-pointer' : ''} transition-colors duration-100"
                onclick={() => onRowClick?.(row)}
              >
                {#if selectable}
                  <td class="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      class="rounded-sm border-border text-accent-600 focus:ring-accent-500"
                      checked={isRowSelected(row)}
                      onchange={(e) => handleRowSelect(row, e.currentTarget.checked)}
                    />
                  </td>
                {/if}

                {#each columns as column}
                  <td
                    class="px-4 {compact ? 'py-2' : 'py-3.5'} whitespace-nowrap text-sm text-foreground nums-tabular {column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'}"
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
</div>
