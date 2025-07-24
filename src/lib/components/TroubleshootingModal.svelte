<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../utils/logger';
  import Modal from './Modal.svelte';
  import { Icon } from 'svelte-hero-icons';
  import { 
    DocumentArrowDown, 
    Trash, 
    ClipboardDocument,
    ExclamationTriangle,
    InformationCircle,
    Cog
  } from 'svelte-hero-icons';

  let { open = false, onclose } = $props<{
    open: boolean;
    onclose: () => void;
  }>();

  let logs = $state('');
  let logFilePath = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let logLevel = $state('DEBUG');
  let showRawLogs = $state(false);

  async function loadLogs() {
    loading = true;
    error = null;
    
    try {
      logger.info('troubleshooting', 'loadLogs', 'Loading logs for troubleshooting');
      logs = await invoke<string>('get_logs_for_troubleshooting');
      logFilePath = await invoke<string>('get_log_file_path_command');
      logger.debug('troubleshooting', 'loadLogs', 'Logs loaded successfully', { 
        logLength: logs.length,
        logFilePath 
      });
    } catch (e) {
      error = `Failed to load logs: ${e}`;
      logger.error('troubleshooting', 'loadLogs', `Failed to load logs: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function exportLogs() {
    loading = true;
    error = null;
    success = null;
    
    try {
      logger.info('troubleshooting', 'exportLogs', 'Exporting logs for support');
      const supportData = await invoke<string>('export_logs_for_support');
      
      // Create a blob and download it
      const blob = new Blob([supportData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `desqta-support-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success = 'Support logs exported successfully!';
      logger.info('troubleshooting', 'exportLogs', 'Support logs exported successfully');
    } catch (e) {
      error = `Failed to export logs: ${e}`;
      logger.error('troubleshooting', 'exportLogs', `Failed to export logs: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function copyLogsToClipboard() {
    try {
      logger.info('troubleshooting', 'copyLogsToClipboard', 'Copying logs to clipboard');
      const supportData = await invoke<string>('export_logs_for_support');
      await navigator.clipboard.writeText(supportData);
      success = 'Logs copied to clipboard!';
      logger.debug('troubleshooting', 'copyLogsToClipboard', 'Logs copied to clipboard successfully');
    } catch (e) {
      error = `Failed to copy logs: ${e}`;
      logger.error('troubleshooting', 'copyLogsToClipboard', `Failed to copy logs: ${e}`, { error: e });
    }
  }

  async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }
    
    loading = true;
    error = null;
    success = null;
    
    try {
      logger.warn('troubleshooting', 'clearLogs', 'Clearing all application logs');
      await invoke('clear_logs');
      logs = '';
      success = 'Logs cleared successfully!';
      logger.info('troubleshooting', 'clearLogs', 'Logs cleared successfully');
    } catch (e) {
      error = `Failed to clear logs: ${e}`;
      logger.error('troubleshooting', 'clearLogs', `Failed to clear logs: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function setLogLevel() {
    try {
      logger.info('troubleshooting', 'setLogLevel', `Setting log level to ${logLevel}`, { logLevel });
      await invoke('set_log_level_command', { level: logLevel });
      success = `Log level set to ${logLevel}`;
      logger.info('troubleshooting', 'setLogLevel', `Log level set to ${logLevel} successfully`);
    } catch (e) {
      error = `Failed to set log level: ${e}`;
      logger.error('troubleshooting', 'setLogLevel', `Failed to set log level: ${e}`, { error: e });
    }
  }

  // Load logs when modal opens
  $effect(() => {
    if (open) {
      loadLogs();
    }
  });

  function formatLogPreview(logText: string): string {
    const lines = logText.split('\n');
    const recentLines = lines.slice(-50); // Show last 50 lines
    return recentLines.join('\n');
  }

  function getLogStats(logText: string) {
    const lines = logText.split('\n').filter(line => line.trim());
    const errorCount = lines.filter(line => line.includes('[ERROR]')).length;
    const warnCount = lines.filter(line => line.includes('[WARN]')).length;
    const infoCount = lines.filter(line => line.includes('[INFO]')).length;
    const debugCount = lines.filter(line => line.includes('[DEBUG]')).length;
    
    return { total: lines.length, errorCount, warnCount, infoCount, debugCount };
  }

  let logStats = $derived(logs ? getLogStats(logs) : null);
</script>

<Modal {open} onclose={onclose} maxWidth="w-full max-w-6xl" maxHeight="h-full max-h-[90vh]">
  <div class="flex flex-col h-full max-h-[80vh]">
    <!-- Header -->
    <div class="flex items-center gap-3 p-6 border-b border-slate-200 dark:border-slate-700">
      <Icon src={Cog} class="w-6 h-6 text-accent-500" />
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Troubleshooting & Logs</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          View application logs and export troubleshooting information
        </p>
      </div>
    </div>

    <!-- Status Messages -->
    {#if error}
      <div class="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
        <Icon src={ExclamationTriangleIcon} class="w-5 h-5 text-red-500" />
        <span class="text-red-700 dark:text-red-300 text-sm">{error}</span>
        <button 
          class="ml-auto text-red-500 hover:text-red-700" 
          onclick={() => error = null}>
          ✕
        </button>
      </div>
    {/if}

    {#if success}
      <div class="mx-6 mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
        <Icon src={InformationCircleIcon} class="w-5 h-5 text-green-500" />
        <span class="text-green-700 dark:text-green-300 text-sm">{success}</span>
        <button 
          class="ml-auto text-green-500 hover:text-green-700" 
          onclick={() => success = null}>
          ✕
        </button>
      </div>
    {/if}

    <!-- Controls -->
    <div class="p-6 border-b border-slate-200 dark:border-slate-700">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div class="flex flex-wrap gap-3">
          <button
            class="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 flex items-center gap-2"
            onclick={exportLogs}
            disabled={loading}>
            <Icon src={DocumentArrowDownIcon} class="w-4 h-4" />
            Export Support Logs
          </button>

          <button
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
            onclick={copyLogsToClipboard}
            disabled={loading}>
            <Icon src={ClipboardDocumentIcon} class="w-4 h-4" />
            Copy to Clipboard
          </button>

          <button
            class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center gap-2"
            onclick={clearLogs}
            disabled={loading}>
            <Icon src={TrashIcon} class="w-4 h-4" />
            Clear Logs
          </button>
        </div>

        <div class="flex items-center gap-3">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Log Level:</label>
          <select 
            bind:value={logLevel}
            onchange={setLogLevel}
            class="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm">
            <option value="TRACE">TRACE</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="FATAL">FATAL</option>
          </select>
        </div>
      </div>

      {#if logFilePath}
        <div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Log file: <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">{logFilePath}</code>
        </div>
      {/if}
    </div>

    <!-- Log Statistics -->
    {#if logStats}
      <div class="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div class="flex flex-wrap gap-4 text-sm">
          <span class="text-slate-600 dark:text-slate-400">
            Total: <span class="font-medium text-slate-900 dark:text-white">{logStats.total}</span>
          </span>
          <span class="text-red-600 dark:text-red-400">
            Errors: <span class="font-medium">{logStats.errorCount}</span>
          </span>
          <span class="text-yellow-600 dark:text-yellow-400">
            Warnings: <span class="font-medium">{logStats.warnCount}</span>
          </span>
          <span class="text-blue-600 dark:text-blue-400">
            Info: <span class="font-medium">{logStats.infoCount}</span>
          </span>
          <span class="text-gray-600 dark:text-gray-400">
            Debug: <span class="font-medium">{logStats.debugCount}</span>
          </span>
        </div>
      </div>
    {/if}

    <!-- Log Content -->
    <div class="flex-1 overflow-hidden">
      {#if loading}
        <div class="flex items-center justify-center h-full">
          <div class="text-slate-500 dark:text-slate-400">Loading logs...</div>
        </div>
      {:else if logs}
        <div class="h-full flex flex-col">
          <div class="px-6 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <label class="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                bind:checked={showRawLogs}
                class="rounded border-slate-300 dark:border-slate-600" />
              Show full logs
            </label>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              ({showRawLogs ? 'All' : 'Last 50'} lines)
            </span>
          </div>
          
          <div class="flex-1 overflow-auto">
            <pre class="p-4 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 h-full overflow-auto">
              {showRawLogs ? logs : formatLogPreview(logs)}
            </pre>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-center h-full">
          <div class="text-slate-500 dark:text-slate-400">No logs available</div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div class="flex justify-between items-center">
        <div class="text-sm text-slate-500 dark:text-slate-400">
          <strong>Note:</strong> Support logs include system information and recent application activity.
          No personal data from SEQTA is included.
        </div>
        
        <button
          class="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-500"
          onclick={onClose}>
          Close
        </button>
      </div>
    </div>
  </div>
</Modal> 