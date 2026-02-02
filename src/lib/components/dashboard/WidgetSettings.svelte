<script lang="ts">
  import Modal from '../Modal.svelte';
  import { Button, Input } from '../ui';
  import * as Select from '../ui/select/index.js';
  import * as Label from '../ui/label/index.js';
  import type { WidgetConfig, WidgetSettingsSchema } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import { widgetService } from '../../services/widgetService';
  import { logger } from '../../../utils/logger';

  interface Props {
    widget: WidgetConfig | null;
    open: boolean;
    onClose: () => void;
    onSave?: (widget: WidgetConfig) => void;
  }

  let { widget, open = $bindable(false), onClose, onSave }: Props = $props();

  let settings = $state<Record<string, any>>({});
  let loading = $state(false);

  // Load settings when widget changes
  $effect(() => {
    if (widget) {
      const definition = widgetRegistry.get(widget.type);
      // Merge default settings with widget settings
      settings = {
        ...(definition?.defaultSettings || {}),
        ...(widget.settings || {}),
      };
    }
  });

  async function handleSave() {
    if (!widget) return;

    loading = true;
    try {
      const updatedWidget: WidgetConfig = {
        ...widget,
        settings: { ...settings },
      };

      await widgetService.updateWidgetConfig(widget.id, { settings: updatedWidget.settings });

      if (onSave) {
        onSave(updatedWidget);
      }

      onClose();
    } catch (e) {
      logger.error('WidgetSettings', 'handleSave', `Failed to save settings: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  function handleCancel() {
    // Reset settings to original
    if (widget) {
      const definition = widgetRegistry.get(widget.type);
      settings = {
        ...(definition?.defaultSettings || {}),
        ...(widget.settings || {}),
      };
    }
    onClose();
  }

  const schema = $derived(() => {
    if (!widget) return null;
    const definition = widgetRegistry.get(widget.type);
    return definition?.settingsSchema;
  });
</script>

<Modal
  bind:open
  onclose={handleCancel}
  maxWidth="max-w-2xl"
  ariaLabel={widget ? `Settings for ${widget.type}` : 'Widget Settings'}
  className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
  <div class="p-6">
    <h2 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
      {widget
        ? `Settings: ${widgetRegistry.get(widget.type)?.name || widget.type}`
        : 'Widget Settings'}
    </h2>

    {#if schema && Object.keys(schema).length > 0}
      <div class="space-y-6">
        {#each Object.entries(schema) as [key, fieldSchema]}
          {@const value = settings[key] ?? fieldSchema.default}

          {#if fieldSchema.type === 'string'}
            <div class="space-y-2">
              <Label.Root for={key} class="text-sm font-medium text-zinc-900 dark:text-white">
                {fieldSchema.label}
              </Label.Root>
              <Input
                id={key}
                type="text"
                {value}
                oninput={(e) => {
                  settings[key] = (e.target as HTMLInputElement).value;
                }}
                class="w-full" />
            </div>
          {:else if fieldSchema.type === 'number'}
            <div class="space-y-2">
              <Label.Root for={key} class="text-sm font-medium text-zinc-900 dark:text-white">
                {fieldSchema.label}
              </Label.Root>
              <Input
                id={key}
                type="number"
                {value}
                min={fieldSchema.min}
                max={fieldSchema.max}
                oninput={(e) => {
                  settings[key] =
                    parseInt((e.target as HTMLInputElement).value) || fieldSchema.default;
                }}
                class="w-full" />
            </div>
          {:else if fieldSchema.type === 'boolean'}
            <div class="flex items-center gap-3">
              <input
                id={key}
                type="checkbox"
                checked={value}
                onchange={(e) => {
                  settings[key] = (e.target as HTMLInputElement).checked;
                }}
                class="w-4 h-4 rounded border-zinc-300 text-accent-600 focus:ring-2 focus:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-800" />
              <Label.Root
                for={key}
                class="text-sm font-medium text-zinc-900 dark:text-white cursor-pointer">
                {fieldSchema.label}
              </Label.Root>
            </div>
          {:else if fieldSchema.type === 'select'}
            <div class="space-y-2">
              <Label.Root for={key} class="text-sm font-medium text-zinc-900 dark:text-white">
                {fieldSchema.label}
              </Label.Root>
              <Select.Root
                type="single"
                {value}
                onValueChange={(newValue) => {
                  if (newValue !== undefined) {
                    settings[key] = newValue;
                  }
                }}>
                <Select.Trigger id={key} class="w-full">
                  <span class="truncate">
                    {fieldSchema.options?.find(
                      (opt: { value: any; label: string }) => opt.value === value,
                    )?.label ||
                      value ||
                      'Select...'}
                  </span>
                </Select.Trigger>
                <Select.Content>
                  {#each fieldSchema.options || [] as option (option.value)}
                    <Select.Item value={option.value} label={option.label}
                      >{option.label}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          {:else if fieldSchema.type === 'color'}
            <div class="space-y-2">
              <Label.Root for={key} class="text-sm font-medium text-zinc-900 dark:text-white">
                {fieldSchema.label}
              </Label.Root>
              <div class="flex items-center gap-2">
                <input
                  id={key}
                  type="color"
                  value={value || '#3b82f6'}
                  oninput={(e) => {
                    settings[key] = (e.target as HTMLInputElement).value;
                  }}
                  class="w-12 h-10 rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                <Input
                  type="text"
                  value={value || '#3b82f6'}
                  oninput={(e) => {
                    settings[key] = (e.target as HTMLInputElement).value;
                  }}
                  class="flex-1" />
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="py-8 text-center text-zinc-600 dark:text-zinc-400">
        <p>This widget has no configurable settings.</p>
      </div>
    {/if}

    <div class="flex justify-end gap-3 mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
      <Button variant="ghost" onclick={handleCancel} disabled={loading}>Cancel</Button>
      <Button onclick={handleSave} disabled={loading || !schema}>
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  </div>
</Modal>
