<script lang="ts">
  import Modal from '../Modal.svelte';
  import { Button, Input } from '../ui';
  import SettingSelect from '../ui/SettingSelect.svelte';
  import { Icon, ArrowPath } from 'svelte-hero-icons';
  import * as Label from '../ui/label/index.js';
  import type { WidgetConfig, WidgetSettingsSchema } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import { widgetService } from '../../services/widgetService';
  import { logger } from '../../../utils/logger';
  import { toast } from 'svelte-sonner';

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

      if (onSave) {
        onSave(updatedWidget);
      } else {
        await widgetService.updateWidgetConfig(widget.id, { settings: updatedWidget.settings });
      }
      onClose();
    } catch (e) {
      logger.error('WidgetSettings', 'handleSave', `Failed to save settings: ${e}`, { error: e });
      toast.error('Failed to save settings');
    } finally {
      loading = false;
    }
  }

  function handleCancel() {
    if (widget) {
      const definition = widgetRegistry.get(widget.type);
      settings = {
        ...(definition?.defaultSettings || {}),
        ...(widget.settings || {}),
      };
    }
    onClose();
  }

  function resetField(key: string, fieldSchema: WidgetSettingsSchema[string]) {
    settings[key] = fieldSchema.default;
  }

  const schema = $derived.by<WidgetSettingsSchema | undefined>(() => {
    if (!widget) return undefined;
    const definition = widgetRegistry.get(widget.type);
    return definition?.settingsSchema;
  });

  const widgetName = $derived.by(() => {
    if (!widget) return 'Widget';
    return widgetRegistry.get(widget.type)?.name || widget.type;
  });
</script>

<Modal
  bind:open
  onclose={handleCancel}
  maxWidth="max-w-xl"
  className="overflow-visible"
  ariaLabel={widget ? `Settings for ${widget.type}` : 'Widget Settings'}
  title={`${widgetName} settings`}>
  <div class="px-6 sm:px-8 pb-6 sm:pb-7 space-y-5">
    {#if schema && Object.keys(schema).length > 0}
      <div class="space-y-5">
        {#each Object.entries(schema) as [key, fieldSchema]}
          {@const value = settings[key] ?? fieldSchema.default}
          {@const isDefault = value === fieldSchema.default}

          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label.Root for={key} class="text-xs uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                {fieldSchema.label}
              </Label.Root>
              {#if !isDefault}
                <button
                  type="button"
                  onclick={() => resetField(key, fieldSchema)}
                  class="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.06em] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <Icon src={ArrowPath} class="w-3 h-3" />
                  Reset
                </button>
              {/if}
            </div>

            {#if fieldSchema.type === 'string'}
              <Input
                id={key}
                type="text"
                {value}
                oninput={(e) => {
                  settings[key] = (e.target as HTMLInputElement).value;
                }}
                class="w-full" />
            {:else if fieldSchema.type === 'number'}
              <Input
                id={key}
                type="number"
                {value}
                min={fieldSchema.min}
                max={fieldSchema.max}
                oninput={(e) => {
                  const n = parseInt((e.target as HTMLInputElement).value);
                  settings[key] = Number.isNaN(n) ? fieldSchema.default : n;
                }}
                class="w-full" />
            {:else if fieldSchema.type === 'boolean'}
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  id={key}
                  type="checkbox"
                  checked={value}
                  onchange={(e) => {
                    settings[key] = (e.target as HTMLInputElement).checked;
                  }}
                  class="w-4 h-4 rounded border-border text-accent-600 focus:ring-2 focus:ring-accent-500 bg-card" />
                <span class="text-sm text-foreground">
                  {fieldSchema.label}
                </span>
              </label>
            {:else if fieldSchema.type === 'select'}
              <SettingSelect
                id={key}
                value={String(value ?? '')}
                options={(fieldSchema.options || []).map((opt) => ({
                  value: String(opt.value),
                  label: opt.label,
                }))}
                onchange={(newValue) => {
                  settings[key] = newValue;
                }} />
            {:else if fieldSchema.type === 'color'}
              <div class="flex items-center gap-2">
                <input
                  id={key}
                  type="color"
                  value={value || '#3b82f6'}
                  oninput={(e) => {
                    settings[key] = (e.target as HTMLInputElement).value;
                  }}
                  class="w-10 h-10 rounded-md border border-border cursor-pointer bg-card" />
                <Input
                  type="text"
                  value={value || '#3b82f6'}
                  oninput={(e) => {
                    settings[key] = (e.target as HTMLInputElement).value;
                  }}
                  class="flex-1" />
              </div>
            {/if}

            {#if fieldSchema.description}
              <p class="text-xs text-muted-foreground">{fieldSchema.description}</p>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="py-8 text-center text-muted-foreground">
        <p class="text-sm">This widget has no configurable settings.</p>
      </div>
    {/if}

    <div class="flex justify-end gap-2 pt-4 border-t border-border-subtle">
      <Button variant="ghost" size="sm" onclick={handleCancel} disabled={loading}>Cancel</Button>
      <Button size="sm" onclick={handleSave} disabled={loading || !schema}>
        {loading ? 'Saving…' : 'Save'}
      </Button>
    </div>
  </div>
</Modal>
