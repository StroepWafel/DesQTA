<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText, VideoCamera, PresentationChartLine, Photo } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';

  interface FileData {
    name?: string;
    filename?: string;
    mimetype: string;
    size: string;
    uuid?: string;
    created_date?: string;
    staff?: boolean;
    created_by?: number;
  }

  interface Props {
    file: FileData;
    showDownload?: boolean;
    showMetadata?: boolean;
    variant?: 'resource' | 'submission';
  }

  let { file, showDownload = true, showMetadata = true, variant = 'resource' }: Props = $props();

  function getFileIcon(mimetype: string) {
    if (mimetype.startsWith('video/')) return VideoCamera;
    if (mimetype.includes('presentation')) return PresentationChartLine;
    if (mimetype.includes('image')) return Photo;
    return DocumentText;
  }

  function formatFileSize(size: string) {
    const bytes = parseInt(size);
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  }

  async function handleDownload() {
    if (!file.uuid) return;
    
    try {
      const url = await invoke('get_seqta_file', {
        fileType: variant,
        uuid: file.uuid,
      });
      if (typeof url === 'string') {
        await openUrl(url);
      }
    } catch (e) {
      console.error('Download failed:', e);
    }
  }

  const fileName = file.name || file.filename || 'Unknown File';
  const isStaffFile = file.staff || (file.created_by && file.created_by !== 69);
</script>

<div
  class="flex items-center gap-4 p-4 rounded-xl dark:bg-slate-800 bg-slate-200 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-accent-500/5">
  <Icon
    src={getFileIcon(file.mimetype)}
    class="w-6 h-6 text-accent-400" />
  <div class="flex-1 min-w-0">
    <div class="text-sm font-medium truncate">
      {fileName}
    </div>
    {#if showMetadata}
      <div class="flex gap-2 items-center text-xs text-slate-400">
        <span>{formatFileSize(file.size)}</span>
        {#if file.created_date}
          <span>•</span>
          <span>{isStaffFile ? 'Teacher' : 'Student'}</span>
          <span>•</span>
          <span>{new Date(file.created_date).toLocaleString()}</span>
        {:else}
          <span>•</span>
          <span>{isStaffFile ? 'Teacher' : 'Student'}</span>
        {/if}
      </div>
    {/if}
  </div>
  {#if showDownload}
    <button
      type="button"
      class="px-3 py-1 text-sm font-medium rounded-lg transition-all duration-200 text-white bg-accent-bg hover:bg-accent-ring"
      onclick={handleDownload}>
      Download
    </button>
  {/if}
</div> 