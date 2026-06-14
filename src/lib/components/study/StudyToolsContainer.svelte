<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fly, fade, slide } from 'svelte/transition';
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
  import { Icon, Sparkles, CheckCircle, XCircle, ChevronDown, ChevronUp, MagnifyingGlass, Check } from 'svelte-hero-icons';
  import Modal from '$lib/components/Modal.svelte';
  import { clickOutside } from '$lib/actions/clickOutside.js';
  import { AIService } from '$lib/services/ai/AIService';
  import type { AIModel, AIProviderAdapter, AIProviderId } from '$lib/services/ai/types';

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
    /** Available year levels for filtering (e.g. [2024, 2025]) */
    availableYears?: number[];
  }

  let { assessments, availableYears = [] }: Props = $props();

  type SourceMode = 'assessment' | 'custom';
  let sourceMode = $state<SourceMode>('custom');
  let selectedAssessment = $state<FullAssessment | null>(null);
  let customTopic = $state('');
  let questionCount = $state(10);
  let loading = $state(false);
  let loadingFeedback = $state(false);
  let error = $state<string | null>(null);
  let questions = $state<QuizQuestion[]>([]);
  let userAnswers = $state<(number | string)[]>([]);
  let submitted = $state(false);
  let aiFeedback = $state<QuizFeedback | null>(null);
  let showAiFeedback = $state(true);
  let assessmentModalOpen = $state(false);
  let assessmentSearchQuery = $state('');
  let assessmentFilterUpcomingOnly = $state(true);
  let assessmentFilterYear = $state<number | 'all'>('all');
  let selectedDifficulty = $state<7 | 8 | 9 | 10 | 11 | 12 | null>(10);
  let difficultyDropdownOpen = $state(false);
  let selectedQuestionTypes = $state<('multiple_choice' | 'true_false' | 'short_answer')[]>(['multiple_choice', 'true_false', 'short_answer']);
  let questionTypesDropdownOpen = $state(false);
  let hasApiKey = $state<boolean | null>(null);
  let apiKeyInput = $state('');
  let savingApiKey = $state(false);
  let apiKeyError = $state<string | null>(null);
  let configExpanded = $state(true);

  // Generic AI provider tab strip state.
  const providers = AIService.listProviders();
  let activeProvider = $state<AIProviderId>('gemini');
  let providerModels = $state<AIModel[]>([]);
  let selectedModel = $state<string>('');
  let loadingModels = $state(false);

  $effect(() => {
    if (questions.length > 0) configExpanded = false;
    else configExpanded = true;
  });

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
    // Check the key for the active provider (not just any provider as before).
    try {
      const provider = await AIService.getActiveProvider();
      activeProvider = provider;
      const key = await AIService.getApiKey(provider);
      hasApiKey = !!key;
    } catch {
      hasApiKey = false;
    }
  }

  async function loadModelsForActive() {
    loadingModels = true;
    try {
      const key = await AIService.getApiKey(activeProvider);
      providerModels = await AIService.listModels(activeProvider, key ?? undefined);
      selectedModel = await AIService.getModel(activeProvider);
    } catch (e) {
      providerModels = AIService.getProvider(activeProvider).defaultModels;
      selectedModel =
        providerModels.find((m) => m.recommended)?.id ?? providerModels[0]?.id ?? '';
    } finally {
      loadingModels = false;
    }
  }

  async function switchProvider(id: AIProviderId) {
    if (id === activeProvider) return;
    activeProvider = id;
    try {
      await saveSettingsWithQueue({ ai_provider: id });
    } catch {
      // best-effort
    }
    await checkApiKey();
    await loadModelsForActive();
  }

  async function setModel(modelId: string) {
    selectedModel = modelId;
    const key = activeProvider === 'cerebras' ? 'cerebras_model' : 'gemini_model';
    try {
      await saveSettingsWithQueue({ [key]: modelId });
    } catch {
      // best-effort
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
      const apiKeyField = activeProvider === 'cerebras' ? 'cerebras_api_key' : 'gemini_api_key';
      await saveSettingsWithQueue({
        [apiKeyField]: key,
        ai_provider: activeProvider,
        ai_integrations_enabled: true,
        lesson_summary_analyser_enabled: true,
        quiz_generator_enabled: true,
      });
      hasApiKey = true;
      apiKeyInput = '';
      await loadModelsForActive();
    } catch (e) {
      apiKeyError = e instanceof Error ? e.message : String(e);
    } finally {
      savingApiKey = false;
    }
  }

  const yearsFromAssessments = $derived(
    [...new Set(assessments.map((a) => new Date(a.due).getFullYear()))].sort((a, b) => b - a),
  );
  const assessmentYears = $derived(availableYears.length > 0 ? availableYears : yearsFromAssessments);

  onMount(async () => {
    await checkApiKey();
    await loadModelsForActive();
  });

  const topic = $derived(
    sourceMode === 'assessment' && selectedAssessment
      ? selectedAssessment.title
      : customTopic.trim(),
  );

  const canGenerate = $derived(
    topic.length > 0 && questionCount >= 5 && questionCount <= 20 && selectedQuestionTypes.length > 0,
  );

  function isAnswerCorrect(q: QuizQuestion, ans: number | string, i: number): boolean {
    const t = q.type || 'multiple_choice';
    if (t === 'short_answer') {
      const expected = (q.correctAnswer ?? '').trim().toLowerCase();
      const given = (typeof ans === 'string' ? ans : '').trim().toLowerCase();
      return expected === given;
    }
    return ans === q.correctIndex;
  }

  /** Use AI scores when available; otherwise fall back to client-side (MC/tf only, short answer = wrong). */
  const questionScores = $derived(
    aiFeedback?.questionScores && aiFeedback.questionScores.length === questions.length
      ? aiFeedback.questionScores
      : questions.map((q, i) => (isAnswerCorrect(q, userAnswers[i], i) ? 1 : 0)),
  );
  const totalScore = $derived(questionScores.reduce((a, b) => a + b, 0));
  const scorePercent = $derived(
    questions.length > 0 ? Math.round((totalScore / questions.length) * 100) : 0,
  );

  async function handleGenerate() {
    if (!canGenerate) return;
    if (hasApiKey === false) {
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
      const yearLevelStr = selectedDifficulty != null ? `Year ${selectedDifficulty}` : undefined;
      const generated = await generateQuiz({
        topic,
        numQuestions: questionCount,
        assessmentContext,
        yearLevel: yearLevelStr,
        questionTypes: selectedQuestionTypes.length > 0 ? selectedQuestionTypes : undefined,
      });
      questions = generated;
      userAnswers = generated.map((q) => {
        const t = q.type || 'multiple_choice';
        return t === 'short_answer' ? '' : -1;
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  const allAnswersFilled = $derived(
    userAnswers.length === questions.length &&
      userAnswers.every((a, i) => {
        const q = questions[i];
        const t = q?.type || 'multiple_choice';
        if (t === 'short_answer') return typeof a === 'string' && (a as string).trim() !== '';
        return typeof a === 'number' && a >= 0;
      }),
  );

  async function handleSubmit() {
    if (!allAnswersFilled) return;
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

  function setAnswer(index: number, value: number | string) {
    userAnswers = userAnswers.map((a, i) => (i === index ? value : a));
  }

  const filteredAssessments = $derived.by(() => {
    let list = assessments;
    if (assessmentFilterUpcomingOnly) {
      list = list.filter((a) => new Date(a.due) >= new Date());
    }
    const yl = assessmentFilterYear;
    if (yl !== 'all' && typeof yl === 'number') {
      list = list.filter((a) => new Date(a.due).getFullYear() === yl);
    }
    if (assessmentSearchQuery.trim()) {
      const q = assessmentSearchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.title ?? '').toLowerCase().includes(q) ||
          (a.subject ?? '').toLowerCase().includes(q) ||
          (a.code ?? '').toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  });

  function selectAssessment(a: FullAssessment) {
    selectedAssessment = a;
    assessmentModalOpen = false;
  }
</script>

<div class="h-full flex flex-col min-h-0" in:fade={{ duration: 300 }} data-onboarding="study-tools">
  <div
    class="flex-1 bg-card rounded-xl sm:rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden flex flex-col"
    in:fly={{ y: 20, duration: 300, delay: 100, easing: quintOut }}>
    <!-- Header: title left, model + provider selector on the right -->
    <div class="shrink-0 px-6 py-4 border-b border-border bg-card">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-lg font-semibold text-foreground flex items-center gap-2 shrink-0">
          <Icon src={Sparkles} class="w-5 h-5 text-(--accent)" />
          <T key="study.quizzes" fallback="Quizzes" />
        </h2>
        <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ml-auto sm:justify-end">
          {#if providerModels.length > 0}
            <label class="flex items-center gap-2 text-xs text-muted-foreground order-1 sm:order-none">
              <span class="uppercase tracking-[0.06em] font-semibold whitespace-nowrap">{$_('study.model') || 'Model'}</span>
              <select
                value={selectedModel}
                onchange={(e) => setModel((e.currentTarget as HTMLSelectElement).value)}
                class="h-8 min-w-[12rem] max-w-[20rem] px-2 text-xs rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500">
                {#each providerModels as m (m.id)}
                  <option value={m.id}>{m.label}{m.recommended ? ' ⭐' : ''}</option>
                {/each}
              </select>
            </label>
          {/if}
          <div
            class="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-surface-muted order-2 sm:order-none sm:ml-1"
            role="tablist">
            {#each providers as p (p.id)}
              <button
                type="button"
                role="tab"
                aria-selected={activeProvider === p.id}
                onclick={() => switchProvider(p.id)}
                class="h-8 px-3 text-xs font-semibold uppercase tracking-[0.06em] rounded-md transition-colors duration-150 {activeProvider === p.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'}">
                {p.displayName}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- API Key Setup (inline when not configured) -->
    {#if hasApiKey === false}
      <div class="flex-1 min-h-0 overflow-auto px-6 pb-6 space-y-6">
        <h3 class="font-semibold text-foreground">
          {$_('study.ai_quiz_setup') ?? 'Enable AI Quizzes'}
        </h3>

        <!-- Quiz Preview -->
        <div>
          <h4 class="font-medium text-zinc-800 dark:text-zinc-200 mb-3 text-sm">
            {$_('study.quiz_preview') ?? 'Here\'s what your AI quiz could look like:'}
          </h4>
          <div class="rounded-xl border border-border bg-zinc-50/50 dark:bg-zinc-800/30 p-4 space-y-4">
            {#each SAMPLE_QUIZ as q, i}
              <div class="p-3 rounded-lg border border-border bg-card/50">
                <p class="font-medium text-foreground mb-2 text-sm">
                  {i + 1}. {q.question}
                </p>
                <div class="space-y-1">
                  {#each q.options as opt}
                    <div
                      class="flex items-center gap-2 py-1.5 px-2 rounded text-sm text-muted-foreground">
                      <span class="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600"></span>
                      {opt}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Provider-specific setup instructions (driven by the adapter). -->
        {#if true}
          {@const adapter = AIService.getProvider(activeProvider)}
          <div>
            <h4 class="font-medium text-zinc-800 dark:text-zinc-200 mb-2 text-sm">
              {`Get a ${adapter.displayName} API key (takes a minute):`}
            </h4>
            <ol class="list-decimal list-inside space-y-2 text-sm text-foreground">
              <li>
                {$_('study.go_to') || 'Go to'}
                <a
                  href={adapter.apiKeyUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-(--accent) underline font-medium hover:opacity-80">
                  {adapter.apiKeyUrl?.replace(/^https?:\/\//, '') ?? adapter.displayName}
                </a>
              </li>
              <li>{$_('study.sign_up') || 'Sign up / sign in'}</li>
              <li>{$_('study.copy_api_key') || 'Copy your API key from the dashboard'}</li>
              <li>{$_('study.paste_and_save') || 'Paste it below and click Save'}</li>
            </ol>
          </div>

          <!-- API Key Input -->
          <div>
            <Label.Root class="block text-sm font-medium text-foreground mb-2">
              {`${adapter.displayName} API Key`}
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
            class="w-full transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
            {$_('study.save_and_enable') ?? 'Save & Enable AI Quizzes'}
          </Button>
        {/if}
      </div>
    {:else}
    <!-- Config Panel -->
    <div class="p-6 space-y-6">
      {#if questions.length > 0}
        <button
          type="button"
          class="flex items-center gap-2 w-full py-2 text-sm font-medium text-muted-foreground hover:text-zinc-900 dark:hover:text-white transition-colors"
          onclick={() => (configExpanded = !configExpanded)}>
          <T key="study.change_options" fallback="Change options" />
          <Icon src={configExpanded ? ChevronUp : ChevronDown} class="w-4 h-4 shrink-0" />
        </button>
      {/if}
      {#if configExpanded || questions.length === 0}
        <div transition:slide={{ duration: 200 }}>
      <!-- Section 1: Topic source -->
      <div class="space-y-3">
        <p class="text-sm font-medium text-muted-foreground">
          <T key="study.topic_source" fallback="1. Choose topic" />
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="flex gap-2">
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {sourceMode ===
              'assessment'
                ? 'accent-bg text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
              onclick={() => {
                sourceMode = 'assessment';
                customTopic = '';
              }}>
              <T key="study.select_assessment" fallback="From assessment" />
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {sourceMode ===
              'custom'
                ? 'accent-bg text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
              onclick={() => {
                sourceMode = 'custom';
                selectedAssessment = null;
              }}>
              <T key="study.custom_topic" fallback="Custom topic" />
            </button>
          </div>
          {#if sourceMode === 'assessment'}
            <div class="flex-1 min-w-0 max-w-md">
              <button
                type="button"
                class="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm flex items-center justify-between gap-2 transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 accent-ring"
                onclick={() => (assessmentModalOpen = true)}>
                <span class="truncate">
                  {selectedAssessment?.title ?? ($_('study.select_assessment') || 'Select assessment')}
                </span>
                <Icon src={ChevronDown} class="w-4 h-4 shrink-0" />
              </button>
            </div>
          {:else}
            <div class="flex-1 min-w-0 max-w-md">
              <Input
                bind:value={customTopic}
                placeholder={$_('study.what_to_study') || 'What do you want to study?'}
                class="w-full" />
            </div>
          {/if}
        </div>
      </div>

      <Modal
            bind:open={assessmentModalOpen}
            title={$_('study.select_assessment') || 'Select assessment'}
            maxWidth="max-w-2xl"
            onclose={() => (assessmentModalOpen = false)}>
            <div class="px-8 pb-8 max-h-[70vh] flex flex-col gap-4">
              <!-- Search -->
              <div class="relative shrink-0">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Icon src={MagnifyingGlass} class="w-4 h-4" />
                </span>
                <input
                  type="text"
                  bind:value={assessmentSearchQuery}
                  placeholder={$_('study.search_assessments') || 'Search assessments...'}
                  class="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 accent-ring" />
              </div>
              <!-- Filters: Upcoming/All + Year -->
              <div class="flex flex-wrap gap-3 shrink-0">
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 {assessmentFilterUpcomingOnly
                      ? 'accent-bg text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
                    onclick={() => (assessmentFilterUpcomingOnly = true)}>
                    <T key="study.upcoming_only" fallback="Upcoming only" />
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 {!assessmentFilterUpcomingOnly
                      ? 'accent-bg text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
                    onclick={() => (assessmentFilterUpcomingOnly = false)}>
                    <T key="study.all_assessments" fallback="All" />
                  </button>
                </div>
                {#if assessmentYears.length > 0}
                  <select
                    class="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 accent-ring"
                    value={assessmentFilterYear === 'all' ? 'all' : String(assessmentFilterYear)}
                    onchange={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      assessmentFilterYear = v === 'all' ? 'all' : parseInt(v, 10);
                    }}>
                    <option value="all"><T key="directory.all_years" fallback="All years" /></option>
                    {#each assessmentYears as y}
                      <option value={y}>{y}</option>
                    {/each}
                  </select>
                {/if}
              </div>
              <div class="flex-1 min-h-0 overflow-y-auto">
              {#if filteredAssessments.length === 0}
                <p class="text-muted-foreground py-8 text-center">
                  <T key="study.no_assessments_match" fallback="No assessments match your filters." />
                </p>
              {:else}
                <div class="space-y-2">
                  {#each filteredAssessments as a}
                    <button
                      type="button"
                      class="w-full px-4 py-3 rounded-xl border border-border bg-card/50 text-left transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md focus:outline-none focus:ring-2 accent-ring {selectedAssessment?.id ===
                      a.id && selectedAssessment?.metaclass === a.metaclass
                        ? 'ring-2 accent-ring border-(--accent)'
                        : ''}"
                      onclick={() => selectAssessment(a)}>
                      <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0 flex-1">
                          <p class="font-medium text-foreground truncate">
                            {a.title}
                          </p>
                          {#if a.subject}
                            <p class="text-sm text-muted-foreground truncate">
                              {a.subject}
                            </p>
                          {/if}
                        </div>
                        <div class="shrink-0 text-sm text-muted-foreground">
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
            </div>
          </Modal>

      <!-- Section 2: Quiz options -->
      <div class="space-y-3">
        <p class="text-sm font-medium text-muted-foreground">
          <T key="study.quiz_options" fallback="2. Quiz options" />
        </p>
        <div class="flex flex-wrap gap-4 items-center">
          <!-- Difficulty (custom dropdown to match question types) -->
          <div class="flex items-center gap-2">
            <Label.Root class="text-sm text-muted-foreground whitespace-nowrap">
              <T key="study.difficulty" fallback="Difficulty" />
            </Label.Root>
            <div class="relative" use:clickOutside={() => (difficultyDropdownOpen = false)}>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm flex items-center gap-2 min-w-[100px] justify-between transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 accent-ring"
                onclick={() => (difficultyDropdownOpen = !difficultyDropdownOpen)}>
                <span>
                  {selectedDifficulty != null ? `Year ${selectedDifficulty}` : ($_('study.any_difficulty') || 'Any')}
                </span>
                <Icon src={ChevronDown} class="w-4 h-4 shrink-0 transition-transform duration-200 {difficultyDropdownOpen ? 'rotate-180' : ''}" />
              </button>
              {#if difficultyDropdownOpen}
                <div
                  class="absolute z-50 mt-1 min-w-[100px] py-1 bg-card border border-border rounded-lg shadow-lg"
                  transition:fly={{ y: -4, duration: 150 }}>
                  <button
                    type="button"
                    class="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors {selectedDifficulty === null ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium' : 'text-foreground'}"
                    onclick={() => {
                      selectedDifficulty = null;
                      difficultyDropdownOpen = false;
                    }}>
                    <T key="study.any_difficulty" fallback="Any" />
                  </button>
                  {#each [7, 8, 9, 10, 11, 12] as y}
                    {@const year = y as 7 | 8 | 9 | 10 | 11 | 12}
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors {selectedDifficulty === year ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium' : 'text-foreground'}"
                      onclick={() => {
                        selectedDifficulty = year;
                        difficultyDropdownOpen = false;
                      }}>
                      Year {year}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Question types (dropdown) -->
          <div class="flex items-center gap-2">
            <Label.Root class="text-sm text-muted-foreground whitespace-nowrap">
              <T key="study.question_types" fallback="Question types" />
            </Label.Root>
            <div class="relative" use:clickOutside={() => (questionTypesDropdownOpen = false)}>
              <button
                type="button"
                class="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm flex items-center gap-2 min-w-[180px] justify-between transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 accent-ring"
                onclick={() => (questionTypesDropdownOpen = !questionTypesDropdownOpen)}>
                <span class="truncate">
                  {#if selectedQuestionTypes.length === 3}
                    <T key="study.all_types" fallback="All types" />
                  {:else if selectedQuestionTypes.length === 0}
                    <T key="study.select_types" fallback="Select types..." />
                  {:else}
                    {selectedQuestionTypes
                      .map((t) =>
                        t === 'multiple_choice'
                          ? ($_('study.type_multiple_choice') ?? 'Multiple choice')
                          : t === 'true_false'
                            ? ($_('study.type_true_false') ?? 'True/False')
                            : ($_('study.type_short_answer') ?? 'Short answer'),
                      )
                      .join(', ')}
                  {/if}
                </span>
                <Icon src={ChevronDown} class="w-4 h-4 shrink-0 transition-transform duration-200 {questionTypesDropdownOpen ? 'rotate-180' : ''}" />
              </button>
              {#if questionTypesDropdownOpen}
                <div
                  class="absolute z-50 mt-1 min-w-[180px] py-1 bg-card border border-border rounded-lg shadow-lg"
                  transition:fly={{ y: -4, duration: 150 }}>
                  {#each ['multiple_choice', 'true_false', 'short_answer'] as t}
                    {@const type = t as 'multiple_choice' | 'true_false' | 'short_answer'}
                    <label
                      class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors duration-200">
                      <input
                        type="checkbox"
                        checked={selectedQuestionTypes.includes(type)}
                        onchange={(e) => {
                          const checked = (e.target as HTMLInputElement).checked;
                          selectedQuestionTypes = checked
                            ? [...selectedQuestionTypes, type]
                            : selectedQuestionTypes.filter((x) => x !== type);
                        }}
                        class="rounded accent-ring" />
                      <span class="text-sm text-foreground">
                        {#if type === 'multiple_choice'}
                          <T key="study.type_multiple_choice" fallback="Multiple choice" />
                        {:else if type === 'true_false'}
                          <T key="study.type_true_false" fallback="True/False" />
                        {:else}
                          <T key="study.type_short_answer" fallback="Short answer" />
                        {/if}
                      </span>
                      {#if selectedQuestionTypes.includes(type)}
                        <Icon src={Check} class="w-4 h-4 text-(--accent) ml-auto" />
                      {/if}
                    </label>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Question count -->
          <div class="flex items-center gap-2">
            <Label.Root class="text-sm text-muted-foreground whitespace-nowrap">
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
            <span class="text-sm text-muted-foreground w-8">{questionCount}</span>
          </div>
        </div>
      </div>

      <!-- Section 3: Generate -->
      <div class="space-y-3">
        <p class="text-sm font-medium text-muted-foreground">
          <T key="study.generate_section" fallback="3. Generate" />
        </p>
        <Button
          onclick={handleGenerate}
          disabled={!canGenerate || loading}
          loading={loading}
          class="transition-all duration-200 transform hover:scale-105 active:scale-95">
          <T key="study.generate_quiz" fallback="Generate Quiz" />
        </Button>
      </div>

        </div>
      {/if}

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
              {@const qType = q.type || 'multiple_choice'}
              <div
                class="p-4 rounded-xl border border-border bg-white/50 dark:bg-zinc-800/50">
                <p class="font-medium text-foreground mb-3">
                  {i + 1}. {q.question}
                </p>
                <div class="space-y-2">
                  {#if qType === 'short_answer'}
                    <input
                      type="text"
                      value={typeof userAnswers[i] === 'string' ? userAnswers[i] : ''}
                      oninput={(e) => setAnswer(i, (e.target as HTMLInputElement).value)}
                      placeholder={$_('study.type_your_answer') || 'Type your answer...'}
                      class="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 accent-ring" />
                  {:else}
                    {#each (qType === 'true_false' && (!q.options || q.options.length === 0) ? ['True', 'False'] : (q.options || [])) as opt, j}
                      <label
                        class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors duration-200">
                        <input
                          type="radio"
                          name="q{i}"
                          value={j}
                          checked={userAnswers[i] === j}
                          onchange={() => setAnswer(i, j)}
                          class="accent-ring" />
                        <span class="text-foreground">{opt}</span>
                      </label>
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}
            <Button type="submit" disabled={!allAnswersFilled}>
              <T key="study.submit_answers" fallback="Submit Answers" />
            </Button>
          </form>
        {:else}
          <!-- Results -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-foreground">
                <T key="study.raw_feedback" fallback="Results" />
              </h3>
              <div class="text-sm text-muted-foreground">
                {totalScore}/{questions.length} ({scorePercent}%)
              </div>
            </div>

            {#each questions as q, i}
              {@const score = questionScores[i] ?? 0}
              {@const correctDisplay = (q.type === 'short_answer' ? q.correctAnswer : q.options?.[q.correctIndex]) ?? ''}
              <div
                class="p-4 rounded-xl border transition-colors duration-200 {score >= 1
                  ? 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10'
                  : score >= 0.5
                    ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10'
                    : 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'}">
                <p class="font-medium text-foreground mb-2">
                  {i + 1}. {q.question}
                </p>
                <div class="flex items-center gap-2 text-sm">
                  {#if score >= 1}
                    <Icon src={CheckCircle} class="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <span class="text-green-700 dark:text-green-300"
                      >{$_('study.full_marks') ?? 'Full marks'}{#if correctDisplay}: {correctDisplay}{/if}</span
                    >
                  {:else if score >= 0.5}
                    <Icon src={CheckCircle} class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span class="text-amber-700 dark:text-amber-300"
                      >{$_('study.half_marks') ?? 'Half marks'}{#if correctDisplay} — {$_('study.model_answer') ?? 'Model'}: {correctDisplay}{/if}</span
                    >
                  {:else}
                    <Icon src={XCircle} class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                    <span class="text-red-700 dark:text-red-300">
                      {$_('study.incorrect') ?? 'Incorrect'}. {$_('study.correct_answer') ?? 'Correct'}: {correctDisplay}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}

            <!-- AI Feedback -->
            <div class="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                class="w-full px-4 py-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 hover:surface-muted transition-colors duration-200"
                onclick={() => (showAiFeedback = !showAiFeedback)}>
                <span class="font-medium text-foreground flex items-center gap-2">
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
                <div class="p-4 border-t border-border">
                  {#if loadingFeedback}
                    <p class="text-muted-foreground text-sm">
                      {$_('study.generating_feedback') ?? 'Generating feedback...'}
                    </p>
                  {:else if aiFeedback}
                    <p class="text-foreground mb-4">{aiFeedback.summary}</p>
                    {#if aiFeedback.suggestions?.length}
                      <ul class="list-disc list-inside text-sm text-muted-foreground mb-4">
                        {#each aiFeedback.suggestions as s}
                          <li>{s}</li>
                        {/each}
                      </ul>
                    {/if}
                    <p class="text-foreground italic">{aiFeedback.encouragement}</p>
                  {:else}
                    <p class="text-sm text-muted-foreground">
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
        <p class="text-muted-foreground text-center">
          <T key="study.configure_and_generate" fallback="Configure your topic and click Generate Quiz to get started." />
        </p>
      </div>
    {/if}
    {/if}
  </div>
</div>
