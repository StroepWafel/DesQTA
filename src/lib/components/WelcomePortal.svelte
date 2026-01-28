<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, ArrowTopRightOnSquare } from 'svelte-hero-icons';
  import Modal from './Modal.svelte';
  import { _ } from '../i18n';
  import { sanitizeHtml } from '../../utils/sanitization';
  import { renderDraftJSText } from '../../routes/courses/utils';
  import type {
    Module,
    TitleModule,
    TextBlockModule,
    ResourceModule,
    LinkModule,
    ParsedDocument,
    ResourceLink,
  } from '../../routes/courses/types';

  let portalUrl = $state<string>('');
  let loadingPortal = $state<boolean>(true);
  let portalError = $state<string>('');
  let showPortalModal = $state(false);
  let showDefaultContent = $state<boolean>(false);
  let parsedPortalDocument = $state<ParsedDocument | null>(null);

  // Module type checking functions (same as CourseContent)
  function isModule<T extends Module>(
    module: Module,
    contentCheck: (content: any) => boolean,
  ): module is T {
    return 'content' in module && contentCheck(module.content);
  }

  function isTitleModule(module: Module): module is TitleModule {
    return isModule(module, (content) => content && typeof content.value === 'string');
  }

  function isTextBlockModule(module: Module): module is TextBlockModule {
    return isModule(module, (content) => content && content.content && content.content.blocks);
  }

  function isResourceModule(module: Module): module is ResourceModule {
    return isModule(module, (content) => content && content.value && content.value.resources);
  }

  function isLinkModule(module: Module): module is LinkModule {
    return isModule(module, (content) => content && content.url);
  }

  type RenderedModule =
    | { type: 'title'; content: string }
    | { type: 'text'; content: string }
    | { type: 'resources'; content: ResourceLink[] }
    | { type: 'link'; content: string };

  function renderModule(module: Module): RenderedModule | null {
    if (isTitleModule(module)) {
      return { type: 'title', content: module.content.value };
    } else if (isTextBlockModule(module)) {
      return {
        type: 'text',
        content: renderDraftJSText(module.content.content),
      };
    } else if (isResourceModule(module)) {
      return {
        type: 'resources',
        content: module.content.value.resources.filter((r) => r.selected),
      };
    } else if (isLinkModule(module)) {
      return { type: 'link', content: module.content.url };
    }
    return null;
  }

  function sortModules(modules: Module[]): Module[] {
    if (!modules || modules.length === 0) return [];

    // Filter out the container module (the one with parentModule === null)
    const contentModules = modules.filter((m) => m.parentModule !== null);
    if (contentModules.length === 0) return modules;

    const moduleMap = new Map<string, Module>();
    contentModules.forEach((module) => {
      moduleMap.set(module.uuid, module);
    });

    const firstModule = contentModules.find(
      (module) => !module.prevModule || !moduleMap.has(module.prevModule),
    );

    if (!firstModule) {
      return contentModules;
    }

    const orderedModules: Module[] = [];
    let currentModule: Module | undefined = firstModule;

    while (currentModule && orderedModules.length < modules.length) {
      orderedModules.push(currentModule);
      currentModule = currentModule.nextModule
        ? moduleMap.get(currentModule.nextModule)
        : undefined;
    }

    contentModules.forEach((module) => {
      if (!orderedModules.includes(module)) {
        orderedModules.push(module);
      }
    });

    return orderedModules;
  }

  async function loadPortal() {
    try {
      const response = await seqtaFetch('/seqta/student/load/portals?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { splash: true },
      });

      const data = JSON.parse(response);
      if (data.status === '200') {
        // Check if payload is empty or has no url/contents
        const payload = data.payload || {};
        const isEmptyPayload =
          Object.keys(payload).length === 0 ||
          (!payload.url && !payload.contents && !payload.is_power_portal);

        if (isEmptyPayload) {
          // Show default content when payload is empty
          showDefaultContent = true;
        } else if (payload.is_power_portal && payload.contents) {
          // Handle power portal with Draft.js content (same structure as lesson content)
          try {
            const contentsJson = JSON.parse(payload.contents);
            if (contentsJson.document && contentsJson.document.modules) {
              parsedPortalDocument = contentsJson as ParsedDocument;
            } else {
              showDefaultContent = true;
            }
          } catch (e) {
            console.error('Error parsing power portal content:', e);
            showDefaultContent = true;
          }
        } else if (payload.url || payload.contents) {
          if (payload.url) {
            portalUrl = payload.url;
          } else {
            // Use Rust-side HTML parsing to extract iframe src
            try {
              const iframeSrc = await invoke<string | null>('extract_iframe_src_command', {
                html: payload.contents
              });
              if (iframeSrc) {
                portalUrl = iframeSrc;
              } else {
                showDefaultContent = true;
              }
            } catch (e) {
              console.error('Error extracting iframe src:', e);
              showDefaultContent = true;
            }
          }
        } else {
          showDefaultContent = true;
        }
      } else {
        portalError = $_('welcome_portal.failed_to_load_url') || 'Failed to load portal URL';
      }
    } catch (e) {
      portalError = $_('welcome_portal.error_loading') || 'Error loading portal';
    } finally {
      loadingPortal = false;
    }
  }

  function closeModal() {
    showPortalModal = false;
  }

  onMount(async () => {
    await loadPortal();
  });
</script>

<div
  class="overflow-hidden relative rounded-2xl border shadow-xl backdrop-blur-xs bg-white/80 dark:bg-zinc-800/30 border-zinc-300/50 dark:border-zinc-700/50">
  <div
    class="flex justify-between items-center px-4 py-3 bg-linear-to-br border-b from-zinc-100/70 dark:from-zinc-800/70 to-zinc-100/30 dark:to-zinc-800/30 border-zinc-300/50 dark:border-zinc-700/50">
    <h3 class="text-xl font-semibold text-zinc-900 dark:text-white">
      {$_('welcome_portal.title') || 'Welcome Portal'}
    </h3>
    <button
      onclick={() => (showPortalModal = true)}
      class="px-3 py-1.5 text-sm rounded-lg transition-all duration-300 text-nowrap accent-text hover:accent-bg-hover hover:text-white">
      {$_('welcome_portal.open_full_screen') || 'Open Full Screen'}
      <Icon src={ArrowTopRightOnSquare} class="inline ml-1 w-4 h-4" />
    </button>
  </div>

  <div class="h-[400px]">
    {#if loadingPortal}
      <div class="flex flex-col justify-center items-center h-full">
        <div
          class="w-16 h-16 rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500">
        </div>
        <p class="mt-4 text-zinc-400">
          {$_('welcome_portal.loading') || 'Loading welcome portal...'}
        </p>
      </div>
    {:else if portalError}
      <div class="flex flex-col justify-center items-center h-full">
        <div
          class="w-20 h-20 flex items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600 text-3xl shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-gradient">
          ⚠️
        </div>
        <p class="mt-4 text-xl text-zinc-300">{portalError}</p>
      </div>
    {:else if showDefaultContent}
      <div class="h-full overflow-y-auto p-6 text-white">
        <div class="space-y-6">
          <div>
            <h2 class="text-2xl font-semibold mb-3">
              {$_('welcome_portal.welcome_title') || 'Welcome to DesQTA!'}
            </h2>
          </div>

          <div>
            <h3 class="text-xl font-semibold mb-2">
              {$_('welcome_portal.getting_around_title') || 'Getting around'}
            </h3>
            <p class="text-zinc-300 leading-relaxed">
              {$_('welcome_portal.getting_around_p1') ||
                "Use the menu on the left to navigate. If you're on a small screen, the menu hides automatically, but you can summon it using the menu button in the corner."}
            </p>
            <p class="text-zinc-300 leading-relaxed mt-2">
              {$_('welcome_portal.getting_around_p2') ||
                'Use the menu to explore and see what you can find. Note that your school may not be using all of the pages.'}
            </p>
          </div>

          <div>
            <h3 class="text-xl font-semibold mb-2">
              {$_('welcome_portal.dashboard_title') || 'Your dashboard'}
            </h3>
            <p class="text-zinc-300 leading-relaxed">
              {$_('welcome_portal.dashboard_p1') ||
                "The dashboard page includes dashlets which your school has enabled (and which you can't disable!), as well as optional dashlets that you can toggle on or off."}
            </p>
            <p class="text-zinc-300 leading-relaxed mt-2">
              {$_('welcome_portal.dashboard_p2') ||
                'Some dashlets help you to get organised, some give you key information, and some are just for fun.'}
            </p>
          </div>

          <div>
            <h3 class="text-xl font-semibold mb-2">
              {$_('welcome_portal.timetable_title') || 'Colour your timetable'}
            </h3>
            <p class="text-zinc-300 leading-relaxed">
              {$_('welcome_portal.timetable_p1') ||
                'On the timetable page, tap (or click) on a class to access more details -- and then tap the palette button to colour up your timetable.'}
            </p>
          </div>
        </div>
      </div>
    {:else if parsedPortalDocument?.document?.modules}
      {@const sortedModules = sortModules(parsedPortalDocument.document.modules)}
      <div class="h-full overflow-y-auto p-6 text-white">
        <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
          {#each sortedModules as module, i}
            {@const renderedModule = renderModule(module)}
            {#if renderedModule}
              {#if renderedModule.type === 'title'}
                <h2 class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
                  {renderedModule.content}
                </h2>
              {:else if renderedModule.type === 'text'}
                <div
                  class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
                  {@html sanitizeHtml(renderedModule.content)}
                </div>
              {:else if renderedModule.type === 'resources'}
                <div class="mb-6">
                  <h3 class="text-lg font-semibold mb-3 text-white">Resources</h3>
                  <div class="space-y-2">
                    {#each renderedModule.content as resource}
                      <div
                        class="p-3 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50">
                        <p class="text-white">{resource.filename}</p>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else if renderedModule.type === 'link'}
                <div class="mb-6">
                  <a
                    href={renderedModule.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-indigo-400 underline hover:text-purple-300">
                    {renderedModule.content}
                  </a>
                </div>
              {/if}
            {/if}
          {/each}
        </div>
      </div>
    {:else if portalUrl}
      <iframe src={portalUrl} class="w-full h-full border-0" title="Welcome Portal"></iframe>
    {/if}
  </div>
</div>

<Modal
  bind:open={showPortalModal}
  onclose={closeModal}
  maxWidth="w-[80%]"
  maxHeight="h-[80%]"
  className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
  ariaLabel={$_('welcome_portal.modal_aria_label') || 'Welcome Portal Modal'}>
  {#if showDefaultContent}
    <div class="h-full overflow-y-auto p-6 text-white">
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl font-semibold mb-3">
            {$_('welcome_portal.welcome_title') || 'Welcome to DesQTA!'}
          </h2>
        </div>

        <div>
          <h3 class="text-xl font-semibold mb-2">
            {$_('welcome_portal.getting_around_title') || 'Getting around'}
          </h3>
          <p class="text-zinc-300 leading-relaxed">
            {$_('welcome_portal.getting_around_p1') ||
              "Use the menu on the left to navigate. If you're on a small screen, the menu hides automatically, but you can summon it using the menu button in the corner."}
          </p>
          <p class="text-zinc-300 leading-relaxed mt-2">
            {$_('welcome_portal.getting_around_p2') ||
              'Use the menu to explore and see what you can find. Note that your school may not be using all of the pages.'}
          </p>
        </div>

        <div>
          <h3 class="text-xl font-semibold mb-2">
            {$_('welcome_portal.dashboard_title') || 'Your dashboard'}
          </h3>
          <p class="text-zinc-300 leading-relaxed">
            {$_('welcome_portal.dashboard_p1') ||
              "The dashboard page includes dashlets which your school has enabled (and which you can't disable!), as well as optional dashlets that you can toggle on or off."}
          </p>
          <p class="text-zinc-300 leading-relaxed mt-2">
            {$_('welcome_portal.dashboard_p2') ||
              'Some dashlets help you to get organised, some give you key information, and some are just for fun.'}
          </p>
        </div>

        <div>
          <h3 class="text-xl font-semibold mb-2">
            {$_('welcome_portal.timetable_title') || 'Colour your timetable'}
          </h3>
          <p class="text-zinc-300 leading-relaxed">
            {$_('welcome_portal.timetable_p1') ||
              'On the timetable page, tap (or click) on a class to access more details -- and then tap the palette button to colour up your timetable.'}
          </p>
        </div>
      </div>
    </div>
  {:else if parsedPortalDocument?.document?.modules}
    {@const sortedModules = sortModules(parsedPortalDocument.document.modules)}
    <div class="h-full overflow-y-auto p-6 text-white">
      <div class="max-w-none prose prose-zinc dark:prose-invert prose-indigo">
        {#each sortedModules as module, i}
          {@const renderedModule = renderModule(module)}
          {#if renderedModule}
            {#if renderedModule.type === 'title'}
              <h2 class="px-6 py-4 mb-4 text-xl font-bold text-white rounded-lg accent-bg">
                {renderedModule.content}
              </h2>
            {:else if renderedModule.type === 'text'}
              <div
                class="p-4 mb-6 rounded-xl border backdrop-blur-xs bg-white/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
                {@html sanitizeHtml(renderedModule.content)}
              </div>
            {:else if renderedModule.type === 'resources'}
              <div class="mb-6">
                <h3 class="text-lg font-semibold mb-3 text-white">Resources</h3>
                <div class="space-y-2">
                  {#each renderedModule.content as resource}
                    <div
                      class="p-3 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-800/50">
                      <p class="text-white">{resource.filename}</p>
                    </div>
                  {/each}
                </div>
              </div>
            {:else if renderedModule.type === 'link'}
              <div class="mb-6">
                <a
                  href={renderedModule.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-indigo-400 underline hover:text-purple-300">
                  {renderedModule.content}
                </a>
              </div>
            {/if}
          {/if}
        {/each}
      </div>
    </div>
  {:else if portalUrl}
    <iframe src={portalUrl} class="w-full h-full rounded-2xl border-0" title="Welcome Portal"
    ></iframe>
  {/if}
</Modal>
