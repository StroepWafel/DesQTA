<script lang="ts">
  import { Icon, ArrowDownTray, TableCells, DocumentText, CalendarDays } from 'svelte-hero-icons';
  import { fly, scale } from 'svelte/transition';
  import T from './T.svelte';
  import { _ } from '../i18n';

  export let showExportMenu: boolean;
  export let onExportCsv: () => void;
  export let onExportPdf: () => void;
  export let onExportIcal: () => void;
</script>

<div class="inline-block relative text-left export-dropdown-container">
  <button
    class="flex gap-3 items-center px-5 py-3 rounded-xl border transition-all duration-200 bg-white/90 hover:bg-white dark:bg-zinc-700/90 dark:hover:bg-zinc-600 border-zinc-200/70 hover:border-zinc-300 dark:border-zinc-600 dark:hover:border-zinc-500 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 shadow-md hover:shadow-lg"
    on:click={() => (showExportMenu = !showExportMenu)}
    aria-label={$_('timetable.export_options') || 'Export options'}
    aria-expanded={showExportMenu}>
    <Icon src={ArrowDownTray} class="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
    <span class="font-semibold text-zinc-900 dark:text-white">
      <T key="timetable.export" fallback="Export" />
    </span>
  </button>
  
  {#if showExportMenu}
    <div
      class="absolute right-0 z-50 mt-3 w-64 rounded-2xl border shadow-2xl backdrop-blur-md bg-white/95 border-zinc-200/60 dark:bg-zinc-900/95 dark:border-zinc-700/40"
      transition:fly={{ y: -8, duration: 200, opacity: 0 }}>
      <div class="p-3">
        <div class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 px-2">
          <T key="timetable.export_format" fallback="Export Format" />
        </div>
        
        <button
          class="flex gap-4 items-center px-4 py-4 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50 group"
          on:click={() => {
            showExportMenu = false;
            onExportCsv();
          }}>
          <div
            class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 bg-green-100 group-hover:bg-green-200 dark:bg-green-900/30 dark:group-hover:bg-green-900/50">
            <Icon src={TableCells} class="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div class="flex-1">
            <div class="font-semibold text-zinc-900 dark:text-white">
              <T key="timetable.export_csv" fallback="Export as CSV" />
            </div>
            <div class="text-sm text-zinc-500 dark:text-zinc-400">
              <T key="timetable.csv_description" fallback="Spreadsheet format for Excel" />
            </div>
          </div>
        </button>

        <button
          class="flex gap-4 items-center px-4 py-4 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50 group"
          on:click={() => {
            showExportMenu = false;
            onExportPdf();
          }}>
          <div
            class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 bg-red-100 group-hover:bg-red-200 dark:bg-red-900/30 dark:group-hover:bg-red-900/50">
            <Icon src={DocumentText} class="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div class="flex-1">
            <div class="font-semibold text-zinc-900 dark:text-white">
              <T key="timetable.export_pdf" fallback="Export as PDF" />
            </div>
            <div class="text-sm text-zinc-500 dark:text-zinc-400">
              <T key="timetable.pdf_description" fallback="Portable document format" />
            </div>
          </div>
        </button>

        <button
          class="flex gap-4 items-center px-4 py-4 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50 group"
          on:click={() => {
            showExportMenu = false;
            onExportIcal();
          }}>
          <div
            class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 bg-blue-100 group-hover:bg-blue-200 dark:bg-blue-900/30 dark:group-hover:bg-blue-900/50">
            <Icon src={CalendarDays} class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div class="flex-1">
            <div class="font-semibold text-zinc-900 dark:text-white">
              <T key="timetable.export_ical" fallback="Export as iCal" />
            </div>
            <div class="text-sm text-zinc-500 dark:text-zinc-400">
              <T key="timetable.ical_description" fallback="Calendar (.ics) format" />
            </div>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div> 