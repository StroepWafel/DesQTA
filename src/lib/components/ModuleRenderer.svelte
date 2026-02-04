<script lang="ts">
  import { fade } from 'svelte/transition';
  import { sanitizeHtml } from '../../utils/sanitization';
  import LinkPreview from '../../routes/courses/components/LinkPreview.svelte';
  import { renderModule } from '../utils/moduleUtils';
  import type { RenderedModule } from '../utils/moduleUtils';
  import type {
    ResourceLink,
    LinkPreview as LinkPreviewType,
    Module,
  } from '../../routes/courses/types';

  let {
    renderedModule,
    index = 0,
    enableLinkPreviews = false,
    linkPreview = null,
    onResourceClick,
    allModules = [],
  }: {
    renderedModule: RenderedModule;
    index?: number;
    enableLinkPreviews?: boolean;
    linkPreview?: LinkPreviewType | null | ((url: string) => LinkPreviewType | null);
    onResourceClick?: (resource: ResourceLink) => void;
    allModules?: Module[];
  } = $props();

  function getLinkPreview(url: string): LinkPreviewType | null {
    if (!enableLinkPreviews) return null;
    if (typeof linkPreview === 'function') {
      return linkPreview(url);
    }
    return linkPreview;
  }

  // Calculate animation delay based on index
  const animationDelay = index * 100;
</script>

{#if renderedModule.type === 'title'}
  <h2
    class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg"
    transition:fade={{ duration: 200, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    {renderedModule.content}
  </h2>
{:else if renderedModule.type === 'text'}
  <div
    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 hover:shadow-lg hover:scale-[1.01] active:scale-95 transition-all duration-300"
    transition:fade={{ duration: 300, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    {@html sanitizeHtml(renderedModule.content)}
  </div>
{:else if renderedModule.type === 'table'}
  <div
    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 overflow-x-auto"
    transition:fade={{ duration: 300, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    <div
      class="max-w-full [&_table]:w-full [&_table]:border-collapse [&_table_td]:p-2 [&_table_td]:border [&_table_td]:border-zinc-300 [&_table_td]:dark:border-zinc-600 [&_table_td]:text-zinc-900 [&_table_td]:dark:text-zinc-100 [&_table_th]:p-2 [&_table_th]:border [&_table_th]:border-zinc-300 [&_table_th]:dark:border-zinc-600 [&_table_th]:bg-zinc-100 [&_table_th]:dark:bg-zinc-700 [&_table_th]:font-semibold [&_table_th]:text-zinc-900 [&_table_th]:dark:text-zinc-100 [&_table_a]:text-accent-600 [&_table_a]:dark:text-accent-400 [&_table_a]:hover:underline">
      {@html sanitizeHtml(renderedModule.content)}
    </div>
  </div>
{:else if renderedModule.type === 'resources'}
  {@const resources = Array.isArray(renderedModule.content) ? renderedModule.content : []}
  <div
    class="mb-6"
    transition:fade={{ duration: 300, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    <h3 class="text-lg font-semibold mb-3 text-white">Resources</h3>
    <div class="space-y-2">
      {#each resources as resource, resourceIndex}
        {#if onResourceClick}
          <button
            type="button"
            class="w-full p-3 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50 hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer text-left"
            transition:fade={{ duration: 200, delay: animationDelay + (resourceIndex + 1) * 50 }}
            style="transform-origin: left center;"
            onclick={() => onResourceClick(resource)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onResourceClick(resource);
              }
            }}>
            <p class="text-white">{resource.filename}</p>
          </button>
        {:else}
          <div
            class="p-3 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50"
            transition:fade={{ duration: 200, delay: animationDelay + (resourceIndex + 1) * 50 }}
            style="transform-origin: left center;">
            <p class="text-white">{resource.filename}</p>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{:else if renderedModule.type === 'link'}
  <div
    class="mb-6"
    transition:fade={{ duration: 200, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    {#if enableLinkPreviews && getLinkPreview(renderedModule.content)}
      <LinkPreview url={renderedModule.content} preview={getLinkPreview(renderedModule.content)} />
    {:else}
      <a
        href={renderedModule.content}
        target="_blank"
        rel="noopener noreferrer"
        class="text-indigo-400 underline hover:text-purple-300 transition-colors duration-200">
        {renderedModule.content}
      </a>
    {/if}
  </div>
{:else if renderedModule.type === 'columnLayout'}
  {@const col1 = Array.isArray(renderedModule.content?.col1) ? renderedModule.content.col1 : []}
  {@const col2 = Array.isArray(renderedModule.content?.col2) ? renderedModule.content.col2 : []}
  {@const col3 = Array.isArray(renderedModule.content?.col3) ? renderedModule.content.col3 : []}
  {@const hasCol1 = col1.length > 0}
  {@const hasCol2 = col2.length > 0}
  {@const hasCol3 = col3.length > 0}
  {@const columnCount = [hasCol1, hasCol2, hasCol3].filter(Boolean).length}
  {@const gridClasses =
    renderedModule.content.layoutStyle === 'equal-widths'
      ? columnCount === 3
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : columnCount === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1'
      : 'grid-cols-1 md:grid-cols-2'}
  <div
    class="mb-6"
    transition:fade={{ duration: 300, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    <div class="grid gap-4 {gridClasses}">
      {#if col1.length > 0}
        <div class="space-y-4">
          {#each col1 as moduleUuid}
            {@const module = allModules.find((m) => m.uuid === moduleUuid)}
            {#if module}
              {@const rendered = renderModule(module, allModules)}
              {#if rendered}
                {@const nestedIndex = index + 1}
                {@const nestedDelay = nestedIndex * 100}
                {#if rendered.type === 'title'}
                  <h2
                    class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg"
                    transition:fade={{ duration: 200, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {rendered.content}
                  </h2>
                {:else if rendered.type === 'text'}
                  <div
                    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 hover:shadow-lg hover:scale-[1.01] active:scale-95 transition-all duration-300"
                    transition:fade={{ duration: 300, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {@html sanitizeHtml(rendered.content)}
                  </div>
                {:else if rendered.type === 'link'}
                  <div
                    class="mb-6"
                    transition:fade={{ duration: 200, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {#if enableLinkPreviews && getLinkPreview(rendered.content)}
                      <LinkPreview
                        url={rendered.content}
                        preview={getLinkPreview(rendered.content)} />
                    {:else}
                      <a
                        href={rendered.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-indigo-400 underline hover:text-purple-300 transition-colors duration-200">
                        {rendered.content}
                      </a>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          {/each}
        </div>
      {/if}
      {#if col2.length > 0}
        <div class="space-y-4">
          {#each col2 as moduleUuid}
            {@const module = allModules.find((m) => m.uuid === moduleUuid)}
            {#if module}
              {@const rendered = renderModule(module, allModules)}
              {#if rendered}
                {@const nestedIndex = index + 1}
                {@const nestedDelay = nestedIndex * 100}
                {#if rendered.type === 'title'}
                  <h2
                    class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg"
                    transition:fade={{ duration: 200, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {rendered.content}
                  </h2>
                {:else if rendered.type === 'text'}
                  <div
                    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 hover:shadow-lg hover:scale-[1.01] active:scale-95 transition-all duration-300"
                    transition:fade={{ duration: 300, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {@html sanitizeHtml(rendered.content)}
                  </div>
                {:else if rendered.type === 'link'}
                  <div
                    class="mb-6"
                    transition:fade={{ duration: 200, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {#if enableLinkPreviews && getLinkPreview(rendered.content)}
                      <LinkPreview
                        url={rendered.content}
                        preview={getLinkPreview(rendered.content)} />
                    {:else}
                      <a
                        href={rendered.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-indigo-400 underline hover:text-purple-300 transition-colors duration-200">
                        {rendered.content}
                      </a>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          {/each}
        </div>
      {/if}
      {#if col3.length > 0}
        <div class="space-y-4">
          {#each col3 as moduleUuid}
            {@const module = allModules.find((m) => m.uuid === moduleUuid)}
            {#if module}
              {@const rendered = renderModule(module, allModules)}
              {#if rendered}
                {@const nestedIndex = index + 1}
                {@const nestedDelay = nestedIndex * 100}
                {#if rendered.type === 'title'}
                  <h2
                    class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg"
                    transition:fade={{ duration: 200, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {rendered.content}
                  </h2>
                {:else if rendered.type === 'text'}
                  <div
                    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50 hover:shadow-lg hover:scale-[1.01] active:scale-95 transition-all duration-300"
                    transition:fade={{ duration: 300, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {@html sanitizeHtml(rendered.content)}
                  </div>
                {:else if rendered.type === 'link'}
                  <div
                    class="mb-6"
                    transition:fade={{ duration: 200, delay: nestedDelay }}
                    style="transform-origin: left center; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {nestedDelay}ms both;">
                    {#if enableLinkPreviews && getLinkPreview(rendered.content)}
                      <LinkPreview
                        url={rendered.content}
                        preview={getLinkPreview(rendered.content)} />
                    {:else}
                      <a
                        href={rendered.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-indigo-400 underline hover:text-purple-300 transition-colors duration-200">
                        {rendered.content}
                      </a>
                    {/if}
                  </div>
                {/if}
              {/if}
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>
{:else if renderedModule.type === 'formula'}
  {@const formulaContent = renderedModule.content?.formula || ''}
  {@const formulaScale = renderedModule.content?.scale}
  <div
    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50"
    transition:fade={{ duration: 300, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    <div class="flex items-center gap-4">
      <div class="flex-1">
        <div class="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Formula</div>
        <div class="text-lg font-mono text-zinc-900 dark:text-white">
          {formulaContent}
        </div>
      </div>
      {#if formulaScale && formulaScale !== '1'}
        <div class="text-sm text-zinc-600 dark:text-zinc-400">
          Scale: {formulaScale}x
        </div>
      {/if}
    </div>
  </div>
{:else if renderedModule.type === 'poll'}
  {@const pollOptions = Array.isArray(renderedModule.content?.options)
    ? renderedModule.content.options
    : []}
  <div
    class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50"
    transition:fade={{ duration: 300, delay: animationDelay }}
    style="transform-origin: left center; animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {animationDelay}ms both;">
    <h3 class="text-lg font-semibold mb-3 text-white">
      {renderedModule.content?.proposition || ''}
    </h3>
    <div class="space-y-2">
      {#each pollOptions as option, optionIndex}
        <div
          class="p-3 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >{String.fromCharCode(65 + optionIndex)}.</span>
            <span class="text-white">{option}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
