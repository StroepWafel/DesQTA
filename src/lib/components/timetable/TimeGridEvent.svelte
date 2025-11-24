<script lang="ts">
  let { calendarEvent } = $props();

  // Parse color from event
  // We'll store the lesson color in the event object
  const bgColor = calendarEvent.color || 'var(--sx-color-primary)';
  const textColor = calendarEvent.textColor || '#fff';
</script>

<div
  class="w-full h-full p-1 text-xs rounded-md overflow-hidden hover:opacity-90 transition-opacity border-l-4"
  style="background-color: {bgColor}33; border-left-color: {bgColor}; color: {textColor};">
  <div class="font-semibold truncate">
    {calendarEvent.title}
  </div>
  <div class="truncate opacity-80 text-[10px]">
    {calendarEvent.location}
  </div>
  {#if calendarEvent.staff}
    <div class="truncate opacity-70 text-[10px]">
      {calendarEvent.staff}
    </div>
  {/if}
</div>
