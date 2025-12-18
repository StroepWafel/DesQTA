<script lang="ts">
  import { goto } from '$app/navigation';
  import { Icon, FolderOpen, PencilSquare } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
</script>

<div class="container px-6 py-7 mx-auto">
  <h1 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
    <T key="navigation.folios" fallback="Folios" />
  </h1>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
    <!-- Edit My Folios -->
    <button
      onclick={() => goto('/folios/edit')}
      class="group p-8 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
      <div class="flex flex-col items-center text-center space-y-4">
        <div class="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
          <Icon src={PencilSquare} class="w-8 h-8 text-accent" />
        </div>
        <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">
          <T key="folios.edit_my_folios" fallback="Edit My Folios" />
        </h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          <T key="folios.edit_my_folios_description" fallback="Create and manage your personal folios" />
        </p>
      </div>
    </button>

    <!-- Browse Folios -->
    <button
      onclick={() => goto('/folios/browse')}
      class="group p-8 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
      <div class="flex flex-col items-center text-center space-y-4">
        <div class="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
          <Icon src={FolderOpen} class="w-8 h-8 text-accent" />
        </div>
        <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">
          <T key="folios.browse_folios" fallback="Browse Folios" />
        </h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          <T key="folios.browse_folios_description" fallback="Explore and view available folios" />
        </p>
      </div>
    </button>
  </div>
</div>

