<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { DocumentText } from 'svelte-hero-icons';
  import { scale, fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';

  interface Props {
    title: string;
    message: string;
    icon?: any;
    size?: 'sm' | 'md' | 'lg';
  }

  let { title, message, icon = DocumentText, size = 'md' }: Props = $props();

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconContainerSizes = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const messageSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };
</script>

<div class="flex flex-col justify-center items-center py-12 sm:py-16">
  <div
    class="flex items-center justify-center rounded-full {iconContainerSizes[
      size
    ]} bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 shadow-lg accent-shadow transition-all duration-300 ease-in-out hover:scale-110"
    in:fly={{ y: -10, duration: 400, easing: cubicInOut }}>
    <Icon src={icon} class="{iconSizes[size]} transition-transform duration-300" />
  </div>
  <p
    class="mt-4 {titleSizes[
      size
    ]} font-semibold text-zinc-900 dark:text-white transition-opacity duration-300"
    in:fly={{ y: 10, duration: 400, delay: 100, easing: cubicInOut }}>
    {title}
  </p>
  <p
    class="mt-2 {messageSizes[
      size
    ]} text-zinc-600 dark:text-zinc-400 text-center max-w-md transition-opacity duration-300"
    in:fly={{ y: 10, duration: 400, delay: 200, easing: cubicInOut }}>
    {message}
  </p>
</div>
