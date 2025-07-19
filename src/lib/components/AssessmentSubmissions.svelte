<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText } from 'svelte-hero-icons';
  import FileUploadButton from './FileUploadButton.svelte';
  import FileCard from './FileCard.svelte';

  interface Submission {
    filename: string;
    mimetype: string;
    size: string;
    uuid?: string;
    created_date?: string;
    staff?: boolean;
    created_by?: number;
  }

  interface Props {
    submissions: Submission[];
    assessmentId: number;
    metaclassId: number;
    onUploadComplete?: () => void;
  }

  let { submissions, assessmentId, metaclassId, onUploadComplete }: Props = $props();

  const studentSubmissions = submissions.filter((f) => !f.staff);
</script>

<div class="grid gap-8 animate-fade-in">
  <div
    class="p-6 rounded-2xl transition-all duration-300 dark:bg-slate-900 bg-slate-100 hover:shadow-lg hover:shadow-accent-500/10">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Submissions</h1>
      <FileUploadButton 
        {assessmentId}
        {metaclassId}
        {onUploadComplete}
      />
    </div>
    
    {#if studentSubmissions.length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-slate-400" />
        </div>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Submissions Yet</h3>
        <p class="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
          You haven't submitted any files for this assessment yet. Use the upload button above to add your work.
        </p>
      </div>
    {:else}
      <div class="grid gap-3">
        {#each studentSubmissions as file}
          <FileCard 
            {file}
            variant="submission"
            showDownload={false}
          />
        {/each}
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