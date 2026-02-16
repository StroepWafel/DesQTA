<script lang="ts">
  import { Button, Input } from '../../ui';
  import type { TimetableWidgetSettings } from '$lib/types/timetable';

  interface Props {
    settings: TimetableWidgetSettings;
    onSettingsChange: (settings: TimetableWidgetSettings) => void;
  }

  let { settings, onSettingsChange }: Props = $props();

  let localSettings = $state<TimetableWidgetSettings>({ ...settings });

  function updateSetting<K extends keyof TimetableWidgetSettings>(
    key: K,
    value: TimetableWidgetSettings[K],
  ) {
    localSettings = { ...localSettings, [key]: value };
    onSettingsChange(localSettings);
  }
</script>

<div class="space-y-6 p-4">
  <!-- View Mode -->
  <div>
    <label for="view-mode-select" class="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
      Default View Mode
    </label>
    <select
      id="view-mode-select"
      value={localSettings.viewMode || 'week'}
      onchange={(e) =>
        updateSetting('viewMode', (e.target as HTMLSelectElement).value as 'week' | 'day' | 'month' | 'list')
      }
      class="w-full px-3 py-2 rounded-lg border transition-all duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-accent-500">
      <option value="week">Week</option>
      <option value="day">Day</option>
      <option value="month">Month</option>
      <option value="list">List</option>
    </select>
  </div>

  <!-- Time Range -->
  <div class="grid grid-cols-2 gap-4">
    <div>
      <label for="start-time-input" class="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
        Start Time
      </label>
      <input
        id="start-time-input"
        type="time"
        value={localSettings.timeRange?.start || '08:00'}
        onchange={(e) =>
          updateSetting('timeRange', {
            ...localSettings.timeRange,
            start: (e.target as HTMLInputElement).value,
            end: localSettings.timeRange?.end || '16:00',
          })
        }
        class="w-full px-3 py-2 rounded-lg border transition-all duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-accent-500" />
    </div>
    <div>
      <label for="end-time-input" class="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
        End Time
      </label>
      <input
        id="end-time-input"
        type="time"
        value={localSettings.timeRange?.end || '16:00'}
        onchange={(e) =>
          updateSetting('timeRange', {
            ...localSettings.timeRange,
            start: localSettings.timeRange?.start || '08:00',
            end: (e.target as HTMLInputElement).value,
          })
        }
        class="w-full" />
    </div>
  </div>

  <!-- Display Options -->
  <div class="space-y-3">
    <div class="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
      Display Options
    </div>
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={localSettings.showTeacher ?? true}
        onchange={(e) =>
          updateSetting('showTeacher', (e.target as HTMLInputElement).checked)
        }
        class="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-accent-600 focus:ring-accent-500" />
      <span class="text-sm text-zinc-700 dark:text-zinc-300">Show Teacher Names</span>
    </label>
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={localSettings.showRoom ?? true}
        onchange={(e) =>
          updateSetting('showRoom', (e.target as HTMLInputElement).checked)
        }
        class="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-accent-600 focus:ring-accent-500" />
      <span class="text-sm text-zinc-700 dark:text-zinc-300">Show Room Numbers</span>
    </label>
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={localSettings.showAttendance ?? true}
        onchange={(e) =>
          updateSetting('showAttendance', (e.target as HTMLInputElement).checked)
        }
        class="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-accent-600 focus:ring-accent-500" />
      <span class="text-sm text-zinc-700 dark:text-zinc-300">Show Attendance Status</span>
    </label>
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={localSettings.showEmptyPeriods ?? false}
        onchange={(e) =>
          updateSetting('showEmptyPeriods', (e.target as HTMLInputElement).checked)
        }
        class="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-accent-600 focus:ring-accent-500" />
      <span class="text-sm text-zinc-700 dark:text-zinc-300">Show Empty Periods</span>
    </label>
  </div>

  <!-- Density -->
  <div>
    <label for="density-select" class="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
      Display Density
    </label>
    <select
      id="density-select"
      value={localSettings.density || 'normal'}
      onchange={(e) =>
        updateSetting('density', (e.target as HTMLSelectElement).value as 'compact' | 'normal' | 'comfortable')
      }
      class="w-full px-3 py-2 rounded-lg border transition-all duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-accent-500">
      <option value="compact">Compact</option>
      <option value="normal">Normal</option>
      <option value="comfortable">Comfortable</option>
    </select>
  </div>
</div>
