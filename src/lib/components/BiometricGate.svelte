<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Icon, LockClosed } from 'svelte-hero-icons';
  import { checkStatus, authenticate } from '@choochmeque/tauri-plugin-biometry-api';
  import { get } from 'svelte/store';
  import { _ } from '../i18n';
  import T from './T.svelte';

  const t = () => get(_);

  interface Props {
    onUnlock: () => void;
    onBiometryUnavailable?: () => void;
  }

  let { onUnlock, onBiometryUnavailable }: Props = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);

  async function handleAuthenticate() {
    error = null;
    loading = true;
    try {
      await authenticate(t()('setup_assistant.biometric_title', { default: 'Unlock with biometrics' }), {
        allowDeviceCredential: true,
        cancelTitle: t()('common.cancel', { default: 'Cancel' }),
        confirmationRequired: false,
      });
      onUnlock();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('userCancel') || msg.toLowerCase().includes('user cancel')) {
        error = null;
      } else if (
        msg.includes('biometryNotEnrolled') ||
        msg.includes('biometryNotAvailable') ||
        msg.includes('biometry not enrolled') ||
        msg.includes('biometry not available')
      ) {
        onBiometryUnavailable?.();
      } else {
        error = msg;
      }
    } finally {
      loading = false;
    }
  }

  import { onMount } from 'svelte';

  onMount(async () => {
    const status = await checkStatus();
    if (!status.isAvailable) {
      onBiometryUnavailable?.();
      return;
    }
    handleAuthenticate();
  });
</script>

<div
  class="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800"
  in:fade={{ duration: 200 }}
  out:fade={{ duration: 200 }}
  role="dialog"
  aria-label={$_('setup_assistant.biometric_title', { default: 'Unlock with biometrics' })}>
  <div class="max-w-sm w-full text-center px-6">
    <div
      class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center">
      <Icon src={LockClosed} class="w-10 h-10 text-[var(--accent)]" />
    </div>
    <h2 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">
      <T key="setup_assistant.biometric_title" fallback="Unlock with biometrics" />
    </h2>
    <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
      <T
        key="setup_assistant.biometric_subtitle"
        fallback="Use Face ID, Touch ID, fingerprint, or Windows Hello to unlock DesQTA." />
    </p>
    {#if error}
      <p class="text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>
    {/if}
    <button
      type="button"
      disabled={loading}
      onclick={handleAuthenticate}
      class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60"
      style="background-color: var(--accent); --tw-ring-color: var(--accent);">
      {#if loading}
        <span class="animate-pulse"><T key="common.loading" fallback="Loading..." /></span>
      {:else}
        <T key="setup_assistant.biometric_unlock" fallback="Unlock" />
      {/if}
    </button>
  </div>
</div>
