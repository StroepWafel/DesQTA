<script lang="ts">
  interface Props {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { message = 'Loading...', size = 'md' }: Props = $props();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
</script>

<div class="flex flex-col justify-center items-center py-12 sm:py-16">
  <div
    class="rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500 {sizeClasses[size]}">
  </div>
  <p class="mt-4 {textSizes[size]} text-slate-600 dark:text-slate-400">
    {message}
  </p>
</div> 