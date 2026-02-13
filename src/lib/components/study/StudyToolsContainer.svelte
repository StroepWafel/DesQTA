<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { Button, Input } from '$lib/components/ui';
  import { Slider } from '$lib/components/ui/slider/index.js';
  import * as Label from '$lib/components/ui/label/index.js';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';
  import {
    generateQuiz,
    generateFeedback,
    fetchAssessmentContext,
  } from '$lib/services/studyToolsService';
  import { saveSettingsWithQueue } from '$lib/services/settingsSync';
  import type { QuizQuestion, QuizFeedback } from '$lib/types/studyTools';
  import { Icon, Sparkles, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'svelte-hero-icons';
  import Modal from '$lib/components/Modal.svelte';

  interface FullAssessment {
    id: string | number;
    title: string;
    due: string;
    code: string;
    subject?: string;
    metaclass?: string | number;
    colour?: string;
  }

  interface Props {
    assessments: FullAssessment[];
  }

  let { assessments }: Props = $props();

  type SourceMode = 'assessment' | 'custom';
  let sourceMode = $state<SourceMode>('custom');
  let selectedAssessment = $state<FullAssessment | null>(null);
  let customTopic = $state('');
  let questionCount = $state(10);
  let loading = $state(false);
  let loadingFeedback = $state(false);
  let error = $state<string | null>(null);
  let questions = $state<QuizQuestion[]>([]);
  let userAnswers = $state<number[]>([]);
  let submitted = $state(false);
  let aiFeedback = $state<QuizFeedback | null>(null);
  let showAiFeedback = $state(true);
  let assessmentModalOpen = $state(false);
  let apiKeySetupModalOpen = $state(false);
  let hasApiKey = $state<boolean | null>(null);
  let apiKeyInput = $state('');
  let savingApiKey = $state(false);
  let apiKeyError = $state<string | null>(null);

  const SAMPLE_QUIZ: QuizQuestion[] = [
    {
      question: 'What is the capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctIndex: 1,
    },
    {
      question: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
      correctIndex: 2,
    },
  ];

  async function checkApiKey() {
    try {
      const subset = await invoke<{
        gemini_api_key?: string;
        cerebras_api_key?: string;
      }>('get_settings_subset', {
        keys: ['gemini_api_key', 'cerebras_api_key'],
      });
      const gemini = (subset?.gemini_api_key ?? '').trim();
      const cerebras = (subset?.cerebras_api_key ?? '').trim();
      hasApiKey = gemini.length > 0 || cerebras.length > 0;
      if (!hasApiKey) {
        apiKeySetupModalOpen = true;
      }
    } catch {
      hasApiKey = false;
      apiKeySetupModalOpen = true;
    }
  }

  async function saveApiKeyAndEnable() {
    const key = apiKeyInput.trim();
    if (!key) {
      apiKeyError = $_('study.api_key_required') ?? 'Please enter your API key.';
      return;
    }
    savingApiKey = true;
    apiKeyError = null;
    try {
      await saveSettingsWithQueue({
        cerebras_api_key: key,
        ai_provider: 'cerebras',
        ai_integrations_enabled: true,
        lesson_summary_analyser_enabled: true,
        quiz_generator_enabled: true,
      });
      hasApiKey = true;
      apiKeySetupModalOpen = false;
      apiKeyInput = '';
    } catch (e) {
      apiKeyError = e instanceof Error ? e.message : String(e);
    } finally {
      savingApiKey = false;
    }
  }

  onMount(() => {
    checkApiKey();
  });

  const topic = $derived(
    sourceMode === 'assessment' && selectedAssessment
      ? selectedAssessment.title
      : customTopic.trim(),
  );

  const canGenerate = $derived(topic.length > 0 && questionCount >= 5 && questionCount <= 20);

  const correctCount = $derived(
    submitted ? userAnswers.filter((a, i) => a === questions[i]?.correctIndex).length : 0,
  );
  const scorePercent = $derived(
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0,
  );

  async function handleGenerate() {
    if (!canGenerate) return;
    if (hasApiKey === false) {
      apiKeySetupModalOpen = true;
      return;
    }
    if (hasApiKey === null) {
      await checkApiKey();
      if (!hasApiKey) return;
    }
    error = null;
    questions = [];
    userAnswers = [];
    submitted = false;
    aiFeedback = null;
    loading = true;
    try {
      let assessmentContext: string | undefined;
      if (sourceMode === 'assessment' && selectedAssessment?.id != null && selectedAssessment?.metaclass != null) {
        assessmentContext = await fetchAssessmentContext(
          Number(selectedAssessment.id),
          Number(selectedAssessment.metaclass),
        );
      }
      const generated = await generateQuiz({
        topic,
        numQuestions: questionCount,
        assessmentContext,
      });
      questions = generated;
      userAnswers = new Array(generated.length).fill(-1);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function handleSubmit() {
    if (userAnswers.some((a) => a < 0)) return;
    submitted = true;
    loadingFeedback = true;
    aiFeedback = null;
    try {
      const feedback = await generateFeedback({
        questions,
        userAnswers,
        topic,
      });
      aiFeedback = feedback;
    } catch {
      // Non-blocking - we still show raw feedback
    } finally {
      loadingFeedback = false;
    }
  }

  function handleRetry() {
    questions = [];
    userAnswers = [];
    submitted = false;
    aiFeedback = null;
    error = null;
  }

  function setAnswer(index: number, value: number) {
    userAnswers = userAnswers.map((a, i) => (i === index ? value : a));
  }

  const upcomingAssessments = $derived(
    assessments.filter((a) => new Date(a.due) >= new Date()).sort(
      (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
    ),
  );

  function selectAssessment(a: FullAssessment) {
    selectedAssessment = a;
    assessmentModalOpen = false;
  }
</script>

<div class="h-full flex flex-col min-h-0" in:fade={{ duration: 300 }}>
  <div
    class="flex-1 backdrop-blur-xs bg-white/80 dark:bg-zinc-900/60 rounded-xl sm:rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden flex flex-col"
    in:fly={{ y: 20, duration: 300, delay: 100, easing: quintOut }}>
    <!-- Header -->
    <div
      class="shrink-0 px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30">
      <h2 class="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Icon src={Sparkles} class="w-5 h-5 text-(--accent)" />
        <T key="study.quizzes" fallback="Quizzes" />
      </h2>
    </div>

    <!-- Config Panel -->
    <div class="p-6 space-y-4">
      <!-- Source selector -->
      <div class="flex flex-wrap gap-4 items-end">
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {sourceMode ===
            'assessment'
              ? 'accent-bg text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
            onclick={() => {
              sourceMode = 'assessment';
              customTopic = '';
            }}>
            <T key="study.select_assessment" fallback="Select assessment" />
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {sourceMode ===
            'custom'
              ? 'accent-bg text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
            onclick={() => {
              sourceMode = 'custom';
              selectedAssessment = null;
            }}>
            <T key="study.custom_topic" fallback="Custom topic" />
          </button>
        </div>

        {#if sourceMode === 'assessment'}
          <div class="flex-1 min-w-[200px] max-w-md">
            <button
              type="button"
              class="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm flex items-center justify-between gap-2 transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 accent-ring"
              onclick={() => (assessmentModalOpen = true)}>
              <span class="truncate">
                {selectedAssessment?.title ?? ($_('study.select_assessment') || 'Select assessment')}
              </span>
              <Icon src={ChevronDown} class="w-4 h-4 shrink-0" />
            </button>
          </div>

          <Modal
            bind:open={assessmentModalOpen}
            title={$_('study.upcoming_assessments') || 'Upcoming Assessments'}
            maxWidth="max-w-2xl"
            onclose={() => (assessmentModalOpen = false)}>
            <div class="px-8 pb-8 max-h-[60vh] overflow-y-auto">
              {#if upcomingAssessments.length === 0}
                <p class="text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  <T key="study.no_upcoming_assessments" fallback="No upcoming assessments." />
                </p>
              {:else}
                <div class="space-y-2">
                  {#each upcomingAssessments as a}
                    <button
                      type="button"
                      class="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-left transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md focus:outline-none focus:ring-2 accent-ring {selectedAssessment?.id ===
                      a.id && selectedAssessment?.metaclass === a.metaclass
                        ? 'ring-2 accent-ring border-(--accent)'
                        : ''}"
                      onclick={() => selectAssessment(a)}>
                      <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0 flex-1">
                          <p class="font-medium text-zinc-900 dark:text-white truncate">
                            {a.title}
                          </p>
                          {#if a.subject}
                            <p class="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                              {a.subject}
                            </p>
                          {/if}
                        </div>
                        <div class="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                          {new Date(a.due).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </Modal>
        {:else}
          <div class="flex-1 min-w-[200px] max-w-md">
            <Input
              bind:value={customTopic}
              placeholder={$_('study.what_to_study') || 'What do you want to study?'}
              class="w-full" />
          </div>
        {/if}

        <!-- Question count -->
        <div class="flex items-center gap-3">
          <Label.Root class="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
            <T key="study.question_count" fallback="Questions" />
          </Label.Root>
          <div class="flex items-center gap-2 w-36">
            <Slider
              type="single"
              bind:value={questionCount}
              min={5}
              max={20}
              step={1}
              class="flex-1" />
          </div>
          <span class="text-sm text-zinc-500 dark:text-zinc-400 w-8">{questionCount}</span>
        </div>

        <Button
          onclick={handleGenerate}
          disabled={!canGenerate || loading}
          loading={loading}
          class="transition-all duration-200 transform hover:scale-105 active:scale-95">
          <T key="study.generate_quiz" fallback="Generate Quiz" />
        </Button>
      </div>

      {#if error}
        <div
          class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      {/if}
    </div>

    <!-- Quiz / Results -->
    {#if questions.length > 0}
      <div class="flex-1 min-h-0 overflow-auto px-6 pb-6 space-y-4">
        {#if !submitted}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            class="space-y-6">
            {#each questions as q, i}
              <div
                class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50">
                <p class="font-medium text-zinc-900 dark:text-white mb-3">
                  {i + 1}. {q.question}
                </p>
                <div class="space-y-2">
                  {#each q.options as opt, j}
                    <label
                      class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors duration-200">
                      <input
                        type="radio"
                        name="q{i}"
                        value={j}
                        checked={userAnswers[i] === j}
                        onchange={() => setAnswer(i, j)}
                        class="accent-ring" />
                      <span class="text-zinc-700 dark:text-zinc-300">{opt}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/each}
            <Button type="submit" disabled={userAnswers.some((a) => a < 0)}>
              <T key="study.submit_answers" fallback="Submit Answers" />
            </Button>
          </form>
        {:else}
          <!-- Results -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                <T key="study.raw_feedback" fallback="Results" />
              </h3>
              <div class="text-sm text-zinc-600 dark:text-zinc-400">
                {correctCount}/{questions.length} ({scorePercent}%)
              </div>
            </div>

            {#each questions as q, i}
              <div
                class="p-4 rounded-xl border transition-colors duration-200 {userAnswers[i] ===
                q.correctIndex
                  ? 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10'
                  : 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'}">
                <p class="font-medium text-zinc-900 dark:text-white mb-2">
                  {i + 1}. {q.question}
                </p>
                <div class="flex items-center gap-2 text-sm">
                  {#if userAnswers[i] === q.correctIndex}
                    <Icon src={CheckCircle} class="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <span class="text-green-700 dark:text-green-300"
                      >{$_('study.correct') ?? 'Correct'}: {q.options[q.correctIndex]}</span
                    >
                  {:else}
                    <Icon src={XCircle} class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                    <span class="text-red-700 dark:text-red-300">
                      {$_('study.incorrect') ?? 'Incorrect'}. {$_('study.correct_answer') ?? 'Correct'}: {q.options[q.correctIndex]}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}

            <!-- AI Feedback -->
            <div class="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
              <button
                type="button"
                class="w-full px-4 py-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-200"
                onclick={() => (showAiFeedback = !showAiFeedback)}>
                <span class="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                  <Icon src={Sparkles} class="w-5 h-5 text-(--accent)" />
                  <T key="study.ai_feedback" fallback="AI Feedback" />
                </span>
                {#if showAiFeedback}
                  <Icon src={ChevronUp} class="w-5 h-5 text-zinc-500" />
                {:else}
                  <Icon src={ChevronDown} class="w-5 h-5 text-zinc-500" />
                {/if}
              </button>
              {#if showAiFeedback}
                <div class="p-4 border-t border-zinc-200 dark:border-zinc-700">
                  {#if loadingFeedback}
                    <p class="text-zinc-500 dark:text-zinc-400 text-sm">
                      {$_('study.generating_feedback') ?? 'Generating feedback...'}
                    </p>
                  {:else if aiFeedback}
                    <p class="text-zinc-700 dark:text-zinc-300 mb-4">{aiFeedback.summary}</p>
                    {#if aiFeedback.suggestions?.length}
                      <ul class="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        {#each aiFeedback.suggestions as s}
                          <li>{s}</li>
                        {/each}
                      </ul>
                    {/if}
                    <p class="text-zinc-700 dark:text-zinc-300 italic">{aiFeedback.encouragement}</p>
                  {:else}
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                      {$_('study.ai_feedback_unavailable') ?? 'AI feedback could not be generated.'}
                    </p>
                  {/if}
                </div>
              {/if}
            </div>

            <Button variant="secondary" onclick={handleRetry}>
              <T key="study.try_again" fallback="Try Again" />
            </Button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center p-8">
        <p class="text-zinc-500 dark:text-zinc-400 text-center">
          <T key="study.configure_and_generate" fallback="Configure your topic and click Generate Quiz to get started." />
        </p>
      </div>
    {/if}
  </div>

  <!-- API Key Setup Modal (shown when no Gemini or Cerebras key is set) - must be outside conditionals -->
  <Modal
    bind:open={apiKeySetupModalOpen}
    title={$_('study.ai_quiz_setup') ?? 'Enable AI Quizzes'}
    maxWidth="max-w-2xl"
    onclose={() => (apiKeySetupModalOpen = false)}>
    <div class="px-8 pb-8 max-h-[75vh] overflow-y-auto space-y-6">
      <!-- Quiz Preview -->
      <div>
        <h3 class="font-semibold text-zinc-900 dark:text-white mb-3">
          {$_('study.quiz_preview') ?? 'Here\'s what your AI quiz could look like:'}
        </h3>
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-4">
          {#each SAMPLE_QUIZ as q, i}
            <div class="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <p class="font-medium text-zinc-900 dark:text-white mb-2 text-sm">
                {i + 1}. {q.question}
              </p>
              <div class="space-y-1">
                {#each q.options as opt}
                  <div
                    class="flex items-center gap-2 py-1.5 px-2 rounded text-sm text-zinc-600 dark:text-zinc-400">
                    <span class="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600"></span>
                    {opt}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Instructions -->
      <div>
        <h3 class="font-semibold text-zinc-900 dark:text-white mb-2">
          {$_('study.get_free_api_key') ?? 'Get a free Cerebras API key (takes 1 minute):'}
        </h3>
        <ol class="list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            {$_('study.cerebras_step_1') ?? 'Go to'}
            <a
              href="https://cloud.cerebras.ai"
              target="_blank"
              rel="noopener noreferrer"
              class="text-(--accent) underline font-medium hover:opacity-80">
              cloud.cerebras.ai
            </a>
          </li>
          <li>{$_('study.cerebras_step_2') ?? 'Sign up (free, no credit card required)'}</li>
          <li>{$_('study.cerebras_step_3') ?? 'Click "Copy api key" on the dashboard that it opens to'}</li>
          <li>{$_('study.cerebras_step_4') ?? 'Paste it below and click Save'}</li>
        </ol>
        <p class="mt-3 text-sm font-medium text-green-600 dark:text-green-400">
          {$_('study.cerebras_free_tier') ?? 'Free tier: 1 million tokens per day.'}
        </p>
      </div>

      <!-- API Key Input -->
      <div>
        <Label.Root class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          {$_('study.cerebras_api_key') ?? 'Cerebras API Key'}
        </Label.Root>
        <Input
          bind:value={apiKeyInput}
          type="password"
          placeholder={$_('study.paste_api_key') ?? 'Paste your API key here'}
          class="w-full font-mono text-sm" />
        {#if apiKeyError}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">{apiKeyError}</p>
        {/if}
      </div>

      <Button
        onclick={saveApiKeyAndEnable}
        disabled={savingApiKey || !apiKeyInput.trim()}
        loading={savingApiKey}
        class="w-full">
        {$_('study.save_and_enable') ?? 'Save & Enable AI Quizzes'}
      </Button>
    </div>
  </Modal>
</div>
