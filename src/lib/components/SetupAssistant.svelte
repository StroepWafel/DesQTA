<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { saveSettingsWithQueue, flushSettingsQueue } from '$lib/services/settingsSync';
  import { Icon, ChevronRight, QrCode, GlobeAlt, ArrowRightOnRectangle } from 'svelte-hero-icons';
  import LanguageSelector from './LanguageSelector.svelte';
  import { get } from 'svelte/store';
  import { _ } from '../i18n';
  import T from './T.svelte';

  const t = () => get(_);

  interface Props {
    onComplete: () => void;
  }

  let { onComplete }: Props = $props();

  let currentStep = $state(0);
  const totalSteps = 4; // Welcome, Language, How to Log In, Ready

  function checkMobile(): boolean {
    const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
    return tauriPlatform === 'ios' || tauriPlatform === 'android';
  }

  const isMobile = checkMobile();

  async function nextStep() {
    if (currentStep < totalSteps - 1) {
      currentStep++;
    } else {
      await completeSetup();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  async function completeSetup() {
    try {
      await saveSettingsWithQueue({ has_completed_setup_assistant: true });
      await flushSettingsQueue();
      onComplete();
    } catch (e) {
      console.error('Failed to save setup completion:', e);
      onComplete();
    }
  }

  function skipSetup() {
    completeSetup();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      skipSetup();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      nextStep();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div
  class="fixed inset-0 z-[9999] flex flex-col bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800"
  role="dialog"
  aria-label={$_('setup_assistant.aria_label', { default: 'Setup Assistant' })}
  aria-live="polite">
  <!-- Skip button -->
  <div class="absolute top-4 right-4 z-10">
    <button
      type="button"
      onclick={skipSetup}
      class="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors duration-200 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-800/50">
      <T key="setup_assistant.skip" fallback="Skip" />
    </button>
  </div>

  <!-- Progress dots -->
  <div class="flex justify-center gap-2 pt-6 pb-4" aria-hidden="true">
    {#each Array(totalSteps) as _, i}
      <button
        type="button"
        class="w-2.5 h-2.5 rounded-full transition-all duration-300 {i === currentStep
          ? 'bg-[var(--accent)] scale-125'
          : i < currentStep
            ? 'bg-[var(--accent)]/60'
            : 'bg-zinc-300 dark:bg-zinc-600'}"
        aria-label={t()('setup_assistant.step_indicator', {
          default: `Step ${i + 1} of ${totalSteps}`,
          values: { current: i + 1, total: totalSteps },
        })}
        onclick={() => (currentStep = i)} />
    {/each}
  </div>

  <!-- Step content -->
  <div class="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 overflow-y-auto">
    {#key currentStep}
      <!-- Step 1: Welcome -->
      {#if currentStep === 0}
        <div
          class="max-w-xl w-full text-center"
          in:fade={{ duration: 300, easing: cubicInOut }}
          out:fade={{ duration: 200, easing: cubicInOut }}>
          <div class="mb-8">
            <img
              src="/betterseqta-dark-icon.png"
              alt=""
              class="w-20 h-20 mx-auto invert dark:invert-0 opacity-90" />
          </div>
          <h1 class="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
            <T key="setup_assistant.welcome_title" fallback="Welcome to DesQTA" />
          </h1>
          <p class="text-lg sm:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed mb-10">
            <T
              key="setup_assistant.welcome_subtitle"
              fallback="Experience SEQTA Learn like never before. A powerful, modern desktop app for students." />
          </p>
          <button
            type="button"
            onclick={nextStep}
            class="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style="background-color: var(--accent); --tw-ring-color: var(--accent);">
            <T key="setup_assistant.get_started" fallback="Get Started" />
            <Icon src={ChevronRight} class="w-5 h-5" />
          </button>
        </div>
      {/if}

      <!-- Step 2: Language -->
      {#if currentStep === 1}
        <div
          class="max-w-md w-full"
          in:fade={{ duration: 300, easing: cubicInOut }}
          out:fade={{ duration: 200, easing: cubicInOut }}>
          <div class="flex justify-center mb-6">
            <div
              class="p-4 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
              <Icon src={GlobeAlt} class="w-12 h-12 text-[var(--accent)]" />
            </div>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white text-center mb-3">
            <T key="setup_assistant.language_title" fallback="Choose your language" />
          </h2>
          <p class="text-zinc-600 dark:text-zinc-400 text-center mb-8">
            <T
              key="setup_assistant.language_subtitle"
              fallback="Select your preferred language for the app." />
          </p>
          <div class="flex justify-center mb-10">
            <LanguageSelector compact={false} showFlags={true} />
          </div>
          <div class="flex justify-center gap-4">
            <button
              type="button"
              onclick={prevStep}
              class="px-6 py-3 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-colors">
              <T key="common.back" fallback="Back" />
            </button>
            <button
              type="button"
              onclick={nextStep}
              class="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style="background-color: var(--accent); --tw-ring-color: var(--accent);">
              <T key="setup_assistant.continue" fallback="Continue" />
              <Icon src={ChevronRight} class="w-5 h-5" />
            </button>
          </div>
        </div>
      {/if}

      <!-- Step 3: How to Log In -->
      {#if currentStep === 2}
        <div
          class="max-w-2xl w-full"
          in:fade={{ duration: 300, easing: cubicInOut }}
          out:fade={{ duration: 200, easing: cubicInOut }}>
          <div class="flex justify-center mb-6">
            <div
              class="p-4 rounded-2xl bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
              <Icon src={QrCode} class="w-12 h-12 text-[var(--accent)]" />
            </div>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white text-center mb-3">
            <T key="setup_assistant.login_title" fallback="How to sign in" />
          </h2>
          <p class="text-zinc-600 dark:text-zinc-400 text-center mb-8">
            {#if isMobile}
              <T
                key="setup_assistant.login_mobile"
                fallback="On mobile, scan a QR code from SEQTA Learn in your browser to sign in instantly." />
            {:else}
              <T
                key="setup_assistant.login_desktop"
                fallback="You can sign in using a QR code, by entering your school's SEQTA URL, or with direct username and password." />
            {/if}
          </p>
          <div class="grid sm:grid-cols-3 gap-4 mb-10">
            <div
              class="p-4 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 text-center">
              <div class="flex justify-center mb-2">
                <Icon src={QrCode} class="w-8 h-8 text-[var(--accent)]" />
              </div>
              <p class="font-medium text-zinc-900 dark:text-white text-sm">
                <T key="setup_assistant.login_qr" fallback="QR Code" />
              </p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                <T key="setup_assistant.login_qr_desc" fallback="Scan from SEQTA Learn" />
              </p>
            </div>
            {#if !isMobile}
              <div
                class="p-4 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 text-center">
                <div class="flex justify-center mb-2">
                  <Icon src={GlobeAlt} class="w-8 h-8 text-[var(--accent)]" />
                </div>
                <p class="font-medium text-zinc-900 dark:text-white text-sm">
                  <T key="setup_assistant.login_url" fallback="Manual URL" />
                </p>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  <T key="setup_assistant.login_url_desc" fallback="Enter school URL" />
                </p>
              </div>
              <div
                class="p-4 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50 text-center">
                <div class="flex justify-center mb-2">
                  <Icon src={ArrowRightOnRectangle} class="w-8 h-8 text-[var(--accent)]" />
                </div>
                <p class="font-medium text-zinc-900 dark:text-white text-sm">
                  <T key="setup_assistant.login_direct" fallback="Direct Login" />
                </p>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  <T key="setup_assistant.login_direct_desc" fallback="Username & password" />
                </p>
              </div>
            {/if}
          </div>
          <div class="flex justify-center gap-4">
            <button
              type="button"
              onclick={prevStep}
              class="px-6 py-3 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-colors">
              <T key="common.back" fallback="Back" />
            </button>
            <button
              type="button"
              onclick={nextStep}
              class="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style="background-color: var(--accent); --tw-ring-color: var(--accent);">
              <T key="setup_assistant.continue" fallback="Continue" />
              <Icon src={ChevronRight} class="w-5 h-5" />
            </button>
          </div>
        </div>
      {/if}

      <!-- Step 4: Ready -->
      {#if currentStep === 3}
        <div
          class="max-w-xl w-full text-center"
          in:fade={{ duration: 300, easing: cubicInOut }}
          out:fade={{ duration: 200, easing: cubicInOut }}>
          <div class="mb-8">
            <div
              class="w-20 h-20 mx-auto rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center">
              <Icon src={ArrowRightOnRectangle} class="w-10 h-10 text-[var(--accent)]" />
            </div>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-4">
            <T key="setup_assistant.ready_title" fallback="You're all set!" />
          </h2>
          <p class="text-lg text-zinc-600 dark:text-zinc-400 mb-10">
            <T
              key="setup_assistant.ready_subtitle"
              fallback="Sign in to get started and explore your dashboard, study tools, and more." />
          </p>
          <button
            type="button"
            onclick={completeSetup}
            class="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style="background-color: var(--accent); --tw-ring-color: var(--accent);">
            <T key="setup_assistant.sign_in" fallback="Sign in" />
            <Icon src={ChevronRight} class="w-5 h-5" />
          </button>
        </div>
      {/if}
    {/key}
  </div>
</div>
