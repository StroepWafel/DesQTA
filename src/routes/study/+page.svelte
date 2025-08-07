<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';

  interface Subtask {
    id: string;
    title: string;
    completed: boolean;
  }

  interface TodoItem {
    id: string;
    title: string;
    description?: string | null;
    related_subject?: string | null;
    related_assessment?: string | null;
    due_date?: string | null; // YYYY-MM-DD
    due_time?: string | null; // HH:MM
    tags?: string[] | null;
    subtasks?: Subtask[] | null;
    completed: boolean;
    priority?: string | null; // low | medium | high
    created_at?: string | null;
    updated_at?: string | null;
  }

  type FilterKey = 'all' | 'today' | 'week' | 'completed';
  type SortKey = 'due' | 'priority' | 'updated';

  interface AssessmentItem {
    id: string;
    subject: string;
    title: string;
    due_date: string; // ISO date yyyy-mm-dd
    due_time?: string | null;
    status?: 'upcoming' | 'soon' | 'overdue';
    colour?: string;
  }

  let todos: TodoItem[] = [];
  let loading = true;
  let error: string | null = null;

  // UI state
  let filter: FilterKey = 'all';
  let sortBy: SortKey = 'due';
  let query = '';
  let expanded: Record<string, boolean> = {};

  // Tabs
  type TabKey = 'tasks' | 'notes';
  let activeTab: TabKey = 'tasks';

  // Upcoming assessments state (real data)
  let upcomingAssessments: AssessmentItem[] = [];
  let loadingAssessments = true;

  function computeStatusISO(dueISO: string): 'upcoming' | 'soon' | 'overdue' {
    const now = new Date();
    const due = new Date(dueISO);
    const diff = due.getTime() - now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (diff < 0) return 'overdue';
    if (diff <= 3 * dayMs) return 'soon';
    return 'upcoming';
  }

  async function loadUpcomingAssessments() {
    loadingAssessments = true;
    try {
      const cacheKey = 'upcoming_assessments_data';
      const cached = cache.get<{ assessments: any[]; subjects: any[]; filters: Record<string, boolean> }>(cacheKey);
      if (cached && Array.isArray(cached.assessments)) {
        upcomingAssessments = cached.assessments
          .filter((a: any) => new Date(a.due) >= new Date())
          .map((a: any) => {
            const d = new Date(a.due);
            const due_date = d.toISOString().split('T')[0];
            const due_time = a.due?.includes('T') ? a.due.split('T')[1]?.substring(0, 5) : null;
            return {
              id: a.id?.toString() ?? crypto.randomUUID(),
              subject: a.subject ?? a.code ?? '—',
              title: a.title ?? 'Assessment',
              due_date,
              due_time,
              status: computeStatusISO(a.due),
              colour: a.colour ?? '#8e8e8e',
            } as AssessmentItem;
          })
          .sort((a: AssessmentItem, b: AssessmentItem) => new Date(`${a.due_date}T${a.due_time ?? '00:00'}:00`).getTime() - new Date(`${b.due_date}T${b.due_time ?? '00:00'}:00`).getTime())
          .slice(0, 5);
        loadingAssessments = false;
        return;
      }

      const studentId = 69;
      const [assessmentsRes, classesRes] = await Promise.all([
        seqtaFetch('/seqta/student/assessment/list/upcoming?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: { student: studentId },
        }),
        seqtaFetch('/seqta/student/load/subjects?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {},
        }),
      ]);

      const prefsRes = await seqtaFetch('/seqta/student/load/prefs?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { request: 'userPrefs', asArray: true, user: studentId },
      });
      const colours = JSON.parse(prefsRes).payload;

      const classesJson = JSON.parse(classesRes);
      const activeClass = classesJson.payload.find((c: any) => c.active);
      const activeSubjects = activeClass ? activeClass.subjects : [];
      const activeCodes = activeSubjects.map((s: any) => s.code);

      const rawAssessments = JSON.parse(assessmentsRes).payload as any[];
      const filtered = rawAssessments
        .filter((a: any) => activeCodes.includes(a.code))
        .filter((a: any) => new Date(a.due) >= new Date())
        .map((a: any) => {
          const prefName = `timetable.subject.colour.${a.code}`;
          const c = colours.find((p: any) => p.name === prefName);
          const d = new Date(a.due);
          const due_date = d.toISOString().split('T')[0];
          const due_time = a.due?.includes('T') ? a.due.split('T')[1]?.substring(0, 5) : null;
          return {
            id: a.id?.toString() ?? crypto.randomUUID(),
            subject: a.subject ?? a.code ?? '—',
            title: a.title ?? 'Assessment',
            due_date,
            due_time,
            status: computeStatusISO(a.due),
            colour: c ? c.value : '#8e8e8e',
          } as AssessmentItem;
        })
        .sort((a: AssessmentItem, b: AssessmentItem) => new Date(`${a.due_date}T${a.due_time ?? '00:00'}:00`).getTime() - new Date(`${b.due_date}T${b.due_time ?? '00:00'}:00`).getTime())
        .slice(0, 5);

      upcomingAssessments = filtered;

      cache.set(
        'upcoming_assessments_data',
        {
          assessments: rawAssessments.map((a: any) => {
            const prefName = `timetable.subject.colour.${a.code}`;
            const c = colours.find((p: any) => p.name === prefName);
            return { ...a, colour: c ? c.value : '#8e8e8e' };
          }),
          subjects: activeSubjects,
          filters: activeSubjects.reduce((acc: Record<string, boolean>, s: any) => {
            acc[s.code] = true;
            return acc;
          }, {}),
        },
        60 * 60 * 1000
      );
    } catch (e) {
      console.error('Failed to load upcoming assessments:', e);
    } finally {
      loadingAssessments = false;
    }
  }

  async function loadTodos() {
    try {
      const result = await invoke<TodoItem[]>('load_todos');
      todos = result ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load todos';
    } finally {
      loading = false;
    }
  }

  async function saveTodos() {
    try {
      await invoke('save_todos', { todos });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save todos';
    }
  }

  function addTodo() {
    const now = new Date().toISOString();
    todos = [
      {
        id: crypto.randomUUID(),
        title: 'New task',
        description: '',
        related_subject: '',
        related_assessment: '',
        due_date: '',
        due_time: '',
        tags: [],
        subtasks: [],
        completed: false,
        priority: 'medium',
        created_at: now,
        updated_at: now
      },
      ...todos
    ];
    saveTodos();
  }

  function removeTodo(id: string) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
  }

  function toggleTodo(id: string) {
    todos = todos.map(t => {
      if (t.id === id) {
        const updated = { ...t, completed: !t.completed, updated_at: new Date().toISOString() } as TodoItem;
        return updated;
      }
      return t;
    });
    saveTodos();
  }

  function addSubtask(todoId: string) {
    todos = todos.map(t => {
      if (t.id === todoId) {
        const list = t.subtasks ? [...t.subtasks] : [];
        list.push({ id: crypto.randomUUID(), title: 'Subtask', completed: false });
        return { ...t, subtasks: list, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function toggleSubtask(todoId: string, subId: string) {
    todos = todos.map(t => {
      if (t.id === todoId) {
        const list = (t.subtasks ?? []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
        const completed = list.length > 0 && list.every(s => s.completed) ? true : t.completed;
        return { ...t, subtasks: list, completed, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function updateField<T extends keyof TodoItem>(todoId: string, field: T, value: TodoItem[T]) {
    todos = todos.map(t => (t.id === todoId ? { ...t, [field]: value, updated_at: new Date().toISOString() } as TodoItem : t));
  }

  function blurSave() {
    saveTodos();
  }

  function isToday(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  function isThisWeek(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    const day = n.getDay();
    const monday = new Date(n);
    monday.setDate(n.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return d >= monday && d <= sunday;
  }

  function priorityOrder(p?: string | null) {
    return p === 'high' ? 0 : p === 'medium' ? 1 : 2;
  }

  $: filteredSortedTodos = todos
    .filter(t => {
      if (query) {
        const q = query.toLowerCase();
        const tagStr = (t.tags ?? []).join(',').toLowerCase();
        if (!(t.title.toLowerCase().includes(q) || tagStr.includes(q))) return false;
      }
      if (filter === 'completed') return t.completed;
      if (filter === 'today') return !t.completed && isToday(t.due_date ?? undefined);
      if (filter === 'week') return !t.completed && isThisWeek(t.due_date ?? undefined);
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'due') {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      }
      if (sortBy === 'priority') return priorityOrder(a.priority) - priorityOrder(b.priority);
      const au = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bu = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bu - au;
    });

  onMount(() => {
    loadTodos();
    loadUpcomingAssessments();
  });
</script>

<div class="container px-6 py-7 mx-auto">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Study</h1>
        <p class="mt-1 text-slate-600 dark:text-slate-300">Plan, track, and focus on your upcoming work.</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="px-4 py-2 rounded-lg border border-slate-300 text-slate-900 dark:text-white dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
          on:click={() => { /* timer */ }}
          aria-label="Open Study Timer">
          Open Timer
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mt-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
      <button class="px-3 py-2 -mb-px rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 accent-ring {activeTab==='tasks' ? 'accent-bg text-white' : 'bg-transparent text-slate-700 dark:text-slate-300'}" on:click={() => activeTab='tasks'} aria-selected={activeTab==='tasks'}>Tasks</button>
      <button class="px-3 py-2 -mb-px rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 accent-ring {activeTab==='notes' ? 'accent-bg text-white' : 'bg-transparent text-slate-700 dark:text-slate-300'}" on:click={() => activeTab='notes'} aria-selected={activeTab==='notes'}>Notes</button>
    </div>
  </div>

  <!-- Main Grid: Left (Tab Content) | Right (Upcoming Assessments) -->
  <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
    <!-- Left Column: Tabbed content -->
    <div class="xl:col-span-2 space-y-6">
      {#if activeTab === 'tasks'}
        <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
          <!-- Tasks Controls moved here -->
          <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex flex-wrap gap-2">
              <button class="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='all' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='all'}>All</button>
              <button class="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='today' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='today'}>Today</button>
              <button class="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='week' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='week'}>This Week</button>
              <button class="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='completed' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='completed'}>Completed</button>
            </div>
            <div class="flex items-center gap-3">
              <button
                class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
                on:click={addTodo}
                aria-label="Add new task">
                New Task
              </button>
              <div class="relative">
                <input
                  class="pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring"
                  placeholder="Search tasks..."
                  bind:value={query}
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
              </div>
              <select class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" bind:value={sortBy}>
                <option value="due">Sort: Due Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="updated">Sort: Updated</option>
              </select>
            </div>
          </div>

          <!-- Tasks List -->
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Tasks</h2>
            <span class="text-sm text-slate-500 dark:text-slate-400">{filteredSortedTodos.length} tasks</span>
          </div>

          <div class="space-y-4">
            {#if filteredSortedTodos.length === 0}
              <div class="text-center py-10 text-slate-500 dark:text-slate-400">No tasks match your filters.</div>
            {/if}

            {#each filteredSortedTodos as todo (todo.id)}
              <div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 transition-all duration-200 hover:scale-[1.02]">
                <div class="flex items-start gap-3">
                  <input type="checkbox" bind:checked={todo.completed} on:change={() => toggleTodo(todo.id)} class="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle complete" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <input class="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium" placeholder="Task title" bind:value={todo.title} on:blur={() => { updateField(todo.id, 'title', todo.title); blurSave(); }} />
                      <span class="text-xs px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 {todo.priority==='high' ? 'accent-bg text-white border-transparent' : ''}">{todo.priority ?? 'medium'}</span>
                    </div>
                    <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Related subject" bind:value={todo.related_subject} on:blur={() => { updateField(todo.id, 'related_subject', todo.related_subject ?? ''); blurSave(); }} />
                      <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Related assessment" bind:value={todo.related_assessment} on:blur={() => { updateField(todo.id, 'related_assessment', todo.related_assessment ?? ''); blurSave(); }} />
                      <div class="flex gap-3">
                        <input type="date" class="px-3 py-2 flex-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" bind:value={todo.due_date} on:blur={() => { updateField(todo.id, 'due_date', todo.due_date ?? ''); blurSave(); }} />
                        <input type="time" class="px-3 py-2 flex-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" bind:value={todo.due_time} on:blur={() => { updateField(todo.id, 'due_time', todo.due_time ?? ''); blurSave(); }} />
                      </div>
                      <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Tags (comma separated)" value={(todo.tags ?? []).join(', ')} on:blur={(e) => { const val = (e.target as HTMLInputElement).value; updateField(todo.id, 'tags', val ? val.split(',').map(t => t.trim()) : []); blurSave(); }} />
                      <div class="flex items-center gap-2">
                        {#each todo.tags ?? [] as tag}
                          <span class="text-xs px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">{tag}</span>
                        {/each}
                      </div>
                      <div class="md:col-span-2 flex items-center justify-between">
                        <button class="px-3 py-1.5 text-sm rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring" on:click={() => addSubtask(todo.id)}>Add subtask</button>
                        <div class="flex items-center gap-2">
                          <button class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring" on:click={() => expanded[todo.id] = !expanded[todo.id]} aria-expanded={expanded[todo.id] ?? false}>{expanded[todo.id] ? 'Hide details' : 'Show details'}</button>
                          <button class="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500" on:click={() => removeTodo(todo.id)}>Delete</button>
                        </div>
                      </div>
                    </div>

                    {#if expanded[todo.id]}
                      <div class="mt-3">
                        <textarea rows="3" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Description" bind:value={todo.description} on:blur={() => { updateField(todo.id, 'description', todo.description ?? ''); blurSave(); }}></textarea>
                        <div class="mt-3 space-y-2">
                          <h3 class="text-sm font-medium text-slate-900 dark:text-white">Subtasks</h3>
                          {#if (todo.subtasks ?? []).length === 0}
                            <div class="text-sm text-slate-500 dark:text-slate-400">No subtasks yet.</div>
                          {:else}
                            <div class="space-y-2">
                              {#each todo.subtasks ?? [] as sub (sub.id)}
                                <div class="flex items-center gap-3">
                                  <input type="checkbox" bind:checked={sub.completed} on:change={() => toggleSubtask(todo.id, sub.id)} class="w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle subtask" />
                                  <input class="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400" bind:value={sub.title} on:blur={() => { const list = (todo.subtasks ?? []).map(s => s.id === sub.id ? { ...s, title: sub.title } : s); updateField(todo.id, 'subtasks', list); blurSave(); }} />
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <!-- Notes Tab Content -->
        <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Notes</h2>
            <button class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring">Create Note</button>
          </div>
          <p class="text-slate-600 dark:text-slate-300">Notes are coming soon. You’ll be able to capture ideas and study summaries next.</p>
        </div>
      {/if}
    </div>

    <!-- Right Column: Upcoming Assessments Widget -->
    <div class="space-y-6">
      <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Assessments</h2>
          <span class="text-sm text-slate-500 dark:text-slate-400">{upcomingAssessments.length}</span>
        </div>
        {#if loadingAssessments}
          <div class="flex items-center justify-center py-6">
            <div class="w-10 h-10 rounded-full border-4 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin"></div>
          </div>
        {:else}
          <div class="space-y-3">
            {#each upcomingAssessments as a (a.id)}
              <div class="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 transition-all duration-200 hover:scale-[1.02]">
                <span class="mt-1 inline-block w-2 h-2 rounded-full {a.status==='overdue' ? 'bg-red-500' : a.status==='soon' ? 'bg-yellow-500' : 'bg-emerald-500'}"></span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <div class="truncate text-slate-900 dark:text-white font-medium">{a.title}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{a.due_date}{a.due_time ? ` • ${a.due_time}` : ''}</div>
                  </div>
                  <div class="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">{a.subject}</div>
                </div>
                <button class="px-2 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring">Open</button>
              </div>
            {/each}
            {#if upcomingAssessments.length === 0}
              <div class="text-center py-6 text-slate-500 dark:text-slate-400">No upcoming assessments.</div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Focus Tips / Placeholder Widget -->
      <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Focus Tips</h2>
        <ul class="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
          <li>Break tasks into 25-minute focus sessions.</li>
          <li>Start with high-priority items due soon.</li>
          <li>Keep your task titles clear and specific.</li>
        </ul>
      </div>
    </div>
  </div>
</div> 