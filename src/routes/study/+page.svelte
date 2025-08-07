<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';

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
    priority?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }

  let todos: TodoItem[] = [];
  let loading = true;
  let error: string | null = null;

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
    // Persist on input blur to avoid saving per keystroke
    saveTodos();
  }

  onMount(loadTodos);
</script>

<div class="container px-6 py-7 mx-auto">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Study</h1>
    <div class="flex items-center gap-3">
      <button
        class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
        on:click={addTodo}
        aria-label="Add new task">
        New Task
      </button>
      <button
        class="px-4 py-2 rounded-lg border border-slate-300 text-slate-900 dark:text-white dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
        on:click={() => { /* placeholder for timer action */ }}
        aria-label="Open Study Timer">
        Open Timer
      </button>
    </div>
  </div>

  <p class="mb-6 text-slate-600 dark:text-slate-300">Organize your study tasks, track subtasks, and set due dates. No quick links here as requested.</p>

  {#if loading}
    <div class="flex items-center justify-center h-48">
      <div class="w-12 h-12 rounded-full border-b-4 border-slate-400 animate-spin"></div>
    </div>
  {:else if error}
    <div class="py-8 text-center">
      <p class="mb-4 text-red-400">{error}</p>
      <button class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring" on:click={loadTodos}>Retry</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md" transition:fade>
        <h2 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Tasks</h2>
        <div class="space-y-4">
          {#each todos as todo (todo.id)}
            <div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 transition-all duration-200 hover:scale-[1.02]">
              <div class="flex items-center gap-3">
                <input type="checkbox" bind:checked={todo.completed} on:change={() => toggleTodo(todo.id)} class="w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle complete" />
                <input
                  class="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400"
                  placeholder="Task title"
                  bind:value={todo.title}
                  on:blur={() => { updateField(todo.id, 'title', todo.title); blurSave(); }}
                />
                <button class="px-2 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring" on:click={() => removeTodo(todo.id)} aria-label="Delete task">Delete</button>
              </div>
              <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Related subject" bind:value={todo.related_subject} on:blur={() => { updateField(todo.id, 'related_subject', todo.related_subject ?? ''); blurSave(); }} />
                <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Related assessment" bind:value={todo.related_assessment} on:blur={() => { updateField(todo.id, 'related_assessment', todo.related_assessment ?? ''); blurSave(); }} />
                <div class="flex gap-3">
                  <input type="date" class="px-3 py-2 flex-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" bind:value={todo.due_date} on:blur={() => { updateField(todo.id, 'due_date', todo.due_date ?? ''); blurSave(); }} />
                  <input type="time" class="px-3 py-2 flex-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" bind:value={todo.due_time} on:blur={() => { updateField(todo.id, 'due_time', todo.due_time ?? ''); blurSave(); }} />
                </div>
                <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Tags (comma separated)" value={(todo.tags ?? []).join(', ')} on:blur={(e) => { const val = (e.target as HTMLInputElement).value; updateField(todo.id, 'tags', val ? val.split(',').map(t => t.trim()) : []); blurSave(); }} />
                <select class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" bind:value={todo.priority} on:blur={() => { updateField(todo.id, 'priority', todo.priority ?? 'medium'); blurSave(); }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <textarea rows="3" class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring md:col-span-2" placeholder="Description" bind:value={todo.description} on:blur={() => { updateField(todo.id, 'description', todo.description ?? ''); blurSave(); }}></textarea>
              </div>

              <div class="mt-4">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-medium text-slate-900 dark:text-white">Subtasks</h3>
                  <button class="px-3 py-1 text-sm rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring" on:click={() => addSubtask(todo.id)}>Add subtask</button>
                </div>
                <div class="space-y-2">
                  {#each todo.subtasks ?? [] as sub (sub.id)}
                    <div class="flex items-center gap-3">
                      <input type="checkbox" bind:checked={sub.completed} on:change={() => toggleSubtask(todo.id, sub.id)} class="w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle subtask" />
                      <input class="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400" bind:value={sub.title} on:blur={() => { const list = (todo.subtasks ?? []).map(s => s.id === sub.id ? { ...s, title: sub.title } : s); updateField(todo.id, 'subtasks', list); blurSave(); }} />
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md" transition:fade>
        <h2 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Notes</h2>
        <p class="text-slate-600 dark:text-slate-300">Coming soon.</p>
      </div>
    </div>
  {/if}
</div> 