<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Star } from 'svelte-hero-icons';

  interface Props {
    rating: number;
    maxRating?: number;
    interactive?: boolean;
    disabled?: boolean;
    onRatingChange?: (rating: number) => void;
  }

  let { rating, maxRating = 5, interactive = false, disabled = false, onRatingChange }: Props = $props();

  let hoveredRating = $state(0);

  function handleClick(value: number) {
    if (!interactive || disabled || !onRatingChange) return;
    onRatingChange(value);
  }

  function handleMouseEnter(value: number) {
    if (!interactive || disabled) return;
    hoveredRating = value;
  }

  function handleMouseLeave() {
    if (!interactive || disabled) return;
    hoveredRating = 0;
  }

  function isStarFilled(index: number): boolean {
    const displayRating = hoveredRating || rating;
    return index < displayRating;
  }
</script>

<div class="flex items-center gap-1">
  {#each Array(maxRating) as _, i}
    <button
      type="button"
      class="focus:outline-none transition-all duration-200 {interactive && !disabled
        ? 'transform hover:scale-110 cursor-pointer'
        : 'cursor-default'}"
      disabled={!interactive || disabled}
      onmouseenter={() => handleMouseEnter(i + 1)}
      onmouseleave={handleMouseLeave}
      onclick={() => handleClick(i + 1)}>
      <Icon
        src={Star}
        class="w-6 h-6 transition-colors duration-200 {isStarFilled(i)
          ? 'text-yellow-500 fill-current'
          : 'text-zinc-300 dark:text-zinc-600'}" />
    </button>
  {/each}
  {#if rating > 0}
    <span class="ml-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
      {rating} {rating === 1 ? 'star' : 'stars'}
    </span>
  {/if}
</div>
