<script lang="ts">
  let { calendarEvent } = $props();
  
  // Parse color from event
  const bgColor = calendarEvent.color || 'var(--sx-color-primary)';
  const textColor = calendarEvent.textColor || '#fff';
  
  // Robust time formatter handling strings and Temporal objects
  function formatTime(val: any): string {
    if (!val) return '';
    
    try {
      // Handle Temporal objects (ZonedDateTime, PlainDateTime, etc.)
      if (typeof val === 'object' && 'hour' in val && 'minute' in val) {
        const h = val.hour.toString().padStart(2, '0');
        const m = val.minute.toString().padStart(2, '0');
        return `${h}:${m}`;
      }
      
      // Handle strings
      if (typeof val === 'string') {
        // Try standard ISO splitting (2023-01-01 10:00 OR 2023-01-01T10:00)
        if (val.includes(' ')) return val.split(' ')[1].substring(0, 5);
        if (val.includes('T')) return val.split('T')[1].substring(0, 5);
        // Maybe it's just HH:mm already?
        if (val.includes(':')) return val.substring(0, 5);
      }
      
      return '';
    } catch (e) {
      return '';
    }
  }

  const startTime = formatTime(calendarEvent.start);
  const endTime = formatTime(calendarEvent.end);
</script>

<!-- Reverted to simpler, cleaner layout without icons, but with time included -->
<div 
  class="w-full h-full p-1.5 text-sm rounded-md overflow-hidden hover:opacity-90 transition-opacity border-l-4 flex flex-col justify-start leading-tight"
  style="background-color: {bgColor}33; border-left-color: {bgColor}; color: {textColor};"
>
  <div class="font-bold truncate mb-0.5 text-sm">
    {calendarEvent.title}
  </div>
  
  <!-- Time row -->
  <div class="truncate opacity-90 text-xs mb-0.5 font-medium">
    {startTime} - {endTime}
  </div>

  {#if calendarEvent.location}
    <div class="truncate opacity-80 text-xs">
      {calendarEvent.location}
    </div>
  {/if}
  
  {#if calendarEvent.staff}
    <div class="truncate opacity-70 text-[11px]">
      {calendarEvent.staff}
    </div>
  {/if}
</div>
