<script lang="ts">
  import { _ } from '$lib/i18n';

  interface Props {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { message, size = 'md' }: Props = $props();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };
</script>

<div class="flex flex-col justify-center items-center py-12 sm:py-16">
  <div
    class="rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500 transition-opacity duration-200 {sizeClasses[
      size
    ]}"
    style="animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
  </div>
  <p
    class="mt-4 transition-opacity duration-200 {textSizes[size]} text-zinc-600 dark:text-zinc-400">
    {message ?? $_('common.loading')}
  </p>
</div>
