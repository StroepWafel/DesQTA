<script lang="ts">
  import Modal from '../Modal.svelte';
  import { Button, Input, SearchInput } from '../ui';
  import { Icon, Trash, Eye } from 'svelte-hero-icons';
  import { fade } from 'svelte/transition';
  import { widgetTemplatesService, type WidgetTemplate } from '../../services/widgetTemplates';
  import TemplatePreview from './TemplatePreview.svelte';
  import { logger } from '../../../utils/logger';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  interface Props {
    open: boolean;
    onClose: () => void;
    onApply?: () => void;
  }

  let { open = $bindable(false), onClose, onApply }: Props = $props();

  let templates = $state<WidgetTemplate[]>([]);
  let loading = $state(false);
  let searchQuery = $state('');
  let showSaveDialog = $state(false);
  let newTemplateName = $state('');
  let newTemplateDescription = $state('');
  let savingTemplate = $state(false);
  let previewTemplate = $state<WidgetTemplate | null>(null);
  let hoveredTemplateId = $state<string | null>(null);
  let previewModalOpen = $state(false);

  const filteredTemplates = $derived(
    !searchQuery.trim()
      ? templates
      : (() => {
          const query = searchQuery.toLowerCase();
          return templates.filter(
            (t) =>
              t.name.toLowerCase().includes(query) ||
              t.description.toLowerCase().includes(query) ||
              t.id.toLowerCase().includes(query),
          );
        })(),
  );

  async function loadTemplates() {
    loading = true;
    try {
      templates = await widgetTemplatesService.loadTemplates();
    } catch (e) {
      logger.error('WidgetTemplates', 'loadTemplates', `Failed to load templates: ${e}`, {
        error: e,
      });
    } finally {
      loading = false;
    }
  }

  async function handleApplyTemplate(templateId: string) {
    loading = true;
    try {
      await widgetTemplatesService.applyTemplate(templateId);
      onClose();
      if (onApply) onApply();
      toast.success('Template applied');
    } catch (e) {
      logger.error('WidgetTemplates', 'handleApplyTemplate', `Failed to apply template: ${e}`, {
        error: e,
      });
      toast.error('Failed to apply template');
    } finally {
      loading = false;
    }
  }

  async function handleDeleteTemplate(templateId: string, e: MouseEvent) {
    e.stopPropagation();
    try {
      await widgetTemplatesService.deleteTemplate(templateId);
      await loadTemplates();
      toast.success('Template deleted');
    } catch (e) {
      logger.error('WidgetTemplates', 'handleDeleteTemplate', `Failed to delete template: ${e}`, {
        error: e,
      });
      toast.error('Failed to delete template');
    }
  }

  async function handleSaveCurrentLayout() {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    savingTemplate = true;
    try {
      await widgetTemplatesService.saveCurrentLayoutAsTemplate(
        newTemplateName.trim(),
        newTemplateDescription.trim() || 'Custom template',
      );
      showSaveDialog = false;
      newTemplateName = '';
      newTemplateDescription = '';
      await loadTemplates();
      toast.success('Template saved');
    } catch (e) {
      logger.error('WidgetTemplates', 'handleSaveCurrentLayout', `Failed to save template: ${e}`, {
        error: e,
      });
      toast.error('Failed to save template');
    } finally {
      savingTemplate = false;
    }
  }

  function handleClose() {
    searchQuery = '';
    showSaveDialog = false;
    newTemplateName = '';
    newTemplateDescription = '';
    previewTemplate = null;
    previewModalOpen = false;
    hoveredTemplateId = null;
    onClose();
  }

  onMount(() => {
    if (open) {
      loadTemplates();
    }
  });

  $effect(() => {
    if (open) {
      loadTemplates();
    }
  });
</script>

<Modal
  bind:open
  onclose={handleClose}
  maxWidth="max-w-3xl"
  ariaLabel="Widget Templates"
  title="Layouts">
  <div class="px-6 sm:px-8 pb-6 sm:pb-7 flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">
        Apply a saved dashboard layout, or store your current one for later.
      </p>
      <Button variant="secondary" size="sm" onclick={() => (showSaveDialog = true)}>
        Save current
      </Button>
    </div>

    {#if showSaveDialog}
      <div
        class="p-4 rounded-lg border border-border-subtle bg-surface-muted/60"
        transition:fade={{ duration: 150 }}>
        <h3 class="text-xs uppercase tracking-[0.08em] font-semibold text-muted-foreground mb-3">
          Save current layout as template
        </h3>
        <div class="space-y-3">
          <Input
            id="template-name"
            label="Template name"
            bind:value={newTemplateName}
            placeholder="e.g. My custom layout"
            class="w-full" />
          <Input
            id="template-description"
            label="Description"
            bind:value={newTemplateDescription}
            placeholder="Optional"
            class="w-full" />
          <div class="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onclick={() => (showSaveDialog = false)}>Cancel</Button>
            <Button
              size="sm"
              onclick={handleSaveCurrentLayout}
              disabled={savingTemplate || !newTemplateName.trim()}>
              {savingTemplate ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    {/if}

    <SearchInput placeholder="Search layouts…" bind:value={searchQuery} class="w-full" />

    {#if loading}
      <div class="py-12 text-center text-muted-foreground">
        <div class="w-5 h-5 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-2"></div>
        <p class="text-sm">Loading layouts…</p>
      </div>
    {:else if filteredTemplates.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto -mx-1 px-1">
        {#each filteredTemplates as template (template.id)}
          <div
            role="button"
            tabindex="0"
            class="group relative flex flex-col gap-3 p-3 rounded-lg border border-border bg-card hover:border-border-strong hover:bg-surface-muted transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
            onmouseenter={() => (hoveredTemplateId = template.id)}
            onmouseleave={() => (hoveredTemplateId = null)}
            onclick={() => handleApplyTemplate(template.id)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleApplyTemplate(template.id);
              }
            }}>
            <div class="relative w-full h-28 rounded-md overflow-hidden bg-surface-muted border border-border-subtle">
              <TemplatePreview layout={template.layout} size="small" />
              {#if hoveredTemplateId === template.id}
                <div
                  class="absolute inset-0 bg-foreground/30 flex items-center justify-center"
                  transition:fade={{ duration: 120 }}>
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      previewTemplate = template;
                      previewModalOpen = true;
                    }}
                    class="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-card border border-border text-xs font-medium text-foreground shadow-sm">
                    <Icon src={Eye} class="w-3.5 h-3.5" />
                    Preview
                  </button>
                </div>
              {/if}
            </div>

            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-foreground truncate">{template.name}</h3>
                <p class="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {template.description}
                </p>
              </div>
              {#if template.isDefault}
                <span class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground border border-border-subtle rounded px-1.5 py-0.5 shrink-0">
                  Default
                </span>
              {/if}
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[11px] text-muted-foreground nums-tabular">
                {template.layout.widgets.filter((w) => w.enabled).length} widgets
              </span>
              <div class="flex items-center gap-1">
                {#if !template.isDefault}
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id, e);
                    }}
                    class="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                    aria-label="Delete template">
                    <Icon src={Trash} class="w-3.5 h-3.5" />
                  </button>
                {/if}
                <Button
                  size="sm"
                  variant="secondary"
                  onclick={() => handleApplyTemplate(template.id)}
                  disabled={loading}>
                  {loading ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="py-12 text-center text-muted-foreground">
        <p class="text-sm">No layouts found matching "{searchQuery}"</p>
      </div>
    {/if}

    <div class="flex justify-end pt-3 border-t border-border-subtle">
      <Button variant="ghost" size="sm" onclick={handleClose}>Close</Button>
    </div>
  </div>
</Modal>

{#if previewTemplate && previewModalOpen}
  <Modal
    open={previewModalOpen}
    onclose={() => {
      previewModalOpen = false;
      previewTemplate = null;
    }}
    maxWidth="max-w-3xl"
    ariaLabel="Template Preview"
    title={previewTemplate.name}>
    <div class="px-6 sm:px-8 pb-6 sm:pb-7 space-y-4">
      <p class="text-sm text-muted-foreground">{previewTemplate.description}</p>
      <TemplatePreview layout={previewTemplate.layout} size="large" showLabels={true} />
      <div class="flex justify-end gap-2 pt-3 border-t border-border-subtle">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => {
            previewModalOpen = false;
            previewTemplate = null;
          }}>
          Cancel
        </Button>
        <Button
          size="sm"
          onclick={async () => {
            if (previewTemplate) {
              const templateId = previewTemplate.id;
              previewModalOpen = false;
              previewTemplate = null;
              await handleApplyTemplate(templateId);
            }
          }}
          disabled={loading}>
          {loading ? 'Applying…' : 'Apply layout'}
        </Button>
      </div>
    </div>
  </Modal>
{/if}
