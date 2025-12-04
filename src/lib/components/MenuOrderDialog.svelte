<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Bars3, ChevronUp, ChevronDown, XMark } from 'svelte-hero-icons';
  import { Button } from '$lib/components/ui';
  import T from './T.svelte';
  import { _ } from '../i18n';
  import { fly } from 'svelte/transition';

  interface MenuItem {
    labelKey: string;
    icon: any;
    path: string;
  }

  interface Props {
    open: boolean;
    menu: MenuItem[];
    onClose: () => void;
    onSave: (orderedMenu: MenuItem[]) => void;
  }

  let { open, menu, onClose, onSave }: Props = $props();

  let orderedMenu = $state([...menu]);
  let draggedIndex: number | null = $state(null);
  let dragOverIndex: number | null = $state(null);

  // Reset ordered menu when dialog opens
  $effect(() => {
    if (open) {
      orderedMenu = [...menu];
    }
  });

  function moveUp(index: number) {
    if (index > 0) {
      const newMenu = [...orderedMenu];
      [newMenu[index - 1], newMenu[index]] = [newMenu[index], newMenu[index - 1]];
      orderedMenu = newMenu;
    }
  }

  function moveDown(index: number) {
    if (index < orderedMenu.length - 1) {
      const newMenu = [...orderedMenu];
      [newMenu[index], newMenu[index + 1]] = [newMenu[index + 1], newMenu[index]];
      orderedMenu = newMenu;
    }
  }

  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      draggedIndex = null;
      dragOverIndex = null;
      return;
    }

    const newMenu = [...orderedMenu];
    const [removed] = newMenu.splice(draggedIndex, 1);
    newMenu.splice(dropIndex, 0, removed);
    orderedMenu = newMenu;

    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleSave() {
    onSave(orderedMenu);
    onClose();
  }

  function handleReset() {
    orderedMenu = [...menu];
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 transition-opacity"
    transition:fly={{ duration: 200, y: 0 }}
    onclick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="menu-order-dialog-title">
    <!-- Dialog -->
    <div
      class="relative bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
      transition:fly={{ duration: 200, y: 20 }}>
      <!-- Header -->
      <div class="flex justify-between items-center p-6 border-b border-zinc-200 dark:border-zinc-700">
        <h2
          id="menu-order-dialog-title"
          class="text-xl font-semibold text-zinc-900 dark:text-white">
          <T key="settings.reorder_pages" fallback="Reorder Pages" />
        </h2>
        <button
          onclick={onClose}
          class="p-2 text-zinc-600 rounded-lg transition-all duration-200 transform dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          aria-label={$_('common.close') || 'Close'}>
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto flex-1 p-6">
        <p class="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          <T
            key="settings.reorder_pages_description"
            fallback="Drag and drop items to reorder them, or use the arrow buttons. Changes will be saved when you click Save." />
        </p>

        <div class="space-y-2">
          {#each orderedMenu as item, index}
            {@const isDragging = draggedIndex === index}
            {@const isDragOver = dragOverIndex === index}
            <div
              draggable="true"
              ondragstart={(e) => handleDragStart(e, index)}
              ondragover={(e) => handleDragOver(e, index)}
              ondragleave={handleDragLeave}
              ondrop={(e) => handleDrop(e, index)}
              ondragend={handleDragEnd}
              class="flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 {isDragging
                ? 'opacity-50 bg-zinc-100 dark:bg-zinc-700'
                : isDragOver
                  ? 'border-accent bg-accent/10 dark:bg-accent/20'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50'}">
              <!-- Drag Handle -->
              <div class="flex-shrink-0 cursor-move text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400">
                <Icon src={Bars3} class="w-5 h-5" />
              </div>

              <!-- Icon -->
              <div class="flex-shrink-0">
                <Icon src={item.icon} class="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </div>

              <!-- Label -->
              <div class="flex-1 min-w-0">
                <T key={item.labelKey} fallback={item.labelKey} />
              </div>

              <!-- Move Buttons -->
              <div class="flex flex-shrink-0 gap-1">
                <button
                  onclick={() => moveUp(index)}
                  disabled={index === 0}
                  class="p-2 rounded-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  aria-label={$_('common.move_up') || 'Move up'}>
                  <Icon src={ChevronUp} class="w-4 h-4" />
                </button>
                <button
                  onclick={() => moveDown(index)}
                  disabled={index === orderedMenu.length - 1}
                  class="p-2 rounded-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  aria-label={$_('common.move_down') || 'Move down'}>
                  <Icon src={ChevronDown} class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-between items-center p-6 border-t border-zinc-200 dark:border-zinc-700 gap-3">
        <Button
          onclick={handleReset}
          variant="outline"
          class="transition-all duration-200 transform hover:scale-105 active:scale-95">
          <T key="common.reset" fallback="Reset" />
        </Button>
        <div class="flex gap-3">
          <Button
            onclick={onClose}
            variant="outline"
            class="transition-all duration-200 transform hover:scale-105 active:scale-95">
            <T key="common.cancel" fallback="Cancel" />
          </Button>
          <Button
            onclick={handleSave}
            class="transition-all duration-200 transform hover:scale-105 active:scale-95">
            <T key="common.save" fallback="Save" />
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

