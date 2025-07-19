<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText } from 'svelte-hero-icons';
  import FileCard from './FileCard.svelte';

  interface Resource {
    name: string;
    userfile: {
      mimetype: string;
      size: string;
      uuid: string;
    };
  }

  interface AssessmentData {
    description?: string;
    resources?: Resource[];
  }

  interface Props {
    assessmentData: AssessmentData;
  }

  let { assessmentData }: Props = $props();
</script>

<div class="grid gap-8 animate-fade-in">
  <div
    class="grid gap-6 p-6 rounded-2xl transition-all duration-300 dark:bg-slate-900 bg-slate-100 hover:shadow-lg hover:shadow-accent-500/10">
    <h1 class="mb-2 text-2xl font-bold">Assessment Overview</h1>
    
    <!-- Description Section -->
    <div>
      <h2 class="text-lg font-semibold mb-3">Description</h2>
      {#if assessmentData.description}
        <div class="max-w-none prose prose-invert">
          <div class="whitespace-pre-line text-slate-300">
            {@html assessmentData.description}
          </div>
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center py-6 text-center">
          <div class="w-12 h-12 mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <Icon src={DocumentText} class="w-6 h-6 text-slate-400" />
          </div>
          <h3 class="text-base font-semibold text-slate-900 dark:text-white mb-1">No Description Available</h3>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            This assessment doesn't have a detailed description yet.
          </p>
        </div>
          {/if}
  </div>
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>
  
  {#if assessmentData.resources?.length}
    <div
      class="grid gap-6 p-6 rounded-2xl transition-all duration-300 dark:bg-slate-900 bg-slate-100 hover:shadow-lg hover:shadow-accent-500/10">
      <h2 class="text-xl font-bold">Resources</h2>
      <div class="grid gap-4">
        {#each assessmentData.resources as resource}
          <FileCard 
            file={{
              name: resource.name,
              mimetype: resource.userfile.mimetype,
              size: resource.userfile.size,
              uuid: resource.userfile.uuid
            }}
            variant="resource"
          />
        {/each}
      </div>
    </div>
  {:else}
    <div
      class="grid gap-6 p-6 rounded-2xl transition-all duration-300 dark:bg-slate-900 bg-slate-100 hover:shadow-lg hover:shadow-accent-500/10">
      <h2 class="text-xl font-bold">Resources</h2>
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-slate-400" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Resources Available</h3>
        <p class="text-slate-600 dark:text-slate-400">
          This assessment doesn't have any attached resources or files.
        </p>
      </div>
    </div>
  {/if}
</div> 