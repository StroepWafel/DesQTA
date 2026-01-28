<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { invoke } from '@tauri-apps/api/core';
  import { fade, scale } from 'svelte/transition';
  import { saveSettingsWithQueue, flushSettingsQueue } from '../services/settingsSync';
  import { Icon, XMark, ChevronRight, ChevronLeft } from 'svelte-hero-icons';
  import { _ } from '../i18n';
  import T from './T.svelte';

  interface Props {
    open: boolean;
    onComplete: () => void;
  }

  let { open, onComplete }: Props = $props();

  let currentStep = $state(0);
  let highlightElement: HTMLElement | null = $state(null);
  let overlayVisible = $state(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasInitialized = $state(false);

  const steps = [
    {
      id: 'nav',
      title: 'Welcome to DesQTA!',
      description: 'Use the navigation sidebar to access all your pages and features.',
      targetSelector: 'aside nav',
      page: '/',
      scrollTo: null,
    },
    {
      id: 'assessments',
      title: 'Your SEQTA Data',
      description: 'All your SEQTA data is here. View assessments, grades, and more.',
      targetSelector: null,
      page: '/assessments',
      scrollTo: null,
    },
    {
      id: 'theme-store',
      title: 'Customize Your Experience',
      description: 'Scroll down to find the Theme Store where you can customize your app appearance.',
      targetSelector: '[data-onboarding="theme-store"]',
      page: '/settings',
      scrollTo: 'theme-store',
    },
    {
      id: 'cloud-sync',
      title: 'Cloud Sync',
      description: 'Scroll up to find Cloud Sync settings to keep your data synchronized across devices.',
      targetSelector: '[data-onboarding="cloud-sync"]',
      page: '/settings',
      scrollTo: 'cloud-sync',
    },
    {
      id: 'user-dropdown',
      title: 'Your Profile',
      description: 'Click on your profile picture in the header to access your account settings and preferences.',
      targetSelector: '[data-onboarding="user-dropdown"]',
      page: '/',
      scrollTo: null,
    },
  ];

  async function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
      await navigateToStep();
    } else {
      await completeOnboarding();
    }
  }

  async function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      await navigateToStep();
    }
  }

  async function navigateToStep() {
    overlayVisible = false;
    highlightElement = null;

    const step = steps[currentStep];

    // Navigate to the required page
    if ($page.url.pathname !== step.page) {
      await goto(step.page);
      // Wait for navigation
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Wait a bit for DOM to settle
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Scroll to element if needed
    if (step.scrollTo) {
      const element = document.querySelector(`[data-onboarding="${step.scrollTo}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    // Special handling for cloud-sync: scroll back up
    if (step.id === 'cloud-sync') {
      const element = document.querySelector(`[data-onboarding="cloud-sync"]`);
      if (element) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise((resolve) => setTimeout(resolve, 600));
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    // Find and highlight target element
    if (step.targetSelector) {
      // Retry finding element with multiple attempts
      let element: HTMLElement | null = null;
      for (let i = 0; i < 5; i++) {
        element = document.querySelector(step.targetSelector) as HTMLElement;
        if (element) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      
      if (element) {
        highlightElement = element;
        overlayVisible = true;
        
        // Ensure element is visible
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // If element not found, still show overlay
        overlayVisible = true;
      }
    } else {
      // For assessments page, just show overlay
      overlayVisible = true;
    }

    // Special handling for user dropdown - open it
    if (step.id === 'user-dropdown') {
      const userButton = document.querySelector('[data-onboarding="user-dropdown"]') as HTMLElement;
      if (userButton) {
        userButton.click();
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  async function completeOnboarding() {
    try {
      await saveSettingsWithQueue({ has_been_through_onboarding: true });
      await flushSettingsQueue();
      overlayVisible = false;
      highlightElement = null;
      onComplete();
    } catch (e) {
      console.error('Failed to save onboarding completion:', e);
      onComplete();
    }
  }

  function skipOnboarding() {
    completeOnboarding();
  }

  // Track previous open state to detect when it first becomes true
  let prevOpen = $state(false);
  
  $effect(() => {
    // Only initialize when open changes from false to true
    if (open && !prevOpen && !hasInitialized) {
      hasInitialized = true;
      currentStep = 0;
      navigateToStep();
    } else if (!open && prevOpen) {
      // Reset when closed so it can be reopened fresh
      hasInitialized = false;
      currentStep = 0;
      overlayVisible = false;
      highlightElement = null;
    }
    prevOpen = open;
  });

  onDestroy(() => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
  });

  function getHighlightRect() {
    if (!highlightElement) return null;
    const rect = highlightElement.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  const highlightRect = $derived.by(() => getHighlightRect());

  const tooltipStyle = $derived.by(() => {
    if (highlightRect) {
      const tooltipWidth = 400; // max-w-md
      const tooltipHeight = 300; // approximate height
      const spacing = 20;
      
      // Try to position below the element first
      let top = highlightRect.top + highlightRect.height + spacing;
      let left = highlightRect.left;
      
      // If it would go off the bottom of the viewport, position above instead
      if (top + tooltipHeight > window.innerHeight) {
        top = highlightRect.top - tooltipHeight - spacing;
      }
      
      // Ensure it doesn't go above the viewport
      if (top < 0) {
        top = spacing;
      }
      
      // Center horizontally relative to the element, but keep within viewport
      left = Math.max(spacing, Math.min(left, window.innerWidth - tooltipWidth - spacing));
      
      return `top: ${top}px; left: ${left}px;`;
    }
    return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
  });
</script>

{#if open}
  <!-- Fullscreen Overlay -->
  <div
    class="fixed inset-0 z-[9998] transition-opacity duration-300"
    class:opacity-0={!overlayVisible}
    class:opacity-100={overlayVisible}
    style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.5);"
    transition:fade={{ duration: 300 }}>
    <!-- Highlight cutout -->
    {#if highlightRect && overlayVisible}
      <svg class="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="highlight-mask">
            <rect width="100%" height="100%" fill="black" />
            <rect
              x={highlightRect.left}
              y={highlightRect.top}
              width={highlightRect.width}
              height={highlightRect.height}
              fill="white"
              rx="8" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" mask="url(#highlight-mask)" />
        <!-- Glow effect -->
        <rect
          x={highlightRect.left - 4}
          y={highlightRect.top - 4}
          width={highlightRect.width + 8}
          height={highlightRect.height + 8}
          fill="none"
          stroke="var(--accent)"
          stroke-width="3"
          rx="12"
          opacity="0.8"
          class="drop-shadow-lg" />
      </svg>
    {/if}
  </div>

  <!-- Tooltip Card -->
  <div
    class="fixed z-[9999] transition-all duration-300"
    style={tooltipStyle}
    transition:scale={{ duration: 300 }}>
    <div
      class="bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-[90vw] sm:w-[400px]">
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <h2 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            {steps[currentStep].title}
          </h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            {steps[currentStep].description}
          </p>
        </div>
        <button
          onclick={skipOnboarding}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Progress -->
      <div class="mb-6">
        <div class="flex gap-2">
          {#each steps as _, i}
            <div
              class="h-1 flex-1 rounded-full transition-colors"
              style={i <= currentStep ? 'background-color: var(--accent);' : ''}
              class:bg-zinc-200={i > currentStep}
              class:dark:bg-zinc-700={i > currentStep} />
          {/each}
        </div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-2 text-center">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-3">
        <button
          onclick={skipOnboarding}
          class="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
          Skip
        </button>
        <div class="flex items-center gap-3">
          <button
            onclick={prevStep}
            disabled={currentStep === 0}
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
            <Icon src={ChevronLeft} class="w-4 h-4" />
            <span>Previous</span>
          </button>
          <button
            onclick={nextStep}
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style="background-color: var(--accent); --tw-ring-color: var(--accent);"
            onmouseenter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onmouseleave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}>
            <span>{currentStep === steps.length - 1 ? 'Complete' : 'Next'}</span>
            {#if currentStep < steps.length - 1}
              <Icon src={ChevronRight} class="w-4 h-4" />
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

