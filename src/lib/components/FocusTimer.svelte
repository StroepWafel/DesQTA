<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Icon, Clock } from 'svelte-hero-icons';

  let timeLeft = $state(25 * 60); // 25 minutes in seconds
  let isRunning = $state(false);
  let timerInterval: number | undefined = $state(undefined);
  let selectedDuration = $state(25); // minutes
  let isBreak = $state(false);
  let customMinutes = $state('');
  let customSeconds = $state('');

  function startTimer() {
    if (!isRunning) {
      isRunning = true;
      timerInterval = window.setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
        } else {
          clearInterval(timerInterval);
          isRunning = false;
          // Play notification sound
          new Audio('/notification.mp3').play().catch(() => {
            // Ignore errors if audio fails to play
          });
          // Toggle between work and break
          isBreak = !isBreak;
          timeLeft = (isBreak ? 5 : selectedDuration) * 60;
        }
      }, 1000);
    }
  }

  function pauseTimer() {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isBreak = false;
    timeLeft = selectedDuration * 60;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function setDuration(minutes: number) {
    selectedDuration = minutes;
    resetTimer();
  }

  onMount(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  });
</script>

<div class="flex flex-col h-full min-h-0 w-full">
  <div
    class="flex items-center gap-2 mb-2 sm:mb-3 shrink-0 transition-all duration-300"
    in:fade={{ duration: 200 }}>
    <Icon
      src={Clock}
      class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    <h3 class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300">
      Focus Timer
    </h3>
  </div>
  <div class="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4">
    <div class="flex flex-col items-center gap-6">
      <!-- Timer Display -->
      <div
        class="flex items-center justify-center w-48 h-48 rounded-full border-8 {isBreak
          ? 'border-green-500'
          : 'border-accent'}">
        <span class="text-4xl font-bold text-zinc-900 dark:text-white">{formatTime(timeLeft)}</span>
      </div>

      <!-- Timer Controls -->
      <div class="flex gap-4">
        {#if !isRunning}
          <button
            onclick={startTimer}
            class="px-6 py-2 text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 bg-accent hover:bg-accent/90 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2">
            Start
          </button>
        {:else}
          <button
            onclick={pauseTimer}
            class="px-6 py-2 text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 bg-yellow-500 hover:bg-yellow-600 focus:outline-hidden focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2">
            Pause
          </button>
        {/if}
        <button
          onclick={resetTimer}
          class="px-6 py-2 text-white rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 bg-red-500 hover:bg-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
          Reset
        </button>
      </div>

      <!-- Duration Selection -->
      <div class="flex gap-2 items-center">
        <button
          onclick={() => setDuration(25)}
          class="px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 {selectedDuration === 25
            ? 'accent-bg text-white'
            : 'bg-transparent accent-text border-2 accent-border hover:accent-bg/10'}">
          25m
        </button>
        <button
          onclick={() => setDuration(45)}
          class="px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 {selectedDuration === 45
            ? 'accent-bg text-white'
            : 'bg-transparent accent-text border-2 accent-border hover:accent-bg/10'}">
          45m
        </button>
        <button
          onclick={() => setDuration(60)}
          class="px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 {selectedDuration === 60
            ? 'accent-bg text-white'
            : 'bg-transparent accent-text border-2 accent-border hover:accent-bg/10'}">
          60m
        </button>
      </div>
      <!-- Custom Timer Entry -->
      <div class="flex gap-2 items-center justify-center mt-3">
        <input
          type="number"
          min="0"
          max="99"
          placeholder="mm"
          bind:value={customMinutes}
          class="w-14 px-2 py-2 rounded-lg border-2 accent-border bg-transparent accent-text focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 text-center"
        />
        <span class="text-xl font-bold text-zinc-700 dark:text-zinc-200">:</span>
        <input
          type="number"
          min="0"
          max="59"
          placeholder="ss"
          bind:value={customSeconds}
          class="w-14 px-2 py-2 rounded-lg border-2 accent-border bg-transparent accent-text focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 text-center"
        />
        <button
          onclick={() => {
            const min = parseInt(customMinutes) || 0;
            const sec = parseInt(customSeconds) || 0;
            if (min > 0 || sec > 0) setDuration(min + sec / 60);
          }}
          class="px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 accent-bg text-white ml-1">
          Set
        </button>
      </div>

      <!-- Status -->
      <div class="text-center">
        <p class="text-lg font-medium text-zinc-900 dark:text-white">
          {isBreak ? 'Break Time!' : 'Focus Time'}
        </p>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          {isBreak ? 'Take a short break' : 'Stay focused and productive'}
        </p>
      </div>
    </div>
  </div>
</div> 