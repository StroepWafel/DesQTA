<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, ArrowTopRightOnSquare, GlobeAlt } from 'svelte-hero-icons';
  import Modal from './Modal.svelte';
  import { _ } from '../i18n';
  import ModuleList from './ModuleList.svelte';
  import type { ParsedDocument } from '../../routes/courses/types';
  import { invoke } from '@tauri-apps/api/core';
  import { normalizeEmbedUrl } from '$lib/utils/urlUtil';
  import { logger } from '../../utils/logger';
  import WidgetCard from './dashboard/WidgetCard.svelte';

  let portalUrl = $state<string>('');
  let loadingPortal = $state<boolean>(true);
  let portalError = $state<string>('');
  let showPortalModal = $state(false);
  let showDefaultContent = $state<boolean>(false);
  let parsedPortalDocument = $state<ParsedDocument | null>(null);

  function setPortalUrlFromRaw(raw: string | null | undefined): boolean {
    const normalized = normalizeEmbedUrl(raw);
    if (normalized) {
      portalUrl = normalized;
      return true;
    }
    return false;
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
            if (!setPortalUrlFromRaw(payload.url)) {
              logger.warn('WelcomePortal', 'loadPortal', 'Invalid portal URL', {
                url: payload.url,
              });
              showDefaultContent = true;
            }
          } else {
            // Use Rust-side HTML parsing to extract iframe src
            try {
              const iframeSrc = await invoke<string | null>('extract_iframe_src_command', {
                html: payload.contents,
              });
              if (!setPortalUrlFromRaw(iframeSrc)) {
                showDefaultContent = true;
              }
            } catch (e) {
              logger.error('WelcomePortal', 'loadPortal', `Error extracting iframe src: ${e}`, {
                error: e,
              });
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

  // Portal action to move modal to body (bypasses overflow clipping in widget)
  function portalAction(node: HTMLElement) {
    if (node.parentNode !== document.body) {
      document.body.appendChild(node);
    }
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }

  onMount(async () => {
    await loadPortal();
  });
</script>

<WidgetCard
  icon={GlobeAlt}
  title={$_('welcome_portal.title') || 'Welcome Portal'}
  loading={loadingPortal}
  flush>
  {#snippet headerAction()}
    <button
      onclick={() => (showPortalModal = true)}
      class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em] font-semibold">
      {$_('welcome_portal.open_full_screen') || 'Full screen'}
      <Icon src={ArrowTopRightOnSquare} class="w-3.5 h-3.5" />
    </button>
  {/snippet}

  <div class="h-full w-full">
    {#if portalError}
      <div class="flex flex-col justify-center items-center h-full text-destructive">
        <p>{portalError}</p>
      </div>
    {:else if showDefaultContent}
      <div class="h-full overflow-y-auto px-4 pb-4 text-foreground">
        <div class="space-y-5 max-w-prose">
          <h2 class="text-xl font-semibold tracking-tight">
            {$_('welcome_portal.welcome_title') || 'Welcome to DesQTA!'}
          </h2>
          <section>
            <h3 class="text-sm font-semibold mb-1 uppercase tracking-[0.06em] text-muted-foreground">
              {$_('welcome_portal.getting_around_title') || 'Getting around'}
            </h3>
            <p class="text-sm leading-relaxed text-foreground/90">
              {$_('welcome_portal.getting_around_p1') ||
                "Use the menu on the left to navigate. If you're on a small screen, the menu hides automatically, but you can summon it using the menu button in the corner."}
            </p>
            <p class="text-sm leading-relaxed text-foreground/90 mt-2">
              {$_('welcome_portal.getting_around_p2') ||
                'Use the menu to explore and see what you can find. Note that your school may not be using all of the pages.'}
            </p>
          </section>
          <section>
            <h3 class="text-sm font-semibold mb-1 uppercase tracking-[0.06em] text-muted-foreground">
              {$_('welcome_portal.dashboard_title') || 'Your dashboard'}
            </h3>
            <p class="text-sm leading-relaxed text-foreground/90">
              {$_('welcome_portal.dashboard_p1') ||
                "The dashboard page includes dashlets which your school has enabled (and which you can't disable!), as well as optional dashlets that you can toggle on or off."}
            </p>
          </section>
          <section>
            <h3 class="text-sm font-semibold mb-1 uppercase tracking-[0.06em] text-muted-foreground">
              {$_('welcome_portal.timetable_title') || 'Colour your timetable'}
            </h3>
            <p class="text-sm leading-relaxed text-foreground/90">
              {$_('welcome_portal.timetable_p1') ||
                'On the timetable page, tap (or click) on a class to access more details, then tap the palette button to colour up your timetable.'}
            </p>
          </section>
        </div>
      </div>
    {:else if parsedPortalDocument?.document?.modules}
      <div class="h-full overflow-y-auto px-4 pb-4 text-foreground">
        <ModuleList modules={parsedPortalDocument.document.modules} filterByParentModule={true} />
      </div>
    {:else if portalUrl}
      <iframe src={portalUrl} class="w-full h-full border-0" title="Welcome Portal"></iframe>
    {/if}
  </div>
</WidgetCard>

<!-- Portaled to body to escape widget overflow constraints -->
<div use:portalAction>
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
    <div class="h-full overflow-y-auto p-6 text-white">
      <ModuleList modules={parsedPortalDocument.document.modules} filterByParentModule={true} />
    </div>
  {:else if portalUrl}
    <iframe src={portalUrl} class="w-full h-full rounded-2xl border-0" title="Welcome Portal"
    ></iframe>
  {/if}
  </Modal>
</div>
