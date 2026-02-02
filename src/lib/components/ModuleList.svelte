<script lang="ts">
  import ModuleRenderer from './ModuleRenderer.svelte';
  import { renderModule, sortModules, isColumnLayoutModule } from '../utils/moduleUtils';
  import type { Module, ResourceLink } from '../../routes/courses/types';
  import type { LinkPreview } from '../../routes/courses/types';

  let {
    modules,
    filterByParentModule = false,
    enableLinkPreviews = false,
    linkPreview = null,
    onResourceClick,
  }: {
    modules: Module[];
    filterByParentModule?: boolean;
    enableLinkPreviews?: boolean;
    linkPreview?: Map<string, LinkPreview | null> | ((url: string) => LinkPreview | null) | null;
    onResourceClick?: (resource: ResourceLink) => void;
  } = $props();

  // Find all column layout module UUIDs to filter out their children
  const columnLayoutUuids = $derived(
    new Set(modules.filter((m) => isColumnLayoutModule(m)).map((m) => m.uuid)),
  );

  // Filter out modules that are children of column layout modules
  const filteredModules = $derived(
    modules.filter((m) => !m.parentModule || !columnLayoutUuids.has(m.parentModule)),
  );

  const sortedModules = $derived(sortModules(filteredModules, { filterByParentModule }));

  function getLinkPreview(url: string): LinkPreview | null {
    if (!enableLinkPreviews || !linkPreview) return null;
    if (linkPreview instanceof Map) {
      return linkPreview.get(url) || null;
    }
    if (typeof linkPreview === 'function') {
      return linkPreview(url);
    }
    return null;
  }
</script>

<div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
  {#each sortedModules as module, i}
    {@const renderedModule = renderModule(module, filteredModules)}
    {#if renderedModule}
      <ModuleRenderer
        {renderedModule}
        index={i}
        {enableLinkPreviews}
        linkPreview={getLinkPreview(renderedModule.type === 'link' ? renderedModule.content : '')}
        {onResourceClick}
        allModules={modules} />
    {/if}
  {/each}
</div>
