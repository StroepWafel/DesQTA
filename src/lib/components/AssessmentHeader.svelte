<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ArrowLeft } from 'svelte-hero-icons';
</script>

<div
  class="flex sticky top-0 z-10 gap-4 items-center px-6 py-4 bg-opacity-80 border-b backdrop-blur-xs dark:bg-zinc-900 bg-zinc-100 dark:border-zinc-800 border-zinc-200">
  <a
    href="/assessments"
    class="flex gap-2 items-center transition-colors duration-200 text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
    <Icon src={ArrowLeft} class="w-5 h-5" />
    <span>Back to Assessments</span>
  </a>
</div>
