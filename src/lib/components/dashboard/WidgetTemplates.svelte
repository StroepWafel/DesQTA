<script lang="ts">
  import Modal from '../Modal.svelte';
  import { Button, Input, SearchInput } from '../ui';
  import { Icon, Trash, Check, Eye } from 'svelte-hero-icons';
  import { fade, scale, fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { widgetTemplatesService, type WidgetTemplate } from '../../services/widgetTemplates';
  import TemplatePreview from './TemplatePreview.svelte';
  import { logger } from '../../../utils/logger';
  import { onMount } from 'svelte';

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
      // Close modal first
      onClose();
      // Trigger layout reload via callback (no page reload needed)
      if (onApply) {
        onApply();
      }
    } catch (e) {
      logger.error('WidgetTemplates', 'handleApplyTemplate', `Failed to apply template: ${e}`, {
        error: e,
      });
      alert('Failed to apply template. Please try again.');
    } finally {
      loading = false;
    }
  }

  async function handleDeleteTemplate(templateId: string, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await widgetTemplatesService.deleteTemplate(templateId);
      await loadTemplates();
    } catch (e) {
      logger.error('WidgetTemplates', 'handleDeleteTemplate', `Failed to delete template: ${e}`, {
        error: e,
      });
    }
  }

  async function handleSaveCurrentLayout() {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name');
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
    } catch (e) {
      logger.error('WidgetTemplates', 'handleSaveCurrentLayout', `Failed to save template: ${e}`, {
        error: e,
      });
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
  maxWidth="max-w-4xl"
  ariaLabel="Widget Templates"
  className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">Widget Templates</h2>
      <Button onclick={() => (showSaveDialog = true)}>Save Current Layout</Button>
    </div>

    {#if showSaveDialog}
      <div
        class="mb-6 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h3 class="font-semibold text-zinc-900 dark:text-white mb-4">
          Save Current Layout as Template
        </h3>
        <div class="space-y-4">
          <div class="space-y-2">
            <label for="template-name" class="text-sm font-medium text-zinc-900 dark:text-white"
              >Template Name</label>
            <Input
              id="template-name"
              bind:value={newTemplateName}
              placeholder="e.g., My Custom Layout"
              class="w-full" />
          </div>
          <div class="space-y-2">
            <label
              for="template-description"
              class="text-sm font-medium text-zinc-900 dark:text-white"
              >Description (optional)</label>
            <Input
              id="template-description"
              bind:value={newTemplateDescription}
              placeholder="Describe this template..."
              class="w-full" />
          </div>
          <div class="flex gap-2">
            <Button
              onclick={handleSaveCurrentLayout}
              disabled={savingTemplate || !newTemplateName.trim()}>
              {savingTemplate ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="ghost" onclick={() => (showSaveDialog = false)}>Cancel</Button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Search -->
    <div class="mb-6">
      <SearchInput placeholder="Search templates..." bind:value={searchQuery} class="w-full" />
    </div>

    <!-- Templates Grid -->
    {#if loading}
      <div class="py-12 text-center text-zinc-600 dark:text-zinc-400">
        <div
          class="w-8 h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"
          style="animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;">
        </div>
        <p class="text-sm font-medium">Loading templates...</p>
      </div>
    {:else if filteredTemplates.length > 0}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
        {#each filteredTemplates as template, index (template.id)}
          <div
            role="button"
            tabindex="0"
            class="group relative flex flex-col gap-3 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm shadow-md hover:shadow-xl hover:border-accent-500/60 transition-all duration-300 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            style="transform-origin: center center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {index *
              100}ms both;"
            onmouseenter={() => (hoveredTemplateId = template.id)}
            onmouseleave={() => (hoveredTemplateId = null)}
            onclick={() => handleApplyTemplate(template.id)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleApplyTemplate(template.id);
              }
            }}>
            <!-- Template Preview -->
            <div
              class="relative w-full h-32 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <TemplatePreview layout={template.layout} size="small" />
              <!-- Preview overlay on hover -->
              {#if hoveredTemplateId === template.id}
                <div
                  class="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center transition-all duration-200"
                  transition:fade={{ duration: 200 }}>
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      previewTemplate = template;
                      previewModalOpen = true;
                    }}
                    class="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-900 dark:text-white shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
                    style="transform-origin: center center;">
                    <Icon src={Eye} class="w-4 h-4" />
                    Preview
                  </button>
                </div>
              {/if}
            </div>

            <!-- Template Info -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-zinc-900 dark:text-white mb-1 truncate">
                  {template.name}
                </h3>
                <p class="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {template.description}
                </p>
              </div>
              {#if template.isDefault}
                <span
                  class="px-2 py-1 text-xs font-medium rounded-lg bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 backdrop-blur-sm shrink-0">
                  Default
                </span>
              {/if}
            </div>

            <!-- Widget count and actions -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{template.layout.widgets.filter((w) => w.enabled).length} widgets</span>
              </div>
              <div class="flex items-center gap-1">
                {#if !template.isDefault}
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id, e);
                    }}
                    class="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    aria-label="Delete template"
                    style="transform-origin: center center;">
                    <Icon src={Trash} class="w-4 h-4" />
                  </button>
                {/if}
                <Button
                  onclick={() => handleApplyTemplate(template.id)}
                  disabled={loading}
                  class="px-3 py-1.5 text-xs h-auto transition-all duration-200">
                  {loading ? 'Applying...' : 'Apply'}
                </Button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="py-12 text-center text-zinc-600 dark:text-zinc-400">
        <p class="text-sm">No templates found matching "{searchQuery}"</p>
      </div>
    {/if}

    <!-- Preview Modal -->
    {#if previewTemplate && previewModalOpen}
      <Modal
        open={previewModalOpen}
        onclose={() => {
          previewModalOpen = false;
          previewTemplate = null;
        }}
        maxWidth="max-w-3xl"
        ariaLabel="Template Preview"
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-xl font-bold text-zinc-900 dark:text-white">
                {previewTemplate.name}
              </h3>
              <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {previewTemplate.description}
              </p>
            </div>
            <Button
              variant="ghost"
              onclick={() => {
                previewModalOpen = false;
                previewTemplate = null;
              }}>
              Close
            </Button>
          </div>
          <div class="mb-4">
            <TemplatePreview layout={previewTemplate.layout} size="large" showLabels={true} />
          </div>
          <div class="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              variant="ghost"
              onclick={() => {
                previewModalOpen = false;
                previewTemplate = null;
              }}>
              Cancel
            </Button>
            <Button
              onclick={async () => {
                if (previewTemplate) {
                  const templateId = previewTemplate.id;
                  previewModalOpen = false;
                  previewTemplate = null;
                  await handleApplyTemplate(templateId);
                }
              }}
              disabled={loading}>
              {loading ? 'Applying...' : 'Apply Template'}
            </Button>
          </div>
        </div>
      </Modal>
    {/if}

    <div class="flex justify-end mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
      <Button variant="ghost" onclick={handleClose}>Close</Button>
    </div>
  </div>
</Modal>
