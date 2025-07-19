<script lang="ts">
  interface Props {
    title: string;
    message: string;
    icon?: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { title, message, icon = '🎉', size = 'md' }: Props = $props();

  const iconSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  };

  const messageSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
</script>

<div class="flex flex-col justify-center items-center py-12 sm:py-16">
  <div
    class="flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl sm:text-3xl shadow-[0_0_20px_rgba(99,102,241,0.3)] animate-gradient {iconSizes[size]}">
    {icon}
  </div>
  <p class="mt-4 {titleSizes[size]} text-slate-700 dark:text-slate-300">
    {title}
  </p>
  <p class="mt-2 {messageSizes[size]} text-slate-600 dark:text-slate-400">
    {message}
  </p>
</div> 