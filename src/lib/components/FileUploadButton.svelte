<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Plus } from 'svelte-hero-icons';
  import { open } from '@tauri-apps/plugin-dialog';
  import { uploadSeqtaFile, seqtaFetch } from '../../utils/netUtil';

  interface Props {
    assessmentId: number;
    metaclassId: number;
    onUploadComplete?: () => void;
  }

  let { assessmentId, metaclassId, onUploadComplete }: Props = $props();

  let uploading = $state(false);
  let uploadError = $state('');

  async function handleFileUpload() {
    uploading = true;
    uploadError = '';

    try {
      // Open file dialog to select files
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (!selected) {
        uploading = false;
        return;
      }

      const files = Array.isArray(selected) ? selected : [selected];

      for (const filePath of files) {
        // Extract filename from path
        const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
        
        // First, upload the file
        const uploadResponse = await uploadSeqtaFile(fileName, filePath);
        const uploadResult = JSON.parse(uploadResponse);
        
        if (uploadResult.status === '200' && uploadResult.payload) {
          // Then link the file to the assessment
          const linkResponse = await seqtaFetch('/seqta/student/assessment/submissions/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {
              action: 'link',
              assID: assessmentId,
              metaclass: metaclassId,
              files: [uploadResult.payload.id]
            },
          });
          
          const linkResult = JSON.parse(linkResponse);
          if (linkResult.status === '200') {
            // Call the callback to reload submissions
            if (onUploadComplete) {
              onUploadComplete();
            }
          } else {
            throw new Error('Failed to link file to assessment');
          }
        } else {
          throw new Error('Failed to upload file');
        }
      }
    } catch (e) {
      console.error('File upload error:', e);
      uploadError = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }
</script>

<div>
  <button
    type="button"
    class="flex gap-2 items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-white bg-accent-bg hover:bg-accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={handleFileUpload}
    disabled={uploading}>
    {#if uploading}
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      Uploading...
    {:else}
      <Icon src={Plus} class="w-4 h-4" />
      Upload Files
    {/if}
  </button>
  
  {#if uploadError}
    <div class="p-3 mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
      <p class="text-sm text-red-700 dark:text-red-400">{uploadError}</p>
    </div>
  {/if}
</div> 