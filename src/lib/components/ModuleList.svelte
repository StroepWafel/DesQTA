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
    failedResourceIds = new Set<string>(),
    compact = false,
  }: {
    modules: Module[];
    filterByParentModule?: boolean;
    enableLinkPreviews?: boolean;
    linkPreview?: Map<string, LinkPreview | null> | ((url: string) => LinkPreview | null) | null;
    onResourceClick?: (resource: ResourceLink) => void;
    failedResourceIds?: Set<string>;
    compact?: boolean;
  } = $props();

  // Guard against null/undefined modules (can occur during navigation teardown)
  const safeModules = $derived(Array.isArray(modules) ? modules : []);

  // Find all column layout module UUIDs to filter out their children
  const columnLayoutUuids = $derived(
    new Set(safeModules.filter((m) => isColumnLayoutModule(m)).map((m) => m.uuid)),
  );

  // Filter out modules that are children of column layout modules
  const filteredModules = $derived(
    safeModules.filter((m) => !m.parentModule || !columnLayoutUuids.has(m.parentModule)),
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

<div
  class="max-w-none prose prose-zinc dark:prose-invert prose-indigo {compact
    ? 'space-y-0 [&>*]:mb-0'
    : ''}">
  {#each sortedModules as module, i}
    {@const renderedModule = renderModule(module, filteredModules)}
    {#if renderedModule}
        <ModuleRenderer
        {renderedModule}
        index={i}
        {enableLinkPreviews}
        {compact}
        {failedResourceIds}
        linkPreview={getLinkPreview(renderedModule.type === 'link' ? renderedModule.content : '')}
        {onResourceClick}
        allModules={safeModules} />
    {/if}
  {/each}
</div>
