<script lang="ts">
  import { fade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { saveSettingsWithQueue, flushSettingsQueue } from '$lib/services/settingsSync';
  import { Icon, ChevronRight, LockClosed, ChartBar } from 'svelte-hero-icons';
  import { platformStore } from '$lib/stores/platform';
  import { checkStatus, authenticate } from '@choochmeque/tauri-plugin-biometry-api';
  import { get } from 'svelte/store';
  import { _ } from '../i18n';
  import T from './T.svelte';

  const t = () => get(_);

  interface Props {
    onComplete: () => void;
  }

  let { onComplete }: Props = $props();

  let supportsBiometric = $derived($platformStore.supportsBiometric);
  let isNativeMobile = $derived($platformStore.isNativeMobile);
  let showBiometricOnMobile = $derived(supportsBiometric && isNativeMobile);
  let hasCompletedBiometricPhase = $state(false);
  let phase = $state<'biometric' | 'usage_stats' | 'done'>('usage_stats');

  $effect(() => {
    if (showBiometricOnMobile && !hasCompletedBiometricPhase && phase === 'usage_stats') {
      phase = 'biometric';
    }
  });
  let biometricLoading = $state(false);
  let biometricError = $state<string | null>(null);

  async function enableBiometric() {
    biometricError = null;
    biometricLoading = true;
    try {
      const status = await checkStatus();
      if (!status.isAvailable) {
        biometricError =
          status.error ??
          t()('setup_assistant.biometric_unavailable', {
            default: 'Biometric authentication is not available on this device.',
          });
        biometricLoading = false;
        return;
      }
      await authenticate(t()('setup_assistant.biometric_title', { default: 'Unlock with biometrics' }), {
        allowDeviceCredential: true,
        cancelTitle: t()('setup_assistant.biometric_skip', { default: 'Skip for now' }),
        confirmationRequired: false,
      });
      hasCompletedBiometricPhase = true;
      await saveSettingsWithQueue({ biometric_enabled: true });
      await flushSettingsQueue();
      nextPhase();
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message?.includes('userCancel') || e.message?.includes('user cancel'))
      ) {
        skipBiometric();
      } else {
        biometricError = e instanceof Error ? e.message : String(e);
      }
    } finally {
      biometricLoading = false;
    }
  }

  async function skipBiometric() {
    hasCompletedBiometricPhase = true;
    await saveSettingsWithQueue({ biometric_enabled: false });
    await flushSettingsQueue();
    nextPhase();
  }

  function nextPhase() {
    if (phase === 'biometric') {
      phase = 'usage_stats';
    } else if (phase === 'usage_stats') {
      phase = 'done';
      complete();
    }
  }

  async function enableUsageStats() {
    await saveSettingsWithQueue({ send_anonymous_usage_statistics: true });
    await flushSettingsQueue();
    nextPhase();
  }

  async function declineUsageStats() {
    await saveSettingsWithQueue({ send_anonymous_usage_statistics: false });
    await flushSettingsQueue();
    nextPhase();
  }

  async function complete() {
    await saveSettingsWithQueue({ has_completed_post_login_prompts: true });
    await flushSettingsQueue();
    onComplete();
  }
</script>

<div
  class="fixed inset-0 z-[9998] flex flex-col bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800"
  role="dialog"
  aria-label={$_('post_login_prompts.aria_label', { default: 'Post-login setup' })}
  aria-live="polite">
  <div class="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 overflow-y-auto">
    {#key phase}
      <!-- Biometric prompt (full-screen) -->
      {#if phase === 'biometric'}
        <div
          class="max-w-md w-full text-center"
          in:fade={{ duration: 300, easing: cubicInOut }}
          out:fade={{ duration: 200, easing: cubicInOut }}>
          <div class="flex justify-center mb-8">
            <div
              class="p-6 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
              <Icon src={LockClosed} class="w-16 h-16 text-[var(--accent)]" />
            </div>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-4">
            <T key="setup_assistant.biometric_title" fallback="Unlock with biometrics" />
          </h2>
          <p class="text-zinc-600 dark:text-zinc-400 mb-10">
            <T
              key="setup_assistant.biometric_subtitle"
              fallback="Use Face ID, Touch ID, fingerprint, or Windows Hello to quickly unlock DesQTA when you open the app." />
          </p>
          {#if biometricError}
            <p class="text-sm text-red-500 dark:text-red-400 text-center mb-4">{biometricError}</p>
          {/if}
          <div class="flex flex-col gap-4">
            <button
              type="button"
              disabled={biometricLoading}
              onclick={enableBiometric}
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              style="background-color: var(--accent); --tw-ring-color: var(--accent);">
              {#if biometricLoading}
                <span class="animate-pulse"><T key="common.loading" fallback="Loading..." /></span>
              {:else}
                <T key="setup_assistant.biometric_enable" fallback="Enable biometric unlock" />
                <Icon src={ChevronRight} class="w-5 h-5" />
              {/if}
            </button>
            <button
              type="button"
              disabled={biometricLoading}
              onclick={skipBiometric}
              class="min-h-[44px] px-6 py-3 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-all duration-200 disabled:opacity-60">
              <T key="setup_assistant.biometric_skip" fallback="Skip for now" />
            </button>
          </div>
        </div>
      {/if}

      <!-- Usage stats prompt -->
      {#if phase === 'usage_stats'}
        <div
          class="max-w-md w-full text-center"
          in:fade={{ duration: 300, easing: cubicInOut }}
          out:fade={{ duration: 200, easing: cubicInOut }}>
          <div class="flex justify-center mb-8">
            <div
              class="p-6 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
              <Icon src={ChartBar} class="w-16 h-16 text-[var(--accent)]" />
            </div>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-4">
            <T key="post_login_prompts.usage_stats_title" fallback="Help improve DesQTA" />
          </h2>
          <p class="text-zinc-600 dark:text-zinc-400 mb-10">
            <T
              key="post_login_prompts.usage_stats_subtitle"
              fallback="Would you like to send anonymous usage statistics? This helps us understand how the app is used and improve it. No personal data is collected." />
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onclick={enableUsageStats}
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style="background-color: var(--accent); --tw-ring-color: var(--accent);">
              <T key="post_login_prompts.usage_stats_yes" fallback="Yes, help improve DesQTA" />
              <Icon src={ChevronRight} class="w-5 h-5" />
            </button>
            <button
              type="button"
              onclick={declineUsageStats}
              class="min-h-[44px] px-6 py-3 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-all duration-200">
              <T key="post_login_prompts.usage_stats_no" fallback="No thanks" />
            </button>
          </div>
        </div>
      {/if}
    {/key}
  </div>
</div>
