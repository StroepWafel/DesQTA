<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText, Trash } from 'svelte-hero-icons';
  import FileUploadButton from './FileUploadButton.svelte';
  import FileCard from './FileCard.svelte';
  import Modal from './Modal.svelte';
  import { Button } from './ui';
  import { seqtaFetch } from '../../utils/netUtil';
  import { toastStore } from '../../lib/stores/toast';

  interface Submission {
    id?: number;
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
    onDeleteComplete?: () => void;
  }

  let { submissions, assessmentId, metaclassId, onUploadComplete, onDeleteComplete }: Props =
    $props();

  let deleteModalOpen = $state(false);
  let fileToDelete = $state<Submission | null>(null);
  let deletingFileId = $state<number | null>(null);

  const studentSubmissions = $derived(submissions.filter((f) => !f.staff));

  function openDeleteModal(file: Submission) {
    const fileId = file.id ?? (file as { userfile?: number }).userfile;
    if (fileId == null) return;
    fileToDelete = file;
    deleteModalOpen = true;
  }

  function closeDeleteModal() {
    if (deletingFileId == null) {
      deleteModalOpen = false;
      fileToDelete = null;
    }
  }

  async function confirmDelete() {
    if (!fileToDelete) return;
    const fileId = fileToDelete.id ?? (fileToDelete as { userfile?: number }).userfile;
    if (fileId == null) return;

    try {
      deletingFileId = fileId as number;
      const res = await seqtaFetch('/seqta/student/assessment/submissions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          action: 'erase',
          assID: assessmentId,
          metaclass: metaclassId,
          fileID: fileId,
          undo: false,
        },
      });
      const result = typeof res === 'string' ? JSON.parse(res) : res;
      if (result.status === '200') {
        toastStore.success(`"${fileToDelete.filename}" removed`);
        onDeleteComplete?.();
        deleteModalOpen = false;
        fileToDelete = null;
      } else {
        throw new Error('Delete failed');
      }
    } catch (e) {
      console.error('Failed to delete submission:', e);
      toastStore.error('Failed to remove file');
    } finally {
      deletingFileId = null;
    }
  }
</script>

<div class="grid gap-8 animate-fade-in">
  <div
    class="p-6 rounded-2xl transition-all duration-300 dark:bg-zinc-900 bg-zinc-100 hover:shadow-lg hover:shadow-accent-500/10">
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
        <div class="w-16 h-16 mb-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
          <Icon src={DocumentText} class="w-8 h-8 text-zinc-400" />
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No Submissions Yet</h3>
        <p class="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md">
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
            showDelete={true}
            onDelete={() => openDeleteModal(file)}
            deleting={deletingFileId === (file.id ?? (file as { userfile?: number }).userfile)}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Delete confirmation modal -->
<Modal
  bind:open={deleteModalOpen}
  onclose={closeDeleteModal}
  title="Delete submission?"
  maxWidth="max-w-md"
  showCloseButton={true}
  ariaLabel="Delete submission confirmation">
  <div class="px-8 pb-8 pt-2">
    {#if fileToDelete}
      <p class="text-zinc-600 dark:text-zinc-400 mb-6">
        Are you sure you want to remove <strong class="text-zinc-900 dark:text-white">"{fileToDelete.filename}"</strong>? This cannot be undone.
      </p>
    {/if}
    <div class="flex gap-3 justify-end">
      <Button variant="ghost" onclick={closeDeleteModal} disabled={deletingFileId != null}>
        Cancel
      </Button>
      <Button
        variant="danger"
        onclick={confirmDelete}
        disabled={deletingFileId != null}
        class="flex items-center gap-2">
        {#if deletingFileId != null}
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin">
          </div>
        {:else}
          <Icon src={Trash} class="w-4 h-4" />
        {/if}
        Delete
      </Button>
    </div>
  </div>
</Modal>

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